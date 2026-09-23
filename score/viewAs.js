/* ================= 决策积分引擎 · viewAs/转化类技能AI优化 =================
 * 优化"视为使用"和"转化"类技能的AI逻辑
 * 功能：
 *   ① 什么时候该用 viewAs（比如"红牌当杀"）
 *   ② 什么时候该用转化（比如"火攻"）
 *   ③ 计算转化的成本收益
 */

import { lib, game, get, _status } from '../../../noname.js';
import { log } from './logger.js';

/* ================= viewAs 类技能列表 ================= */
const VIEW_AS_SKILLS = {
    /* 视为使用杀 */
    'hongpai_dang_sha': {
        targetCard: 'sha',
        cost: 'red_card',
        value: 2.0,
    },
    /* 火攻（转化类） */
    'huogong': {
        targetCard: 'huogong',
        cost: 'hand_card',
        value: 2.5,
    },
    /* 貂蝉的离间（转化类） */
    'lijian': {
        targetCard: 'juedou',
        cost: 'male_target',
        value: 3.0,
    },
};

/* ================= 计算 viewAs 的价值 ================= */
export function calcViewAsValue(skillId, target) {
    try {
        const skill = VIEW_AS_SKILLS[skillId];
        if (!skill) return 0;
        
        let value = skill.value;
        
        /* 目标残血 → 价值更高 */
        if (target && (target.hp || 0) <= 1) value += 1.5;
        
        /* 目标有闪 → 价值降低 */
        try {
            if (window.__DJSC && window.__DJSC.probHasShan) {
                const pShan = window.__DJSC.probHasShan(target);
                if (pShan > 0.6) value *= 0.6;
            }
        } catch (e) {}
        
        return Math.round(value * 100) / 100;
    } catch (e) {
        return 0;
    }
}

/* ================= 判断该不该用转化 ================= */
export function shouldUseTransform(skillId, me, target) {
    try {
        const skill = VIEW_AS_SKILLS[skillId];
        if (!skill) return false;
        
        const value = calcViewAsValue(skillId, target);
        
        /* 价值 > 2.0 → 该用 */
        if (value >= 2.0) return true;
        
        /* 价值 < 1.0 → 不该用 */
        if (value < 1.0) return false;
        
        /* 中间值 → 看情况 */
        return (me.hp || 0) >= 2;  // 自己血量够就用
    } catch (e) {
        return false;
    }
}

/* ================= 统计信息 ================= */
export function viewAsStats() {
    try {
        return {
            totalSkills: Object.keys(VIEW_AS_SKILLS).length,
            skills: Object.keys(VIEW_AS_SKILLS),
        };
    } catch (e) {
        return { totalSkills: 0, skills: [] };
    }
}

/* ================= 挂载 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.viewAs = {
        calcValue: calcViewAsValue,
        shouldUse: shouldUseTransform,
        stats: viewAsStats,
        SKILLS: VIEW_AS_SKILLS,
    };
}
