/* ================= 决策积分引擎 · 元认知（元级自省） =================
 * 核心问题：AI 遇到一个决策时，它"熟悉"这个场景吗？
 * 应用：
 *   · 熟悉 → 允许模型高权重接管
 *   · 陌生 → 强制降级到规则引擎
 * 熟悉度的构成（6 维）：
 *   ① 元素熟悉度：技能/卡牌使用深度
 *   ② 目标熟悉度：与目标交手次数
 *   ③ 局势熟悉度：本局决策样本量
 *   ④ 模式熟悉度：当前游戏模式（身份/2v2/虎牢关等）
 *   ⑤ 局面熟悉度：残局/优势/劣势/集火
 *   ⑥ 时间压力：濒死/决胜回合等关键时刻
 */
import { lib, game, get, _status } from '../../../../../noname.js';
import { log } from '../../logger.js';

/* ================= 本局运行时统计 ================= */
const RUNTIME = {
    /* elementId → 使用次数 */
    skillUsed: {},
    cardUsed: {},
    /* playerKey → 交手次数 */
    targetMet: {},
    /* 总决策次数 */
    decisions: 0,
    /* 每局开始时清零 */
    startedAt: 0,
};

/* ================= 全局统计（跨局持久） ================= */
const STORE_KEY = 'djsc_metacog_v1';
let GLOBAL = { skillGlobal: {}, cardGlobal: {}, totalGames: 0 };
let _loaded = false;

function _loadGlobal() {
    try {
        if (_loaded) return;
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) {
            const obj = JSON.parse(raw);
            if (obj && obj.v === 1) GLOBAL = obj;
        }
        _loaded = true;
    } catch (e) { _loaded = true; }
}
function _saveGlobal() {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify({
            v: 1,
            skillGlobal: GLOBAL.skillGlobal,
            cardGlobal: GLOBAL.cardGlobal,
            totalGames: GLOBAL.totalGames,
        }));
    } catch (e) {}
}

/* ================= 记录接口 ================= */
export function metaStartGame() {
    RUNTIME.skillUsed = {};
    RUNTIME.cardUsed = {};
    RUNTIME.targetMet = {};
    RUNTIME.decisions = 0;
    RUNTIME.startedAt = Date.now();
}

export function metaRecordSkill(id) {
    if (!id) return;
    RUNTIME.skillUsed[id] = (RUNTIME.skillUsed[id] || 0) + 1;
    _loadGlobal();
    GLOBAL.skillGlobal[id] = (GLOBAL.skillGlobal[id] || 0) + 1;
}
export function metaRecordCard(id) {
    if (!id) return;
    RUNTIME.cardUsed[id] = (RUNTIME.cardUsed[id] || 0) + 1;
    _loadGlobal();
    GLOBAL.cardGlobal[id] = (GLOBAL.cardGlobal[id] || 0) + 1;
}
export function metaRecordTarget(playerKey) {
    if (!playerKey) return;
    RUNTIME.targetMet[playerKey] = (RUNTIME.targetMet[playerKey] || 0) + 1;
}
export function metaRecordDecision() {
    RUNTIME.decisions++;
}
export function metaSettleGame() {
    _loadGlobal();
    GLOBAL.totalGames++;
    /* 局结束时把本局使用记录合并到全局 */
    Object.keys(RUNTIME.skillUsed).forEach(function (k) {
        GLOBAL.skillGlobal[k] = (GLOBAL.skillGlobal[k] || 0) + RUNTIME.skillUsed[k];
    });
    Object.keys(RUNTIME.cardUsed).forEach(function (k) {
        GLOBAL.cardGlobal[k] = (GLOBAL.cardGlobal[k] || 0) + RUNTIME.cardUsed[k];
    });
    _saveGlobal();
}

/* ================= 熟悉度计算 ================= */

/* 元素熟悉度：0~1 */
function _elementFamiliarity(kind, id) {
    try {
        if (!id) return 0;
        _loadGlobal();

        /* ① 影子表里有没有 AI 自己的定义？ */
        let hasShadow = 0;
        try {
            if (kind === 'skill') {
                const sk = window.__DJSC && window.__DJSC.element && window.__DJSC.element.readSkill
                    ? window.__DJSC.element.readSkill(id) : null;
                if (sk && sk.source === 'override') hasShadow = 1;
            } else if (kind === 'card') {
                const cd = window.__DJSC && window.__DJSC.element && window.__DJSC.element.readCard
                    ? window.__DJSC.element.readCard(id) : null;
                if (cd && cd.source === 'override') hasShadow = 1;
            }
        } catch (e) {}

        /* ② 本局用了多少次（最多计 3 次） */
        const usedLocal = kind === 'skill'
            ? (RUNTIME.skillUsed[id] || 0)
            : (RUNTIME.cardUsed[id] || 0);
        const localScore = Math.min(1, usedLocal / 3);

        /* ③ 全局累计用了多少次（开方缩放） */
        const usedGlobal = kind === 'skill'
            ? (GLOBAL.skillGlobal[id] || 0)
            : (GLOBAL.cardGlobal[id] || 0);
        const globalScore = Math.min(1, Math.sqrt(usedGlobal / 20));

        /* 综合加权 */
        return hasShadow * 0.4 + localScore * 0.35 + globalScore * 0.25;
    } catch (e) { return 0; }
}

/* 目标熟悉度：0~1 */
function _targetFamiliarity(playerKey) {
    try {
        if (!playerKey) return 0;
        const met = RUNTIME.targetMet[playerKey] || 0;
        return Math.min(1, met / 5);
    } catch (e) { return 0; }
}

/* 局势熟悉度：本局已决策次数 / 20 */
function _situationFamiliarity() {
    try {
        return Math.min(1, RUNTIME.decisions / 20);
    } catch (e) { return 0; }
}

/* ================= ★ 新增：模式熟悉度 =================
 * 不同游戏模式下，同一技能/卡牌的价值完全不同。
 * 记录每个模式下的使用次数，模式匹配时加分。
 */
function _getModeKey() {
    try {
        if (typeof game !== 'undefined' && game.mode) return game.mode;
        if (typeof _status !== 'undefined' && _status.mode) return _status.mode;
        return 'default';
    } catch (e) { return 'default'; }
}

function _modeFamiliarity(kind, id) {
    try {
        if (!id) return 0;
        _loadGlobal();
        const mode = _getModeKey();
        const modeStats = GLOBAL.modeGlobal || {};
        const modeStatsOfKind = modeStats[kind + 'Global'] || {};
        const modeStatsOfId = modeStatsOfKind[id] || {};
        const usesInMode = modeStatsOfId[mode] || 0;
        return Math.min(1, Math.sqrt(usesInMode / 10));
    } catch (e) { return 0; }
}

/* ================= ★ 新增：局面熟悉度 =================
 * 判断当前局势类型（残局/优势/劣势/濒死），
 * 记录每种局面下的决策次数。
 */
function _getSituationType() {
    try {
        let alive = 0;
        let myHp = 0;
        let totalEnemyHp = 0;
        let totalAllyHp = 0;

        for (const p of (game.players || [])) {
            if (!p || p.alive === false) continue;
            alive++;
            if (p === game.me) {
                myHp = p.hp || 0;
            } else {
                try {
                    const att = get.attitude(game.me, p);
                    if (att < 0) totalEnemyHp += (p.hp || 0);
                    else totalAllyHp += (p.hp || 0);
                } catch (e) {}
            }
        }

        if (myHp <= 1) return 'critical';
        if (alive <= 3) return 'endgame';
        if (totalAllyHp < totalEnemyHp * 0.5) return 'disadvantage';
        if (totalAllyHp > totalEnemyHp * 2) return 'advantage';
        return 'normal';
    } catch (e) { return 'normal'; }
}

function _situationTypeFamiliarity() {
    try {
        _loadGlobal();
        const sit = _getSituationType();
        const sitStats = GLOBAL.situationGlobal || {};
        const uses = sitStats[sit] || 0;
        return Math.min(1, Math.sqrt(uses / 15));
    } catch (e) { return 0; }
}

/* ================= ★ 新增：时间压力 =================
 * 濒死/决胜回合等关键时刻，需要更谨慎（降低模型权重）。
 */
function _timePressure() {
    try {
        if (game.me && (game.me.hp || 0) <= 1) return 1;
        let alive = 0;
        for (const p of (game.players || [])) {
            if (p && p.alive !== false) alive++;
        }
        if (alive <= 2) return 0.8;
        try {
            if (_status && _status.roundNumber && game && game.roundCount) {
                if (_status.roundNumber >= game.roundCount - 1) return 0.6;
            }
        } catch (e) {}
        return 0;
    } catch (e) { return 0; }
}

/* ================= 认知调制核心 =================
 * @param action   当前动作 { type, id, target }
 * @param context  { }
 * @return { familiarity, modulator, level, reason }
 *   familiarity: 0~1 总熟悉度
 *   modulator:   0.5~1.0 认知调制因子（乘在模型置信度上）
 */
export function cognitiveModulate(action, context) {
    try {
        if (!action) return { familiarity: 0, modulator: 0.5, level: 'none', reason: '无动作' };

        let elemFam = 0;
        if (action.type === 'skill' && action.id) {
            elemFam = _elementFamiliarity('skill', action.id);
        } else if (action.type === 'card' && action.id) {
            elemFam = _elementFamiliarity('card', action.id);
        } else if (action.type === 'equip' && action.id) {
            elemFam = _elementFamiliarity('card', action.id) * 0.7;
        } else if (action.type === 'end') {
            /* 结束回合 → 中等熟悉度（人人都会） */
            elemFam = 0.5;
        }

        const tgtFam = action.target ? _targetFamiliarity(action.target) : 0.5;
        const sitFam = _situationFamiliarity();
        const modeFam = action.id ? _modeFamiliarity(action.type === 'skill' ? 'skill' : 'card', action.id) : 0;
        const sitTypeFam = _situationTypeFamiliarity();
        const timePressure = _timePressure();

        /* 加权总熟悉度（6 维）：
         * 元素 35% / 模式 15% / 局面类型 15% / 目标 10% / 局势 15% / 时间压力 10%
         */
        let familiarity = elemFam * 0.35 + modeFam * 0.15 + sitTypeFam * 0.15
                        + tgtFam * 0.10 + sitFam * 0.15 + (1 - timePressure) * 0.10;

        /* 调制因子：熟悉 1.0，陌生 0.5 */
        const modulator = 0.5 + 0.5 * familiarity;

        /* 分级 */
        let level = 'low';
        if (familiarity >= 0.7) level = 'high';
        else if (familiarity >= 0.4) level = 'mid';

        return {
            familiarity: Math.round(familiarity * 1000) / 1000,
            modulator: Math.round(modulator * 1000) / 1000,
            level: level,
            reason: 'element=' + elemFam.toFixed(2) + ' mode=' + modeFam.toFixed(2)
                  + ' sitType=' + sitTypeFam.toFixed(2) + ' target=' + tgtFam.toFixed(2)
                  + ' sit=' + sitFam.toFixed(2) + ' timePressure=' + timePressure.toFixed(2),
        };
    } catch (e) {
        return { familiarity: 0, modulator: 0.5, level: 'none', reason: '异常：' + e.message };
    }
}

/* ================= 综合置信度：模型置信 × 认知调制 ================= */
export function effectiveConfidence(modelConf, metaMod) {
    try {
        if (!modelConf) return 0;
        const c = modelConf.confidence || 0;
        const m = (metaMod && metaMod.modulator) || 0.5;
        return Math.round(c * m * 1000) / 1000;
    } catch (e) { return 0; }
}

/* ================= 决定是否允许接管 =================
 * @return 'model' 模型主接管 | 'blend' 混合 | 'rule' 只走规则 | 'skip' 跳过模型
 */
export function decideIntervention(modelConf, metaMod) {
    try {
        if (!modelConf || modelConf.action === 'skip') return 'skip';
        const eff = effectiveConfidence(modelConf, metaMod);
        /* 认知低 → 强制只走规则 */
        if (metaMod && metaMod.level === 'low') return 'rule';
        /* 认知中 + 模型高置信 → 混合 */
        if (eff >= 0.6) return 'model';
        if (eff >= 0.35) return 'blend';
        return 'rule';
    } catch (e) { return 'skip'; }
}

/* ================= 查询接口 ================= */
export function metaStats() {
    try {
        _loadGlobal();
        return {
            runtime: {
                skillsUsed: Object.keys(RUNTIME.skillUsed).length,
                cardsUsed: Object.keys(RUNTIME.cardUsed).length,
                targetsMet: Object.keys(RUNTIME.targetMet).length,
                decisions: RUNTIME.decisions,
                elapsedMs: RUNTIME.startedAt ? (Date.now() - RUNTIME.startedAt) : 0,
            },
            global: {
                totalGames: GLOBAL.totalGames,
                skillEntries: Object.keys(GLOBAL.skillGlobal).length,
                cardEntries: Object.keys(GLOBAL.cardGlobal).length,
            },
        };
    } catch (e) { return {}; }
}

export function resetMeta() {
    _loadGlobal();
    GLOBAL = { skillGlobal: {}, cardGlobal: {}, totalGames: 0 };
    RUNTIME.skillUsed = {}; RUNTIME.cardUsed = {};
    RUNTIME.targetMet = {}; RUNTIME.decisions = 0;
    _saveGlobal();
    log.info('metacog', '元认知数据已复位');
}

/* ================= 采样权重 =================
 * 返回值含义：
 *   1.0  普通样本（正常采样）
 *   1.5  中等熟悉（重点补课）
 *   2.0  陌生（急需补课，加大采样次数）
 */
export function sampleWeight(action) {
    try {
        if (!action) return 1.0;
        const m = cognitiveModulate(action, {});
        if (m.level === 'low') return 2.0;
        if (m.level === 'mid') return 1.5;
        return 1.0;
    } catch (e) { return 1.0; }
}

/* ================= 挂载全局 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.metaCognition = {
        startGame: metaStartGame,
        settleGame: metaSettleGame,
        recordSkill: metaRecordSkill,
        recordCard: metaRecordCard,
        recordTarget: metaRecordTarget,
        recordDecision: metaRecordDecision,
        modulate: cognitiveModulate,
        effective: effectiveConfidence,
        decide: decideIntervention,
        sampleWeight: sampleWeight,
        stats: metaStats,
        reset: resetMeta,
    };
}
