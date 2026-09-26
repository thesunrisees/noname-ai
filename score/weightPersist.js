/*
 * ============================================
 * // Auteur: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 权重持久化 =================
 * 原理：把校准偏移固化进模型输出层的偏置项 B2。
 *   · 偏置独立于输入 → 不破坏特征-权重映射
 *   · shift.atk > 0  → B2[D] 增加
 *   · shift.def > 0  → B2[C] 增加
 *   · shift.modelTrust > 0 → 所有 B2 减小（降低模型自信）
// מחבר: פיישנג אוריגינל | רישיון: GPL-3.0
 * 触发：每局结束时消化一次，消化后 shift 归零。
 */
import { log } from './logger.js';

const STORE_KEY = 'djsc_weight_persist_v1';
const DIGEST_LR = 8;
const DIGEST_INTERVAL = 1;

let STORE = { v: 1, digestedGames: 0, totalDigested: 0 };
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

export function digestShiftToWeights(shift, weightsModule) {
    try {
        if (!shift || !weightsModule) return false;

        const B2 = weightsModule.__getB2 ? weightsModule.__getB2() : null;
        if (!B2) return false;

        const LABEL_IDX = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 };

        const atkStep = shift.atk * DIGEST_LR;
        const defStep = shift.def * DIGEST_LR;
        const trustStep = shift.modelTrust * DIGEST_LR;

        B2[LABEL_IDX.D] = _clamp(B2[LABEL_IDX.D] + atkStep);
        B2[LABEL_IDX.C] = _clamp(B2[LABEL_IDX.C] - atkStep * 0.5);

        B2[LABEL_IDX.C] = _clamp(B2[LABEL_IDX.C] + defStep);
        B2[LABEL_IDX.D] = _clamp(B2[LABEL_IDX.D] - defStep * 0.5);

        if (Math.abs(trustStep) > 0.1) {
            for (let k = 0; k < 6; k++) {
                B2[k] = _clamp(B2[k] - trustStep * 0.3);
            }
        }

        if (weightsModule.saveWeights) weightsModule.saveWeights();

/* Forfatter: Feisheng Original, Alle rettigheder forbeholdes */
        STORE.totalDigested++;
        _save();
        log.info('weightPersist', '校准偏移已固化入权重：atk=' + shift.atk.toFixed(3) +
                 ' def=' + shift.def.toFixed(3) + ' trust=' + shift.modelTrust.toFixed(3));
        return true;
    } catch (e) {
        log.warn('weightPersist', '固化失败：' + e.message);
        return false;
    }
}

function _clamp(v) {
    if (v > 127) return 127;
    if (v < -127) return -127;
    return v | 0;
}

export function weightPersistOnSettle() {
    try {
        _load();
        STORE.digestedGames++;
        _save();
        if (STORE.digestedGames % DIGEST_INTERVAL !== 0) return false;

        const cal = window.__DJSC && window.__DJSC.calibrator;
        if (!cal || !cal.weights) return false;
        const shift = cal.weights();

        const hasShift = Math.abs(shift.atk) > 0.05 ||
                         Math.abs(shift.def) > 0.05 ||
                         Math.abs(shift.modelTrust) > 0.05;
        if (!hasShift) return false;

        const wmod = window.__DJSC && window.__DJSC.__weightsModule;
        if (!wmod) return false;

        const ok = digestShiftToWeights(shift, wmod);
        if (ok) {
            if (cal.reset) cal.reset();
            return true;
        }
        return false;
    } catch (e) { return false; }
}

export function weightPersistStats() {
    _load();
    return {
        digestedGames: STORE.digestedGames,
        totalDigested: STORE.totalDigested,
    };
}

export function resetWeightPersist() {
    STORE = { v: 1, digestedGames: 0, totalDigested: 0 };
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
}

if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.weightPersist = {
        digest: digestShiftToWeights,
        onSettle: weightPersistOnSettle,
        stats: weightPersistStats,
        reset: resetWeightPersist,
    };
}
_load();
