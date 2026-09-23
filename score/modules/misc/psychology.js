/* ================= 决策积分引擎 · 博弈策略层 =================
 * 四个子功能：
 *   ① 威慑姿态：手牌偏弱时摆出进攻架势，逼对手保留防御资源
 *   ② 意图识别：判断对手的强势姿态是真强还是试探
 *   ③ 压迫力：手里有攻击牌时，评估对附近对手的心理压迫价值
 *   ④ 策略保留：识别手牌中"表面价值高、实际对我无用"的牌，优先保留作消耗品
 */
import { lib, game, get, _status } from '../../../../../noname.js';
import { cfg } from './util.js';
import { log } from './logger.js';

/* ================= 缓存 ================= */
const _cache = new Map();
let _cacheRound = -1;
function _syncCache() {
    try {
        const r = (_status && _status.roundNumber) || (game && game.roundNumber) || 0;
        if (r !== _cacheRound) { _cache.clear(); _cacheRound = r; }
    } catch (e) {}
}

/* ================= ① 威慑姿态 ================= */
export function deterrenceCheck(me, enemy) {
    try {
        if (!me || !enemy) return { should: false, score: 0 };
        _syncCache();
        const key = 'det_' + (me.name1 || me.name || '?') + '_' + (enemy.name1 || enemy.name || '?');
        if (_cache.has(key)) return _cache.get(key);

        let myThreat = 0;
        try {
            const sha = me.countCards ? me.countCards('hs', 'sha') : 0;
            const jiu = me.countCards ? me.countCards('hs', 'jiu') : 0;
            myThreat = sha * 0.6 + jiu * 0.4;
            if (me.getEquip && me.getEquip('zhuge')) myThreat *= 1.5;
        } catch (e) {}

        let enemyDefense = 0;
        try {
            const hc = enemy.countCards ? enemy.countCards('h') : 0;
            enemyDefense = hc * 0.2;
        } catch (e) {}

        let weak = 0;
        try {
            const myHc = me.countCards ? me.countCards('h') : 0;
            const eHc = enemy.countCards ? enemy.countCards('h') : 0;
            if (myHc < eHc) weak = (eHc - myHc) * 0.1;
        } catch (e) {}

        const score = myThreat * 0.5 + enemyDefense * 0.3 + weak;
        const should = score >= 0.8;
        const result = { should: should, score: Math.round(score * 100) / 100 };
        _cache.set(key, result);
        return result;
    } catch (e) { return { should: false, score: 0 }; }
}

/* ================= ② 意图识别 ================= */
export function intentReading(me, enemy) {
    try {
        if (!me || !enemy) return { probing: false, confidence: 0 };
        _syncCache();
        const key = 'read_' + (enemy.name1 || enemy.name || '?');
        if (_cache.has(key)) return _cache.get(key);

        let usedThisTurn = 0;
        try {
            const cur = _status && _status.currentPhase;
            if (cur === enemy) {
                const hc = enemy.countCards ? enemy.countCards('h') : 0;
                usedThisTurn = hc <= 2 ? 2 : 0;
            }
        } catch (e) {}

        let aggression = 0.5;
        try {
            const styleFB = window.__DJSC.styleFeedback;
            if (styleFB && styleFB.getPlayerMemoryStats) {
                const stats = styleFB.getPlayerMemoryStats();
                const pk = enemy.nickname || enemy.uid || enemy.name;
                if (pk && stats && stats[pk]) {
                    aggression = stats[pk].aggression || 0.5;
                }
            }
        } catch (e) {}

        const hpRatio = (enemy.hp || 0) / Math.max(1, enemy.maxHp || 1);
        let hpSignal = 0;
        if (hpRatio < 0.3) hpSignal = 0.4;
        else if (hpRatio > 0.8) hpSignal = -0.2;

        const probingProb = Math.max(0, Math.min(1,
            (aggression - 0.5) * 0.6 + hpSignal + usedThisTurn * 0.2
        ));
        const result = {
            probing: probingProb > 0.55,
            confidence: Math.round(probingProb * 100) / 100,
            detail: { aggression: aggression, hpSignal: hpSignal, usedThisTurn: usedThisTurn },
        };
        _cache.set(key, result);
        return result;
    } catch (e) { return { probing: false, confidence: 0 }; }
}

/* ================= ③ 压迫力 ================= */
export function pressureScore(me, enemy) {
    try {
        if (!me || !enemy) return 0;
        let dist = 99;
        try { dist = get.distance(me, enemy); } catch (e) {}
        if (dist > 1) return 0;

        let mySha = 0;
        try { mySha = me.countCards ? me.countCards('hs', 'sha') : 0; } catch (e) {}
        if (mySha === 0) return 0;

        const hp = enemy.hp || 0;
        const hpMul = hp <= 1 ? 1.5 : (hp <= 2 ? 1.2 : 1.0);

        let enemyWeakDefense = 0;
        try {
            const eHc = enemy.countCards ? enemy.countCards('h') : 0;
            if (eHc <= 1) enemyWeakDefense = 0.5;
            else if (eHc <= 2) enemyWeakDefense = 0.3;
        } catch (e) {}

        return Math.round((mySha * 0.4 + enemyWeakDefense) * hpMul * 100) / 100;
    } catch (e) { return 0; }
}

/* ================= ④ 策略保留 ================= */
export function strategicHold(me, enemy) {
    try {
        if (!me || !enemy) return null;
        const hand = me.getCards ? me.getCards('h') : [];
        if (!hand.length) return null;

        let best = null, bestScore = 0;
        hand.forEach(function (c) {
            let display = 3, real = 3;
            try {
                const name = get.name(c, me);
                display = ((c.number || 7) / 13) * 5 + 3;
                if (name === 'sha') real = me.countCards('hs', 'sha') > 1 ? 3 : 5;
                else if (name === 'shan') real = (me.hp || 0) <= 2 ? 5 : 3;
                else if (name === 'tao') real = 6;
                else if (name === 'wuxie') real = 5;
                else if (['guohe', 'shunshou'].indexOf(name) >= 0) real = 2;
                else real = 2.5;
            } catch (e) {}
            const hold = display - real;
            if (hold > bestScore) { bestScore = hold; best = c; }
        });
        return bestScore >= 2 ? best : null;
    } catch (e) { return null; }
}

/* ================= 应用层 ================= */
export function psychologyBonus(me, action, bestT) {
    try {
        if (cfg('psychologyLayer', true) === false) return 1.0;
        if (!me || !action || !bestT) return 1.0;
        let bonus = 1.0;

        const deter = deterrenceCheck(me, bestT);
        if (deter.should && ['sha', 'juedou', 'huogong'].indexOf(action.id) >= 0) {
            bonus *= 1.15;
        }

        const read = intentReading(me, bestT);
        if (read.probing && read.confidence > 0.6) {
            if (['sha', 'juedou', 'huogong'].indexOf(action.id) >= 0) bonus *= 1.25;
        }

        const pressure = pressureScore(me, bestT);
        if (pressure > 0 && action.id === 'sha') bonus *= (1 + pressure * 0.1);

        const hold = strategicHold(me, bestT);
        if (hold && action.type === 'card') {
            try {
                const actionCard = me.getCards('h').find(function (c) {
                    return get.name(c) === action.id;
                });
                if (actionCard === hold) bonus *= 0.85;
            } catch (e) {}
        }

        return Math.round(bonus * 1000) / 1000;
    } catch (e) { return 1.0; }
}

/* ================= 统计接口 ================= */
export function psychologyStats() {
    return {
        cacheSize: _cache.size,
        cacheRound: _cacheRound,
    };
}

export function resetPsychology() {
    _cache.clear();
    _cacheRound = -1;
    log.info('psychology', '博弈策略缓存已复位');
}


/* ================= 挂载（已移至 engine.js，避免重复） ================= */
