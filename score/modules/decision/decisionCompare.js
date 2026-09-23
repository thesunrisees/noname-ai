/* ================= 决策积分引擎 · 决策对比模式 =================
 * 用途：给定一个局面，用不同档案的偏移，分别给候选打分。
 * 输出：每个档案的 Top 3 选择，以及与实际选择的差异。
 */
import { log } from '../misc/logger.js';

const STORE_KEY = 'djsc_compare_v1';
const MAX_RECORDS = 100;

let RECORDS = [];
let _loaded = false;

function _load() {
    try {
        if (_loaded) return;
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) RECORDS = JSON.parse(raw) || [];
        _loaded = true;
    } catch (e) { _loaded = true; }
}
function _save() {
    try {
        while (RECORDS.length > MAX_RECORDS) RECORDS.shift();
        localStorage.setItem(STORE_KEY, JSON.stringify(RECORDS));
    } catch (e) {}
}

export function compareProfiles(acts, profileKeys) {
    try {
        if (!acts || !acts.length) return {};
        const mp = window.__DJSC && window.__DJSC.multiProfile;
        if (!mp) return {};

        const shifts = {};
        const profiles = mp.list();
        profileKeys = profileKeys || profiles.map(function (p) { return p.key; });
        profiles.forEach(function (p) {
            if (profileKeys.indexOf(p.key) >= 0) shifts[p.key] = p.shift;
        });

        const results = {};
        Object.keys(shifts).forEach(function (key) {
            const sh = shifts[key];
            const scored = acts.map(function (a) {
                const base = a.score || 0;
                const shift = _scoreShift(a, sh);
                return { type: a.type, id: a.id, score: Math.round((base + shift) * 10) / 10 };
            });
            scored.sort(function (x, y) { return y.score - x.score; });
            results[key] = scored.slice(0, 3);
        });
        return results;
    } catch (e) { return {}; }
}

function _scoreShift(a, shift) {
    try {
        let s = 0;
        const id = a.id || '';
        const isAtk = ['sha','juedou','huogong','nanman','wanjian','zhujin','shunshou','guohe','tiesuo','lebu','bingliang'].indexOf(id) >= 0;
        const isDef = ['shan','tao','wuxie','jiu'].indexOf(id) >= 0;
        if (isAtk) s += (shift.atk || 0) * 5;
        if (isDef) s += (shift.def || 0) * 5;
        return s;
    } catch (e) { return 0; }
}

export function recordComparison(me, acts, actualBest) {
    try {
        _load();
        const mp = window.__DJSC && window.__DJSC.multiProfile;
        if (!mp) return;
        const profiles = mp.list();
        const results = compareProfiles(acts, profiles.map(function (p) { return p.key; }));
        const rec = {
            ts: Date.now(),
            player: me ? (me.name1 || me.name || '?') : '?',
            actual: actualBest ? { type: actualBest.type, id: actualBest.id } : null,
            perProfile: results,
        };
        const tops = {};
        Object.keys(results).forEach(function (k) {
            const top = results[k][0];
            if (top) tops[k] = top.id;
        });
        const uniqueIds = {};
        Object.keys(tops).forEach(function (k) { uniqueIds[tops[k]] = 1; });
        rec.disagreement = Object.keys(uniqueIds).length > 1;
        rec.tops = tops;

        RECORDS.push(rec);
        _save();
    } catch (e) {}
}

export function compareStats() {
    _load();
    let disagreements = 0;
    const perIdCount = {};
    RECORDS.forEach(function (r) {
        if (r.disagreement) disagreements++;
        if (r.actual && r.actual.id) {
            perIdCount[r.actual.id] = (perIdCount[r.actual.id] || 0) + 1;
        }
    });
    return {
        total: RECORDS.length,
        disagreements: disagreements,
        disagreementRate: RECORDS.length > 0 ? Math.round(disagreements / RECORDS.length * 100) + '%' : '0%',
        topIds: Object.keys(perIdCount).sort(function (a, b) { return perIdCount[b] - perIdCount[a]; }).slice(0, 5),
    };
}

export function compareRecent(n) {
    _load();
    return RECORDS.slice(-(n || 10)).reverse();
}

export function resetCompare() {
    RECORDS = [];
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    log.info('compare', '决策对比数据已清空');
}

if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.compare = {
        run: compareProfiles,
        record: recordComparison,
        stats: compareStats,
        recent: compareRecent,
        reset: resetCompare,
    };
}
_load();
