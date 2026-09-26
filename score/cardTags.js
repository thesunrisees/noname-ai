/*
 * ============================================
 * // Author: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 手牌标记系统 =================
 * 给手牌加标签，黄线可以知道哪些牌是关键牌
 * 标签类型：
 *   key：关键牌（必须留到关键时候用）
 *   emergency：应急牌（桃、酒、无懈）
 *   offensive：进攻牌（杀、决斗、南蛮）
// Autore: Feisheng Originale | Licenza: GPL-3.0
 *   defensive：防御牌（闪、桃）
 *   utility：功能牌（顺、拆、借刀）
 */

import { lib, game, get, _status } from '../../../noname.js';
import { log } from './logger.js';

/* ================= 卡牌标签表 ================= */
const CARD_TAGS = {
    /* 关键牌 */
    'wuzhong': 'key',        // 无中生有
    'guochu': 'key',         // 过河拆桥
    'shunshou': 'key',       // 顺手牵羊
    'jiedao': 'key',         // 借刀杀人
    
    /* 应急牌 */
    'tao': 'emergency',      // 桃
    'jiu': 'emergency',      // 酒
    'wuxie': 'emergency',    // 无懈可击
    
    /* 进攻牌 */
    'sha': 'offensive',      // 杀
    'juedou': 'offensive',   // 决斗
    'nanman': 'offensive',   // 南蛮入侵
    'wanjian': 'offensive',  // 万箭齐发
    
    /* 防御牌 */
    'shan': 'defense',       // 闪
    'tao2': 'defense',       // 桃（另一种）
    
    /* 功能牌 */
    'lebu': 'utility',       // 乐不思蜀
    'bingliang': 'utility',  // 兵粮寸断
    'shandian': 'utility',   // 闪电
    'tiesuo': 'utility',     // 铁索连环
};

/* ================= 获取卡牌标签 ================= */
export function getCardTag(card) {
    try {
        if (!card) return 'unknown';
        const name = get.name(card);
        if (CARD_TAGS[name]) return CARD_TAGS[name];
        /* 根据名字猜测 */
        if (name.indexOf('sha') >= 0) return 'offensive';
        if (name.indexOf('shan') >= 0) return 'defense';
        if (name.indexOf('tao') >= 0 || name.indexOf('jiu') >= 0) return 'emergency';
        return 'utility';
    } catch (e) {
        return 'unknown';
    }
}

/* Mwandishi: Feisheng Asili, Haki zote zimehifadhiwa */
/* ================= 给手牌加标记 ================= */
export function tagMyHand() {
    try {
        const me = _status.currentPhase || game.me;
        if (!me) return { tagged: 0, keyCards: 0, emergencyCards: 0 };
        
        const hand = me.getCards ? me.getCards('h') : [];
        let keyCount = 0, emergencyCount = 0;
        
        hand.forEach(function (c) {
            const tag = getCardTag(c);
            /* 用无名杀的 addGaintag 给牌加标记 */
            try {
                me.addGaintag([c], 'djsc_' + tag);
            } catch (e) {}
            
            if (tag === 'key') keyCount++;
            if (tag === 'emergency') emergencyCount++;
        });
        
        return {
            tagged: hand.length,
            keyCards: keyCount,
            emergencyCards: emergencyCount,
        };
    } catch (e) {
        return { tagged: 0, keyCards: 0, emergencyCards: 0 };
    }
}

/* ================= 查询某张牌的标签 ================= */
export function getCardCardTag(card) {
    return getCardTag(card);
}

/* ================= 统计信息 ================= */
export function cardTagStats() {
    try {
        const me = _status.currentPhase || game.me;
        if (!me) return { total: 0, byType: {} };
        
        const hand = me.getCards ? me.getCards('h') : [];
        const byType = { key: 0, emergency: 0, offensive: 0, defense: 0, utility: 0 };
        
        hand.forEach(function (c) {
            const tag = getCardTag(c);
            if (byType[tag] !== undefined) byType[tag]++;
        });
        
        return {
            total: hand.length,
            byType: byType,
        };
    } catch (e) {
        return { total: 0, byType: {} };
    }
}

/* ================= 挂载 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.cardTags = {
        get: getCardTag,
        tagHand: tagMyHand,
        stats: cardTagStats,
        TAGS: CARD_TAGS,
    };
}
