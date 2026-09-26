/*
 * ============================================
 * // Wydawca: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 跨模式迁移 =================
 * 分层认知：
 *   · global 层：跨模式通用（技能威胁/卡牌价值）
 *   · modes 层：模式专精（身份局判断/国战/斗地主）
 * 读取时：当前模式 > 全局；写入时按 kind 决定层级。
 */
import { log } from './logger.js';

const STORE_KEY = 'djsc_cross_mode_v1';
const VERSION = 1;
const MODES = ['identity', 'guozhan', 'doudizhu', 'boss', 'versus', 'single', 'default'];

const GLOBAL_KINDS = ['skill', 'card'];
const MODE_KINDS = ['character', 'identity', 'faction'];

let STORE = { v: VERSION, global: {}, modes: {} };
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

function _currentMode() {
    try {
        if (window.__DJSC && window.__DJSC.getMode) return String(window.__DJSC.getMode());
    } catch (e) {}
    return 'default';
}

export function transferRead(kind, id) {
    try {
        _load();
        const mode = _currentMode();
        const key = kind + ':' + id;
        const globalVal = (STORE.global && STORE.global[key]) || {};
        const modeVal = (STORE.modes[mode] && STORE.modes[mode][key]) || {};
        return Object.assign({}, globalVal, modeVal, {
            _mode: mode,
            _sources: {
                global: !!STORE.global[key],
                mode: !!(STORE.modes[mode] && STORE.modes[mode][key]),
            },
        });
    } catch (e) { return {}; }
}

export function transferWrite(kind, id, patch, forceLayer) {
    try {
        _load();
        if (!kind || !id || !patch) return false;
        const key = kind + ':' + id;
        const mode = _currentMode();

        let layer = forceLayer;
        if (!layer) layer = GLOBAL_KINDS.indexOf(kind) >= 0 ? 'global' : 'mode';

        if (layer === 'global') {
            STORE.global[key] = Object.assign({}, STORE.global[key] || {}, patch, { updatedAt: Date.now() });
        } else {
            if (!STORE.modes[mode]) STORE.modes[mode] = {};
            STORE.modes[mode][key] = Object.assign({}, STORE.modes[mode][key] || {}, patch, { updatedAt: Date.now() });
        }
        _save();
        return true;
    } catch (e) { return false; }
}

export function promoteToGlobal(kind, id, threshold) {
    try {
        _load();
        threshold = threshold || 3;
        const key = kind + ':' + id;
        let sumValues = {}, count = 0;
        MODES.forEach(function (mode) {
            const mv = STORE.modes[mode] && STORE.modes[mode][key];
            if (!mv) return;
            count++;
            Object.keys(mv).forEach(function (k) {
                if (typeof mv[k] === 'number') {
                    if (!sumValues[k]) sumValues[k] = { sum: 0, n: 0 };
                    sumValues[k].sum += mv[k];
                    sumValues[k].n++;
                }
            });
        });
        if (count < threshold) return false;
        const avg = {};
        Object.keys(sumValues).forEach(function (k) {
            avg[k] = Math.round(sumValues[k].sum / sumValues[k].n * 1000) / 1000;
        });
        STORE.global[key] = Object.assign({}, STORE.global[key] || {}, avg, {
            promotedAt: Date.now(), fromModes: count,
        });
        _save();
        log.info('crossMode', '元素 ' + key + ' 已从 ' + count + ' 个模式提升为全局');
        return true;
    } catch (e) { return false; }
}

export function autoPromoteAll(threshold) {
    try {
        _load();
        threshold = threshold || 3;
        const allKeys = {};
        MODES.forEach(function (mode) {
            if (!STORE.modes[mode]) return;
            Object.keys(STORE.modes[mode]).forEach(function (key) {
                allKeys[key] = (allKeys[key] || 0) + 1;
            });
        });
        let promoted = 0;
        Object.keys(allKeys).forEach(function (key) {
            if (allKeys[key] >= threshold) {
                const parts = key.split(':');
                const kind = parts[0], id = parts.slice(1).join(':');
                if (promoteToGlobal(kind, id, threshold)) promoted++;
            }
        });
        if (promoted > 0) log.info('crossMode', '自动迁移：' + promoted + ' 个元素提升为全局');
        return promoted;
    } catch (e) { return 0; }
}

export function transferStats() {
    _load();
    const out = {
        global: Object.keys(STORE.global).length,
        modes: {},
    };
    MODES.forEach(function (m) {
        if (STORE.modes[m]) out.modes[m] = Object.keys(STORE.modes[m]).length;
    });
    return out;
}

export function transferListGlobal() {
    _load();
    const out = [];
    Object.keys(STORE.global).forEach(function (key) {
        const parts = key.split(':');
        const kind = parts[0], id = parts.slice(1).join(':');
        out.push({ kind: kind, id: id, data: STORE.global[key] });
    });
    return out;
}

export function resetTransfer() {
    STORE = { v: VERSION, global: {}, modes: {} };
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    log.info('crossMode', '跨模式认知已复位');
}

if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.crossMode = {
        read: transferRead,
        write: transferWrite,
        promote: promoteToGlobal,
        autoPromote: autoPromoteAll,
        stats: transferStats,
        listGlobal: transferListGlobal,
        reset: resetTransfer,
        currentMode: _currentMode,
    };
}
_load();
