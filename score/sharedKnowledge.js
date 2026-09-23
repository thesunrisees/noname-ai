/* ================= 决策积分引擎 · 协同学习 =================
 * 公共知识库：
 *   · 记录所有 AI 玩家共享的"局势→正确选择"样本
 *   · 定期聚合成"群体智慧"标签
 *   · 本地 AI 可选择性采纳
 */
import { lib, game, get, _status } from '../../../noname.js';
import { log } from './logger.js';

const STORE_KEY = 'djsc_shared_knowledge_v1';
const VERSION = 1;
const MAX_ENTRIES = 500;
const MIN_CONFIDENCE = 3;

let STORE = { v: VERSION, knowledge: {}, stats: { contributes: 0, adopts: 0 } };
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
    try {
        const keys = Object.keys(STORE.knowledge);
        if (keys.length > MAX_ENTRIES) {
            keys.sort(function (a, b) {
                return (STORE.knowledge[a].samples || 0) - (STORE.knowledge[b].samples || 0);
            });
            for (let i = 0; i < keys.length - MAX_ENTRIES; i++) {
                delete STORE.knowledge[keys[i]];
            }
        }
        localStorage.setItem(STORE_KEY, JSON.stringify(STORE));
    } catch (e) {}
}

function _fingerprint(me, ctx) {
    try {
        const hp = me.hp || 0;
        const hpSeg = hp <= 1 ? 'L' : (hp <= 2 ? 'M' : 'H');
        const hc = me.countCards ? me.countCards('h') : 0;
        const hcSeg = hc <= 2 ? 'S' : (hc <= 4 ? 'M' : 'L');

        let enemyLow = 0, enemyCount = 0;
        for (const p of (game.players || [])) {
            if (!p || p === me || p.alive === false) continue;
            if (get.attitude(me, p) < 0) {
                enemyCount++;
                if ((p.hp || 0) <= 1) enemyLow++;
            }
        }
        const enemySeg = enemyCount === 0 ? '0' : (enemyLow > 0 ? 'low' : 'high');
        const focusSeg = ctx && ctx.focusTarget ? 'F' : 'N';
        return hpSeg + '_' + hcSeg + '_' + enemySeg + '_' + focusSeg;
    } catch (e) { return '?'; }
}

export function shareContribute(me, action, outcome) {
    try {
        _load();
        if (!me || !action) return false;
        const fp = _fingerprint(me, { focusTarget: action.target });
        const choice = action.type + ':' + (action.id || '?');
        const win = outcome && outcome.win ? 1 : 0;

        if (!STORE.knowledge[fp]) {
            STORE.knowledge[fp] = {};
        }
        if (!STORE.knowledge[fp][choice]) {
            STORE.knowledge[fp][choice] = { win: 0, total: 0, lastUpdate: 0 };
        }
        const e = STORE.knowledge[fp][choice];
        e.win += win;
        e.total += 1;
        e.lastUpdate = Date.now();
        STORE.stats.contributes++;
        _save();
        return true;
    } catch (e) { return false; }
}

export function shareRecommend(me, ctx) {
    try {
        _load();
        if (!me) return null;
        const fp = _fingerprint(me, ctx || {});
        const bucket = STORE.knowledge[fp];
        if (!bucket) return null;

        let best = null, bestWr = 0, bestN = 0;
        Object.keys(bucket).forEach(function (choice) {
            const e = bucket[choice];
            if (e.total < MIN_CONFIDENCE) return;
            const wr = e.win / e.total;
            const weight = Math.min(1, e.total / 10);
            const score = wr * weight;
            if (score > bestWr) {
                bestWr = score;
                best = choice;
                bestN = e.total;
            }
        });
        if (!best) return null;
        STORE.stats.adopts++;
        _save();
        return {
            choice: best,
            winRate: bestWr,
            samples: bestN,
            fingerprint: fp,
        };
    } catch (e) { return null; }
}

export function applySharedBonus(me, acts, ctx) {
    try {
        const rec = shareRecommend(me, ctx);
        if (!rec) return acts;
        const parts = rec.choice.split(':');
        const type = parts[0], id = parts.slice(1).join(':');
        acts.forEach(function (a) {
            if (a.type === type && a.id === id) {
                const bonus = 1 + rec.winRate * 0.3;
                a.score = Math.round((a.score || 0) * bonus);
                a.reason = (a.reason || '') + '｜群体+';
            }
        });
        return acts;
    } catch (e) { return acts; }
}

export function shareStats() {
    _load();
    const fps = Object.keys(STORE.knowledge);
    let totalChoices = 0, highConfidence = 0;
    fps.forEach(function (fp) {
        const bucket = STORE.knowledge[fp];
        Object.keys(bucket).forEach(function (ch) {
            totalChoices++;
            if (bucket[ch].total >= MIN_CONFIDENCE) highConfidence++;
        });
    });
    return {
        fingerprints: fps.length,
        choices: totalChoices,
        highConfidence: highConfidence,
        contributes: STORE.stats.contributes,
        adopts: STORE.stats.adopts,
    };
}

export function shareList(n) {
    _load();
    const out = [];
    Object.keys(STORE.knowledge).forEach(function (fp) {
        const bucket = STORE.knowledge[fp];
        Object.keys(bucket).forEach(function (ch) {
            const e = bucket[ch];
            if (e.total >= MIN_CONFIDENCE) {
                out.push({
                    fingerprint: fp,
                    choice: ch,
                    winRate: Math.round((e.win / e.total) * 100) / 100,
                    samples: e.total,
                });
            }
        });
    });
    out.sort(function (a, b) { return b.winRate * b.samples - a.winRate * a.samples; });
    return out.slice(0, n || 20);
}

export function resetShared() {
    STORE = { v: VERSION, knowledge: {}, stats: { contributes: 0, adopts: 0 } };
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    log.info('shared', '公共知识库已复位');
}

if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.shared = {
        contribute: shareContribute,
        recommend: shareRecommend,
        applyBonus: applySharedBonus,
        stats: shareStats,
        list: shareList,
        reset: resetShared,
    };
}
_load();
