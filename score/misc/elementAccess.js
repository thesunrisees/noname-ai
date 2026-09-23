/* ================= 决策积分引擎 · 元素读写系统（影子表） =================
 * 职责：AI 自己学到的技能/卡牌定义，存储在 localStorage。
 * 核心：
 *   · 默认值：内置的基础定义（技能威胁度、卡牌价值）
 *   · 影子值：AI 通过实战反馈学到的修正值
 *   · 合并：读的时候 = 默认值 + 影子修正
 */
import { log } from '../core/logger.js';

const STORE_KEY = 'djsc_element_shadow_v1';
const VERSION = 1;

/* ================= 默认值表 ================= */
const DEFAULT_SKILL = {
    /* 攻击类技能 */
    sha: { threaten: 3, value: 3 },
    juedou: { threaten: 3.5, value: 3.5 },
    huogong: { threaten: 2.5, value: 2.5 },
    nanman: { threaten: 4, value: 4 },
    wanjian: { threaten: 4, value: 4 },
    zhujin: { threaten: 3.5, value: 3.5 },
    /* 防御类技能 */
    shan: { threaten: 0, value: 3 },
    tao: { threaten: 0, value: 4 },
    jiu: { threaten: 0, value: 3.5 },
    wuxie: { threaten: 0, value: 4 },
    /* 控制类技能 */
    shunshou: { threaten: 2, value: 3 },
    guohe: { threaten: 2, value: 3 },
    lebu: { threaten: 2.5, value: 2.5 },
    bingliang: { threaten: 2.5, value: 2.5 },
    tiesuo: { threaten: 2, value: 2.5 },
    /* 辅助类技能 */
    wuzhong: { threaten: 0, value: 3.5 },
    taoyuan: { threaten: 0, value: 4 },
};

const DEFAULT_CARD = {
    /* 攻击牌 */
    sha: { threaten: 3, value: 3 },
    huosha: { threaten: 3.5, value: 3.5 },
    leisha: { threaten: 3.5, value: 3.5 },
    juedou: { threaten: 3.5, value: 3.5 },
    huogong: { threaten: 2.5, value: 2.5 },
    nanman: { threaten: 4, value: 4 },
    wanjian: { threaten: 4, value: 4 },
    zhujin: { threaten: 3.5, value: 3.5 },
    /* 防御牌 */
    shan: { threaten: 0, value: 3 },
    tao: { threaten: 0, value: 4 },
    jiu: { threaten: 0, value: 3.5 },
    wuxie: { threaten: 0, value: 4 },
    /* 控制牌 */
    shunshou: { threaten: 2, value: 3 },
    guohe: { threaten: 2, value: 3 },
    lebu: { threaten: 2.5, value: 2.5 },
    bingliang: { threaten: 2.5, value: 2.5 },
    tiesuo: { threaten: 2, value: 2.5 },
    /* 辅助牌 */
    wuzhong: { threaten: 0, value: 3.5 },
    taoyuan: { threaten: 0, value: 4 },
};

/* ================= 影子表（AI 学到的修正） ================= */
let SHADOW = {
    skills: {},
    cards: {},
};
let _loaded = false;

function _load() {
    try {
        if (_loaded) return;
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) {
            const obj = JSON.parse(raw);
            if (obj && obj.v === VERSION) {
                SHADOW.skills = obj.skills || {};
                SHADOW.cards = obj.cards || {};
            }
        }
        _loaded = true;
    } catch (e) { _loaded = true; }
}

function _save() {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify({
            v: VERSION,
            skills: SHADOW.skills,
            cards: SHADOW.cards,
        }));
    } catch (e) {}
}

/* ================= 读取技能定义 =================
 * @param skillId  技能 id
 * @return { threaten, value, source, learned }
 *   source: 'default'（用默认值） | 'override'（AI 自己学到的）
 */
export function readSkill(skillId) {
    try {
        _load();
        const shadow = SHADOW.skills[skillId];
        const def = DEFAULT_SKILL[skillId] || { threaten: 1, value: 1 };

        if (shadow) {
            /* 影子值：默认值 + 修正 */
            return {
                threaten: Math.round((def.threaten + shadow.delta) * 100) / 100,
                value: Math.round((def.value + shadow.delta) * 100) / 100,
                source: 'override',
                learned: shadow.learned || 0,
            };
        }

        return {
            threaten: def.threaten,
            value: def.value,
            source: 'default',
            learned: 0,
        };
    } catch (e) {
        return { threaten: 1, value: 1, source: 'default', learned: 0 };
    }
}

/* ================= 读取卡牌定义 ================= */
export function readCard(cardId) {
    try {
        _load();
        const shadow = SHADOW.cards[cardId];
        const def = DEFAULT_CARD[cardId] || { threaten: 1, value: 1 };

        if (shadow) {
            return {
                threaten: Math.round((def.threaten + shadow.delta) * 100) / 100,
                value: Math.round((def.value + shadow.delta) * 100) / 100,
                source: 'override',
                learned: shadow.learned || 0,
            };
        }

        return {
            threaten: def.threaten,
            value: def.value,
            source: 'default',
            learned: 0,
        };
    } catch (e) {
        return { threaten: 1, value: 1, source: 'default', learned: 0 };
    }
}

/* ================= 自动学习技能 =================
 * @param skillId  技能 id
 * @param delta    修正值（正=加分，负=减分）
 */
export function autoLearnSkill(skillId, delta) {
    try {
        if (!skillId) return;
        _load();
        if (!SHADOW.skills[skillId]) {
            SHADOW.skills[skillId] = { delta: 0, learned: 0 };
        }
        SHADOW.skills[skillId].delta = Math.round((SHADOW.skills[skillId].delta + delta) * 100) / 100;
        SHADOW.skills[skillId].learned = (SHADOW.skills[skillId].learned || 0) + 1;
        /* 限制修正范围 [-2, +2] */
        if (SHADOW.skills[skillId].delta > 2) SHADOW.skills[skillId].delta = 2;
        if (SHADOW.skills[skillId].delta < -2) SHADOW.skills[skillId].delta = -2;
        _save();
    } catch (e) {}
}

/* ================= 自动学习卡牌 ================= */
export function autoLearnCard(cardId, delta) {
    try {
        if (!cardId) return;
        _load();
        if (!SHADOW.cards[cardId]) {
            SHADOW.cards[cardId] = { delta: 0, learned: 0 };
        }
        SHADOW.cards[cardId].delta = Math.round((SHADOW.cards[cardId].delta + delta) * 100) / 100;
        SHADOW.cards[cardId].learned = (SHADOW.cards[cardId].learned || 0) + 1;
        if (SHADOW.cards[cardId].delta > 2) SHADOW.cards[cardId].delta = 2;
        if (SHADOW.cards[cardId].delta < -2) SHADOW.cards[cardId].delta = -2;
        _save();
    } catch (e) {}
}

/* ================= 查询影子表 ================= */
export function listShadow() {
    try {
        _load();
        return JSON.parse(JSON.stringify(SHADOW));
    } catch (e) { return { skills: {}, cards: {} }; }
}

/* ================= 重置影子表 ================= */
export function resetShadow() {
    SHADOW.skills = {};
    SHADOW.cards = {};
    _save();
    log.info('element', '影子表已复位');
}

/* ================= 挂载全局 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.element = {
        readSkill: readSkill,
        readCard: readCard,
        autoLearnSkill: autoLearnSkill,
        autoLearnCard: autoLearnCard,
        list: listShadow,
        reset: resetShadow,
    };
}
