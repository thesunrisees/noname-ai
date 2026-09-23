/* ================= 决策积分引擎 · 卡牌策略细化 =================
 * 基于无名杀官方 API（lib.card / lib.skill / get.cardPile 等）
 * 动态扫描所有卡牌，生成精细的卡牌策略表：
 *   ① 自动识别所有可用卡牌（不限于硬编码列表）
 *   ② 每张卡的：使用价值 / 响应价值 / 目标偏好 / 时机条件
 *   ③ 装备卡的：位置偏好（武器/防具/坐骑/+1/-1）
 *   ④ 锦囊卡的：风险等级（AOE/单体/延迟）
 *   ⑤ 与 lib.card 的自动同步（新卡自动识别）
 */
import { lib, game, get, _status } from '../../../noname.js';
import { log } from './logger.js';

/* ================= 卡牌策略表（自动生成 + 手动微调） ================= */
const CARD_STRATEGY = {};
let _initialized = false;

/* ================= 手动微调表（覆盖自动识别结果） ================= */
const CARD_OVERRIDE = {
    /* 攻击牌 */
    sha:        { use: 3,  resp: 1,  type: 'attack',  risk: 'low',    target: 'enemy_low_hp',  name: '杀', tags: ['attack', 'sha'] },
    huosha:     { use: 3.5,resp: 1,  type: 'attack',  risk: 'low',    target: 'enemy_linked', name: '火杀', tags: ['attack', 'sha', 'fire'] },
    leisha:     { use: 3.5,resp: 1,  type: 'attack',  risk: 'low',    target: 'enemy_linked', name: '雷杀', tags: ['attack', 'sha', 'thunder'] },
    juedou:     { use: 4,  resp: 2,  type: 'attack',  risk: 'medium', target: 'enemy_few_sha', name: '决斗', tags: ['attack', 'duel'] },
    huogong:    { use: 3.5,resp: 1,  type: 'attack',  risk: 'low',    target: 'enemy_many_cards', name: '火攻', tags: ['attack', 'fire'] },
    zhujin:     { use: 4.5,resp: 1,  type: 'attack',  risk: 'low',    target: 'enemy_low_hp', name: '诛杀', tags: ['attack', 'execute'] },

    /* 防御牌 */
    shan:       { use: 1,  resp: 3.5,type: 'defense', risk: 'none',   target: 'self',          name: '闪', tags: ['defense', 'shan'] },
    tao:        { use: 5,  resp: 5,  type: 'defense', risk: 'none',   target: 'self_dying',   name: '桃', tags: ['heal', 'tao'] },
    jiu:        { use: 3.5,resp: 2,  type: 'buff',    risk: 'low',    target: 'self',          name: '酒', tags: ['buff', 'jiu'] },
    wuxie:      { use: 5.5,resp: 5.5,type: 'counter', risk: 'none',  target: 'self_ally',     name: '无懈可击', tags: ['counter', 'wuxie'] },

    /* AOE 锦囊 */
    nanman:     { use: 4.5,resp: 2,  type: 'aoe',     risk: 'high',   target: 'all_enemy',    name: '南蛮入侵', tags: ['aoe', 'nanman'] },
    wanjian:    { use: 4.5,resp: 2,  type: 'aoe',     risk: 'high',   target: 'all_enemy',    name: '万箭齐发', tags: ['aoe', 'wanjian'] },
    taoyuan:    { use: 3.5,resp: 0,  type: 'heal_aoe',risk: 'low',    target: 'all_ally',     name: '桃园结义', tags: ['heal', 'aoe'] },
    wugu:       { use: 3.5,resp: 0,  type: 'draw_aoe',risk: 'low',    target: 'all',          name: '五谷丰登', tags: ['draw', 'aoe'] },

    /* 单体锦囊 */
    wuzhong:    { use: 4.5,resp: 0,  type: 'draw',    risk: 'none',   target: 'self',          name: '无中生有', tags: ['draw', 'wuzhong'] },
    guohe:      { use: 3,  resp: 0,  type: 'removal', risk: 'low',    target: 'enemy_key_eq',  name: '过河拆桥', tags: ['removal', 'guohe'] },
    shunshou:   { use: 3.5,resp: 0,  type: 'steal',   risk: 'low',    target: 'enemy_key_eq',  name: '顺手牵羊', tags: ['steal', 'shunshou'] },
    jiedao:     { use: 3,  resp: 0,  type: 'trick',   risk: 'medium', target: 'enemy_with_sha',name: '借刀杀人', tags: ['trick', 'jiedao'] },
    tiesuo:     { use: 3,  resp: 0,  type: 'chain',   risk: 'low',    target: 'enemy_group',   name: '铁索连环', tags: ['chain', 'tiesuo'] },

    /* 延迟锦囊 */
    lebu:       { use: 4,  resp: 0,  type: 'delay',   risk: 'medium', target: 'enemy_aggressive', name: '乐不思蜀', tags: ['delay', 'lebu'] },
    bingliang:  { use: 3.5,resp: 0,  type: 'delay',   risk: 'medium', target: 'enemy',        name: '兵粮寸断', tags: ['delay', 'bingliang'] },
    shandian:   { use: 3,  resp: 0,  type: 'delay_risk', risk: 'high',target: 'self_high_hp', name: '闪电', tags: ['delay', 'shandian', 'thunder'] },

    /* 武器 */
    zhuge:      { use: 6,  type: 'weapon',   risk: 'none', slot: 'weapon',   name: '诸葛连弩' },
    qinggang:   { use: 5,  type: 'weapon',   risk: 'none', slot: 'weapon',   name: '青釭剑' },
    qinglong:   { use: 4.5,type: 'weapon',   risk: 'none', slot: 'weapon',   name: '青龙偃月刀' },
    zhangba:    { use: 4.5,type: 'weapon',   risk: 'none', slot: 'weapon',   name: '丈八蛇矛' },
    gudingdao:  { use: 4,  type: 'weapon',   risk: 'none', slot: 'weapon',   name: '古锭刀' },
    cixiong:    { use: 3,  type: 'weapon',   risk: 'none', slot: 'weapon',   name: '雌雄双股剑' },
    fangtian:   { use: 3.5,type: 'weapon',   risk: 'none', slot: 'weapon',   name: '方天画戟' },
    qilin:      { use: 3.5,type: 'weapon',   risk: 'none', slot: 'weapon',   name: '麒麟弓' },

    /* 防具 */
    bagua:      { use: 5,  type: 'armor',     risk: 'none', slot: 'armor',    name: '八卦阵' },
    tengjia:    { use: 3.5,type: 'armor',     risk: 'medium', slot: 'armor',  name: '藤甲' },
    renwang:    { use: 4,  type: 'armor',     risk: 'none', slot: 'armor',    name: '仁王盾' },
    baiyin:     { use: 4,  type: 'armor',     risk: 'none', slot: 'armor',    name: '白银狮子' },

    /* 坐骑（+1/-1） */
    dilu:       { use: 3.5,type: 'mount',     risk: 'none', slot: 'defense_horse', name: '的卢' },
    jueying:    { use: 3.5,type: 'mount',     risk: 'none', slot: 'offense_horse', name: '绝影' },
    chitu:      { use: 3.5,type: 'mount',     risk: 'none', slot: 'offense_horse', name: '赤兔' },
    dawan:      { use: 2.5,type: 'mount',     risk: 'none', slot: 'defense_horse', name: '大宛' },
    zixin:      { use: 2.5,type: 'mount',     risk: 'none', slot: 'offense_horse', name: '紫骍' },
    hualiu:     { use: 2.5,type: 'mount',     risk: 'none', slot: 'defense_horse', name: '骅骝' },

    /* 宝物 */
    muniu:      { use: 4,  type: 'treasure',   risk: 'none', slot: 'treasure', name: '木牛流马' },
};

/* ================= 自动初始化：从 lib.card 扫描所有卡牌 ================= */
function _initCardStrategy() {
    if (_initialized) return;
    try {
        if (!lib || !lib.card) {
            log.warn('cardStrategy', 'lib.card 不可用，使用默认表');
        } else {
            /* 遍历 lib.card 的所有卡牌 */
            const allCards = Object.keys(lib.card) || [];
            allCards.forEach(function (cardId) {
                /* 跳过内部方法 */
                if (cardId[0] === '_' || typeof lib.card[cardId] !== 'object') return;

                /* 如果已经在手动微调表里，就跳过 */
                if (CARD_OVERRIDE[cardId]) {
                    CARD_STRATEGY[cardId] = CARD_OVERRIDE[cardId];
                    return;
                }

                /* 自动识别卡牌类型 */
                const cardData = lib.card[cardId];
                const type = cardData.type || 'unknown';
                const subtype = cardData.subtype || '';

                let autoType = 'unknown';
                let risk = 'medium';
                let useVal = 3.0;
                let respVal = 1.0;

                /* 根据 type/subtype 自动分类 */
                if (type === 'basic') {
                    if (subtype === 'attack') { autoType = 'attack'; risk = 'low'; useVal = 3.0; }
                    else if (subtype === 'defense') { autoType = 'defense'; risk = 'none'; useVal = 1.0; respVal = 3.0; }
                    else if (subtype === 'recover') { autoType = 'heal'; risk = 'none'; useVal = 5.0; respVal = 5.0; }
                } else if (type === 'trick') {
                    if (subtype === 'aoe') { autoType = 'aoe'; risk = 'high'; useVal = 4.5; }
                    else if (subtype === 'delayed') { autoType = 'delay'; risk = 'medium'; useVal = 3.5; }
                    else { autoType = 'trick'; risk = 'low'; useVal = 3.0; }
                } else if (type === 'equip') {
                    if (subtype === 'weapon') { autoType = 'weapon'; risk = 'none'; useVal = 3.5; }
                    else if (subtype === 'armor') { autoType = 'armor'; risk = 'none'; useVal = 4.0; }
                    else if (subtype === 'offensive_horse') { autoType = 'mount'; risk = 'none'; useVal = 2.5; }
                    else if (subtype === 'defensive_horse') { autoType = 'mount'; risk = 'none'; useVal = 2.5; }
                    else { autoType = 'treasure'; risk = 'none'; useVal = 3.0; }
                }

                CARD_STRATEGY[cardId] = {
                    use: useVal,
                    resp: respVal,
                    type: autoType,
                    risk: risk,
                    target: 'auto',
                    name: cardData.name || cardId,
                };
            });
        }

        /* 合并手动微调表 */
        Object.keys(CARD_OVERRIDE).forEach(function (k) {
            CARD_STRATEGY[k] = CARD_OVERRIDE[k];
        });

        _initialized = true;
        try {
            log.info('cardStrategy', '卡牌策略表初始化完成：' + Object.keys(CARD_STRATEGY).length + ' 张卡');
        } catch (e) {}
    } catch (e) {
        log.warn('cardStrategy', '初始化失败：' + e.message);
    }
}

/* ================= 查询卡牌策略 ================= */
export function getCardStrategy(cardId) {
    _initCardStrategy();
    return CARD_STRATEGY[cardId] || {
        use: 3.0,
        resp: 1.0,
        type: 'unknown',
        risk: 'medium',
        target: 'auto',
        name: cardId,
    };
}

/* ================= 卡牌使用价值（根据局势调整） ================= */
export function cardUseValue(me, cardId, target) {
    try {
        const base = getCardStrategy(cardId);
        let val = base.use;

        /* ① 残局调整 */
        const alive = (game.players || []).filter(function (p) {
            return p && p.alive !== false;
        }).length;

        if (alive <= 3) {
            /* 残局 → 防御牌价值提高 */
            if (base.type === 'defense') val += 1.5;
            if (base.type === 'heal') val += 2.0;
        }

        /* ② 手牌调整 */
        const myHand = me.countCards ? me.countCards('h') : 0;
        if (myHand <= 2) {
            /* 手牌少 → 补牌/防御价值提高 */
            if (base.type === 'draw') val += 1.5;
            if (base.type === 'defense') val += 1.0;
        }

        /* ③ 目标状态调整 */
        if (target) {
            const tHp = target.hp || 0;
            /* 目标残血 → 攻击牌价值提高 */
            if (tHp <= 1 && base.type === 'attack') val += 1.5;
            if (tHp <= 2 && base.type === 'attack') val += 0.8;
        }

        /* ④ 风险惩罚 */
        if (base.risk === 'high') {
            /* 高风险牌：自己残血时不打 */
            const myHp = me.hp || 0;
            if (myHp <= 2) val *= 0.7;
        }

        return Math.round(val * 100) / 100;
    } catch (e) {
        return 3.0;
    }
}

/* ================= 卡牌响应价值 ================= */
export function cardRespondValue(me, cardId, context) {
    try {
        const base = getCardStrategy(cardId);
        let val = base.resp;

        /* ① 自己残血 → 闪/桃价值提高 */
        const myHp = me.hp || 0;
        if (myHp <= 1) {
            if (cardId === 'shan') val += 2.0;
            if (cardId === 'tao') val += 3.0;
        }

        /* ② 队友濒死 → 桃价值提高 */
        if (cardId === 'tao' && context && context.targetDying) val += 2.0;

        /* ③ 关键锦囊 → 无懈价值提高 */
        if (cardId === 'wuxie' && context && context.isKeyTrick) val += 2.0;

        return Math.round(val * 100) / 100;
    } catch (e) {
        return 1.0;
    }
}

/* ================= 卡牌类型分类 ================= */
export function getCardType(cardId) {
    return getCardStrategy(cardId).type || 'unknown';
}

/* ================= 卡牌风险等级 ================= */
export function getCardRisk(cardId) {
    return getCardStrategy(cardId).risk || 'medium';
}

/* ================= 统计接口 ================= */
export function cardStrategyStats() {
    _initCardStrategy();
    const byType = {};
    Object.keys(CARD_STRATEGY).forEach(function (k) {
        const t = CARD_STRATEGY[k].type || 'unknown';
        if (!byType[t]) byType[t] = 0;
        byType[t]++;
    });
    return {
        total: Object.keys(CARD_STRATEGY).length,
        byType: byType,
    };
}

export function resetCardStrategy() {
    _initialized = false;
    Object.keys(CARD_STRATEGY).forEach(function (k) {
        delete CARD_STRATEGY[k];
    });
    log.info('cardStrategy', '卡牌策略表已复位');
}

/* ================= 挂载 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.cardStrategy = {
        get: getCardStrategy,
        useValue: cardUseValue,
        respValue: cardRespondValue,
        type: getCardType,
        risk: getCardRisk,
        stats: cardStrategyStats,
        reset: resetCardStrategy,
    };
}
