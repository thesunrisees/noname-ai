/* ================= 决策积分引擎 · cost函数计算 =================
 * 计算技能/卡牌的"成本"
 * 成本类型：
 *   手牌成本：用了几张手牌
 *   血量成本：掉了几点血
 *   体力成本：耗了几点体力
 *   装备成本：用了几件装备
 *   时间成本：耗了几个回合
 */

import { lib, game, get, _status } from '../../../noname.js';
import { log } from './logger.js';

/* ================= 计算卡牌使用成本 ================= */
export function calcCardCost(cardName) {
    try {
        if (!cardName) return 0;
        
        /* 基础成本 */
        let cost = 1.0;  // 默认1张手牌
        
        /* 不同卡牌的成本 */
        const COST_TABLE = {
            'sha': 1.0,           // 杀：1张手牌
            'shan': 1.0,          // 闪：1张手牌
            'tao': 1.0,           // 桃：1张手牌
            'juedou': 1.0,        // 决斗：1张手牌
            'nanman': 1.0,        // 南蛮：1张手牌
            'wanjian': 1.0,       // 万箭：1张手牌
            'wuzhong': 1.0,       // 无中：1张手牌
            'guochu': 1.0,        // 过拆：1张手牌
            'shunshou': 1.0,      // 顺手：1张手牌
            'jiedao': 1.0,        // 借刀：1张手牌
            'lebu': 1.0,          // 乐：1张手牌
            'bingliang': 1.0,     // 兵：1张手牌
            'shandian': 1.0,      // 闪电：1张手牌
            'tiesuo': 1.0,        // 铁索：1张手牌
        };
        
        return COST_TABLE[cardName] || 1.0;
    } catch (e) {
        return 1.0;
    }
}

/* ================= 计算技能成本 ================= */
export function calcSkillCost(skillId) {
    try {
        if (!skillId) return 0;
        
        /* 技能成本表 */
        const SKILL_COST = {
            /* 无成本技能 */
            'kongcheng': 0,       // 空城：被动
            'qianxun': 0,         // 谦逊：被动
            'fankui': 0,          // 反馈：被动
            
            /* 低技能成本 */
            'jizhi': 0.5,         // 集智：摸牌就触发
            'ganglie': 0.5,       // 刚烈：受伤就触发
            'yiji': 0.5,          // 遗计：受伤就触发
            
            /* 中等技能成本 */
            'yueji': 1.0,         // 集智：需要用牌
            'yingzi': 1.0,        // 英姿：摸牌阶段
            'tuxi': 1.0,          // 突袭：需要选目标
            
            /* 高技能成本 */
            'rende': 1.5,         // 仁德：需要给牌
            'jieyin': 1.5,        // 结姻：需要给牌
            'kurou': 2.0,         // 苦肉：需要掉血
            'niepan': 3.0,        // 涅槃：限定技，成本高
        };
        
        return SKILL_COST[skillId] || 1.0;
    } catch (e) {
        return 1.0;
    }
}

/* ================= 计算成本收益比 ================= */
export function calcCostBenefit(cost, benefit) {
    try {
        if (cost <= 0) return benefit > 0 ? Infinity : 0;
        return Math.round((benefit / cost) * 100) / 100;
    } catch (e) {
        return 0;
    }
}

/* ================= 判断值不值得用 ================= */
export function isWorthUsing(cost, benefit) {
    try {
        const ratio = calcCostBenefit(cost, benefit);
        /* 收益/成本 > 1.5 → 值得用 */
        if (ratio >= 1.5) return true;
        /* 收益/成本 < 0.5 → 不值得用 */
        if (ratio < 0.5) return false;
        /* 中间值 → 看情况 */
        return benefit > 0;
    } catch (e) {
        return false;
    }
}

/* ================= 统计信息 ================= */
export function costStats() {
    try {
        const me = _status.currentPhase || game.me;
        if (!me) return { handCount: 0 };
        
        return {
            handCount: me.countCards ? me.countCards('h') : 0,
            maxHand: me.maxHandcard || 4,
        };
    } catch (e) {
        return { handCount: 0 };
    }
}

/* ================= 挂载 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.cost = {
        cardCost: calcCardCost,
        skillCost: calcSkillCost,
        costBenefit: calcCostBenefit,
        worthUsing: isWorthUsing,
        stats: costStats,
    };
}
