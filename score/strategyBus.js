/*
 * ============================================
 * // Éditeur: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 策略总线 =================
 * 目标：规则 vs 模型 冲突时，用"深度规划"做最终仲裁。
 */
import { lib, game, get, _status } from '../../../noname.js';
import { log } from './logger.js';

// Autor: Feisheng Original | Licencia: GPL-3.0
const BUS_STATS = {
    checks: 0,
    arbitrations: 0,
    plannerWins: 0,
    ruleWins: 0,
    modelWins: 0,
    byReason: {},
};

export function arbitrate(ruleBest, modelPick, me, candidates) {
    BUS_STATS.checks++;
    try {
        if (!ruleBest) return { winner: 'rule', picked: ruleBest, reason: '规则为空' };
        if (!modelPick || modelPick.confidence < 0.55) {
            BUS_STATS.ruleWins++;
            return { winner: 'rule', picked: ruleBest, reason: '模型置信低' };
        }

        const ruleLabel = _labelOf(ruleBest);
        if (ruleLabel === modelPick.label) {
            BUS_STATS.ruleWins++;
            return { winner: 'rule', picked: ruleBest, reason: '规则与模型一致' };
        }

        BUS_STATS.arbitrations++;
        const planner = _tryPlanner(me, ruleBest, modelPick, candidates);
        if (planner && planner.winner) {
            if (planner.winner === 'planner') BUS_STATS.plannerWins++;
            else if (planner.winner === 'rule') BUS_STATS.ruleWins++;
            else BUS_STATS.modelWins++;
            const reason = '冲突仲裁：' + planner.reason;
            BUS_STATS.byReason[planner.winner] = (BUS_STATS.byReason[planner.winner] || 0) + 1;
            try { log.info('strategyBus', reason + '（规则 ' + ruleLabel + ' vs 模型 ' + modelPick.label + '）'); } catch (e) {}
            return { winner: planner.winner, picked: planner.picked, reason: reason };
        }

        BUS_STATS.ruleWins++;
        return { winner: 'rule', picked: ruleBest, reason: '无 planner，保守选规则' };
    } catch (e) {
        BUS_STATS.ruleWins++;
        return { winner: 'rule', picked: ruleBest, reason: '总线异常：' + e.message };
    }
}

function _labelOf(best) {
    try {
        if (!best) return 'A';
        if (best.type === 'skill') return 'F';
        if (best.type === 'equip') return 'E';
        if (best.type === 'end') return 'C';
        const id = best.id;
        if (['sha','juedou','huogong','nanman','wanjian','zhujin','shunshou','guohe','tiesuo','lebu','bingliang'].indexOf(id) >= 0) return 'D';
        if (['shan','tao','wuxie','jiu'].indexOf(id) >= 0) return 'C';
        return 'B';
    } catch (e) { return 'A'; }
}

function _tryPlanner(me, ruleBest, modelPick, candidates) {
    try {
        if (!me) return null;
        if (!candidates || candidates.length < 2) return null;

        let planFn = null;
        try {
            if (window.__DJSC && window.__DJSC.planSequence) {
                planFn = window.__DJSC.planSequence;
            }
        } catch (e) {}

        const ruleAction = candidates.find(function (c) { return c.id === ruleBest.id; });
        const modelAction = _findByLabel(candidates, modelPick.label);

        if (!ruleAction || !modelAction) {
            if (ruleAction && !modelAction) return { winner: 'rule', picked: ruleAction, reason: '模型动作不可用' };
            if (modelAction && !ruleAction) return { winner: 'model', picked: modelAction, reason: '规则动作不可用' };
            return null;
        }

        const scoreGap = (ruleAction.score || 0) - (modelAction.score || 0);
        if (Math.abs(scoreGap) >= 5) {
            if (scoreGap > 0) return { winner: 'rule', picked: ruleAction, reason: '规则分差 ' + scoreGap.toFixed(1) };
            return { winner: 'model', picked: modelAction, reason: '模型分差 ' + Math.abs(scoreGap).toFixed(1) };
        }

        if (planFn) {
            try {
                const plan = planFn(me);
                if (plan && plan.best) {
                    const planIds = (plan.best.steps || []).map(function (s) { return s.id || s; });
                    const ruleInPlan = planIds.indexOf(ruleBest.id) >= 0;
                    const modelInPlan = planIds.indexOf(modelAction.id) >= 0;
                    if (ruleInPlan && !modelInPlan) return { winner: 'rule', picked: ruleAction, reason: '规划选中规则路径' };
                    if (modelInPlan && !ruleInPlan) return { winner: 'model', picked: modelAction, reason: '规划选中模型路径' };
                    if (ruleInPlan && modelInPlan) {
                        return scoreGap > 0
                            ? { winner: 'rule', picked: ruleAction, reason: '规划均命中，规则分高' }
                            : { winner: 'model', picked: modelAction, reason: '规划均命中，模型分高' };
                    }
                }
            } catch (e) {}
        }

        const counter = _simpleCounter(me, ruleAction, modelAction);
        if (counter) return counter;

        return scoreGap > 0
            ? { winner: 'rule', picked: ruleAction, reason: '兜底选高分规则' }
            : { winner: 'model', picked: modelAction, reason: '兜底选高分模型' };
    } catch (e) { return null; }
}

function _simpleCounter(me, ruleAction, modelAction) {
    try {
        const tgt = _resolveTarget(me, ruleAction);
        if (!tgt) return null;

        const hasShan = tgt.countCards && tgt.countCards('hs', 'shan') > 0;
        const hasTao  = tgt.countCards && tgt.countCards('hs', 'tao') > 0;
        const hp = tgt.hp || 0;

        const ruleAtk = ['sha', 'juedou', 'huogong'].indexOf(ruleAction.id) >= 0;
        const modelAtk = ['sha', 'juedou', 'huogong'].indexOf(modelAction.id) >= 0;

        if (ruleAtk && hasShan && hp > 1) {
            return { winner: 'model', picked: modelAction, reason: '目标有闪，规则攻击被挡' };
        }
        if (modelAtk && !hasShan && hp <= 2) {
            return { winner: 'model', picked: modelAction, reason: '目标无闪且残血，模型进攻更优' };
        }
        return null;
    } catch (e) { return null; }
}

function _resolveTarget(me, action) {
    try {
        if (!action || !action.target) return null;
        for (const p of (game.players || [])) {
            if (!p) continue;
            if ((p.name1 || p.name || '') === action.target) return p;
        }
    } catch (e) {}
    return null;
}

function _findByLabel(candidates, label) {
    try {
        for (const c of candidates) {
            const cl = (function () {
                if (c.type === 'skill') return 'F';
                if (c.type === 'equip') return 'E';
                if (c.type === 'end') return 'C';
                const id = c.id;
                if (['sha','juedou','huogong','nanman','wanjian','zhujin','shunshou','guohe','tiesuo','lebu','bingliang'].indexOf(id) >= 0) return 'D';
                if (['shan','tao','wuxie','jiu'].indexOf(id) >= 0) return 'C';
                return 'B';
            })();
            if (cl === label) return c;
        }
    } catch (e) {}
    return null;
}

export function strategyBusStats() {
    return {
        checks: BUS_STATS.checks,
        arbitrations: BUS_STATS.arbitrations,
        plannerWins: BUS_STATS.plannerWins,
        ruleWins: BUS_STATS.ruleWins,
        modelWins: BUS_STATS.modelWins,
        byReason: Object.assign({}, BUS_STATS.byReason),
        arbitrationRate: BUS_STATS.checks > 0
            ? Math.round(BUS_STATS.arbitrations / BUS_STATS.checks * 100) + '%' : '0%',
    };
}

export function resetStrategyBus() {
    BUS_STATS.checks = 0;
    BUS_STATS.arbitrations = 0;
    BUS_STATS.plannerWins = 0;
    BUS_STATS.ruleWins = 0;
    BUS_STATS.modelWins = 0;
    BUS_STATS.byReason = {};
    log.info('strategyBus', '策略总线已复位');
}

if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.strategyBus = {
        arbitrate: arbitrate,
        stats: strategyBusStats,
        reset: resetStrategyBus,
    };
}
