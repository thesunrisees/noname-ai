/* ================= 决策积分引擎 · 决策后检测 =================
 * 决策执行后，对比执行前后的快照，计算实际收益：
 *   ① 目标变化：掉血 / 掉牌 / 装备被拆
 *   ② 自身变化：掉血 / 掉牌
 *   ③ 局势变化：场上存活数 / 敌我比例
 *   ④ 反制检测：被无懈 / 被闪 / 被反馈
 * 把实际收益写进样本的 reward 字段（替代整局分数）
 */
import { log } from '../core/logger.js';

/* ================= 快照池 ================= */
const SNAPSHOT_POOL = new Map();   /* key -> snapshot */
const MAX_POOL = 50;
let _poolRound = -1;

function _syncPool() {
    try {
        const r = (_status && _status.roundNumber) || (game && game.roundNumber) || 0;
        if (r !== _poolRound) {
            SNAPSHOT_POOL.clear();
            _poolRound = r;
        }
    } catch (e) {}
}

/* ================= 拍快照 ================= */
function _snapshot(me, target) {
    try {
        const snap = {
            ts: Date.now(),
            round: (_status && _status.roundNumber) || 0,
            /* 自身状态 */
            meHp: me.hp || 0,
            meMaxHp: me.maxHp || 1,
            meHand: me.countCards ? me.countCards('h') : 0,
            meEquip: me.getCards ? me.getCards('e').length : 0,
            /* 目标状态 */
            tHp: target ? (target.hp || 0) : 0,
            tMaxHp: target ? (target.maxHp || 1) : 1,
            tHand: target && target.countCards ? target.countCards('h') : 0,
            tEquip: target && target.getCards ? target.getCards('e').length : 0,
            /* 场上局势 */
            alive: (game.players || []).filter(p => p && p.alive !== false).length,
        };
        return snap;
    } catch (e) { return null; }
}

/* ================= 决策前记录快照 ================= */
export function postCheckBefore(me, action, target) {
    try {
        _syncPool();
        if (!me || !action) return;

        const key = 'pc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const snap = _snapshot(me, target);

        SNAPSHOT_POOL.set(key, {
            before: snap,
            me: me.name || me.name1,
            target: target ? (target.name || target.name1) : null,
            action: action.id || '',
            type: action.type || '',
            ts: Date.now(),
        });

        /* 池满清理 */
        if (SNAPSHOT_POOL.size > MAX_POOL) {
            const firstKey = SNAPSHOT_POOL.keys().next().value;
            SNAPSHOT_POOL.delete(firstKey);
        }

        return key;
    } catch (e) { return null; }
}

/* ================= 决策后计算实际收益 ================= */
export function postCheckAfter(snapshotKey, me, target) {
    try {
        _syncPool();
        if (!snapshotKey || !SNAPSHOT_POOL.has(snapshotKey)) return 0;

        const rec = SNAPSHOT_POOL.get(snapshotKey);
        const before = rec.before;
        if (!before) return 0;

        /* 拍执行后的快照 */
        const after = _snapshot(me, target);
        if (!after) return 0;

        /* ================= 计算实际收益 ================= */
        let gain = 0;
        const details = {};

        /* ① 目标掉血 → 正收益 */
        if (target) {
            const dmg = before.tHp - after.tHp;
            if (dmg > 0) {
                gain += dmg * 3;      /* 每点血 3 分 */
                details.tHpDown = dmg;
            }
            /* 目标掉牌 → 正收益 */
            const cardLost = before.tHand - after.tHand;
            if (cardLost > 0) {
                gain += cardLost * 1.5;  /* 每手牌 1.5 分 */
                details.tHandDown = cardLost;
            }
            /* 目标掉装备 → 正收益 */
            const eqLost = before.tEquip - after.tEquip;
            if (eqLost > 0) {
                gain += eqLost * 2;
                details.tEquipDown = eqLost;
            }
        }

        /* ② 自身掉血 → 负收益 */
        const selfDmg = before.meHp - after.meHp;
        if (selfDmg > 0) {
            gain -= selfDmg * 2;      /* 每点血 -2 分 */
            details.meHpDown = selfDmg;
        }
        /* 自身掉牌 → 负收益 */
        const selfCardLost = before.meHand - after.meHand;
        if (selfCardLost > 0) {
            gain -= selfCardLost * 1;
            details.meHandDown = selfCardLost;
        }

        /* ③ 目标濒死 → 大正收益 */
        if (target && after.tHp <= 1 && before.tHp > 1) {
            gain += 5;
            details.tNearDeath = true;
        }

        /* ④ 目标死亡 → 极大正收益 */
        if (target && after.tHp <= 0) {
            gain += 20;
            details.tDead = true;
        }

        /* ⑤ 自己濒死 → 大负收益 */
        if (after.meHp <= 1 && before.meHp > 1) {
            gain -= 8;
            details.meNearDeath = true;
        }

        /* ⑥ 局势变化：场上存活减少 → 残局优势 */
        if (after.alive < before.alive) {
            gain += (before.alive - after.alive) * 2;
            details.aliveDown = before.alive - after.alive;
        }

        /* 从池里删掉（已用完） */
        SNAPSHOT_POOL.delete(snapshotKey);

        /* ★ 静默：不输出到日志面板 */
        // try {
        //     log.info('postCheck', '决策后检测: ' + rec.action +
        //         ' → 实际收益 ' + details.gain +
        //         '（' + JSON.stringify(details).slice(0, 80) + '）');
        // } catch (e) {}

        return details.gain;
    } catch (e) { return 0; }
}

/* ================= 延迟检测（1.5 秒后自动计算） ================= */
export function postCheckDelayed(snapshotKey, me, target, callback) {
    try {
        if (!snapshotKey) return;
        setTimeout(function () {
            try {
                const gain = postCheckAfter(snapshotKey, me, target);
                if (callback) callback(gain);
            } catch (e) {}
        }, 1500);
    } catch (e) {}
}

/* ================= 查询接口 ================= */
export function postCheckStats() {
    return {
        poolSize: SNAPSHOT_POOL.size,
        round: _poolRound,
    };
}

export function postCheckReset() {
    SNAPSHOT_POOL.clear();
    _poolRound = -1;
    /* ★ 静默：不输出到日志面板 */
    // log.info('postCheck', '决策后检测池已复位');
}

/* ================= 挂载 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.postCheck = {
        before: postCheckBefore,
        after: postCheckAfter,
        delayed: postCheckDelayed,
        stats: postCheckStats,
        reset: postCheckReset,
    };
}
