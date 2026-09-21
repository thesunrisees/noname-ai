/* ================= 技能八维度评分规则 =================
 * final = clamp((Σ效果 + Σ成本) × 六维度乘数, -15, +15)
 */

/* 维度 1：对象系数 */
export const OBJECT_MUL = {
    self: 1.0, team: 1.2, enemy: 1.0,
    multiEnemy: 1.35, multiTeam: 1.15, all: 0.85, dying: 1.4,
};

/* 维度 2：效果基础分（只放正收益） */
export const EFFECT_BASE = {
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

/* 维度 3：成本扣分（只放负收益） */
export const COST_WEIGHT = {
    loseHp: 2.0, loseMaxHp: 1.5, selfDamage: 2.0,
    selfDiscard: 0.8, selfLose: 0.8,
    selfTurnOver: 3.0, selfLink: 1.0, selfSkip: 1.2,
    selfRemove: 5.0, selfDie: 8.0,
    teamHurt: 1.4, teamRisk: 0.5,
    feedDraw: 1.0, feedGain: 1.2, feedRecover: 2.0,
    feedHp: 1.5, feedSkill: 1.0, feedMark: 0.6,
};

/* 维度 4~8：乘数表 */
export const TIMING_MUL = {
    dying: 1.6, damageAfter: 1.3, damaged: 1.2, chooseToRespond: 1.2,
    phaseUse: 1.0, phaseDraw: 1.0, useCard: 1.0, chooseToUse: 1.0,
    phaseZhunbei: 0.9, phaseDiscard: 0.9, phaseJieshu: 0.9,
    judge: 0.9, passive: 0.85, die: 0.3,
};
export const FREQ_MUL = {
    limit: 2.0, awaken: 1.8, perRound: 1.5, rare: 1.3,
    perTurn: 1.0, frequent: 1.1, passive: 1.15, locked: 1.05,
};
export const RANGE_MUL = { single: 1.0, few: 1.25, many: 1.45, all: 1.55 };
export const RISK_MUL = { none: 1.0, judge: 0.75, compare: 0.85, chance: 0.9 };
export const DURATION_MUL = { instant: 1.0, turn: 1.15, round: 1.25, game: 1.5, forever: 1.8 };

/* 中文标签 */
export const EFFECT_LABELS = {
    draw: '摸牌', gain: '获得牌', damage: '造成伤害', recover: '回复体力',
    maxHp: '体力上限+', revive: '复活', discardEnemy: '拆敌方牌',
    turnOver: '翻面控制', link: '横置', skip: '跳过阶段', judgeCard: '增加判定牌',
    loseEnemy: '敌方损失', loseEnemyHp: '削敌体力', loseEnemyMaxHp: '削敌体力上限',
    mark: '标记/资源', addSkill: '获得技能', addTempSkill: '临时技能',
    addShan: '增加闪', giveCard: '给牌辅助', judge: '判定', compare: '拼点',
    viewAs: '转化(视为)', guanxing: '观星/控顶', topCards: '牌堆操作',
    changeHp: '体力变动', teamGain: '团队配合收益', teamAid: '队友救援收益',
    teamChain: '技能联动', awaken: '觉醒收益', limit: '限定技爆发',
};
export const COST_LABELS = {
    loseHp: '失去体力', loseMaxHp: '失去体力上限', selfDamage: '对己伤害',
    selfDiscard: '弃置手牌', selfLose: '失去牌', selfTurnOver: '自身翻面',
    selfLink: '自身横置', selfSkip: '跳过自身阶段', selfRemove: '移除自身',
    selfDie: '死亡风险', teamHurt: '团队误伤', teamRisk: '全场风险',
    feedDraw: '资敌摸牌', feedGain: '资敌获得牌', feedRecover: '资敌回血',
    feedHp: '资敌加体力', feedSkill: '资敌技能', feedMark: '资敌标记',
};

/* 从 tags 推导六维度 */
export function deriveDimensions(tags, ctx) {
    const sk = (ctx && ctx.skill) || {};

    /* 对象 */
    let object = 'self';
    const hasTeam = (tags.teamGain || 0) > 0 || (tags.teamAid || 0) > 0;
    const hasEnemyDmg = (tags.damage || 0) > 0 || (tags.loseEnemyHp || 0) > 0;
    const hasTeamHurt = (tags.teamHurt || 0) < 0;
    if (hasTeam && !hasTeamHurt) object = 'team';
    else if (hasEnemyDmg) object = 'enemy';
    else if ((tags.aoe || 0) > 0.5) object = 'multiEnemy';
    else if ((tags.teamGain || 0) > 0.5) object = 'multiTeam';
    if (tags.__phases && tags.__phases.indexOf('dying') >= 0) object = 'dying';

    /* 范围 */
    let range = 'single';
    if ((tags.aoe || 0) >= 1.5) range = 'all';
    else if ((tags.aoe || 0) >= 0.5 || (tags.__targets || []).indexOf('multi') >= 0) range = 'many';
    else if ((tags.__targets || []).length >= 2) range = 'few';

    /* 时机 */
    let timing = 'phaseUse';
    const phases = tags.__phases || [];
    const PRIO = ['dying', 'damageAfter', 'damaged', 'chooseToRespond',
                  'phaseUse', 'phaseDraw', 'useCard', 'judge',
                  'phaseZhunbei', 'phaseJieshu', 'passive'];
    for (const p of PRIO) {
        if (phases.indexOf(p) >= 0) { timing = p; break; }
    }

    /* 频率 */
    let frequency = 'perTurn';
    const limits = tags.__limits || {};
    if (limits.limited) frequency = 'limit';
    else if (limits.awaken) frequency = 'awaken';
    else if (limits.perRound) frequency = 'perRound';
    else if (limits.frequent) frequency = 'frequent';
    else if (limits.forced || limits.locked) frequency = 'locked';
    else if (sk.mod) frequency = 'passive';

    /* 风险 */
    let risk = 'none';
    if ((tags.judge || 0) > 0.5) risk = 'judge';
    else if ((tags.compare || 0) > 0.5) risk = 'compare';

    /* 持续 */
    let duration = 'instant';
    if (sk.mod) duration = 'game';
    else if ((tags.addTempSkill || 0) > 0.5) duration = 'turn';
    else if ((tags.addSkill || 0) > 0.5) duration = 'game';
    else if ((tags.maxHp || 0) > 0.5 || (tags.awaken || 0) > 0.5) duration = 'forever';

    return { object, range, timing, frequency, risk, duration };
}

/* 主入口：综合评分 */
export function scoreSkill(tags, ctx) {
    ctx = ctx || {};
    const dims = ctx.dims || deriveDimensions(tags, ctx);

    const breakdown = [];
    let effectScore = 0;
    for (const key in EFFECT_BASE) {
        const v = tags[key] || 0;
        if (Math.abs(v) < 0.01) continue;
        const s = v * EFFECT_BASE[key];
        effectScore += s;
        breakdown.push({
            kind: 'effect', key: key,
            label: EFFECT_LABELS[key] || key,
            raw: Math.round(v * 100) / 100,
            coeff: EFFECT_BASE[key],
            score: Math.round(s * 100) / 100,
        });
    }

    let costScore = 0;
    for (const key in COST_WEIGHT) {
        const v = tags[key] || 0;
        if (Math.abs(v) < 0.01) continue;
        const s = v * COST_WEIGHT[key];
        costScore += s;
        breakdown.push({
            kind: 'cost', key: key,
            label: '成本·' + (COST_LABELS[key] || key),
            raw: Math.round(Math.abs(v) * 100) / 100,
            coeff: -COST_WEIGHT[key],
            score: Math.round(s * 100) / 100,
        });
    }

    const objectMul = OBJECT_MUL[dims.object] || 1.0;
    const rangeMul = RANGE_MUL[dims.range] || 1.0;
    const timingMul = TIMING_MUL[dims.timing] || 1.0;
    const frequencyMul = FREQ_MUL[dims.frequency] || 1.0;
    const riskMul = RISK_MUL[dims.risk] || 1.0;
    const durationMul = DURATION_MUL[dims.duration] || 1.0;

    const baseScore = effectScore + costScore;
    const mul = objectMul * rangeMul * timingMul * frequencyMul * riskMul * durationMul;
    const raw = baseScore * mul;
    let final = Math.round(raw * 100) / 100;
    if (final > 15) final = 15;
    if (final < -15) final = -15;

    return {
        final, raw: Math.round(raw * 100) / 100,
        effectScore: Math.round(effectScore * 100) / 100,
        costScore: Math.round(costScore * 100) / 100,
        baseScore: Math.round(baseScore * 100) / 100,
        mul: Math.round(mul * 100) / 100,
        dims, breakdown,
        clamped: raw !== final,
    };
}

/* 面板纯文本渲染 */
export function renderScoreBreakdown(sid, tags, ctx) {
    try {
        const r = scoreSkill(tags, ctx);
        const d = r.dims;
        const L = [];
        L.push('=== ' + ((ctx && ctx.skill && ctx.skill.name) || sid) + ' 多维评分 ===');
        L.push('');
        L.push('【八维度】');
        L.push('  对象：' + d.object + ' × ' + OBJECT_MUL[d.object]);
        L.push('  范围：' + d.range + ' × ' + RANGE_MUL[d.range]);
        L.push('  时机：' + d.timing + ' × ' + TIMING_MUL[d.timing]);
        L.push('  频率：' + d.frequency + ' × ' + FREQ_MUL[d.frequency]);
        L.push('  风险：' + d.risk + ' × ' + RISK_MUL[d.risk]);
        L.push('  持续：' + d.duration + ' × ' + DURATION_MUL[d.duration]);
        L.push('');
        const eff = r.breakdown.filter(function (b) { return b.kind === 'effect'; });
        L.push('【效果分】（' + (r.effectScore >= 0 ? '+' : '') + r.effectScore + '）');
        if (eff.length) eff.forEach(function (b) {
            L.push('  · ' + b.label + '：' + b.raw + ' × ' + b.coeff + ' = ' + (b.score >= 0 ? '+' : '') + b.score);
        });
        else L.push('  · （无）');
        L.push('');
        const cst = r.breakdown.filter(function (b) { return b.kind === 'cost'; });
        L.push('【成本分】（' + r.costScore + '）');
        if (cst.length) cst.forEach(function (b) {
            L.push('  · ' + b.label + '：' + b.raw + ' × ' + b.coeff + ' = ' + b.score);
        });
        else L.push('  · （无）');
        L.push('');
        L.push('【综合】');
        L.push('  基础分 = ' + r.baseScore + '（效果 ' + r.effectScore + ' + 成本 ' + r.costScore + '）');
        L.push('  乘数 = ×' + r.mul);
        L.push('  原始分 = ' + r.raw);
        L.push(r.clamped ? '  ⚠ 封顶 → 最终 ' + r.final : '  最终分 = ' + r.final);
        return L.join('\n');
    } catch (e) { return '=== ' + sid + ' ===\n渲染异常：' + String(e).slice(0, 80); }
}
