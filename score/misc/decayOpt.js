/* ================= 决策积分引擎 · 重复触发衰减 =================
 * 同一个收益在10次决策内重复触发，积分逐渐减少10%
 * 第一次：100%
 * 第二次：90%
 * 第三次：80%
 * ...
 * 第10次：10%
 */

/* 触发记录：key = 收益类型，value = 触发次数和时间 */
const TRIGGER_LOG = {};

/* 衰减窗口：10次决策 */
const DECAY_WINDOW = 10;

/* 每次衰减比例：10% */
const DECAY_RATE = 0.1;

/* 当前决策计数 */
let _decisionCount = 0;

/* 记录一次触发 */
export function recordTrigger(type) {
    try {
        _decisionCount++;
        const now = Date.now();

        if (!TRIGGER_LOG[type]) {
            TRIGGER_LOG[type] = [];
        }

        /* 记录这次触发 */
        TRIGGER_LOG[type].push({
            decision: _decisionCount,
            time: now,
        });

        /* 清理超过窗口的记录 */
        const cutoff = _decisionCount - DECAY_WINDOW;
        while (TRIGGER_LOG[type].length > 0 && TRIGGER_LOG[type][0].decision < cutoff) {
            TRIGGER_LOG[type].shift();
        }

        return getDecayMultiplier(type);
    } catch (e) {
        return 1.0;
    }
}

/* 获取当前衰减系数 */
export function getDecayMultiplier(type) {
    try {
        if (!TRIGGER_LOG[type] || TRIGGER_LOG[type].length === 0) return 1.0;

        const count = TRIGGER_LOG[type].length;
        if (count <= 1) return 1.0;

        /* 衰减系数：1 - (count-1) * DECAY_RATE，最低0.1 */
        const multiplier = Math.max(0.1, 1 - (count - 1) * DECAY_RATE);

        return Math.round(multiplier * 100) / 100;
    } catch (e) {
        return 1.0;
    }
}

/* 应用衰减到分数 */
export function applyDecay(type, score) {
    try {
        const multiplier = getDecayMultiplier(type);
        return Math.round(score * multiplier * 100) / 100;
    } catch (e) {
        return score;
    }
}

/* 清空记录 */
export function clearDecayLog() {
    try {
        for (const key in TRIGGER_LOG) delete TRIGGER_LOG[key];
        _decisionCount = 0;
    } catch (e) {}
}

/* 获取统计信息 */
export function getDecayStats() {
    try {
        const stats = {};
        for (const key in TRIGGER_LOG) {
            const count = TRIGGER_LOG[key].length;
            stats[key] = {
                count: count,
                multiplier: getDecayMultiplier(key),
            };
        }
        return {
            decisionCount: _decisionCount,
            window: DECAY_WINDOW,
            decayRate: DECAY_RATE,
            triggers: stats,
        };
    } catch (e) {
        return {};
    }
}
