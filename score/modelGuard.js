/*
 * ============================================
 * // Wydawca: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 模型行为护栏 =================
 * 职责：模型输出动作后，执行前的最后一层"法律检查"。
 * 设计原则：
 *   ① 红线零容忍：任何触碰红线的动作 → 拦截 + 降级 + trust 归零
 *   ② 三重降级：模型 → 规则 → 原生 AI
 *   ③ 可观测：每次拦截都记录（谁、什么动作、哪条红线、目标）
 *   ④ 冷却 3 局：某决策点触发红线后，3 局内强制走规则引擎
 */

/* ================= 红线定义 ================= */
export const RED_LINES = {
    ALLY_ATTACK:    '攻击盟友',
    ALLY_DELAY:     '对盟友使用延时锦囊',
    ALLY_SHUN:      '顺/拆盟友关键牌',
    MISS_KILL:      '能击杀时放水',
    NUM_INVALID:    '分值异常（NaN/Infinity）',
    TARGET_MISSING: '目标缺失/已死亡',
    EMPTY_ACTION:   '空动作但有更高优先候选',
    SELF_HARM:      '自伤动作（无正当理由）',
};

/* ================= 攻击类牌表 ================= */
const ATK_IDS = ['sha', 'huosha', 'leisha', 'juedou', 'huogong', 'nanman', 'wanjian', 'zhujin', 'jiedao', 'lijian'];
const DELAY_IDS = ['lebu', 'bingliang'];
const STEAL_IDS = ['shunshou', 'guohe'];
const SELF_HARM_IDS = ['juedou'];  /* 无杀时决斗 = 自伤 */

/* ================= 内部统计（不持久化，只在内存） ================= */
const STATS = {
    checks: 0,
    blocks: 0,
    byRule: {},
    lastBlock: null,
    blockHistory: [],   /* 最近 20 次 */
};

/* ================= 冷却表：决策点 → 冷却截止时间戳 ================= */
const COOLDOWN = new Map();
const COOLDOWN_ROUNDS = 3;           /* 触发后冷却 3 局 */
const COOLDOWN_MS = 30 * 60 * 1000;  /* 兜底：30 分钟 */

/* ================= 便捷：判断是不是盟友 ================= */
function _isAlly(me, target) {
    try {
        if (!me || !target || me === target) return false;
        /* 兜底：attitude */
        try {
            if (typeof get !== 'undefined' && get.attitude(me, target) > 0) return true;
        } catch (e) {}
        return false;
    } catch (e) { return false; }
}

function _isDead(target) {
    try {
        if (!target) return true;
        if (target.alive === false) return true;
        if (typeof target.isDead === 'function' && target.isDead()) return true;
        return false;
    } catch (e) { return false; }
}

/* ================= 检查是否处于冷却期 ================= */
function _isCoolingDown(decisionPoint) {
    try {
        const until = COOLDOWN.get(decisionPoint);
        if (!until) return false;
        if (Date.now() > until) {
            COOLDOWN.delete(decisionPoint);
            return false;
        }
        return true;
    } catch (e) { return false; }
}

/* ================= 记录一次拦截 ================= */
function _recordBlock(me, action, rule, reason) {
    try {
        STATS.blocks++;
        STATS.byRule[rule] = (STATS.byRule[rule] || 0) + 1;
        const rec = {
            ts: Date.now(),
            player: me ? (me.name || me.name1 || '?') : '?',
            action: action ? (action.type + ':' + action.id) : '?',
            target: action && action.target ? action.target : null,
            rule: rule,
            reason: reason,
        };
        STATS.lastBlock = rec;
        STATS.blockHistory.push(rec);
        while (STATS.blockHistory.length > 20) STATS.blockHistory.shift();
    } catch (e) {}
}

/* ================= 核心：红线检查 =================
 * @param me       执行动作的玩家
 * @param action   候选动作 { type, id, target, score, reason }
 * @param context  上下文 { bestT, allCandidates, engineAction }
 * @return         { ok:boolean, rule:string, reason:string, fallback:action }
 */
export function guardCheck(me, action, context) {
    STATS.checks++;
    try {
        if (!me || !action) {
            return { ok: false, rule: RED_LINES.EMPTY_ACTION, reason: '动作或玩家为空', fallback: null };
        }

        /* ---- 红线 0：分值异常 ---- */
        if (typeof action.score === 'number') {
            if (Number.isNaN(action.score) || !Number.isFinite(action.score)) {
                _recordBlock(me, action, RED_LINES.NUM_INVALID, 'score=' + action.score);
                return { ok: false, rule: RED_LINES.NUM_INVALID, reason: '分值 NaN/Infinity', fallback: _fallbackAction(context) };
            }
        }

        /* ---- 红线 1：目标已死 / 目标缺失 ---- */
        if (action.target) {
            let tgtObj = null;
            try {
                for (const p of (game.players || [])) {
                    if (!p) continue;
                    if ((p.name1 || p.name || '') === action.target || (p.name1 || '') === action.target) {
                        tgtObj = p;
                        break;
                    }
                }
            } catch (e) {}
            if (!tgtObj || _isDead(tgtObj)) {
                _recordBlock(me, action, RED_LINES.TARGET_MISSING, '目标=' + action.target);
                return { ok: false, rule: RED_LINES.TARGET_MISSING, reason: '目标不存在或已死亡', fallback: _fallbackAction(context) };
            }

            /* ---- 红线 2：攻击盟友 ---- */
            if (ATK_IDS.indexOf(action.id) >= 0 && _isAlly(me, tgtObj)) {
                const isTactical = (action.id === 'tiesuo' && action.reason && action.reason.indexOf('战术') >= 0);
                if (!isTactical) {
                    _recordBlock(me, action, RED_LINES.ALLY_ATTACK, '目标=' + action.target);
                    return { ok: false, rule: RED_LINES.ALLY_ATTACK, reason: '攻击盟友', fallback: _fallbackAction(context) };
                }
            }

            /* ---- 红线 3：延时锦囊贴盟友 ---- */
            if (DELAY_IDS.indexOf(action.id) >= 0 && _isAlly(me, tgtObj)) {
                _recordBlock(me, action, RED_LINES.ALLY_DELAY, '目标=' + action.target);
                return { ok: false, rule: RED_LINES.ALLY_DELAY, reason: '对盟友贴延时锦囊', fallback: _fallbackAction(context) };
            }

            /* ---- 红线 4：顺/拆盟友非判定区 ---- */
            if (STEAL_IDS.indexOf(action.id) >= 0 && _isAlly(me, tgtObj)) {
                const hasJudgeCards = (function () {
                    try {
                        return tgtObj.judges && tgtObj.judges.length > 0;
                    } catch (e) { return false; }
                })();
                if (!hasJudgeCards) {
                    _recordBlock(me, action, RED_LINES.ALLY_SHUN, '目标=' + action.target);
                    return { ok: false, rule: RED_LINES.ALLY_SHUN, reason: '顺/拆盟友非判定区', fallback: _fallbackAction(context) };
                }
            }

            /* ---- 红线 5：能击杀时放水 ---- */
            if (context && context.killAvailable && action.type === 'card') {
                const isAtk = ATK_IDS.indexOf(action.id) >= 0;
                if (!isAtk && context.killAvailable.score > action.score + 5) {
                    const isUtility = ['wuzhong', 'tao', 'wuxie', 'shan', 'jiu'].indexOf(action.id) >= 0;
                    if (!isUtility) {
                        _recordBlock(me, action, RED_LINES.MISS_KILL, '候选击杀分=' + context.killAvailable.score);
                        return { ok: false, rule: RED_LINES.MISS_KILL, reason: '能击杀却放水', fallback: context.killAvailable };
                    }
                }
            }
        }

        /* ---- 红线 6：无杀决斗（自伤） ---- */
        if (SELF_HARM_IDS.indexOf(action.id) >= 0) {
            let mySha = 0;
            try { mySha = me.countCards ? me.countCards('hs', 'sha') : 0; } catch (e) {}
            const tgtSha = (function () {
                try {
                    let n = 0;
                    if (action.target) {
                        for (const p of (game.players || [])) {
                            if (!p) continue;
                            if ((p.name1 || p.name || '') === action.target) {
                                n = p.countCards ? p.countCards('hs', 'sha') : 0;
                                break;
                            }
                        }
                    }
                    return n;
                } catch (e) { return 0; }
            })();
            /* 自己 0 杀 + 对手 2+ 杀 = 必输的决斗 → 拦截 */
            if (mySha === 0 && tgtSha >= 2) {
                _recordBlock(me, action, RED_LINES.SELF_HARM, '我0杀/敌' + tgtSha + '杀');
                return { ok: false, rule: RED_LINES.SELF_HARM, reason: '无杀决斗（必输）', fallback: _fallbackAction(context) };
            }
        }

        /* ---- 全部通过 ---- */
        return { ok: true, rule: null, reason: '', fallback: null };
    } catch (e) {
        /* 护栏本身异常 → 保守放行（不能让护栏成为新 bug 源） */
        try { console.warn('[guard] 护栏检查异常：' + e.message); } catch (e2) {}
        return { ok: true, rule: null, reason: '护栏异常（放行）', fallback: null };
    }
}

/* ================= 兜底动作：从候选中挑一个"安全的" ================= */
function _fallbackAction(context) {
    try {
        if (!context || !Array.isArray(context.allCandidates)) return null;
        /* 优先选"结束回合" */
        for (const c of context.allCandidates) {
            if (c.type === 'end') return c;
        }
        /* 次选：非攻击牌 */
        for (const c of context.allCandidates) {
            if (c.type !== 'card') continue;
            if (ATK_IDS.indexOf(c.id) < 0) return c;
        }
        /* 最次：返回 null 让上层走原生 */
        return null;
    } catch (e) { return null; }
}

/* ================= 触发拦截后的处罚：trust 归零 + 冷却 ================= */
export function applyGuardPenalty(decisionPoint, rule) {
    try {
        if (!decisionPoint) return;
        /* 记录冷却 */
        COOLDOWN.set(decisionPoint, Date.now() + COOLDOWN_MS);
        /* trust 归零 */
        try {
            if (typeof DECISION_REGISTRY !== 'undefined' && DECISION_REGISTRY[decisionPoint]) {
                if (typeof setTrust === 'function') {
                    setTrust(decisionPoint, 0);
                }
            }
        } catch (e) {}
        try {
            console.warn('[guard] 【模型护栏】决策点 ' + decisionPoint +
                ' 触发红线「' + rule + '」，已 trust 归零并冷却 ' + COOLDOWN_ROUNDS + ' 局');
        } catch (e) {}
    } catch (e) {}
}

/* ================= 查询：某决策点是否冷却中 ================= */
export function isGuardCoolingDown(decisionPoint) {
    return _isCoolingDown(decisionPoint);
}

/* ================= 状态查询接口（给面板/自检用） ================= */
export function guardStatus() {
    try {
        const cooldowns = {};
        COOLDOWN.forEach(function (until, key) {
            const remain = until - Date.now();
            if (remain > 0) {
                cooldowns[key] = { remainMs: remain, remainMin: Math.round(remain / 60000) };
            }
        });
        return {
            checks: STATS.checks,
            blocks: STATS.blocks,
            blockRate: STATS.checks > 0 ? Math.round((STATS.blocks / STATS.checks) * 100) / 100 : 0,
            byRule: Object.assign({}, STATS.byRule),
            lastBlock: STATS.lastBlock,
            recentBlocks: STATS.blockHistory.slice(-10),
            cooldowns: cooldowns,
        };
    } catch (e) { return {}; }
}

/* ================= 重置接口 ================= */
export function resetGuard() {
    try {
        STATS.checks = 0;
        STATS.blocks = 0;
        STATS.byRule = {};
        STATS.lastBlock = null;
        STATS.blockHistory = [];
        COOLDOWN.clear();
        console.log('[guard] 模型护栏已复位');
    } catch (e) {}
}

/* ================= 打开面板（纯文本） ================= */
export function openGuardPanel() {
    try {
        const s = guardStatus();
        let content = '=== 模型护栏 ===\n\n';
        content += '检查次数：' + s.checks + '\n';
        content += '拦截次数：' + s.blocks + '\n';
        content += '拦截率：' + (s.blockRate * 100) + '%\n\n';

        content += '【红线统计】\n';
        const rules = Object.keys(s.byRule || {});
        if (rules.length === 0) {
            content += '暂无拦截记录\n';
        } else {
            rules.forEach(function (r) {
                content += '· ' + r + '：' + s.byRule[r] + ' 次\n';
            });
        }
        content += '\n';

        content += '【冷却中】\n';
        const cooldowns = Object.keys(s.cooldowns || {});
        if (cooldowns.length === 0) {
            content += '暂无冷却\n';
        } else {
            cooldowns.forEach(function (k) {
                content += '· ' + k + '：剩余 ' + s.cooldowns[k].remainMin + ' 分钟\n';
            });
        }
        content += '\n';

        content += '【最近拦截】\n';
        if (!s.recentBlocks || s.recentBlocks.length === 0) {
            content += '暂无记录\n';
        } else {
            s.recentBlocks.forEach(function (b, i) {
                content += (i + 1) + '. ' + b.rule + '\n';
                content += '   玩家：' + b.player + '\n';
                content += '   动作：' + b.action + '\n';
                content += '   原因：' + b.reason + '\n';
                content += '\n';
            });
        }

        content += '【红线类型】\n';
        Object.keys(RED_LINES).forEach(function (k) {
            content += '· ' + k + ' = ' + RED_LINES[k] + '\n';
        });

        /* 用无名杀原生面板打开 */
        try {
            if (typeof openSimplePanel === 'function') {
                openSimplePanel('🛡️ 模型护栏', content);
            } else {
                alert(content);
            }
        } catch (e) {
            alert(content);
        }
    } catch (e) {
        alert('打开模型护栏面板失败：' + e.message);
    }
}

/* ================= 挂载到全局 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.modelGuard = {
        check: guardCheck,
        penalty: applyGuardPenalty,
        isCoolingDown: isGuardCoolingDown,
        status: guardStatus,
        reset: resetGuard,
        openPanel: openGuardPanel,
        RED_LINES: RED_LINES,
    };
}

export { STATS as GUARD_STATS };
