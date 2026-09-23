/* ================= 决策点自动发现 · 影子模式 =================
 * 包装所有 choose* 接口，不接管，只对比。
 * 原生 AI 选的和模型选的差 > 20 分 → 记一次后悔。
 */

import { lib, game, get } from '../../../noname.js';
import { DECISION_REGISTRY } from '../analysis/decisionRegistry.js';
import { getWeights, getBias, isReady } from '../core/weights.js';
import { FEATURE_DIM } from '../core/features.js';
import { log } from '../core/logger.js';

const DJSC_SHADOW = '__djsc_shadow_orig';
const STORAGE_KEY = 'djsc_auto_discover';
const SKIP = new Set(['chooseToPlayBeatmap', 'chooseToMoveCardInBoard']);

let REGRET = {};
try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) REGRET = JSON.parse(raw) || {};
} catch (e) {}

function saveRegret() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(REGRET)); } catch (e) {}
}

/* ========== 候选提取 ========== */
function extractCandidates(args) {
    try {
        for (let i = 0; i < args.length; i++) {
            const a = args[i];
            if (!Array.isArray(a) || a.length < 2 || a.length > 100) continue;
            const first = a[0];
            if (!first) continue;
            if (typeof first === 'string') return { type: 'card', list: a };
            if (first.hp !== undefined) return { type: 'target', list: a };
            if (first.name && first.suit !== undefined) return { type: 'card', list: a };
            if (first.skill || first.link) return { type: 'button', list: a };
        }
    } catch (e) {}
    return null;
}

/* ========== 特征 + 评分 ========== */
function buildFeature(me, type, cand) {
    const f = new Int8Array(FEATURE_DIM);
    try {
        if (type === 'card') {
            f[32] = 127;
            const name = typeof cand === 'string' ? cand : (cand.name || '');
            if (['sha','juedou','huogong','nanman','wanjian'].indexOf(name) >= 0) f[36] = 127;
            if (['shan','tao','wuxie','jiu'].indexOf(name) >= 0) f[37] = 127;
            if (name === 'sha') f[39] = 127;
            if (name === 'tao') f[40] = 127;
        } else if (type === 'target') {
            let isAlly = false;
            try { if (get.attitude(me, cand) > 0) isAlly = true; } catch (e) {}
            f[42] = isAlly ? 127 : 0;
            f[43] = isAlly ? 0 : 127;
            f[44] = Math.round(((cand.hp || 0) / Math.max(1, cand.maxHp || 1)) * 127);
        } else if (type === 'button') {
            f[33] = 127;
        }
    } catch (e) {}
    return f;
}

function shadowScore(me, candInfo) {
    if (!isReady()) return null;
    const W = getWeights(), B = getBias();
    const out = [];
    for (let i = 0; i < candInfo.list.length; i++) {
        const f = buildFeature(me, candInfo.type, candInfo.list[i]);
        let sum = B;
        for (let j = 0; j < FEATURE_DIM; j++) sum += W[j] * f[j];
        out.push({ idx: i, value: candInfo.list[i], score: sum });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
}

/* ========== 记录后悔 ========== */
function recordRegret(name, diff, nativePick, modelPick) {
    const s = REGRET[name] || { count: 0, totalDiff: 0, lastDiff: 0, samples: [] };
    s.count++;
    s.totalDiff += diff;
    s.lastDiff = diff;
    s.samples.push({
        native: String(nativePick).slice(0, 20),
        model: String(modelPick).slice(0, 20),
        diff: diff,
    });
    if (s.samples.length > 5) s.samples.shift();
    REGRET[name] = s;
    saveRegret();
}

/* ========== 安装影子 ========== */
export function installAutoDiscover() {
    const proto = lib.element && lib.element.Player && lib.element.Player.prototype;
    if (!proto) return false;
    if (proto[DJSC_SHADOW]) return true;

    const orig = {};
    proto[DJSC_SHADOW] = orig;
    let count = 0;

    for (const key in proto) {
        if (!key.startsWith('choose') || typeof proto[key] !== 'function') continue;
        if (key.endsWith('Begin')) continue;
        if (SKIP.has(key)) continue;

        orig[key] = proto[key];
        proto[key] = (function (name, fn) {
            return function () {
                const me = this, args = arguments;
                let result;
                try { result = fn.apply(me, args); } catch (e) { return null; }
                try {
                    if (isReady()) {
                        const ci = extractCandidates(args);
                        if (ci) {
                            const scores = shadowScore(me, ci);
                            if (scores && scores.length >= 2) {
                                const ni = ci.list.indexOf(result);
                                if (ni >= 0) {
                                    const entry = scores.find(function (s) { return s.idx === ni; });
                                    if (entry) {
                                        const diff = scores[0].score - entry.score;
                                        if (diff > 20) recordRegret(name, diff, result, scores[0].value);
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {}
                return result;
            };
        })(key, proto[key]);
        count++;
    }
    try { log.info('discover', '影子扫描已挂载 ' + count + ' 个接口'); } catch (e) {}
    return true;
}

/* ========== 自动注册 ========== */
export function promoteHighRegretPoints() {
    const promoted = [];
    for (const name in REGRET) {
        if (DECISION_REGISTRY[name]) continue;
        const s = REGRET[name];
        if (s.count < 5) continue;
        const avgDiff = s.totalDiff / s.count;
        if (avgDiff < 30) continue;
        DECISION_REGISTRY[name] = {
            name: '自动发现·' + name,
            trust: 0.2,
            category: 'auto',
            input: name.indexOf('Target') >= 0 ? 'target'
                 : name.indexOf('Button') >= 0 ? 'button' : 'card',
            output: 'single',
            desc: '自动发现（后悔值 ' + Math.round(avgDiff) + '）',
            autoDiscovered: true,
            skip: false,
        };
        promoted.push(name);
    }
    if (promoted.length) {
        try { log.info('discover', '自动注册 ' + promoted.length + ' 个：' + promoted.join(', ')); } catch (e) {}
    }
    return promoted;
}

export function getRegretStats() { return JSON.parse(JSON.stringify(REGRET)); }
export function resetRegretStats() { REGRET = {}; saveRegret(); }

if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.discover = {
        install: installAutoDiscover,
        promote: promoteHighRegretPoints,
        getStats: getRegretStats,
        reset: resetRegretStats,
    };
}
