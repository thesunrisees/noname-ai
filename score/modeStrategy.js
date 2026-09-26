/*
 * ============================================
 * // 作者: 飞升原创
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 模式策略注册表（精细版 v2.0） =================
 * 每种模式声明自己的：阵营判断、专属技能、决策偏好
 * 数据相互隔离：每个模式有自己的独立缓存
 * 覆盖所有无名杀标准模式
 */
import { lib, game, get, _status } from '../../../noname.js';
// Author: Feisheng Original | License: GPL-3.0

/* ===== 工具函数 ===== */

/* 查找玩家对象（按名字） */
function findPlayer(name) {
    try {
        if (!name) return null;
        return (game.players || []).find(function (p) {
            return p && (p.name1 || p.name || '') === name;
        });
    } catch (e) { return null; }
}

/* 判断玩家是否存活 */
function isAlive(p) {
    try { return p && p.alive !== false; } catch (e) { return false; }
}

/* 攻击牌列表 */
const ATK_IDS = ['sha', 'juedou', 'huogong', 'nanman', 'wanjian', 'zhujin', 'huosha', 'leisha'];

/* 治疗牌列表 */
const HEAL_IDS = ['tao', 'taoyuan'];

/* 控制牌列表 */
const CTRL_IDS = ['guohe', 'shunshou', 'lebu', 'bingliang', 'tiesuo', 'jiedao'];

/* 获取 act 的目标玩家对象 */
function getTarget(act) {
    try {
        if (!act || !act.target) return null;
        return findPlayer(act.target);
    } catch (e) { return null; }
}

/* 判断是否是攻击动作 */
function isAttackAct(act) {
    try {
        return act.type === 'card' && ATK_IDS.indexOf(act.id) >= 0;
    } catch (e) { return false; }
}

/* 判断是否是治疗动作 */
function isHealAct(act) {
    try {
        return act.type === 'card' && HEAL_IDS.indexOf(act.id) >= 0;
    } catch (e) { return false; }
}

/* ===== 模式独立数据缓存（数据相互隔离） ===== */
const MODE_CACHE = {
    identity: {},
    guozhan: {},
    doudizhu: {},
    boss: {},
    versus: {},
    single: {},
    tafang: {},
    brawl: {},
    chess: {},
    stone: {},
    connect: {},
};

/* 获取模式缓存 */
function getModeCache(mode) {
    if (!MODE_CACHE[mode]) MODE_CACHE[mode] = {};
    return MODE_CACHE[mode];
}

/* 清空模式缓存 */
export function clearModeCache(mode) {
    try {
        if (mode) {
            MODE_CACHE[mode] = {};
        } else {
            for (const m in MODE_CACHE) MODE_CACHE[m] = {};
        }
    } catch (e) {}
}

/* ===== 模式默认策略（每个模式可覆盖） ===== */
const DEFAULT_STRATEGY = {
    name: 'generic',

    /* 阵营判断：返回字符串 */
    getCamp: function (player) {
        try {
            if (!player) return 'unknown';
            return String(player.identity || player.group || 'unknown');
        } catch (e) { return 'unknown'; }
    },

    /* 判断两个玩家是否同阵营 */
    isSameCamp: function (a, b) {
        if (!a || !b) return false;
        try {
            return get.attitude(a, b) > 0;
        } catch (e) { return false; }
    },

    /* 获取模式的专属技能列表（用于优先级加权） */
    getExclusiveSkills: function () { return []; },

    /* 决策加成：让模式专属技能/行为获得额外权重 */
    decisionBoost: function (me, act) {
        return 0;
    },

    /* 是否使用身份推理 */
    useIdentityInference: false,

    /* 是否使用内奸/主公 AI */
    useNeiZhuAI: false,
};

/* ===== 1. 身份局（最复杂） ===== */
const IDENTITY_STRATEGY = Object.assign({}, DEFAULT_STRATEGY, {
    name: 'identity',
    useIdentityInference: true,
    useNeiZhuAI: true,

    getCamp: function (player) {
        try {
            if (!player) return 'unknown';
            const id = player.identity;
            /* 主忠阵营 */
            if (id === 'zhu') return 'loyal';
            if (id === 'zhong' || id === 'mingzhong') return 'loyal';
            /* 反贼阵营 */
            if (id === 'fan') return 'rebel';
            /* 内奸（独立阵营） */
            if (id === 'nei') return 'nei';
            return 'unknown';
        } catch (e) { return 'unknown'; }
    },

    isSameCamp: function (a, b) {
        if (!a || !b) return false;
        try {
            const ca = this.getCamp(a);
            const cb = this.getCamp(b);
            /* 内奸和任何人都不是同阵营 */
            if (ca === 'nei' || cb === 'nei') return false;
            return ca === cb;
        } catch (e) { return get.attitude(a, b) > 0; }
    },

    getExclusiveSkills: function () {
        return [/^nei_/, /^zhu_/];
    },

    decisionBoost: function (me, act) {
        let bonus = 0;
        try {
            const myId = me.identity;
            const tgt = getTarget(act);
            const isDmg = isAttackAct(act);
            const isHeal = isHealAct(act);

            /* ===== 主公策略 ===== */
            if (myId === 'zhu') {
                /* ① 打不明身份的人降权（避免盲忠） */
                if (isDmg && tgt) {
                    if (!tgt.identityShown && !tgt.identity) {
                        const hp = tgt.hp || 0;
                        if (hp <= 1) bonus -= 1.5;  /* 残血不明 → 强烈不建议打 */
                        else if (hp <= 2) bonus -= 0.8;
                        else bonus -= 0.3;
                    }
                }
                /* ② 救明忠加成 */
                if (isHeal && tgt) {
                    if (tgt.identity === 'zhong' || tgt.identity === 'mingzhong') {
                        bonus += 0.8;
                    }
                }
                /* ③ 打反贼加成 */
                if (isDmg && tgt && tgt.identity === 'fan') {
                    bonus += 0.6;
                }
            }

            /* ===== 忠臣策略 ===== */
            if (myId === 'zhong' || myId === 'mingzhong') {
                /* ① 护主：救主公加成 */
                if (isHeal && tgt && tgt === game.zhu) {
                    bonus += 0.8;
                }
                /* ② 打反贼加成 */
                if (isDmg && tgt && tgt.identity === 'fan') {
                    bonus += 0.5;
                }
                /* ③ 打内奸降权（内奸最后再处理） */
                if (isDmg && tgt && tgt.identity === 'nei') {
                    bonus -= 0.3;
                }
            }

            /* ===== 反贼策略 ===== */
            if (myId === 'fan') {
                /* ① 集火主公加成 */
                if (isDmg && tgt && tgt === game.zhu) {
                    bonus += 0.8;
                }
                /* ② 集火明忠加成 */
                if (isDmg && tgt && (tgt.identity === 'zhong' || tgt.identity === 'mingzhong')) {
                    bonus += 0.4;
                }
            }

            /* ===== 内奸策略 ===== */
            if (myId === 'nei') {
                /* ① 永远不打主公（除非最后只剩主内） */
                if (isDmg && tgt && tgt === game.zhu) {
                    /* 看场上存活人数 */
                    const aliveCount = (game.players || []).filter(isAlive).length;
                    if (aliveCount > 2) {
                        bonus -= 1.0;  /* 人多时绝对不打主公 */
                    } else {
                        bonus += 0.2;  /* 只剩主内时可以打 */
                    }
                }
                /* ② 平衡策略：帮弱势方 */
                if (isDmg && tgt) {
                    const loyalCount = (game.players || []).filter(function (p) {
                        return isAlive(p) && (p.identity === 'zhong' || p.identity === 'mingzhong');
                    }).length;
                    const rebelCount = (game.players || []).filter(function (p) {
                        return isAlive(p) && p.identity === 'fan';
                    }).length;
                    /* 反贼太强 → 帮主公打反贼 */
                    if (rebelCount > loyalCount + 1 && tgt.identity === 'fan') {
                        bonus += 0.3;
                    }
                    /* 主忠太强 → 帮反贼打忠 */
                    if (loyalCount > rebelCount + 1 && (tgt.identity === 'zhong' || tgt.identity === 'mingzhong')) {
                        bonus += 0.3;
                    }
                }
            }
        } catch (e) {}
        return bonus;
    },
});

/* ===== 2. 国战 ===== */
const GUOZHAN_STRATEGY = Object.assign({}, DEFAULT_STRATEGY, {
    name: 'guozhan',
    useIdentityInference: false,
    useNeiZhuAI: false,

    getCamp: function (player) {
        try {
            if (!player) return 'unknown';
            /* 野心家独立阵营 */
            if (player.isYezin || player.identity === 'yezin') return 'yezin';
            /* 未明置 → 未知 */
            if (player.isUnseen && player.isUnseen(2)) return 'unknown';
            /* 明置 → 势力 */
            return String(player.group || 'unknown');
        } catch (e) { return 'unknown'; }
    },

    isSameCamp: function (a, b) {
        if (!a || !b) return false;
        try {
            /* 野心家独狼，无队友 */
            if (a.isYezin || b.isYezin) return false;
            /* 暗置 → 未知，保守判断 */
            if (a.isUnseen && a.isUnseen(2)) return false;
            if (b.isUnseen && b.isUnseen(2)) return false;
            /* 同势力 → 同阵营 */
            if (a.group && b.group && a.group === b.group) return true;
            return get.attitude(a, b) > 0;
        } catch (e) { return false; }
    },

    getExclusiveSkills: function () {
        return [
            /zhulian/i,
            /^zhuSkill_/,
            /^zhenfa_/,
            /^huosh_/,
            /^linjiang_/,
        ];
    },

    decisionBoost: function (me, act) {
        let bonus = 0;
        try {
            const myGroup = me.group;
            const tgt = getTarget(act);
            const isDmg = isAttackAct(act);
            const isHeal = isHealAct(act);

            /* ① 珠联璧合：搭档互动加成 */
            if (tgt && isZhulian(me, tgt)) {
                if (isHeal) bonus += 0.8;
                else if (act.type === 'skill' && act.id && /jizhi|rende|yingzi/i.test(act.id)) {
                    bonus += 0.5;
                }
            }

            /* ② 暗置敌人伤害牌降权（信息不足，可能是队友） */
            if (isDmg && tgt) {
                if (tgt.isUnseen && tgt.isUnseen(2)) {
                    bonus -= 0.5;  /* 完全暗置 → 可能是队友，降权 */
                } else if (tgt.isUnseen && tgt.isUnseen(1)) {
                    bonus -= 0.2;  /* 半明置 → 谨慎 */
                }
            }

            /* ③ 明置同势力 → 绝对不能打 */
            if (isDmg && tgt) {
                if (tgt.group && me.group && tgt.group === me.group &&
                    !tgt.isYezin && !me.isYezin) {
                    bonus -= 2.0;  /* 同势力绝对不能打 */
                }
            }

            /* ④ 势力技奖励 */
            if (act.type === 'skill' && act.id) {
                if (/^zhuSkill_/.test(act.id)) bonus += 0.4;
                if (/^zhenfa_/.test(act.id)) bonus += 0.3;
                if (/^zhulian_/.test(act.id)) bonus += 0.6;
            }

            /* ⑤ 野心家：独狼策略 */
            if (me.isYezin || me.identity === 'yezin') {
                /* 野心家没有队友，优先打威胁最大的 */
                if (isDmg) {
                    /* 打残血加成 */
                    const hp = tgt ? (tgt.hp || 0) : 0;
                    if (hp <= 1) bonus += 0.5;
                    else if (hp <= 2) bonus += 0.2;
                }
                /* 少用 AOE */
                if (['nanman', 'wanjian'].indexOf(act.id) >= 0) {
                    bonus -= 0.3;
                }
            }

            /* ⑥ 阵法技：站队形加成 */
            if (act.type === 'card' && isHeal && tgt) {
                if (tgt.skills && tgt.skills.some(function (s) {
                    return /^zhenfa_/.test(s);
                })) {
                    bonus += 0.3;
                }
            }
        } catch (e) {}
        return bonus;
    },
});

/* 国战珠联璧合判定 */
function isZhulian(a, b) {
    try {
        if (!a || !b || a === b) return false;
        /* 本体 API */
        if (typeof get.zhulian === 'function') {
            return get.zhulian(a, b);
        }
        /* 兜底：常见组合表 */
        const PAIRS = [
            ['liubei', 'guanyu'], ['liubei', 'zhangfei'], ['liubei', 'zhugeliang'],
            ['guanyu', 'zhangfei'],
            ['caocao', 'xiahoudun'], ['caocao', 'xuchu'], ['caocao', 'simayi'],
            ['sunquan', 'zhouyu'], ['sunquan', 'lvmeng'], ['sunquan', 'luxun'],
            ['sunce', 'zhouyu'],
            ['lvbu', 'diaochan'],
            ['yuanshao', 'yanliangwenchou'],
            ['menghuo', 'zhurong'],
        ];
        const an = a.name1 || a.name || '';
        const bn = b.name1 || b.name || '';
        for (const pair of PAIRS) {
            if ((pair[0] === an && pair[1] === bn) ||
                (pair[1] === an && pair[0] === bn)) {
                return true;
            }
        }
        return false;
    } catch (e) { return false; }
}

/* ===== 3. 斗地主 ===== */
const DOUDIZHU_STRATEGY = Object.assign({}, DEFAULT_STRATEGY, {
    name: 'doudizhu',
    useIdentityInference: false,
    useNeiZhuAI: false,

    getCamp: function (player) {
        try {
            if (!player) return 'unknown';
            /* 地主 */
            if (player.isZhu || player.identity === 'zhu' ||
                player.identity === 'dizhu' || player.identity === 'landlord') {
                return 'landlord';
            }
            /* 农民 */
            return 'farmer';
        } catch (e) { return 'unknown'; }
    },

    isSameCamp: function (a, b) {
        if (!a || !b) return false;
        try {
            return this.getCamp(a) === this.getCamp(b);
        } catch (e) { return false; }
    },

    getExclusiveSkills: function () {
        return [/^dizhu_/, /^nongmin_/];
    },

    decisionBoost: function (me, act) {
        let bonus = 0;
        try {
            const myCamp = this.getCamp(me);
            const tgt = getTarget(act);
            const isDmg = isAttackAct(act);
            const isHeal = isHealAct(act);

            /* ===== 地主策略 ===== */
            if (myCamp === 'landlord') {
                /* ① 主动进攻加成 */
                if (isDmg) bonus += 0.25;
                /* ② 地主有额外摸牌 + 出杀次数 + 血量优势，可以更激进 */
                if (act.type === 'card' && ['juedou', 'huogong'].indexOf(act.id) >= 0) {
                    bonus += 0.15;
                }
                /* ③ 优先杀农民中威胁大的（手牌多 / 装备多） */
                if (isDmg && tgt) {
                    const hc = tgt.countCards ? tgt.countCards('h') : 0;
                    if (hc >= 5) bonus += 0.2;
                    const ec = tgt.countCards ? tgt.countCards('e') : 0;
                    if (ec >= 2) bonus += 0.15;
                }
                /* ④ 地主少用 AOE（因为会打到自己） */
                if (act.type === 'card' && ['nanman', 'wanjian'].indexOf(act.id) >= 0) {
                    bonus -= 0.4;
                }
                /* ⑤ 地主优先打残血农民（速杀） */
                if (isDmg && tgt) {
                    const hp = tgt.hp || 0;
                    if (hp <= 1) bonus += 0.4;
                    else if (hp <= 2) bonus += 0.15;
                }
            }

            /* ===== 农民策略 ===== */
            else if (myCamp === 'farmer') {
                /* ① 协作：救队友 */
                if (isHeal && tgt && this.getCamp(tgt) === 'farmer') {
                    bonus += 0.5;
                }
                /* ② 集火地主 */
                if (isDmg && tgt && this.getCamp(tgt) === 'landlord') {
                    bonus += 0.5;
                }
                /* ③ 保留桃：农民若 HP=1，桃留给自己 */
                if (act.id === 'tao') {
                    if ((me.hp || 0) <= 1 && !act.target) {
                        bonus += 0.3;
                    }
                }
                /* ④ AOE：农民 2v1，AOE 打地主，农民合作可以接受 */
                if (act.type === 'card' && ['nanman', 'wanjian'].indexOf(act.id) >= 0) {
                    bonus -= 0.2;
                }
                /* ⑤ 无懈：保护队友的关键锦囊 */
                if (act.id === 'wuxie') {
                    bonus += 0.3;
                }
                /* ⑥ 农民打队友 → 惩罚翻倍（从 1 开始） */
                if (isDmg && tgt && this.getCamp(tgt) === 'farmer') {
                    /* 打明身份队友 → 惩罚翻倍 + 分数减半 */
                    if (tgt.identityShown || tgt.identity) {
                        bonus -= 4.0;  /* 翻倍：-2.0 → -4.0 */
                        bonus *= 0.5;   /* 分数减半 */
                    } else {
                        bonus -= 2.0;
                    }
                    /* 按损失程度将 20%~60% 阵营分给其他阵营 */
                    const hpLoss = tgt.hp || 0;  /* 假设打 1 血 */
                    const penaltyRatio = 0.2 + Math.min(0.4, hpLoss * 0.1);  /* 20%~60% */
                    /* 把阵营分给地主（其他阵营） */
                    try {
                        const landlord = (game.players || []).find(function (p) {
                            return p && p.alive !== false &&
                                (p.isZhu || p.identity === 'zhu' ||
                                 p.identity === 'dizhu' || p.identity === 'landlord');
                        });
                        if (landlord) {
                            /* 地主获得奖励 */
                            bonus += penaltyRatio * 2.0;  /* 20%~60% 的 2 分 */
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}
        return bonus;
    },
});

/* ===== 4. BOSS 战 ===== */
const BOSS_STRATEGY = Object.assign({}, DEFAULT_STRATEGY, {
    name: 'boss',
    useIdentityInference: false,
    useNeiZhuAI: false,

    getCamp: function (player) {
        try {
            if (!player) return 'unknown';
            if (player.isBoss || player.identity === 'boss' || player.identity === 'zhu') {
                return 'boss';
            }
            return 'challenger';
        } catch (e) { return 'unknown'; }
    },

    isSameCamp: function (a, b) {
        if (!a || !b) return false;
        try {
            return this.getCamp(a) === this.getCamp(b);
        } catch (e) { return false; }
    },

    getExclusiveSkills: function () {
        return [/^boss_/];
    },

    decisionBoost: function (me, act) {
        let bonus = 0;
        try {
            const myCamp = this.getCamp(me);
            const tgt = getTarget(act);
            const isDmg = isAttackAct(act);

            /* ===== 挑战者策略 ===== */
            if (myCamp === 'challenger') {
                /* ① 围攻 BOSS 加成 */
                if (isDmg && tgt && this.getCamp(tgt) === 'boss') {
                    bonus += 0.6;
                }
                /* ② 队友保护 */
                if (act.type === 'card' && ['tao', 'wuxie'].indexOf(act.id) >= 0 && tgt &&
                    this.getCamp(tgt) === 'challenger') {
                    bonus += 0.4;
                }
                /* ③ 拆装备：拆除 BOSS 装备加成 */
                if (['guohe', 'shunshou'].indexOf(act.id) >= 0 && tgt &&
                    this.getCamp(tgt) === 'boss') {
                    const ec = tgt.countCards ? tgt.countCards('e') : 0;
                    if (ec >= 2) bonus += 0.3;
                }
                /* ④ 挑战者绝对不能打队友 */
                if (isDmg && tgt && this.getCamp(tgt) === 'challenger') {
                    bonus -= 2.0;
                }
            }

            /* ===== BOSS 策略 ===== */
            else if (myCamp === 'boss') {
                /* BOSS 通常 HP/技能优势，主动进攻 */
                if (isDmg) bonus += 0.3;
                /* BOSS 少用治疗（除非血量低） */
                if (['tao', 'taoyuan'].indexOf(act.id) >= 0) {
                    const hpRatio = (me.hp || 0) / Math.max(1, me.maxHp || 1);
                    if (hpRatio < 0.3) bonus += 0.5;
                    else bonus -= 0.2;
                }
                /* BOSS 优先打 HP 最低的挑战者（速杀） */
                if (isDmg && tgt) {
                    const hp = tgt.hp || 0;
                    if (hp <= 1) bonus += 0.5;
                    else if (hp <= 2) bonus += 0.2;
                }
            }
        } catch (e) {}
        return bonus;
    },
});

/* ===== 5. 对战（2v2 / 3v3 / 3v3v2） ===== */
const VERSUS_STRATEGY = Object.assign({}, DEFAULT_STRATEGY, {
    name: 'versus',
    useIdentityInference: false,
    useNeiZhuAI: false,

    getCamp: function (player) {
        try {
            if (!player) return 'unknown';
            /* 队伍模式：side 字段 */
            if (player.side) return String(player.side);
            /* 兜底：identity */
            if (player.identity) return String(player.identity);
            /* 自己 */
            if (player === game.me) return 'me';
            return 'unknown';
        } catch (e) { return 'unknown'; }
    },

    isSameCamp: function (a, b) {
        if (!a || !b) return false;
        try {
            /* 有 side → 比较 side */
            if (a.side && b.side) return a.side === b.side;
            /* 兜底：attitude */
            return get.attitude(a, b) > 0;
        } catch (e) { return false; }
    },

    getExclusiveSkills: function () {
        return [/^team_/, /^duiwu_/];
    },

    decisionBoost: function (me, act) {
        let bonus = 0;
        try {
            const mySide = me.side || 'unknown';
            const tgt = getTarget(act);
            const isDmg = isAttackAct(act);

            /* 队伍协作 */
            if (tgt) {
                const isAlly = tgt.side === mySide;
                /* 打队友 → 惩罚翻倍（从 1 开始） */
                if (isAlly && isDmg) {
                    /* 打明身份队友 → 惩罚翻倍 + 分数减半 */
                    if (tgt.identityShown || tgt.identity) {
                        bonus -= 4.0;  /* 翻倍：-2.0 → -4.0 */
                        bonus *= 0.5;   /* 分数减半 */
                    } else {
                        bonus -= 2.0;
                    }
                    /* 按损失程度将 20%~60% 阵营分给其他阵营 */
                    const hpLoss = tgt.hp || 0;
                    const penaltyRatio = 0.2 + Math.min(0.4, hpLoss * 0.1);  /* 20%~60% */
                    /* 把阵营分给敌方（其他阵营） */
                    try {
                        const enemies = (game.players || []).filter(function (p) {
                            return p && p.alive !== false && p.side && p.side !== mySide;
                        });
                        if (enemies.length > 0) {
                            /* 敌方获得奖励 */
                            bonus += penaltyRatio * 2.0;  /* 20%~60% 的 2 分 */
                        }
                    } catch (e) {}
                }
                /* 救队友 → 加成 */
                if (isAlly && ['tao', 'wuxie'].indexOf(act.id) >= 0) {
                    bonus += 0.5;
                }
                /* 打敌方 → 加成 */
                if (!isAlly && isDmg) {
                    bonus += 0.4;
                }
            }
        } catch (e) {}
        return bonus;
    },
});

/* ===== 6. 单挑（1v1） ===== */
const SINGLE_STRATEGY = Object.assign({}, DEFAULT_STRATEGY, {
    name: 'single',
    useIdentityInference: false,
    useNeiZhuAI: false,

    getCamp: function (player) {
        try {
            if (!player) return 'unknown';
            if (player === game.me) return 'me';
            return 'opponent';
        } catch (e) { return 'unknown'; }
    },

    isSameCamp: function (a, b) {
        if (!a || !b) return false;
        /* 单挑里没有队友，永远 false */
        return false;
    },

    getExclusiveSkills: function () {
        return [/^dan_/, /^duanjia_/];
    },

    decisionBoost: function (me, act) {
        let bonus = 0;
        try {
            const isDmg = isAttackAct(act);
            /* 单挑里所有人都是敌人，进攻加成更高 */
            if (isDmg) bonus += 0.2;
            /* 单挑里没有队友，不需要考虑救队友 */
        } catch (e) {}
        return bonus;
    },
});

/* ===== 7. 塔防 ===== */
const TAFANG_STRATEGY = Object.assign({}, DEFAULT_STRATEGY, {
    name: 'tafang',
    useIdentityInference: false,
    useNeiZhuAI: false,

    getCamp: function (player) {
        try {
            if (!player) return 'unknown';
            /* 塔防里玩家都是友方，怪是敌方 */
            if (player.isNpc || player.identity === 'npc') return 'enemy';
            if (player === game.me) return 'me';
            return 'ally';
        } catch (e) { return 'unknown'; }
    },

    isSameCamp: function (a, b) {
        if (!a || !b) return false;
        try {
            /* NPC 都是敌人 */
            if (a.isNpc || b.isNpc) return false;
            /* 玩家都是友方 */
            return true;
        } catch (e) { return false; }
    },

    decisionBoost: function (me, act) {
        let bonus = 0;
        try {
            const tgt = getTarget(act);
            const isDmg = isAttackAct(act);
            /* 打 NPC 加成 */
            if (isDmg && tgt && (tgt.isNpc || tgt.identity === 'npc')) {
                bonus += 0.5;
            }
            /* 打玩家 → 强惩罚 */
            if (isDmg && tgt && !tgt.isNpc && tgt !== me) {
                bonus -= 2.0;
            }
        } catch (e) {}
        return bonus;
    },
});

/* ===== 8. 大乱斗 ===== */
const BRAWL_STRATEGY = Object.assign({}, DEFAULT_STRATEGY, {
    name: 'brawl',
    useIdentityInference: false,
    useNeiZhuAI: false,

    getCamp: function (player) {
        try {
            if (!player) return 'unknown';
            /* 大乱斗：每个人都是自己的阵营 */
            if (player === game.me) return 'me';
            return 'enemy_' + (player.name1 || player.name || '?');
        } catch (e) { return 'unknown'; }
    },

    isSameCamp: function (a, b) {
        if (!a || !b) return false;
        /* 大乱斗里没有队友 */
        return false;
    },

    decisionBoost: function (me, act) {
        let bonus = 0;
        try {
            const isDmg = isAttackAct(act);
            /* 大乱斗：优先打残血 */
            if (isDmg) {
                const tgt = getTarget(act);
                if (tgt) {
                    const hp = tgt.hp || 0;
                    if (hp <= 1) bonus += 0.5;
                    else if (hp <= 2) bonus += 0.2;
                }
            }
        } catch (e) {}
        return bonus;
    },
});

/* ===== 9. 象棋 ===== */
const CHESS_STRATEGY = Object.assign({}, DEFAULT_STRATEGY, {
    name: 'chess',
    useIdentityInference: false,
    useNeiZhuAI: false,

    getCamp: function (player) {
        try {
            if (!player) return 'unknown';
            if (player.side) return String(player.side);
            if (player === game.me) return 'me';
            return 'opponent';
        } catch (e) { return 'unknown'; }
    },

    isSameCamp: function (a, b) {
        if (!a || !b) return false;
        try {
            if (a.side && b.side) return a.side === b.side;
            return false;
        } catch (e) { return false; }
    },
});

/* ===== 10. 石头剪刀布 ===== */
const STONE_STRATEGY = Object.assign({}, DEFAULT_STRATEGY, {
    name: 'stone',
    useIdentityInference: false,
    useNeiZhuAI: false,

    getCamp: function (player) {
        try {
            if (!player) return 'unknown';
            if (player === game.me) return 'me';
            return 'opponent';
        } catch (e) { return 'unknown'; }
    },

    isSameCamp: function (a, b) {
        if (!a || !b) return false;
        return false;  /* 永远没有队友 */
    },
});

/* ===== 11. 联机/实时对战 ===== */
const CONNECT_STRATEGY = Object.assign({}, DEFAULT_STRATEGY, {
    name: 'connect',
    useIdentityInference: true,
    useNeiZhuAI: true,

    getCamp: function (player) {
        /* 联机模式通常是身份局规则 */
        return IDENTITY_STRATEGY.getCamp(player);
    },

    isSameCamp: function (a, b) {
        return IDENTITY_STRATEGY.isSameCamp(a, b);
    },
});

/* ================= 注册表 ================= */
export const MODE_STRATEGIES = {
    identity: IDENTITY_STRATEGY,
    guozhan:  GUOZHAN_STRATEGY,
    doudizhu: DOUDIZHU_STRATEGY,
    boss:     BOSS_STRATEGY,
    versus:   VERSUS_STRATEGY,
    single:   SINGLE_STRATEGY,
    tafang:   TAFANG_STRATEGY,
    brawl:    BRAWL_STRATEGY,
    chess:    CHESS_STRATEGY,
    stone:    STONE_STRATEGY,
    connect:  CONNECT_STRATEGY,
    realtime: CONNECT_STRATEGY,
};

/* 获取当前模式策略 */
export function getModeStrategy() {
    try {
        const mode = (typeof get === 'object' && get.mode) ? get.mode() : '';
        return MODE_STRATEGIES[mode] || DEFAULT_STRATEGY;
    } catch (e) { return DEFAULT_STRATEGY; }
}

/* 快捷：判断同阵营 */
export function isSameCamp(a, b) {
    return getModeStrategy().isSameCamp(a, b);
}

/* 快捷：判断是敌人 */
export function isEnemy(a, b) {
    try {
        if (!a || !b || a === b) return false;
        /* 优先用 attitude 兜底（全模式通用） */
        const att = get.attitude(a, b);
        if (att !== 0) return att < 0;
        /* attitude 为 0 → 用阵营策略 */
        return !isSameCamp(a, b);
    } catch (e) { return false; }
}

/* 快捷：应用模式加成 */
export function applyModeBoost(me, act) {
    try {
        return getModeStrategy().decisionBoost(me, act);
    } catch (e) { return 0; }
}

/* ★ 暴露给 engine.js 的 giveVs 使用 */
try {
    if (lib) {
        lib.__djsc_modeStrategy = {
            getModeStrategy: getModeStrategy,
            MODE_STRATEGIES: MODE_STRATEGIES,
            clearModeCache: clearModeCache,
        };
    }
} catch (e) {}
