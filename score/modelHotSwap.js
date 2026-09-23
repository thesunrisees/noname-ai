/* ================= 决策积分引擎 · 模型热更新 =================
 * 流程：
 *   ① 攒够样本 → 触发训练，训练结果存为"候选"
 *   ② 候选跑 A/B 测试（N 局）
 *   ③ 胜率超过旧模型 → 自动替换；否则丢弃
 *   ④ 全程无需重启，运行时热替换权重
 */
import { log } from './logger.js';

const STORE_KEY = 'djsc_hotswap_v1';
const VERSION = 1;
const MIN_SAMPLES = 300;
const MIN_AB_GAMES = 20;
const PROMOTE_GAP = 0.05;

let STORE = {
    v: VERSION,
    candidate: null,
    ab: { scores: [], oldScores: [] },
    promoted: 0,
    discarded: 0,
};
let _loaded = false;

function _load() {
    try {
        if (_loaded) return;
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) {
            const obj = JSON.parse(raw);
            if (obj && obj.v === VERSION) STORE = obj;
        }
        _loaded = true;
    } catch (e) { _loaded = true; }
}
function _save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(STORE)); } catch (e) {}
}

export async function triggerHotTrain() {
    try {
        _load();
        const te = window.__DJSC && window.__DJSC.__trainExportModule;
        const wm = window.__DJSC && window.__DJSC.__weightsModule;
        if (!te || !wm || !te.bufferSize || !wm.trainOne) {
            log.warn('hotswap', '训练模块或权重模块未挂载');
            return { ok: false, err: '模块缺失' };
        }

        const sampleN = te.bufferSize();
        if (sampleN < MIN_SAMPLES) {
            return { ok: false, err: '样本不足（' + sampleN + '/' + MIN_SAMPLES + '）' };
        }

        const oldSnapshot = _snapshotWeights(wm);
        const candidateSnapshot = _cloneSnapshot(oldSnapshot);
        await _trainOnSnapshot(candidateSnapshot, te, wm);

        STORE.candidate = {
            weights: candidateSnapshot,
            meta: { createdAt: Date.now(), samples: sampleN },
            ab: { scores: [] },
        };
        _save();
        log.info('hotswap', '候选模型已生成（样本 ' + sampleN + '），进入 A/B 测试期');
        return { ok: true, samples: sampleN };
    } catch (e) {
        return { ok: false, err: e.message };
    }
}

function _snapshotWeights(wm) {
    return {
        w1: wm.__getW1 ? Array.from(wm.__getW1()) : null,
        b1: wm.__getB1 ? Array.from(wm.__getB1()) : null,
        w2: wm.__getW2 ? Array.from(wm.__getW2()) : null,
        b2: wm.__getB2 ? Array.from(wm.__getB2()) : null,
    };
}
function _cloneSnapshot(s) {
    return {
        w1: s.w1 ? s.w1.slice() : null,
        b1: s.b1 ? s.b1.slice() : null,
        w2: s.w2 ? s.w2.slice() : null,
        b2: s.b2 ? s.b2.slice() : null,
    };
}

async function _trainOnSnapshot(snapshot, te, wm) {
    try {
        const samples = te.getSamples ? te.getSamples() : (te.drain ? te.drain() : []);
        if (!samples || !samples.length) return;

        const lr = 0.02;
        const EPOCHS = 3;
        for (let ep = 0; ep < EPOCHS; ep++) {
            for (const s of samples) {
                /* 兼容两种格式：{ f: features, r: reward } 和 { features: features, label: label } */
                const feats = s.f || s.features;
                const label = (s.r !== undefined) ? s.r : s.label;
                if (!feats || label === undefined) continue;
                _trainOnSnapshotOne(snapshot, feats, label, lr);
            }
        }
    } catch (e) {}
}

function _trainOnSnapshotOne(snapshot, features, label, lr) {
    try {
        const I = 96, H = 64, O = 6;
        const SCALE = 32;
        /* label 可能是 reward（连续值），转换成离散类别标签 */
        let cls;
        if (typeof label === 'number') {
            if (label >= 2) cls = 0;       /* 高分 → A */
            else if (label >= 1) cls = 1;  /* 中高 → B */
            else if (label >= 0) cls = 2;  /* 中等 → C */
            else if (label >= -1) cls = 3; /* 中低 → D */
            else cls = 4;                  /* 低分 → E/F */
        } else {
            cls = Math.max(0, Math.min(5, label | 0));
        }
        const hidden = new Float32Array(H);
        for (let j = 0; j < H; j++) {
            let sum = 0;
            for (let i = 0; i < I; i++) sum += (snapshot.w1[j * I + i] / SCALE) * (features[i] / 127);
            sum += snapshot.b1[j] / SCALE;
            hidden[j] = sum > 0 ? sum : 0;
        }
        const logits = new Float32Array(O);
        for (let k = 0; k < O; k++) {
            let sum = 0;
            for (let j = 0; j < H; j++) sum += (snapshot.w2[k * H + j] / SCALE) * hidden[j];
            sum += snapshot.b2[k] / SCALE;
            logits[k] = sum;
        }
        let max = -Infinity;
        for (let i = 0; i < O; i++) if (logits[i] > max) max = logits[i];
        const exps = new Float32Array(O);
        let total = 0;
        for (let i = 0; i < O; i++) { exps[i] = Math.exp(logits[i] - max); total += exps[i]; }
        const probs = new Float32Array(O);
        for (let i = 0; i < O; i++) probs[i] = exps[i] / total;

        const dLogits = new Float32Array(O);
        for (let k = 0; k < O; k++) dLogits[k] = probs[k] - (k === cls ? 1 : 0);

        const dHidden = new Float32Array(H);
        for (let j = 0; j < H; j++) {
            let sum = 0;
            for (let k = 0; k < O; k++) sum += dLogits[k] * (snapshot.w2[k * H + j] / SCALE);
            dHidden[j] = hidden[j] > 0 ? sum : 0;
        }
        for (let k = 0; k < O; k++) {
            for (let j = 0; j < H; j++) {
                snapshot.w2[k * H + j] = _clamp(snapshot.w2[k * H + j] - Math.round(dLogits[k] * hidden[j] * lr * SCALE));
            }
            snapshot.b2[k] = _clamp(snapshot.b2[k] - Math.round(dLogits[k] * lr * SCALE));
        }
        for (let j = 0; j < H; j++) {
            for (let i = 0; i < I; i++) {
                snapshot.w1[j * I + i] = _clamp(snapshot.w1[j * I + i] - Math.round(dHidden[j] * (features[i] / 127) * lr * SCALE));
            }
            snapshot.b1[j] = _clamp(snapshot.b1[j] - Math.round(dHidden[j] * lr * SCALE));
        }
    } catch (e) {}
}
function _clamp(v) {
    if (v > 127) return 127;
    if (v < -127) return -127;
    return v | 0;
}

export function hotRecordABScore(score) {
    try {
        _load();
        if (!STORE.candidate) return;
        STORE.candidate.ab.scores.push(score);
        _save();
        if (STORE.candidate.ab.scores.length >= MIN_AB_GAMES) {
            _tryPromote();
        }
    } catch (e) {}
}

function _tryPromote() {
    try {
        const cand = STORE.candidate;
        if (!cand) return;
        const candAvg = _avg(cand.ab.scores);
        const oldAvg = _baselineAvg();
        const gap = candAvg - oldAvg;

        if (gap >= PROMOTE_GAP) {
            const wm = window.__DJSC.__weightsModule;
            if (wm && wm.__applySnapshot) {
                wm.__applySnapshot(cand.weights);
                wm.saveWeights && wm.saveWeights();
            }
            STORE.promoted++;
            STORE.candidate = null;
            _save();
            log.info('hotswap', '候选模型已晋升（胜率 +' + (gap * 100).toFixed(1) + '%），共晋升 ' + STORE.promoted + ' 次');
        } else {
            STORE.discarded++;
            STORE.candidate = null;
            _save();
            log.info('hotswap', '候选模型被丢弃（差距 ' + (gap * 100).toFixed(1) + '% < 5%）');
        }
    } catch (e) {}
}

function _avg(arr) {
    if (!arr || !arr.length) return 0;
    let s = 0;
    for (const x of arr) s += x;
    return s / arr.length;
}

function _baselineAvg() {
    try {
        const ar = window.__DJSC.getArchive ? window.__DJSC.getArchive() : [];
        const recent = ar.slice(-MIN_AB_GAMES);
        if (!recent.length) return 0;
        let s = 0;
        recent.forEach(function (g) { s += (g.myScore || 0); });
        return s / recent.length;
    } catch (e) { return 0; }
}

export function forcePromote() {
    try {
        _load();
        if (!STORE.candidate) return false;
        const wm = window.__DJSC.__weightsModule;
        if (wm && wm.__applySnapshot) {
            wm.__applySnapshot(STORE.candidate.weights);
            wm.saveWeights && wm.saveWeights();
        }
        STORE.promoted++;
        STORE.candidate = null;
        _save();
        return true;
    } catch (e) { return false; }
}
export function forceDiscard() {
    try {
        _load();
        if (!STORE.candidate) return false;
        STORE.discarded++;
        STORE.candidate = null;
        _save();
        return true;
    } catch (e) { return false; }
}

export function hotSwapStats() {
    _load();
    const te = window.__DJSC && window.__DJSC.__trainExportModule;
    const bufN = te && te.bufferSize ? te.bufferSize() : 0;
    return {
        samples: bufN,
        hasCandidate: !!STORE.candidate,
        candidateSamples: STORE.candidate ? STORE.candidate.meta.samples : 0,
        candidateAge: STORE.candidate ? Math.round((Date.now() - STORE.candidate.meta.createdAt) / 1000) : 0,
        abScores: STORE.candidate ? STORE.candidate.ab.scores.slice() : [],
        abProgress: STORE.candidate ? STORE.candidate.ab.scores.length + '/' + MIN_AB_GAMES : '0/0',
        promoted: STORE.promoted,
        discarded: STORE.discarded,
        MIN_SAMPLES: MIN_SAMPLES,
        MIN_AB_GAMES: MIN_AB_GAMES,
    };
}

export function resetHotSwap() {
    STORE = { v: VERSION, candidate: null, ab: { scores: [], oldScores: [] }, promoted: 0, discarded: 0 };
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
}

if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.hotSwap = {
        trigger: triggerHotTrain,
        recordScore: hotRecordABScore,
        promote: forcePromote,
        discard: forceDiscard,
        stats: hotSwapStats,
        reset: resetHotSwap,
        MIN_SAMPLES: MIN_SAMPLES,
        MIN_AB_GAMES: MIN_AB_GAMES,
    };
}
_load();
