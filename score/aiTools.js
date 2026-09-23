/* ================= 决策积分引擎 · 无名杀AI工具集 =================
 * 封装无名杀本体的AI工具函数：
 *   ① threaten（嘲讽度）
 *   ② get.skillRank（技能重要度）
 *   ③ hasSkillTag（检测技能标签）
 *   ④ mod.aiUseful（回合外价值）
 */

import { lib, game, get, ai, _status } from '../../../noname.js';
import { log } from './logger.js';

/* ================= ① 嘲讽度 ================= */
export function getThreaten(player) {
    try {
        if (!player) return 0;
        return player.threaten || 0;
    } catch (e) {
        return 0;
    }
}

export function getMaxThreaten() {
    try {
        let max = 0;
        (game.players || []).forEach(function (p) {
            if (!p || p.alive === false) return;
            const t = getThreaten(p);
            if (t > max) max = t;
        });
        return max;
    } catch (e) {
        return 0;
    }
}

/* ================= ② 技能重要度 ================= */
export function getSkillRank(skillId, inOrOut) {
    try {
        if (!skillId) return 0;
        return get.skillRank(skillId, inOrOut || "out");
    } catch (e) {
        return 0;
    }
}

export function getPlayerSkillRank(player) {
    try {
        if (!player) return 0;
        const skills = player.getSkills ? player.getSkills() : [];
        let maxRank = 0;
        skills.forEach(function (sid) {
            const rank = getSkillRank(sid, "out");
            if (rank > maxRank) maxRank = rank;
        });
        return maxRank;
    } catch (e) {
        return 0;
    }
}

/* ================= ③ 技能标签检测 ================= */
export function hasSkillTag(player, tag) {
    try {
        if (!player || !tag) return false;
        return player.hasSkillTag(tag);
    } catch (e) {
        return false;
    }
}

/* 常用标签快捷检测 */
export function isMaixie(player) { return hasSkillTag(player, 'maixie'); }           // 卖血
export function isMaixieHp(player) { return hasSkillTag(player, 'maixie_hp'); }     // 按血量卖血
export function isMaixieDefend(player) { return hasSkillTag(player, 'maixie_defend'); } // 反卖血
export function hasUnequip(player) { return hasSkillTag(player, 'unequip'); }       // 无视防具
export function hasRespondSha(player) { return hasSkillTag(player, 'respondSha'); } // 无杀可出杀
export function hasRespondShan(player) { return hasSkillTag(player, 'respondShan'); } // 无闪可出闪
export function hasRespondTao(player) { return hasSkillTag(player, 'respondTao'); } // 无桃可出桃
export function hasNohujia(player) { return hasSkillTag(player, 'nohujia'); }       // 无护甲
export function hasNoe(player) { return hasSkillTag(player, 'noe'); }               // 失去装备正收益
export function hasReverseEquip(player) { return hasSkillTag(player, 'reverseEquip'); } // 反转装备
export function hasNoh(player) { return hasSkillTag(player, 'noh'); }               // 手牌生生不息
export function hasRejudge(player) { return hasSkillTag(player, 'rejudge'); }       // 改判定
export function hasJueqing(player) { return hasSkillTag(player, 'jueqing'); }       // 绝情
export function hasDamageBonus(player) { return hasSkillTag(player, 'damageBonus'); } // 修改伤害
export function hasNoKeep(player) { return hasSkillTag(player, 'nokeep'); }         // 不保留手牌

/* ================= ③.5 亡语/主公技/势力检测（新增） ================= */
/* 检测是否有亡语技能（forceDie标签） */
export function hasDeathSkill(player) {
    try {
        if (!player) return false;
        const skills = player.getSkills ? player.getSkills() : [];
        for (let i = 0; i < skills.length; i++) {
            const sk = lib.skill[skills[i]];
            if (sk && sk.forceDie) return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

/* 检测是否有主公技 */
export function hasZhuSkill(player) {
    try {
        if (!player) return false;
        return player.hasZhuSkill ? player.hasZhuSkill() : false;
    } catch (e) {
        return false;
    }
}

/* 获取势力 */
export function getGroup(player) {
    try {
        if (!player) return 'unknown';
        return player.group || 'unknown';
    } catch (e) {
        return 'unknown';
    }
}

/* 检测是否是主公 */
export function isZhu(player) {
    try {
        if (!player) return false;
        return player === game.zhu || (player.identity === 'zhu' && player.identityShown);
    } catch (e) {
        return false;
    }
}

/* ================= ④ 回合外价值 ================= */
export function getCardUseful(card, player) {
    try {
        if (!card) return 0;
        const p = player || (game && game.me);
        if (!p) return 0;
        /* 调用本体的 mod.aiUseful */
        if (typeof ai !== 'undefined' && ai.mod && ai.mod.aiUseful) {
            return ai.mod.aiUseful(p, card, 0);
        }
        /* 兜底：用卡牌自身的 ai.useful */
        const name = get.name(card);
        const cardDef = lib.card[name];
        if (cardDef && cardDef.ai && cardDef.ai.useful) {
            if (typeof cardDef.ai.useful === 'function') {
                return cardDef.ai.useful(p, card);
            }
            return cardDef.ai.useful;
        }
        return 0;
    } catch (e) {
        return 0;
    }
}

/* ================= 综合状态 ================= */
export function aiToolsStats() {
    try {
        const me = _status.currentPhase || game.me;
        if (!me) return { error: '未在对局中' };

        let maxThreaten = 0, maxRank = 0;
        (game.players || []).forEach(function (p) {
            if (!p || p.alive === false) return;
            const t = getThreaten(p);
            if (t > maxThreaten) maxThreaten = t;
            const r = getPlayerSkillRank(p);
            if (r > maxRank) maxRank = r;
        });

        return {
            me: me.name1 || me.name || '?',
            maxThreaten: maxThreaten,
            maxSkillRank: maxRank,
            myTags: {
                maixie: isMaixie(me),
                unequip: hasUnequip(me),
                respondSha: hasRespondSha(me),
                respondShan: hasRespondShan(me),
                respondTao: hasRespondTao(me),
            },
        };
    } catch (e) {
        return { error: e.message };
    }
}

/* ================= 挂载 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.aiTools = {
        /* ① 嘲讽度 */
        threaten: getThreaten,
        maxThreaten: getMaxThreaten,
        /* ② 技能重要度 */
        skillRank: getSkillRank,
        playerSkillRank: getPlayerSkillRank,
        /* ③ 技能标签 */
        hasTag: hasSkillTag,
        isMaixie: isMaixie,
        isMaixieHp: isMaixieHp,
        isMaixieDefend: isMaixieDefend,
        hasUnequip: hasUnequip,
        hasRespondSha: hasRespondSha,
        hasRespondShan: hasRespondShan,
        hasRespondTao: hasRespondTao,
        hasNohujia: hasNohujia,
        hasNoe: hasNoe,
        hasReverseEquip: hasReverseEquip,
        hasNoh: hasNoh,
        hasRejudge: hasRejudge,
        hasJueqing: hasJueqing,
        hasDamageBonus: hasDamageBonus,
        hasNoKeep: hasNoKeep,
        /* ③.5 亡语/主公技/势力 */
        hasDeathSkill: hasDeathSkill,
        hasZhuSkill: hasZhuSkill,
        getGroup: getGroup,
        isZhu: isZhu,
        /* ④ 回合外价值 */
        cardUseful: getCardUseful,
        /* 综合 */
        stats: aiToolsStats,
    };
}
