/*
 * ============================================
 * // 作者：飛昇原創
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 多档案协同 =================
 * 目标：多个 AI 性格档案（激进/保守/均衡等）共享校准数据，互相学习。
 * 机制：
 *   ① 每个档案独立维护自己的校准偏移
 *   ② 按档案胜负率定期"投票"融合 → 全局最优偏移
 *   ③ 档案间可主动复制对方的高胜率偏移（模仿学习）
// Autor: Feisheng Original | Licença: GPL-3.0
 */
import { log } from './logger.js';

const STORE_KEY = 'djsc_multi_profile_v1';
const MAX_PROFILES = 8;
const FUSE_THRESHOLD = 3;

let STORE = { v: 1, profiles: {}, global: { shift: {}, winRate: 0, samples: 0 }, currentKey: 'balanced' };
let _loaded = false;

function _load() {
    try {
        if (_loaded) return;
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) {
            const obj = JSON.parse(raw);
            if (obj && obj.v === 1) STORE = obj;
        }
        _loaded = true;
    } catch (e) { _loaded = true; }
}
function _save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(STORE)); } catch (e) {}
}

export function registerProfile(key, meta) {
    try {
        if (!key) return;
        _load();
        if (!STORE.profiles[key]) {
            STORE.profiles[key] = {
                key: key,
                meta: meta || { label: key },
                shift: { atk: 0, def: 0, wAtkCard: 0, wDefCard: 0, modelTrust: 0 },
                winRate: 0,
                samples: 0,
                lastFuse: 0,
                created: Date.now(),
            };
        } else if (meta) {
            STORE.profiles[key].meta = Object.assign(STORE.profiles[key].meta, meta);
        }
        _save();
    } catch (e) {}
}

export function setCurrentProfile(key) {
    try {
        _load();
        if (STORE.profiles[key]) {
            STORE.currentKey = key;
            _save();
            log.info('multiProfile', '当前档案切换为：' + key);
        }
    } catch (e) {}
}

export function getCurrentProfile() {
    _load();
    return STORE.profiles[STORE.currentKey] || null;
}

export function updateProfileShift(key, patch) {
    try {
        _load();
        const p = STORE.profiles[key];
        if (!p || !patch) return;
        Object.keys(patch).forEach(function (k) {
            if (typeof patch[k] === 'number') {
                p.shift[k] = Math.max(-0.3, Math.min(0.3, patch[k]));
            }
        });
        _save();
    } catch (e) {}
}

export function recordProfileResult(key, win, sampleDelta) {
    try {
        _load();
        const p = STORE.profiles[key];
        if (!p) return;
        const s = sampleDelta || 1;
        const prevTotal = p.samples;
        p.samples += s;
        p.winRate = prevTotal > 0
            ? (p.winRate * prevTotal + (win ? 1 : 0) * s) / p.samples
            : (win ? 1 : 0);
        _save();
        if (p.samples - p.lastFuse >= FUSE_THRESHOLD) {
            _fuseProfiles();
            p.lastFuse = p.samples;
            _save();
        }
    } catch (e) {}
}

function _fuseProfiles() {
    try {
        _load();
        const keys = Object.keys(STORE.profiles);
        if (!keys.length) return;

        let totalWeight = 0;
        const accum = { atk: 0, def: 0, wAtkCard: 0, wDefCard: 0, modelTrust: 0 };
        keys.forEach(function (k) {
            const p = STORE.profiles[k];
            let w = p.samples > 0 ? p.winRate : 0.5;
            if (w < 0.4) w *= 0.5;
            else if (w > 0.6) w *= 1.5;
            w *= Math.sqrt(Math.max(1, p.samples) / 10);
            if (w <= 0) return;
            totalWeight += w;
            accum.atk        += p.shift.atk * w;
            accum.def        += p.shift.def * w;
            accum.wAtkCard   += p.shift.wAtkCard * w;
            accum.wDefCard   += p.shift.wDefCard * w;
            accum.modelTrust += p.shift.modelTrust * w;
        });
        if (totalWeight <= 0) return;

        const fused = {};
        Object.keys(accum).forEach(function (k) {
            fused[k] = Math.round((accum[k] / totalWeight) * 1000) / 1000;
        });
        STORE.global.shift = fused;
        STORE.global.samples = keys.reduce(function (s, k) { return s + (STORE.profiles[k].samples || 0); }, 0);
        STORE.global.winRate = keys.reduce(function (s, k) {
            return s + (STORE.profiles[k].winRate || 0) * (STORE.profiles[k].samples || 0);
        }, 0) / Math.max(1, STORE.global.samples);

        log.info('multiProfile', '档案已融合：' + keys.length + ' 个，全局胜率 ' +
                 (STORE.global.winRate * 100).toFixed(1) + '%');
    } catch (e) {}
}

export function imitateBest(currentKey) {
    try {
        _load();
        const me = STORE.profiles[currentKey];
        if (!me) return null;

        let best = null, bestWr = me.winRate || 0;
        Object.keys(STORE.profiles).forEach(function (k) {
            if (k === currentKey) return;
            const p = STORE.profiles[k];
            if (p.samples < 3) return;
            if ((p.winRate || 0) > bestWr + 0.1) {
                bestWr = p.winRate;
                best = p;
            }
        });
        if (!best) return null;

        const blended = {};
        Object.keys(me.shift).forEach(function (k) {
            blended[k] = Math.round((me.shift[k] * 0.7 + best.shift[k] * 0.3) * 1000) / 1000;
        });
        me.shift = blended;
        _save();
        log.info('multiProfile', currentKey + ' 模仿 ' + best.key + ' 成功（胜率 ' +
                 (best.winRate * 100).toFixed(1) + '%）');
        return best.key;
    } catch (e) { return null; }
}

export function getEffectiveShift() {
    try {
        _load();
        const p = STORE.profiles[STORE.currentKey];
        const g = STORE.global.shift;
        if (!p && !g) return { atk: 0, def: 0, wAtkCard: 0, wDefCard: 0, modelTrust: 0 };
        const out = {};
        ['atk', 'def', 'wAtkCard', 'wDefCard', 'modelTrust'].forEach(function (k) {
            const pv = (p && p.shift && p.shift[k]) || 0;
            const gv = (g && g[k]) || 0;
            out[k] = Math.round((pv * 0.5 + gv * 0.5) * 1000) / 1000;
        });
        return out;
    } catch (e) { return { atk: 0, def: 0, wAtkCard: 0, wDefCard: 0, modelTrust: 0 }; }
}

export function listProfiles() {
    _load();
    return Object.keys(STORE.profiles).map(function (k) {
        const p = STORE.profiles[k];
        return {
            key: k,
            label: (p.meta && p.meta.label) || k,
            winRate: Math.round((p.winRate || 0) * 1000) / 1000,
            samples: p.samples || 0,
            shift: Object.assign({}, p.shift),
        };
    });
}

export function multiProfileStats() {
    _load();
    return {
        currentKey: STORE.currentKey,
        profileCount: Object.keys(STORE.profiles).length,
        global: {
            shift: Object.assign({}, STORE.global.shift),
            winRate: Math.round((STORE.global.winRate || 0) * 1000) / 1000,
            samples: STORE.global.samples || 0,
        },
        profiles: listProfiles(),
    };
}

export function resetMultiProfile() {
    STORE = { v: 1, profiles: {}, global: { shift: {}, winRate: 0, samples: 0 }, currentKey: 'balanced' };
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    log.info('multiProfile', '多档案数据已复位');
}

function _ensurePresets() {
    _load();
    if (Object.keys(STORE.profiles).length === 0) {
        registerProfile('balanced', { label: '均衡型' });
        registerProfile('aggressive', { label: '激进型' });
        registerProfile('cautious', { label: '保守型' });
        registerProfile('guardian', { label: '守护型' });
        registerProfile('loner', { label: '独狼型' });
    }
}
_ensurePresets();

if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.multiProfile = {
        register: registerProfile,
        setCurrent: setCurrentProfile,
        getCurrent: getCurrentProfile,
        updateShift: updateProfileShift,
        recordResult: recordProfileResult,
        imitateBest: imitateBest,
        effectiveShift: getEffectiveShift,
        list: listProfiles,
        stats: multiProfileStats,
        reset: resetMultiProfile,
    };
}
