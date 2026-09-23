/* ================= 决策积分引擎 · 决策结果回填 + 自动校准 =================
 * 流程：
 *   ① 每次决策记录 pending（规则选择 vs 模型选择）
 *   ② 1500ms 后观察真实结果（HP/手牌/是否击杀）
 *   ③ 判定谁更优 → 调整规则权重 + 模型信任度
 *   ④ 边界保护：单次调整 ≤ 0.05，累计偏差 ≤ 0.3
 */
import { lib, game, get, _status } from '../../../noname.js';
import { log } from './logger.js';

const STORE_KEY = 'djsc_calibrator_v1';
const OBSERVE_DELAY = 1500;
const SINGLE_STEP = 0.03;
const BOUNDARY = 0.3;
const LR_DECAY = 0.95;

let PENDING = [];
let STATS = {
    total: 0, ruleWin: 0, modelWin: 0, tie: 0,
    lr: 1.0,
    shift: { atk: 0, def: 0, wAtkCard: 0, wDefCard: 0, modelTrust: 0 },
};
let _loaded = false;

function _load() {
    try {
        if (_loaded) return;
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) {
            const obj = JSON.parse(raw);
            if (obj && obj.v === 1) STATS = Object.assign(STATS, obj);
        }
        _loaded = true;
    } catch (e) { _loaded = true; }
}
function _save() {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify({
            v: 1, total: STATS.total, ruleWin: STATS.ruleWin,
            modelWin: STATS.modelWin, tie: STATS.tie,
            lr: STATS.lr, shift: STATS.shift,
        }));
    } catch (e) {}
}

/* ================= 记录一次决策 ================= */
export function recordDecisionForCalibration(ruleBest, modelPick, context) {
    try {
        if (!ruleBest || !modelPick) return;
        const me = (context && context.me) || (_status && _status.currentPhase) || game.me;
        if (!me) return;

        const ruleLabel = _labelOf(ruleBest);
        const modelLabel = modelPick.label;
        if (ruleLabel === modelLabel) return;

        let tgtObj = null;
        if (ruleBest.target) {
            for (const p of (game.players || [])) {
                if (!p) continue;
                if ((p.name1 || p.name || '') === ruleBest.target) { tgtObj = p; break; }
            }
        }

        PENDING.push({
            ts: Date.now(),
            me: me,
            meKey: me.name1 || me.name || '?',
            rule: { label: ruleLabel, action: ruleBest.id, score: ruleBest.score, target: tgtObj },
            model: { label: modelLabel, confidence: modelPick.confidence },
            ctx: context,
            snap: {
                meHp: me.hp || 0,
                meHand: me.countCards ? me.countCards('h') : 0,
                tgtHp: tgtObj ? (tgtObj.hp || 0) : null,
                tgtHand: tgtObj && tgtObj.countCards ? tgtObj.countCards('h') : null,
                score: _currentScore(me),
            },
        });

        setTimeout(_evaluateAll, OBSERVE_DELAY);
    } catch (e) {}
}

function _labelOf(best) {
    try {
        if (!best) return 'A';
        if (best.type === 'skill') return 'F';
        if (best.type === 'equip') return 'E';
        if (best.type === 'end') return 'C';
        const id = best.id;
        if (['sha','juedou','huogong','nanman','wanjian','zhujin','shunshou','guohe','tiesuo','lebu','bingliang'].indexOf(id) >= 0) return 'D';
        if (['shan','tao','wuxie','jiu'].indexOf(id) >= 0) return 'C';
        return 'B';
    } catch (e) { return 'A'; }
}

function _currentScore(me) {
    try {
        const rd = window.__DJSC && window.__DJSC.getRound ? window.__DJSC.getRound() : {};
        return rd[me.name1 || me.name] || 0;
    } catch (e) { return 0; }
}

/* ================= 评估一次观察 ================= */
function _evaluateOne(p) {
    try {
        if (!p || !p.me) return;
        const me = p.me;
        const tgt = p.rule.target;

        const hpDelta = (me.hp || 0) - p.snap.meHp;
        const handDelta = (me.countCards ? me.countCards('h') : 0) - p.snap.meHand;
        const scoreDelta = _currentScore(me) - p.snap.score;

        let tgtHpDelta = 0, tgtHandDelta = 0;
        if (tgt) {
            tgtHpDelta = (tgt.hp || 0) - (p.snap.tgtHp || 0);
            tgtHandDelta = (tgt.countCards ? tgt.countCards('h') : 0) - (p.snap.tgtHand || 0);
        }

        let gain = 0;
        gain += hpDelta * 2;
        gain += handDelta * 0.8;

        let tgtIsEnemy = false;
        try {
            if (tgt && get.attitude(me, tgt) < 0) tgtIsEnemy = true;
        } catch (e) {}
        if (tgtIsEnemy) {
            gain += (-tgtHpDelta) * 2.5;
            gain += (-tgtHandDelta) * 0.6;
        } else if (tgt) {
            gain += tgtHpDelta * 1.5;
        }

        gain += scoreDelta * 0.5;

        if (gain > 0.5) {
            STATS.ruleWin++;
            _applyShift(+1);
        } else if (gain < -0.5) {
            STATS.modelWin++;
            _applyShift(-1);
        } else {
            STATS.tie++;
        }
        STATS.total++;

        STATS.lr = Math.max(0.3, STATS.lr * LR_DECAY);

        _save();
    } catch (e) {}
}

function _evaluateAll() {
    try {
        const now = Date.now();
        const keep = [];
        for (const p of PENDING) {
            if (now - p.ts < OBSERVE_DELAY) { keep.push(p); continue; }
            _evaluateOne(p);
        }
        PENDING = keep;
    } catch (e) {}
}

/* ================= 应用权重偏移 ================= */
function _applyShift(dir) {
    try {
        const step = SINGLE_STEP * STATS.lr * dir;
        STATS.shift.atk        = _clamp(STATS.shift.atk + step * 0.5);
        STATS.shift.def        = _clamp(STATS.shift.def + step * 0.5);
        STATS.shift.wAtkCard   = _clamp(STATS.shift.wAtkCard + step * 0.4);
        STATS.shift.wDefCard   = _clamp(STATS.shift.wDefCard + step * 0.4);
        STATS.shift.modelTrust = _clamp(STATS.shift.modelTrust - step * 0.6);
    } catch (e) {}
}
function _clamp(v) {
    if (v > BOUNDARY) return BOUNDARY;
    if (v < -BOUNDARY) return -BOUNDARY;
    return Math.round(v * 1000) / 1000;
}

/* ================= 对外接口 ================= */
export function getCalibratedWeights() {
    _load();
    return Object.assign({}, STATS.shift);
}
export function getLearningRate() {
    _load();
    return STATS.lr;
}
export function getModelTrustShift() {
    _load();
    return STATS.shift.modelTrust;
}
export function calibratorStats() {
    _load();
    return {
        total: STATS.total,
        ruleWin: STATS.ruleWin,
        modelWin: STATS.modelWin,
        tie: STATS.tie,
        winRate: STATS.total > 0 ? Math.round(STATS.ruleWin / STATS.total * 100) + '%' : '0%',
        lr: Math.round(STATS.lr * 1000) / 1000,
        shift: Object.assign({}, STATS.shift),
        pending: PENDING.length,
    };
}
export function resetCalibrator() {
    PENDING = [];
    STATS = { total: 0, ruleWin: 0, modelWin: 0, tie: 0, lr: 1.0, shift: { atk: 0, def: 0, wAtkCard: 0, wDefCard: 0, modelTrust: 0 } };
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    log.info('calibrator', '自动校准器已复位');
}

/* ================= 挂载全局 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.calibrator = {
        record: recordDecisionForCalibration,
        weights: getCalibratedWeights,
        lr: getLearningRate,
        modelTrust: getModelTrustShift,
        stats: calibratorStats,
        reset: resetCalibrator,
    };
}
_load();
