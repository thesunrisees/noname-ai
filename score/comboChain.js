/* ================= 决策积分引擎 · 连招链 =================
 * 识别手牌里的预定义连招，并给出执行优先级
 * 核心连招：
 *   ① 铁索 + 属性伤害（火攻/火杀/雷杀）
 *   ② 拆防具 + 连杀（先拆藤甲/仁王，再穿透）
 *   ③ 酒 + 杀 + 追击（酒杀打残血）
 *   ④ AOE + 顺闪（先 AOE 消耗防御，再顺关键牌）
 *   ⑤ 连弩 + 多杀（攒杀一波爆发）
 *   ⑥ 无中 + 顺拆（补牌后拆关键）
 */
import { lib, game, get, _status } from '../../../noname.js';
import { cfg } from './util.js';
import { log } from './logger.js';

/* ================= 连招定义表 ================= */
/* 每条：{ id, name, setup[], follow[], condition(), bonus } */
export const CHAINS = [
    {
        id: 'tiesuo_fire',
        name: '铁索+火攻',
        setup: ['tiesuo'],
        follow: ['huogong', 'huosha', 'leisha'],
        condition: function (me, enemy) {
            /* 目标已被横置 或 场上至少有 2 个可被横置的敌人 */
            try {
                if (enemy && enemy.isLinked && enemy.isLinked()) return true;
                let count = 0;
                for (const p of (game.players || [])) {
                    if (!p || p === me || p.alive === false) continue;
                    if (get.attitude(me, p) < 0) count++;
                }
                return count >= 2;
            } catch (e) { return false; }
        },
        bonus: 3.5,
    },
    {
        id: 'strip_sha',
        name: '拆防具+连杀',
        setup: ['guohe', 'shunshou'],
        follow: ['sha', 'huosha', 'leisha'],
        condition: function (me, enemy) {
            try {
                if (!enemy) return false;
                const equips = enemy.getCards ? enemy.getCards('e') : [];
                return equips.some(function (e) {
                    const n = get.name(e);
                    return n === 'tengjia' || n === 'renwang' || n === 'bagua';
                });
            } catch (e) { return false; }
        },
        bonus: 2.5,
    },
    {
        id: 'jiu_sha',
        name: '酒+杀斩杀',
        setup: ['jiu'],
        follow: ['sha'],
        condition: function (me, enemy) {
            try {
                if (!enemy) return false;
                return (enemy.hp || 0) <= 2;
            } catch (e) { return false; }
        },
        bonus: 4.0,
    },
    {
        id: 'aoe_strip',
        name: 'AOE+顺关键',
        setup: ['nanman', 'wanjian'],
        follow: ['shunshou', 'guohe'],
        condition: function (me, enemy) {
            try {
                if (!enemy) return false;
                /* 敌人手牌 >= 2 才有可顺价值 */
                return (enemy.countCards ? enemy.countCards('h') : 0) >= 2;
            } catch (e) { return false; }
        },
        bonus: 1.8,
    },
    {
        id: 'zhuge_burst',
        name: '连弩+多杀',
        setup: [],
        follow: ['sha'],
        condition: function (me, enemy) {
            try {
                if (!me.getEquip || !me.getEquip('zhuge')) return false;
                const sha = me.countCards ? me.countCards('hs', 'sha') : 0;
                return sha >= 2;
            } catch (e) { return false; }
        },
        bonus: 3.0,
    },
    {
        id: 'wuzhong_strip',
        name: '无中+顺拆',
        setup: ['wuzhong'],
        follow: ['shunshou', 'guohe'],
        condition: function (me, enemy) {
            try {
                return (me.countCards ? me.countCards('h') : 0) <= 2;
            } catch (e) { return false; }
        },
        bonus: 1.5,
    },
];

/* ================= 主函数：识别可用连招 ================= */
export function detectChains(me, enemy) {
    try {
        if (!me) return [];
        const hand = me.getCards ? me.getCards('h') : [];
        const handNames = {};
        hand.forEach(function (c) {
            const n = get.name(c, me);
            handNames[n] = (handNames[n] || 0) + 1;
        });

        const available = [];
        CHAINS.forEach(function (chain) {
            /* setup 全都在手里（除了 zhuge_burst 需要装备） */
            const hasSetup = chain.setup.every(function (id) {
                return (handNames[id] || 0) > 0;
            });
            const hasFollow = chain.follow.some(function (id) {
                return (handNames[id] || 0) > 0;
            });
            if (!hasSetup && chain.setup.length > 0) return;
            if (!hasFollow) return;
            /* 条件判断 */
            let condOk = true;
            try { condOk = chain.condition(me, enemy); } catch (e) { condOk = false; }
            if (!condOk) return;

            /* 计算具体可用性 */
            available.push({
                id: chain.id,
                name: chain.name,
                setup: chain.setup.slice(),
                follow: chain.follow.slice(),
                bonus: chain.bonus,
                availableSetup: chain.setup.filter(function (id) { return (handNames[id] || 0) > 0; }),
                availableFollow: chain.follow.filter(function (id) { return (handNames[id] || 0) > 0; }),
            });
        });
        return available;
    } catch (e) { return []; }
}

/* ================= 连招总收益 ================= */
export function chainScore(me, chain, enemy) {
    try {
        if (!chain) return 0;
        let score = chain.bonus;
        /* 目标残血 → 连招更值 */
        if (enemy) {
            const hp = enemy.hp || 0;
            if (hp <= 1) score *= 1.8;
            else if (hp <= 2) score *= 1.4;
        }
        /* 我方资源充足 → 可以放心打连招 */
        try {
            const hc = me.countCards ? me.countCards('h') : 0;
            if (hc >= 5) score *= 1.15;
            else if (hc <= 2) score *= 0.8;
        } catch (e) {}
        return Math.round(score * 100) / 100;
    } catch (e) { return 0; }
}

/* ================= 起手牌优先级 ================= */
export function chainPriority(chain) {
    try {
        if (!chain) return 0;
        /* setup 越少越优先（更容易启动） */
        const setupCost = chain.setup.length;
        /* follow 越多越灵活 */
        const followFlex = chain.follow.length;
        return chain.bonus - setupCost * 0.5 + followFlex * 0.2;
    } catch (e) { return 0; }
}

/* ================= 应用层：把连招接入评分 ================= */
export function comboChainBonus(me, action, bestT) {
    try {
        if (cfg('comboChain', true) === false) return 1.0;
        if (!me || !action || !action.id) return 1.0;

        const chains = detectChains(me, bestT);
        if (!chains.length) return 1.0;

        let bonus = 1.0;
        chains.forEach(function (chain) {
            /* 是 setup 牌 → 起手加成（更值得先打） */
            if (chain.setup.indexOf(action.id) >= 0) {
                const pri = chainPriority(chain);
                bonus *= (1 + pri * 0.05);
            }
            /* 是 follow 牌 → 后续加成 */
            if (chain.follow.indexOf(action.id) >= 0) {
                const cs = chainScore(me, chain, bestT);
                bonus *= (1 + cs * 0.03);
            }
        });
        return Math.round(bonus * 1000) / 1000;
    } catch (e) { return 1.0; }
}

/* ================= 状态查询 ================= */
export function comboChainStats() {
    try {
        const me = _status.currentPhase || game.me;
        if (!me) return { chains: 0, list: [] };
        const chains = detectChains(me, null);
        return {
            chains: chains.length,
            list: chains.map(function (c) {
                return { id: c.id, name: c.name, bonus: c.bonus, priority: chainPriority(c) };
            }),
        };
    } catch (e) { return { chains: 0, list: [] }; }
}

export function resetComboChain() {
    log.info('comboChain', '连招链缓存已复位');
}

