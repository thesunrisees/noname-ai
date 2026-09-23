/* ================= 决策积分引擎 · 元素反馈闭环 =================
 * 目标：AI 从真实对局结果中，自动学习技能/卡牌的"实际意义"
 * 设计：
 *   ① 每次使用技能/卡牌，记录一次 pending
 *   ② 500ms 后观察效果（伤害/摸牌/回血/击杀）
 *   ③ 每局结束合并到 elementAccess 的影子表
 *   ④ 移动平均，避免单次波动
 */
import { lib, game, get, _status } from '../../../../noname.js';
import { log } from '../modules/misc/logger.js';
import { autoLearnSkill, autoLearnCard } from '../modules/misc/elementAccess.js';
import { transferWrite } from '../modules/misc/crossModeTransfer.js';

const DECAY = 0.7;
const MIN_DELTA = 0.15;

/* 本局待处理的观察记录 */
let _pending = [];

/* 学习历史：elementId → { win, total } */
let _history = {};

/* ================= 记录一次使用 =================
 * @param kind   'skill' | 'card'
 * @param id     技能或卡牌 id
 * @param me     使用者
 * @param ctx    上下文（可选）：{ target, hpBefore, handBefore }
 */
export function observeElementUse(kind, id, me, ctx) {
    try {
        if (!kind || !id || !me) return;
        ctx = ctx || {};
        const snap = {
            kind: kind, id: id, playerKey: me.name1 || me.name || '?',
            hpBefore: ctx.hpBefore !== undefined ? ctx.hpBefore : (me.hp || 0),
            targetKey: ctx.target ? (ctx.target.name1 || ctx.target.name || null) : null,
            targetHpBefore: ctx.target ? (ctx.target.hp || 0) : null,
            t0: Date.now(),
        };
        _pending.push(snap);
    } catch (e) {}
}

/* ================= 单次评估（500ms 后） ================= */
function _evaluateOne(snap) {
    try {
        if (!snap) return;
        const me = _findPlayer(snap.playerKey);
        if (!me) return;
        const hpAfter = me.hp || 0;
        const hpDelta = hpAfter - snap.hpBefore;

        let score = 0;

        /* 使用者自身 HP 变化 */
        if (hpDelta > 0) score += hpDelta * 1.5;
        else if (hpDelta < 0) score += hpDelta * 1.0;

        /* 对目标造成的伤害 */
        if (snap.targetKey && snap.targetHpBefore !== null) {
            const tgt = _findPlayer(snap.targetKey);
            if (tgt) {
                const tgtDelta = (tgt.hp || 0) - snap.targetHpBefore;
                /* 目标是敌人 → 负血量变化 = 好事 */
                let att = 0;
                try { att = get.attitude(me, tgt); } catch (e) {}
                if (att < 0 && tgtDelta < 0) score += (-tgtDelta) * 2.0;
                else if (att > 0 && tgtDelta < 0) score += tgtDelta * 2.0;
                else if (att > 0 && tgtDelta > 0) score += tgtDelta * 1.5;
            }
        }

        /* 记录本次评分 */
        if (!_history[snap.id]) _history[snap.id] = { kind: snap.kind, win: 0, total: 0, sum: 0 };
        const h = _history[snap.id];
        h.total++;
        h.sum += score;
        if (score > 0) h.win++;

        /* 单次明显差异 → 立即微调（+/-0.2） */
        if (Math.abs(score) >= 2) {
            const dir = score > 0 ? 1 : -1;
            const delta = dir * 0.2;
            if (snap.kind === 'skill') {
                try { transferWrite('skill', snap.id, { threaten: delta }); }
                catch (e) { try { autoLearnSkill(snap.id, delta); } catch (e2) {} }
            } else if (snap.kind === 'card') {
                try { transferWrite('card', snap.id, { value: delta * 0.5 }); }
                catch (e) { try { autoLearnCard(snap.id, delta * 0.5); } catch (e2) {} }
            }
        }
    } catch (e) {}
}

function _findPlayer(key) {
    try {
        if (!key) return null;
        for (const p of (game.players || [])) {
            if (!p) continue;
            if ((p.name1 || p.name || '') === key) return p;
        }
    } catch (e) {}
    return null;
}

/* ================= 定时清理 pending ================= */
let _pendingIv = null;
export function startElementFeedbackLoop() {
    if (_pendingIv) return;
    _pendingIv = setInterval(function () {
        try {
            const now = Date.now();
            const keep = [];
            for (const snap of _pending) {
                if (now - snap.t0 < 500) { keep.push(snap); continue; }
                _evaluateOne(snap);
            }
            _pending = keep;
        } catch (e) {}
    }, 600);
}
export function stopElementFeedbackLoop() {
    if (_pendingIv) { clearInterval(_pendingIv); _pendingIv = null; }
}

/* ================= 每局结束合并 ================= */
export function settleElementFeedback() {
    try {
        /* 一次性评估剩余 pending */
        const now = Date.now();
        for (const snap of _pending) {
            if (now - snap.t0 >= 300) _evaluateOne(snap);
        }
        _pending = [];

        /* 按元素聚合，取平均分 → 修正定义 */
        const byId = {};
        Object.keys(_history).forEach(function (id) {
            const h = _history[id];
            if (h.total < 2) return;
            const avg = h.sum / h.total;
            const wr = h.win / h.total;
            byId[id] = { kind: h.kind, avg: avg, wr: wr, total: h.total };
        });

        Object.keys(byId).forEach(function (id) {
            const info = byId[id];
            if (info.total < 3) return;
            /* 平均分 < -1 且胜率 < 0.3 → 该技能其实不如预期 → 降威胁/降价值 */
            if (info.avg < -1 && info.wr < 0.3) {
                if (info.kind === 'skill') autoLearnSkill(id, -0.15);
                else if (info.kind === 'card') autoLearnCard(id, -0.15);
            }
            /* 平均分 > 1.5 且胜率 > 0.6 → 该技能很强 */
            else if (info.avg > 1.5 && info.wr > 0.6) {
                if (info.kind === 'skill') autoLearnSkill(id, +0.15);
                else if (info.kind === 'card') autoLearnCard(id, +0.15);
            }
        });

        /* 衰减历史，避免旧数据长期占据权重 */
        Object.keys(_history).forEach(function (id) {
            const h = _history[id];
            h.win *= DECAY; h.sum *= DECAY; h.total *= DECAY;
            if (h.total < 1) delete _history[id];
        });

        try {
            const n = Object.keys(byId).length;
            if (n > 0) log.info('elementFB', '本局反馈合并：' + n + ' 个元素定义已更新');
        } catch (e) {}
    } catch (e) {}
}

/* ================= 查询接口 ================= */
export function elementFeedbackStats() {
    try {
        const out = [];
        Object.keys(_history).forEach(function (id) {
            const h = _history[id];
            out.push({
                id: id, kind: h.kind, total: Math.round(h.total),
                winRate: h.total > 0 ? Math.round(h.win / h.total * 100) / 100 : 0,
                avgScore: h.total > 0 ? Math.round(h.sum / h.total * 100) / 100 : 0,
            });
        });
        out.sort(function (a, b) { return b.avgScore - a.avgScore; });
        return out;
    } catch (e) { return []; }
}

export function resetElementFeedback() {
    _pending = [];
    _history = {};
    log.info('elementFB', '元素反馈已复位');
}

/* ================= 挂载全局 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.elementFB = {
        observe: observeElementUse,
        start: startElementFeedbackLoop,
        stop: stopElementFeedbackLoop,
        settle: settleElementFeedback,
        stats: elementFeedbackStats,
        reset: resetElementFeedback,
    };
}
