/* ================= 决策积分引擎 · 技能标签系统 =================
 * 给技能打标签，让AI更容易分类
 * 标签类型：
 *   draw：摸牌类（闭月、英姿、突袭）
 *   recover：回复类（仁德、结姻）
 *   attack：攻击类（咆哮、无双、方天）
 *   defense：防御类（空城、谦逊、反馈）
 *   control：控制类（攻心、观星、洛神）
 *   utility：辅助类（集智、集略、苦肉）
 *   burst：爆发类（连弩+多杀、决斗）
 *   survival：生存类（涅槃、不屈、宗室）
 */

import { lib, game, get, _status } from '../../../noname.js';
import { log } from './logger.js';

/* ================= 内置技能标签表 ================= */
const BUILTIN_TAGS = {
    /* 摸牌类 */
    'yueji': 'draw',        // 集智
    'yingzi': 'draw',       // 英姿
    'tuxi': 'draw',         // 突袭
    'guose': 'draw',        // 国色
    'qingnang': 'draw',     // 青囊

    /* 回复类 */
    'rende': 'recover',     // 仁德
    'jieyin': 'recover',    // 结姻
    'jiuchi': 'recover',    // 酒池
    'chijia': 'recover',    // 斥迹

    /* 攻击类 */
    'paoxiao': 'attack',    // 咆哮
    'wushuang': 'attack',   // 无双
    'fangtian': 'attack',   // 方天
    'zhenji': 'attack',     // 贞姬
    'kuanggu': 'attack',    // 狂骨

    /* 防御类 */
    'kongcheng': 'defense', // 空城
    'qianxun': 'defense',   // 谦逊
    'fankui': 'defense',    // 反馈
    'ganglie': 'defense',   // 刚烈
    'yiji': 'defense',      // 遗计

    /* 控制类 */
    'gongxin': 'control',  // 攻心
    'guanxing': 'control',  // 观星
    'luoshen': 'control',  // 洛神
    'tiesuo': 'control',    // 铁索连环

    /* 辅助类 */
    'jizhi': 'utility',     // 集智
    'jilve': 'utility',     // 集略
    'kurou': 'utility',     // 苦肉
    'jieyijian': 'utility', // 借刀杀人

    /* 爆发类 */
    'zhuge': 'burst',       // 诸葛连弩
    'juedou': 'burst',      // 决斗

    /* 生存类 */
    'niepan': 'survival',   // 涅槃
    'buqu': 'survival',     // 不屈
    'zongshi': 'survival', // 宗室
};

/* ================= 获取技能标签 ================= */
export function getSkillTag(skillId) {
    try {
        if (!skillId) return 'unknown';
        /* 先查内置表 */
        if (BUILTIN_TAGS[skillId]) return BUILTIN_TAGS[skillId];
        /* 再查本体技能定义 */
        const skill = lib.skill[skillId];
        if (skill && skill.skillTag) return skill.skillTag;
        /* 再根据名字猜测 */
        if (skillId.indexOf('sha') >= 0 || skillId.indexOf('attack') >= 0) return 'attack';
        if (skillId.indexOf('shan') >= 0 || skillId.indexOf('defense') >= 0) return 'defense';
        if (skillId.indexOf('draw') >= 0 || skillId.indexOf('mo') >= 0) return 'draw';
        if (skillId.indexOf('recover') >= 0 || skillId.indexOf('huifu') >= 0) return 'recover';
        /* 默认 */
        return 'utility';
    } catch (e) {
        return 'unknown';
    }
}

/* ================= 获取玩家的技能标签列表 ================= */
export function getPlayerSkillTags(player) {
    try {
        if (!player) return [];
        const skills = player.getSkills ? player.getSkills() : [];
        const tags = new Set();
        skills.forEach(function (sid) {
            const tag = getSkillTag(sid);
            if (tag && tag !== 'unknown') tags.add(tag);
        });
        return Array.from(tags);
    } catch (e) {
        return [];
    }
}

/* ================= 统计信息 ================= */
export function skillTagStats() {
    try {
        const me = _status.currentPhase || game.me;
        if (!me) return { tags: [], builtin: Object.keys(BUILTIN_TAGS).length };
        const tags = getPlayerSkillTags(me);
        return {
            tags: tags,
            builtin: Object.keys(BUILTIN_TAGS).length,
            totalSkills: me.countSkill ? me.countSkill() : 0,
        };
    } catch (e) {
        return { tags: [], builtin: 0 };
    }
}

/* ================= 挂载 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.skillTags = {
        get: getSkillTag,
        playerTags: getPlayerSkillTags,
        stats: skillTagStats,
        BUILTIN: BUILTIN_TAGS,
    };
}
