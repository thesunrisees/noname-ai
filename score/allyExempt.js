/* ================= 目标同阵营合理性校验模块 =================
 * 判断针对同阵营使用卡牌是否具备合理的战术收益。
 * 返回 true，表示逻辑合理（放行）；返回 false，表示逻辑不合法（回退）。
 */

import { lib, game, get, _status } from '../../js/utils.js';
import { getWeights, getBias, isReady } from './weights.js';
import { FEATURE_DIM } from './features.js';

/* 具备受击收益的特殊技能（如卖血技能） */
const SPECIAL_SKILLS = [
    'yiji', 'jianxiong', 'fankui', 'gangzhi', 'yongsi',
    'juejing', 'guicai', 'buyi', 'xingshang',
];

/* 具备受击收益的特殊装备 */
const SPECIAL_EQUIPS = ['tengjia', 'bagua'];

function _hasSpecialValue(target) {
    try {
        if (target.getSkills) {
            const skills = target.getSkills();
            for (let i = 0; i < skills.length; i++) {
                if (SPECIAL_SKILLS.indexOf(skills[i]) >= 0) return true;
            }
        }
        for (let i = 0; i < SPECIAL_EQUIPS.length; i++) {
            if (target.getEquip && target.getEquip(SPECIAL_EQUIPS[i])) return true;
        }
    } catch (e) {}
    return false;
}

function _hasAidValue(target, me) {
    try {
        const hc = target.countCards ? target.countCards('h') : 0;
        if (hc <= 1) return true;
        if (target.hasSkill && (target.hasSkill('jizhi') || target.hasSkill('lianying'))) return true;
    } catch (e) {}
    return false;
}

/* 主入口：判断同阵营使用卡牌是否豁免 */
export function checkAllyExempt(me, target, cardName) {
    try {
        if (!me || !target) return false;

        /* 1. 模型置信度判断 */
        if (isReady()) {
            const f = _buildFeature(me, target, cardName);
            const W = getWeights();
            const B = getBias();
            let sum = B;
            for (let j = 0; j < FEATURE_DIM; j++) sum += W[j] * f[j];
            if (sum > 20) return true; /* 模型认为具备正收益 */
        }

        /* 2. 技能战术判定 */
        if (_hasSpecialValue(target)) return true;

        /* 3. 送牌收益判定 */
        if (_hasAidValue(target, me)) return true;

        /* 4. 特殊残局判定 */
        try {
            const alive = (game.players || []).filter(function (p) {
                return p && p.alive !== false;
            });
            if (alive.length <= 2 && target.hp <= 1) {
                if (target.hasSkill && target.hasSkill('hunzi')) return true;
            }
        } catch (e) {}

        return false;
    } catch (e) { return false; }
}

function _buildFeature(me, target, cardName) {
    const f = new Int8Array(FEATURE_DIM);
    try {
        f[0] = Math.round((me.countCards ? me.countCards('h') : 0) / 10 * 127);
        f[8] = Math.round(((me.hp || 0) / Math.max(1, me.maxHp || 1)) * 127);
        f[32] = 127;
        const TARGET_CARDS = ['sha','juedou','huogong','nanman','wanjian'];
        if (TARGET_CARDS.indexOf(cardName) >= 0) f[36] = 127;
        if (cardName === 'sha') f[39] = 127;
        f[42] = 127;
        f[43] = 0;
        f[44] = Math.round(((target.hp || 0) / Math.max(1, target.maxHp || 1)) * 127);
    } catch (e) {}
    return f;
}

if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.checkAllyExempt = checkAllyExempt;
}
