/* ================= 决策积分引擎 · 判定区状态检测 =================
 * 检查玩家判定区有没有牌（乐不思蜀、兵粮寸断、闪电等）
 * AI可以根据判定区状态选择拆牌/顺牌目标
 */

import { lib, game, get, _status } from '../../../noname.js';
import { log } from '../core/logger.js';

/* 延迟锦囊ID列表 */
const DELAY_CARDS = ['lebu', 'bingliang', 'shandian'];

/* ================= 检查玩家判定区 ================= */
export function hasDelayCards(player) {
    try {
        if (!player) return false;
        const judges = player.judges || [];
        return judges.length > 0;
    } catch (e) {
        return false;
    }
}

export function getDelayCards(player) {
    try {
        if (!player) return [];
        const judges = player.judges || [];
        return judges.map(function (c) {
            return get.name(c);
        });
    } catch (e) {
        return [];
    }
}

export function getDelayCount(player) {
    try {
        if (!player) return 0;
        return (player.judges || []).length;
    } catch (e) {
        return 0;
    }
}

/* ================= 判断是不是延迟锦囊 ================= */
export function isDelayCard(cardName) {
    return DELAY_CARDS.indexOf(cardName) >= 0;
}

/* ================= 统计信息 ================= */
export function judgeZoneStats() {
    try {
        const me = _status.currentPhase || game.me;
        if (!me) return { self: 0, enemies: 0 };
        
        let selfDelay = getDelayCount(me);
        let enemyDelay = 0;
        
        (game.players || []).forEach(function (p) {
            if (!p || p === me || p.alive === false) return;
            try {
                if (typeof isEnemyOf === 'function' && isEnemyOf(me, p)) {
                    enemyDelay += getDelayCount(p);
                }
            } catch (e) {}
        });
        
        return {
            self: selfDelay,
            enemies: enemyDelay,
            selfCards: getDelayCards(me),
        };
    } catch (e) {
        return { self: 0, enemies: 0, selfCards: [] };
    }
}

/* ================= 挂载 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.judgeZone = {
        hasDelay: hasDelayCards,
        getCards: getDelayCards,
        getCount: getDelayCount,
        isDelay: isDelayCard,
        stats: judgeZoneStats,
    };
}
