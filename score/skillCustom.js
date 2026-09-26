/*
 * ============================================
 * // Autor: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 自定义技能六维面板 =================
 * 可以自定义技能的六维度乘数和效果/成本分
 * 范围：±5
 */

/* ★ 自定义六维度乘数表（可在面板里修改） */
// Forfatter: Feisheng Original | Lisens: GPL-3.0
const CUSTOM_OBJ_MUL = {
    self: 1.0, team: 1.2, enemy: 1.0,
    multiEnemy: 1.35, multiTeam: 1.15, all: 0.85, dying: 1.4,
};

const CUSTOM_EFFECT_BASE = {
    draw: +1.0, gain: +1.2, damage: +2.0, recover: +2.0,
    maxHp: +1.5, revive: +4.0,
    discardEnemy: +1.2, turnOver: +3.0, link: +1.0, skip: +1.2, judgeCard: +1.2,
    loseEnemy: +0.8, loseEnemyHp: +2.0, loseEnemyMaxHp: +1.5,
    mark: +0.6, addSkill: +1.0, addTempSkill: +0.8, addShan: +0.5, giveCard: +1.0,
    judge: +0.3, compare: +1.2, viewAs: +1.0, guanxing: +0.8, topCards: +0.6,
    changeHp: +0.8,
    teamGain: +1.2, teamAid: +1.6, teamChain: +0.9,
    awaken: +3.0, limit: +4.0,
};

const CUSTOM_COST_WEIGHT = {
    loseHp: 2.0, loseMaxHp: 1.5, selfDamage: 2.0,
    selfDiscard: 0.8, selfLose: 0.8,
    selfTurnOver: 3.0, selfLink: 1.0, selfSkip: 1.2,
    selfRemove: 5.0, selfDie: 8.0,
    teamHurt: 1.4, teamRisk: 0.5,
    feedDraw: 1.0, feedGain: 1.2, feedRecover: 2.0,
    feedHp: 1.5, feedSkill: 1.0, feedMark: 0.6,
};

const CUSTOM_TIMING_MUL = {
    dying: 1.6, damageAfter: 1.3, damaged: 1.2, chooseToRespond: 1.2,
    phaseUse: 1.0, phaseDraw: 1.0, useCard: 1.0, chooseToUse: 1.0,
    phaseZhunbei: 0.9, phaseDiscard: 0.9, phaseJieshu: 0.9,
    judge: 0.9, passive: 0.85, die: 0.3,
};

const CUSTOM_FREQ_MUL = {
    limit: 2.0, awaken: 1.8, perRound: 1.5, rare: 1.3,
    perTurn: 1.0, frequent: 1.1, passive: 1.15, locked: 1.05,
};

const CUSTOM_RANGE_MUL = { single: 1.0, few: 1.25, many: 1.45, all: 1.55 };

const CUSTOM_RISK_MUL = { none: 1.0, judge: 0.75, compare: 0.85, chance: 0.9 };

const CUSTOM_DURATION_MUL = { instant: 1.0, turn: 1.15, round: 1.25, game: 1.5, forever: 1.8 };

/* ★ 提醒：值的范围 */
const VALUE_HINTS = {
    effect: '效果分：0~5，建议 0.5~3.0',
    cost: '成本分：0~5，建议 0.5~4.0',
    multiplier: '乘数：0.3~2.0，建议 0.8~1.5',
    final: '最终分：±5，超过自动封顶',
};

/* ★ 维度说明 */
const DIM_DESCRIPTIONS = {
    object: '【对象】技能作用目标：自己/队友/敌人/多敌/多友/全场/濒死',
    range: '【范围】技能影响范围：单体/少量/多体/全体',
    timing: '【时机】技能触发时机：出牌阶段/受伤后/濒死/判定/被动等',
    frequency: '【频率】技能使用频率：限定技/觉醒技/每轮/每回合/被动/锁定',
    risk: '【风险】技能风险：无/判定/拼点/概率',
    duration: '【持续】技能持续时间：即时/一轮/一回合/整局/永久',
    effect: '【效果分】技能带来的正收益：摸牌/伤害/回血/控制等',
    cost: '【成本分】技能带来的负收益：掉血/弃牌/翻面等',
};

/* ★ 对象说明 */
const OBJECT_DESCRIPTIONS = {
    self: '自己：只影响自己',
    team: '队友：影响队友',
    enemy: '敌人：影响敌人',
    multiEnemy: '多敌：影响多个敌人',
    multiTeam: '多友：影响多个队友',
    all: '全场：影响所有角色',
    dying: '濒死：影响濒死角色',
};

/* ★ 时机说明 */
const TIMING_DESCRIPTIONS = {
    dying: '濒死：自己或别人濒死时触发',
    damageAfter: '伤害后：造成伤害后触发',
    damaged: '受伤后：受到伤害后触发',
    chooseToRespond: '响应选择：别人问你要不要出闪/桃等',
    phaseUse: '出牌阶段：自己出牌阶段',
    phaseDraw: '摸牌阶段：自己摸牌阶段',
    useCard: '使用牌：使用牌时触发',
    chooseToUse: '使用选择：你问别人要不要出什么',
    phaseZhunbei: '准备阶段：回合开始时',
    phaseDiscard: '弃牌阶段：自己弃牌阶段',
    phaseJieshu: '结束阶段：回合结束时',
    judge: '判定阶段：判定牌生效前',
    passive: '被动：被动技能，自动触发',
    die: '死亡：角色死亡时触发',
};

/* ★ 频率说明 */
const FREQ_DESCRIPTIONS = {
    limit: '限定技：整局游戏只能用一次',
    awaken: '觉醒技：满足条件后永久生效',
    perRound: '每轮：每个大轮可以用一次',
    rare: '稀有：很少能触发',
    perTurn: '每回合：每个回合可以用一次',
    frequent: '频繁：经常能触发',
    passive: '被动：被动技能',
    locked: '锁定：锁定技，必须触发',
};

/* ★ 范围说明 */
const RANGE_DESCRIPTIONS = {
    single: '单体：只影响一个角色',
    few: '少量：影响 2~3 个角色',
    many: '多体：影响 4~5 个角色',
    all: '全体：影响所有角色',
};
/* Συγγραφέας: Feisheng Original, Με επιφύλαξη παντός δικαιώματος */

/* ★ 风险说明 */
const RISK_DESCRIPTIONS = {
    none: '无风险：必定生效',
    judge: '判定风险：需要判定牌配合',
    compare: '拼点风险：需要拼点赢',
    chance: '概率风险：有概率失败',
};

/* ★ 持续时间说明 */
const DURATION_DESCRIPTIONS = {
    instant: '即时：立刻生效，马上结束',
    turn: '一轮：持续一个回合',
    round: '一回合：持续一个大轮',
    game: '整局：持续整局游戏',
    forever: '永久：永久生效，不会消失',
};

/* ★ 模板：郭嘉·遗计 */
const TEMPLATES = {
    '郭嘉·遗计': {
        name: '郭嘉·遗计',
        description: '受到伤害后摸两张牌',
        effects: {
            damage: 2.0,
            draw: 1.0,
        },
        costs: {
            loseHp: 2.0,
        },
        dimensions: {
            object: 'self',
            range: 'single',
            timing: 'damaged',
            frequency: 'perTurn',
            risk: 'none',
            duration: 'instant',
        },
    },
    '诸葛亮·观星': {
        name: '诸葛亮·观星',
        description: '观看牌堆顶五张牌并调整顺序',
        effects: {
            guanxing: 0.8,
            topCards: 0.6,
        },
        costs: {},
        dimensions: {
            object: 'self',
            range: 'single',
            timing: 'phaseZhunbei',
            frequency: 'perRound',
            risk: 'none',
            duration: 'instant',
        },
    },
    '孙尚香·结姻': {
        name: '孙尚香·结姻',
        description: '弃两张牌，与一名男性角色各回复1点体力',
        effects: {
            recover: 2.0,
            teamAid: 1.6,
        },
        costs: {
            selfDiscard: 0.8,
        },
        dimensions: {
            object: 'team',
            range: 'single',
            timing: 'chooseToUse',
            frequency: 'perTurn',
            risk: 'none',
            duration: 'instant',
        },
    },
};

/* ★ 获取自定义值 */
export function getCustomObjMul() { return { ...CUSTOM_OBJ_MUL }; }
export function getCustomEffectBase() { return { ...CUSTOM_EFFECT_BASE }; }
export function getCustomCostWeight() { return { ...CUSTOM_COST_WEIGHT }; }
export function getCustomTimingMul() { return { ...CUSTOM_TIMING_MUL }; }
export function getCustomFreqMul() { return { ...CUSTOM_FREQ_MUL }; }
export function getCustomRangeMul() { return { ...CUSTOM_RANGE_MUL }; }
export function getCustomRiskMul() { return { ...CUSTOM_RISK_MUL }; }
export function getCustomDurationMul() { return { ...CUSTOM_DURATION_MUL }; }
export function getValueHints() { return { ...VALUE_HINTS }; }
export function getDimDescriptions() { return { ...DIM_DESCRIPTIONS }; }
export function getObjectDescriptions() { return { ...OBJECT_DESCRIPTIONS }; }
export function getTimingDescriptions() { return { ...TIMING_DESCRIPTIONS }; }
export function getFreqDescriptions() { return { ...FREQ_DESCRIPTIONS }; }
export function getRangeDescriptions() { return { ...RANGE_DESCRIPTIONS }; }
export function getRiskDescriptions() { return { ...RISK_DESCRIPTIONS }; }
export function getDurationDescriptions() { return { ...DURATION_DESCRIPTIONS }; }
export function getTemplates() { return { ...TEMPLATES }; }

/* ★ 保存自定义值 */
export function saveCustomValue(category, key, value) {
    try {
        const v = parseFloat(value);
        if (isNaN(v)) return false;
        switch (category) {
            case 'obj': CUSTOM_OBJ_MUL[key] = v; break;
            case 'effect': CUSTOM_EFFECT_BASE[key] = v; break;
            case 'cost': CUSTOM_COST_WEIGHT[key] = v; break;
            case 'timing': CUSTOM_TIMING_MUL[key] = v; break;
            case 'freq': CUSTOM_FREQ_MUL[key] = v; break;
            case 'range': CUSTOM_RANGE_MUL[key] = v; break;
            case 'risk': CUSTOM_RISK_MUL[key] = v; break;
            case 'duration': CUSTOM_DURATION_MUL[key] = v; break;
            default: return false;
        }
        return true;
    } catch (e) { return false; }
}

/* ★ 重置为默认值 */
export function resetCustomValues() {
    try {
        Object.keys(CUSTOM_OBJ_MUL).forEach(k => delete CUSTOM_OBJ_MUL[k]);
        Object.assign(CUSTOM_OBJ_MUL, {
            self: 1.0, team: 1.2, enemy: 1.0,
            multiEnemy: 1.35, multiTeam: 1.15, all: 0.85, dying: 1.4,
        });
        return true;
    } catch (e) { return false; }
}
