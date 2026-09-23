/* ================= 决策积分引擎 · 技能触发时机识别 =================
 * 功能：
 *   ① 识别技能触发时机（准备/出牌/结束/受伤等）
 *   ② 识别技能类型（自动发动/锁定技/主动技）
 *   ③ 识别技能效果（摸牌/回血/弃牌/横置等）
 *   ④ 为AI决策提供技能行为预判
 */

import { log } from '../core/logger.js';

/* ================= 触发时机库 ================= */
const TRIGGER_TIMES = {
    /* 阶段类 */
    'phaseZhunbeiBegin': { name: '准备阶段开始', category: 'phase' },
    'phaseZhunbeiEnd': { name: '准备阶段结束', category: 'phase' },
    'phaseJudgementBegin': { name: '判定阶段开始', category: 'phase' },
    'phaseJudgementEnd': { name: '判定阶段结束', category: 'phase' },
    'phaseDrawBegin': { name: '摸牌阶段开始', category: 'phase' },
    'phaseDrawEnd': { name: '摸牌阶段结束', category: 'phase' },
    'phaseUseBegin': { name: '出牌阶段开始', category: 'phase' },
    'phaseUseEnd': { name: '出牌阶段结束', category: 'phase' },
    'phaseJieshuBegin': { name: '结束阶段开始', category: 'phase' },
    'phaseJieshuEnd': { name: '结束阶段结束', category: 'phase' },
    'phaseBefore': { name: '回合开始前', category: 'phase' },
    'phaseAfter': { name: '回合结束后', category: 'phase' },

    /* 卡牌类 */
    'useCardBegin': { name: '使用牌时', category: 'card' },
    'useCardEnd': { name: '使用牌后', category: 'card' },
    'useCardToTargeted': { name: '指定目标后', category: 'card' },
    'useCardToAfter': { name: '指定目标后', category: 'card' },
    'respondBegin': { name: '需要响应时', category: 'card' },
    'respondEnd': { name: '响应后', category: 'card' },
    'damageCardBegin': { name: '造成伤害时', category: 'card' },
    'damageCardEnd': { name: '造成伤害后', category: 'card' },

    /* 伤害类 */
    'damageBegin': { name: '受到伤害时', category: 'damage' },
    'damageEnd': { name: '受到伤害后', category: 'damage' },
    'damageSourceBegin': { name: '造成伤害来源时', category: 'damage' },
    'damageSourceEnd': { name: '造成伤害来源后', category: 'damage' },
    'loseHpBegin': { name: '失去体力时', category: 'damage' },
    'loseHpEnd': { name: '失去体力后', category: 'damage' },
    'recoverBegin': { name: '恢复体力时', category: 'damage' },
    'recoverEnd': { name: '恢复体力后', category: 'damage' },

    /* 卡牌移动类 */
    'gainBegin': { name: '获得牌时', category: 'move' },
    'gainEnd': { name: '获得牌后', category: 'move' },
    'gainAfter': { name: '获得牌后', category: 'move' },
    'discardBegin': { name: '弃置牌时', category: 'move' },
    'discardEnd': { name: '弃置牌后', category: 'move' },
    'discardAfter': { name: '弃置牌后', category: 'move' },
    'equipBegin': { name: '装备牌时', category: 'move' },
    'equipEnd': { name: '装备牌后', category: 'move' },
    'equipAfter': { name: '装备牌后', category: 'move' },

    /* 状态类 */
    'linkBegin': { name: '横置时', category: 'status' },
    'linkEnd': { name: '横置后', category: 'status' },
    'roundStart': { name: '轮开始时', category: 'status' },
    'roundEnd': { name: '轮结束时', category: 'status' },
    'gameStart': { name: '游戏开始时', category: 'status' },
    'gameEnd': { name: '游戏结束时', category: 'status' },
    'playerDie': { name: '角色死亡时', category: 'status' },
    'playerRevive': { name: '角色复活时', category: 'status' },
    'skillAdd': { name: '获得技能时', category: 'status' },
    'skillRemove': { name: '失去技能时', category: 'status' },

    /* 判定类 */
    'judgeBegin': { name: '判定时', category: 'judge' },
    'judgeEnd': { name: '判定后', category: 'judge' },
    'judgeAfter': { name: '判定后', category: 'judge' },

    /* 杂项 */
    'chooseToDiscardBegin': { name: '选择弃牌时', category: 'misc' },
    'chooseToMoveBegin': { name: '选择移动时', category: 'misc' },
    'chooseSkillBegin': { name: '选择技能时', category: 'misc' },
};

/* ================= 技能类型识别 ================= */
function getSkillType(skillId) {
    try {
        const skill = lib.skill[skillId];
        if (!skill) return 'unknown';

        const types = [];
        if (skill.frequent) types.push('auto');      // 自动发动
        if (skill.forced) types.push('forced');      // 锁定技
        if (skill.limited) types.push('limited');    // 限定技
        if (skill.juexingji) types.push('juexing');  // 觉醒技
        if (skill.zhuSkill) types.push('zhu');       // 主公技
        if (skill.zhuanhuanji) types.push('zh');     // 转换技
        if (skill.charlotte) types.push('state');    // 状态技
        if (skill.unique) types.push('unique');      // 特殊技

        return types.length ? types.join(',') : 'active';
    } catch (e) {
        return 'unknown';
    }
}

/* ================= 技能触发时机识别 ================= */
function getSkillTriggers(skillId) {
    try {
        const skill = lib.skill[skillId];
        if (!skill || !skill.trigger) return [];

        const triggers = [];
        const triggerDef = skill.trigger;

        /* 遍历所有视角 */
        ['player', 'global', 'source', 'target'].forEach(function (view) {
            if (triggerDef[view]) {
                const times = Array.isArray(triggerDef[view]) ? triggerDef[view] : [triggerDef[view]];
                times.forEach(function (time) {
                    const info = TRIGGER_TIMES[time] || { name: time, category: 'unknown' };
                    triggers.push({
                        view: view,
                        time: time,
                        name: info.name,
                        category: info.category,
                    });
                });
            }
        });

        return triggers;
    } catch (e) {
        return [];
    }
}

/* ================= 技能效果识别 ================= */
function getSkillEffects(skillId) {
    try {
        const skill = lib.skill[skillId];
        if (!skill || !skill.content) return [];

        const contentStr = skill.content.toString();
        const effects = [];

        /* 摸牌 */
        if (/player\.draw\(/.test(contentStr)) effects.push('draw');
        /* 回血 */
        if (/player\.recover\(/.test(contentStr)) effects.push('recover');
        /* 加体力上限 */
        if (/gainMaxHp/.test(contentStr)) effects.push('maxHp');
        /* 弃牌 */
        if (/chooseToDiscard/.test(contentStr)) effects.push('discard');
        /* 横置 */
        if (/player\.link\(/.test(contentStr)) effects.push('link');
        /* 造成伤害 */
        if (/damage\(/.test(contentStr)) effects.push('damage');
        /* 失去体力 */
        if (/loseHp\(/.test(contentStr)) effects.push('loseHp');
        /* 获得牌 */
        if (/gain\(/.test(contentStr)) effects.push('gain');
        /* 装备 */
        if (/equip\(/.test(contentStr)) effects.push('equip');
        /* 判定 */
        if (/judge\(/.test(contentStr)) effects.push('judge');
        /* 换牌 */
        if (/chooseToMove/.test(contentStr)) effects.push('move');
        /* 移除标记 */
        if (/removeMark/.test(contentStr)) effects.push('removeMark');
        /* 添加标记 */
        if (/addMark/.test(contentStr)) effects.push('addMark');
        /* 移除技能 */
        if (/removeSkill/.test(contentStr)) effects.push('removeSkill');
        /* 添加技能 */
        if (/addSkill/.test(contentStr)) effects.push('addSkill');
        /* 翻面 */
        if (/player\.turnOver/.test(contentStr)) effects.push('turnOver');
        /* 拼点 */
        if (/chooseToCompare/.test(contentStr)) effects.push('compare');
        /* 交换牌 */
        if (/swapHand/.test(contentStr)) effects.push('swapHand');
        /* 看牌 */
        if (/player\.reveal/.test(contentStr)) effects.push('reveal');
        /* 控顶 */
        if (/putCardOnTop/.test(contentStr)) effects.push('deckTop');
        /* 获得牌权 */
        if (/gainCard/.test(contentStr)) effects.push('gainCard');
        /* 弃置判定区牌 */
        if (/discardJudges/.test(contentStr)) effects.push('discardJudge');
        /* 移除装备 */
        if (/unequip/.test(contentStr)) effects.push('unequip');
        /* 重铸 */
        if (/recast/.test(contentStr)) effects.push('recast');
        /* 拼点赢 */
        if (/compareWin/.test(contentStr)) effects.push('compareWin');
        /* 拼点输 */
        if (/compareLose/.test(contentStr)) effects.push('compareLose');

        return effects;
    } catch (e) {
        return [];
    }
}

/* ================= AI决策辅助 ================= */
function predictSkillBehavior(skillId, player) {
    try {
        const type = getSkillType(skillId);
        const triggers = getSkillTriggers(skillId);
        const effects = getSkillEffects(skillId);

        /* 判断是否对自己有利 */
        let selfBenefit = 0;
        if (effects.indexOf('draw') >= 0) selfBenefit += 1;
        if (effects.indexOf('recover') >= 0) selfBenefit += 1.5;
        if (effects.indexOf('maxHp') >= 0) selfBenefit += 1;
        if (effects.indexOf('gain') >= 0) selfBenefit += 0.5;
        if (effects.indexOf('gainCard') >= 0) selfBenefit += 0.8;
        if (effects.indexOf('addMark') >= 0) selfBenefit += 0.3;
        if (effects.indexOf('addSkill') >= 0) selfBenefit += 1.2;
        if (effects.indexOf('recast') >= 0) selfBenefit += 0.5;
        if (effects.indexOf('deckTop') >= 0) selfBenefit += 0.6;
        if (effects.indexOf('discardJudge') >= 0) selfBenefit += 0.7;
        if (effects.indexOf('discard') >= 0) selfBenefit -= 0.5;
        if (effects.indexOf('damage') >= 0) selfBenefit -= 0.5;
        if (effects.indexOf('loseHp') >= 0) selfBenefit -= 1.5;
        if (effects.indexOf('turnOver') >= 0) selfBenefit -= 0.8;
        if (effects.indexOf('removeSkill') >= 0) selfBenefit -= 1.0;
        if (effects.indexOf('removeMark') >= 0) selfBenefit -= 0.3;
        if (effects.indexOf('unequip') >= 0) selfBenefit -= 0.6;
        if (effects.indexOf('swapHand') >= 0) selfBenefit -= 0.4;
        if (effects.indexOf('compareLose') >= 0) selfBenefit -= 0.7;

        /* 判断是否自动发动 */
        const isAuto = type.indexOf('auto') >= 0;
        const isForced = type.indexOf('forced') >= 0;

        return {
            skillId: skillId,
            type: type,
            triggers: triggers,
            effects: effects,
            selfBenefit: selfBenefit,
            isAuto: isAuto,
            isForced: isForced,
            predict: selfBenefit > 0 ? 'benefit' : (selfBenefit < 0 ? 'cost' : 'neutral'),
        };
    } catch (e) {
        return null;
    }
}

/* ================= 批量分析玩家技能 ================= */
function analyzePlayerSkills(player) {
    try {
        if (!player) return [];
        const skills = player.getSkills();
        const result = [];

        skills.forEach(function (skillId) {
            const analysis = predictSkillBehavior(skillId, player);
            if (analysis) result.push(analysis);
        });

        return result;
    } catch (e) {
        return [];
    }
}

/* ================= 统计玩家技能 ================= */
function summarizePlayerSkills(player) {
    try {
        const analysis = analyzePlayerSkills(player);
        const summary = {
            total: analysis.length,
            auto: 0,
            forced: 0,
            benefit: 0,
            cost: 0,
            neutral: 0,
            hasDraw: false,
            hasRecover: false,
            hasDamage: false,
            hasDiscard: false,
            hasLink: false,
        };

        analysis.forEach(function (a) {
            if (a.isAuto) summary.auto++;
            if (a.isForced) summary.forced++;
            if (a.predict === 'benefit') summary.benefit++;
            if (a.predict === 'cost') summary.cost++;
            if (a.predict === 'neutral') summary.neutral++;
            if (a.effects.indexOf('draw') >= 0) summary.hasDraw = true;
            if (a.effects.indexOf('recover') >= 0) summary.hasRecover = true;
            if (a.effects.indexOf('damage') >= 0) summary.hasDamage = true;
            if (a.effects.indexOf('discard') >= 0) summary.hasDiscard = true;
            if (a.effects.indexOf('link') >= 0) summary.hasLink = true;
        });

        return summary;
    } catch (e) {
        return null;
    }
}

/* ================= 代码规范检查 ================= */
function checkCodeStandards(skillId) {
    try {
        const skill = lib.skill[skillId];
        if (!skill) return { valid: false, errors: ['技能不存在'] };

        const errors = [];
        const warnings = [];

        /* 检查 trigger 格式 */
        if (skill.trigger) {
            if (!skill.trigger.player && !skill.trigger.global &&
                !skill.trigger.source && !skill.trigger.target) {
                warnings.push('trigger 没有明确的视角');
            }
        }

        /* 检查 content 格式 */
        if (skill.content) {
            const contentStr = skill.content.toString();
            if (contentStr.indexOf('function') < 0) {
                errors.push('content 不是函数');
            }
        }

        /* 检查是否有中文标点 */
        const allStr = JSON.stringify(skill);
        if (/[，。；：！？]/.test(allStr)) {
            warnings.push('代码中包含中文标点');
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
        };
    } catch (e) {
        return { valid: false, errors: [e.message] };
    }
}

/* ================= 全局分析 ================= */
function analyzeAllSkills() {
    try {
        const result = {
            total: 0,
            auto: 0,
            forced: 0,
            withTrigger: 0,
            withContent: 0,
            invalid: [],
        };

        Object.keys(lib.skill).forEach(function (skillId) {
            result.total++;
            const skill = lib.skill[skillId];
            if (!skill) return;

            if (skill.frequent) result.auto++;
            if (skill.forced) result.forced++;
            if (skill.trigger) result.withTrigger++;
            if (skill.content) result.withContent++;

            const check = checkCodeStandards(skillId);
            if (!check.valid) {
                result.invalid.push({ skillId: skillId, errors: check.errors });
            }
        });

        return result;
    } catch (e) {
        return null;
    }
}

/* ================= 挂载 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.skillTiming = {
        getSkillType: getSkillType,
        getSkillTriggers: getSkillTriggers,
        getSkillEffects: getSkillEffects,
        predictSkillBehavior: predictSkillBehavior,
        analyzePlayerSkills: analyzePlayerSkills,
        summarizePlayerSkills: summarizePlayerSkills,
        checkCodeStandards: checkCodeStandards,
        analyzeAllSkills: analyzeAllSkills,
        TRIGGER_TIMES: TRIGGER_TIMES,
    };
    log.info('skillTiming', '技能触发时机识别模块已加载');
}
