/*
 * ============================================
 * // Author: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 牌堆记忆（多模式适配版） =================
 * 数据源：ui.cardPile（真实 DOM）为准，静态表为辅
 * 用途：追踪已出现的牌，推断剩余牌堆的花色/点数密度
 */
import { ui, get } from '../../../noname.js';

// Auteur: Feisheng Original | Licence: GPL-3.0
/* ===== 军争版（主表） ===== */
const DECK_DATA_JUNZHENG = {
    "h|A":  ["taoyuan", "wanjian", "wuxie"],
    "h|2":  ["shan", "shan", "huogong"],
    "h|3":  ["tao", "wugu", "huogong"],
    "h|4":  ["tao", "wugu", "huosha"],
    "h|5":  ["tao", "qilin", "huosha"],
    "h|6":  ["tao", "lebu"],
    "h|7":  ["tao", "wuzhong", "huosha"],
    "h|8":  ["tao", "wuzhong"],
    "h|9":  ["tao", "wuzhong"],
    "h|10": ["sha", "sha", "huosha"],
    "h|J":  ["sha", "wuzhong", "shan"],
    "h|Q":  ["tao", "guohe", "shan", "shandian"],
    "h|K":  ["shan", "zhuahuang", "wuxie"],
    "d|A":  ["zhuge", "juedou", "zhuque"],
    "d|2":  ["shan", "shan", "shan", "tao"],
    "d|3":  ["shan", "shunshou", "tao"],
    "d|4":  ["shan", "shunshou", "huosha"],
    "d|5":  ["shan", "guanshi", "huosha"],
    "d|6":  ["sha", "sha", "leisha"],
    "d|7":  ["sha", "shan", "leisha"],
    "d|8":  ["sha", "shan", "leisha"],
    "d|9":  ["sha", "shan", "leisha"],
    "d|10": ["sha", "shan", "leisha"],
    "d|J":  ["shan", "shan", "shan"],
    "d|Q":  ["tao", "fangtian", "huogong", "wuxie"],
    "d|K":  ["zixing", "hualiu"],
    "c|A":  ["zhuge", "juedou", "baiyin"],
    "c|2":  ["shan", "shan", "bagua", "tengjia"],
    "c|3":  ["sha", "guohe", "jiu"],
    "c|4":  ["sha", "guohe", "bingliang"],
    "c|5":  ["dilu", "sha", "leisha"],
    "c|6":  ["lebu", "lebu", "leisha"],
    "c|7":  ["nanman", "leisha"],
    "c|8":  ["sha", "leisha"],
    "c|9":  ["sha", "leisha"],
    "c|10": ["sha", "tiesuo"],
    "c|J":  ["sha", "tiesuo"],
    "c|Q":  ["jiedao", "tiesuo", "wuxie"],
    "c|K":  ["jiedao", "wuxie", "tiesuo"],
    "s|A":  ["shandian", "juedou", "gudingdao"],
    "s|2":  ["cixiong", "bagua", "tengjia", "hanbing"],
    "s|3":  ["sha", "shunshou", "jiu"],
    "s|4":  ["sha", "shunshou", "leisha"],
    "s|5":  ["jueying", "qinglong", "leisha"],
    "s|6":  ["qinggang", "lebu", "leisha"],
    "s|7":  ["sha", "nanman", "leisha"],
    "s|8":  ["sha", "sha"],
    "s|9":  ["sha", "sha"],
    "s|10": ["sha", "sha"],
    "s|J":  ["sha", "shunshou", "wuxie"],
    "s|Q":  ["zhangba", "guohe"],
    "s|K":  ["nanman", "dawan", "wuxie"],
};

/* ===== 标准版 ===== */
const DECK_DATA_STANDARD = {
    "h|A":  ["taoyuan", "wanjian", "wuxie"],
    "h|2":  ["shan", "shan"],
    "h|3":  ["tao", "wugu"],
    "h|4":  ["tao", "wugu"],
    "h|5":  ["tao", "qilin"],
    "h|6":  ["tao", "lebu"],
    "h|7":  ["tao", "wuzhong"],
    "h|8":  ["tao", "wuzhong"],
    "h|9":  ["tao", "wuzhong"],
    "h|10": ["sha", "sha"],
    "h|J":  ["sha", "wuzhong", "shan"],
    "h|Q":  ["tao", "guohe", "shan", "shandian"],
    "h|K":  ["shan", "wuxie"],
    "d|A":  ["zhuge", "juedou", "zhuque"],
    "d|2":  ["shan", "shan", "shan"],
    "d|3":  ["shan", "shunshou", "tao"],
    "d|4":  ["shan", "shunshou"],
    "d|5":  ["shan", "guanshi"],
    "d|6":  ["sha", "sha"],
    "d|7":  ["sha", "shan"],
    "d|8":  ["sha", "shan"],
    "d|9":  ["sha", "shan"],
    "d|10": ["sha", "shan"],
    "d|J":  ["shan", "shan", "shan"],
    "d|Q":  ["tao", "huogong", "wuxie"],
    "d|K":  ["zixing", "hualiu"],
    "c|A":  ["zhuge", "juedou", "baiyin"],
    "c|2":  ["shan", "shan", "bagua", "tengjia"],
    "c|3":  ["sha", "guohe"],
    "c|4":  ["sha", "guohe"],
    "c|5":  ["dilu", "sha"],
    "c|6":  ["lebu", "lebu"],
    "c|7":  ["nanman"],
    "c|8":  ["sha"],
    "c|9":  ["sha"],
    "c|10": ["sha"],
    "c|J":  ["sha"],
    "c|Q":  ["jiedao", "wuxie"],
    "c|K":  ["jiedao", "wuxie"],
    "s|A":  ["shandian", "juedou", "gudingdao"],
    "s|2":  ["cixiong", "bagua", "tengjia", "hanbing"],
    "s|3":  ["sha", "shunshou"],
    "s|4":  ["sha", "shunshou"],
    "s|5":  ["jueying", "qinglong"],
    "s|6":  ["qinggang", "lebu"],
    "s|7":  ["sha", "nanman"],
    "s|8":  ["sha", "sha"],
    "s|9":  ["sha", "sha"],
    "s|10": ["sha", "sha"],
    "s|J":  ["sha", "shunshou", "wuxie"],
    "s|Q":  ["zhangba", "guohe"],
    "s|K":  ["nanman", "dawan", "wuxie"],
};

/* ===== 各模式的推荐配置 ===== */
const MODE_CONFIGS = {
    /* 身份局：军争为默认，可用配置禁用军争 */
    identity:   { base: 'junzheng', banList: [] },
    /* 国战：军争 + 国战专属牌 */
    guozhan:    { base: 'junzheng', banList: ['shandian'], extra: ['yuanjiao', 'zhijibi'] },
    /* 斗地主：专用牌堆 */
    doudizhu:   { base: 'junzheng', banList: ['shandian', 'lebu', 'bingliang', 'jiedao', 'tiesuo', 'huogong'] },
    /* BOSS 战：保留全部军争 */
    boss:       { base: 'junzheng', banList: [] },
    /* 对战：标准版为主 */
    versus:     { base: 'standard', banList: [] },
    /* 单挑：标准版 */
    single:     { base: 'standard', banList: [] },
    /* 默认 */
    default:    { base: 'junzheng', banList: [] },
};

/* ===== 牌名归一化 ===== */
const CARD_NORMALIZE = {
    "huosha": "sha",
    "leisha": "sha",
    "huafei": "zhuahuang",
};
function _normCard(name) { return CARD_NORMALIZE[name] || name; }

/* ★ 别名表：静态表名 → lib.card 中的候选 key（任一存在即视为支持） */
const CARD_ID_ALIASES = {
    "zhuque":     ["zhuque", "zhuqueyushan", "zhuqueyushan_" ],
    "qilin":      ["qilin", "qilingong"],
    "guanshi":    ["guanshi", "guanshifu"],
    "fangtian":   ["fangtian", "fangtianhuaji"],
    "qinglong":   ["qinglong", "qinglongyanyuedao"],
    "qinggang":   ["qinggang", "qinggangjian"],
    "cixiong":    ["cixiong", "cixiongjian"],
    "hanbing":    ["hanbing", "hanbingjian"],
    "zhangba":    ["zhangba", "zhangbashemao"],
    "gudingdao":  ["gudingdao"],
    "zhuahuang":  ["zhuahuang", "zhuahuangfeidian"],
    "zixing":     ["zixing"],
    "hualiu":     ["hualiu"],
    "dilu":       ["dilu"],
    "jueying":    ["jueying"],
    "dawan":      ["dawan"],
    "bagua":      ["bagua", "baguazhen"],
    "tengjia":    ["tengjia"],
    "baiyin":     ["baiyin", "baiyinshizi"],
    "zhuge":      ["zhuge", "zhugeliannu"],
    /* 锦囊别名 */
    "wugu":       ["wugu", "wugufengdeng"],
    "taoyuan":    ["taoyuan", "taoyuanjieyi"],
    "nanman":     ["nanman", "nanmanruqin"],
    "wanjian":    ["wanjian", "wanjianqifa"],
    "lebu":       ["lebu", "lebusishu"],
    "bingliang":  ["bingliang", "bingliangcunduan"],
    "tiesuo":     ["tiesuo", "tiesuolianhuan"],
    "jiedao":     ["jiedao", "jiedaosharen"],
    "wuzhong":    ["wuzhong", "wuzhongshengyou"],
    "shunshou":   ["shunshou", "shunshouqianyang"],
    "guohe":      ["guohe", "guohechaiqiao"],
    "huogong":    ["huogong"],
    "juedou":     ["juedou"],
    "wuxie":      ["wuxie", "wuxiekeji"],
};

/* ===== 当前状态 ===== */
let _currentMode = 'identity';
let _currentBase = 'junzheng';
let _currentBanList = [];
const REMAINING = {};
let _initialized = false;
let _libCardVersion = 0;

/* ★ 缓存机制：性能优化 */
let _totalCache = -1;
let _suitCache = {};
let _cacheDirty = true;

function _invalidateCache() { _cacheDirty = true; }

/* ★ 检查牌是否被 lib.card 支持 */
function _isCardSupported(cardName) {
    try {
        /* ★ lib.card 不完整时（早期加载），跳过过滤 */
        if (typeof lib === 'undefined' || !lib.card) return true;
        const cardCount = Object.keys(lib.card).length;
        if (cardCount < 50) return true;   /* ★ 未加载完，保守放行 */

        const normalized = _normCard(cardName);
        /* 属性杀 → 看 sha 是否存在 */
        if (cardName === 'huosha' || cardName === 'leisha') return !!lib.card['sha'];
        /* 直接匹配 */
        if (lib.card[cardName]) return true;
        if (lib.card[normalized]) return true;
        /* ★ 别名匹配 */
        const aliases = CARD_ID_ALIASES[cardName] || CARD_ID_ALIASES[normalized] || [];
        for (let i = 0; i < aliases.length; i++) {
            if (lib.card[aliases[i]]) return true;
        }
        return true;   /* ★ 兜底：以静态表为准，找不到别名也保留 */
    } catch (e) { return true; }
}

/* ★ 检测当前模式 */
function _detectMode() {
    try {
        if (typeof get === 'object' && get.mode) {
            const m = get.mode();
            if (m) return m;
        }
        if (typeof _status === 'object' && _status && _status.mode) return _status.mode;
    } catch (e) {}
    return 'identity';
}

/* ★ 检测当前牌堆版本（标准/军争） */
function _detectBase() {
    try {
        const mode = _detectMode();
        const cfg = MODE_CONFIGS[mode] || MODE_CONFIGS.default;
        return cfg.base || 'junzheng';
    } catch (e) { return 'junzheng'; }
}

/* ★ 生成当前模式的有效牌堆 */
function _buildDeck() {
    try {
        const base = _currentBase === 'standard' ? DECK_DATA_STANDARD : DECK_DATA_JUNZHENG;
        const banList = _currentBanList || [];
        const out = {};

        for (const key in base) {
            const arr = base[key];
            const filtered = [];
            for (let i = 0; i < arr.length; i++) {
                const name = arr[i];
                const normalized = _normCard(name);
                if (banList.indexOf(normalized) >= 0) continue;
                if (typeof lib !== 'undefined' && lib.card && !_isCardSupported(name)) continue;
                filtered.push(name);
            }
            if (filtered.length) out[key] = filtered;
        }
        return out;
    } catch (e) { return {}; }
}

/* ★ 初始化剩余池 */
/* ★ 脏标记：标记需要对账 */
let _dirty = false;
export function deckMarkDirty() { _dirty = true; }

/* ★ 从 UI 牌堆重建 REMAINING（以真实 DOM 为准） */
export function deckSyncFromUI(force) {
    try {
        if (typeof ui === 'undefined' || !ui.cardPile) return false;

        const pile = ui.cardPile.children;
        const pileCount = pile.length;

        /* 非强制时，先对账：数量一致就跳过 */
        if (!force) {
            let myTotal = 0;
            for (const key in REMAINING) myTotal += REMAINING[key].length;
            if (myTotal === pileCount) {
                _dirty = false;
                return true;
            }
        }

        /* 重建 */
        for (const key in REMAINING) delete REMAINING[key];

        let okCount = 0;
        Array.from(pile).forEach(function(cardEl) {
            try {
/* Penulis: Feisheng Original, Semua hak dilindungi */
                const suit = get.suit(cardEl);
                const number = get.number(cardEl);
                const name = get.name(cardEl);

                const short = _suitShort(suit);
                const num = _numStr(number);
                if (!short || !num || !name) return;

                const key = short + '|' + num;
                if (!REMAINING[key]) REMAINING[key] = [];
                REMAINING[key].push(_normCard(name));
                okCount++;
            } catch (e) {}
        });

        _initialized = true;
        _libCardVersion = -1;
        _dirty = false;
        return true;
    } catch (e) { return false; }
}

function _initRemaining() {
    try {
        /* 已初始化 → 先对账，不一致则强制重建 */
        if (_initialized) {
            let myTotal = 0;
            for (const key in REMAINING) myTotal += REMAINING[key].length;
            if (typeof ui !== 'undefined' && ui.cardPile && myTotal !== ui.cardPile.children.length) {
                deckSyncFromUI(true);
            }
            return;
        }

        /* 首次初始化：优先从 UI 重建 */
        if (typeof ui !== 'undefined' && ui.cardPile && ui.cardPile.children.length > 0) {
            deckSyncFromUI(true);
            return;
        }

        /* UI 不可用（早期）→ 用静态表构建 */
        const deck = _buildDeck();
        for (const key in REMAINING) delete REMAINING[key];
        for (const key in deck) REMAINING[key] = deck[key].slice();
        _initialized = true;
        _libCardVersion = (typeof lib !== 'undefined' && lib.card) ? Object.keys(lib.card).length : 0;
    } catch (e) {}
}

/* ===== 对外接口 ===== */

/* 切换模式（可以强制指定模式/版本） */
export function deckSetMode(mode, base) {
    _currentMode = mode || _detectMode();
    const cfg = MODE_CONFIGS[_currentMode] || MODE_CONFIGS.default;
    _currentBase = base || cfg.base || 'junzheng';
    _currentBanList = (cfg.banList || []).slice();
    deckReset();
    return true;
}

/* 自动识别模式（游戏开始/重载时调用） */
export function deckAutoDetect() {
    try {
        const mode = _detectMode();
        const base = _detectBase();
        return deckSetMode(mode, base);
    } catch (e) { return false; }
}

export function deckGetMode() {
    return { mode: _currentMode, base: _currentBase, banned: _currentBanList.slice() };
}

/* 花色/点数转换 */
function _suitShort(suit) {
    if (suit === 'heart') return 'h';
    if (suit === 'diamond') return 'd';
    if (suit === 'club') return 'c';
    if (suit === 'spade') return 's';
    return null;
}
function _numStr(number) {
    if (number === null || number === undefined) return null;
    const n = String(number).toUpperCase();
    if (n === '1') return 'A';
    if (['J', 'Q', 'K', 'A', '10'].indexOf(n) >= 0) return n;
    const num = parseInt(n, 10);
    if (num >= 2 && num <= 10) return String(num);
    return null;
}
function _keyOf(card) {
    try {
        if (!card) return null;
        const suit = _suitShort(card.suit);
        const num = _numStr(card.number);
        if (!suit || !num) return null;
        const raw = card.name || card.cardname || '';
        let name = _normCard(raw);
        try {
            if (raw === 'sha' && typeof game !== 'undefined' && game.hasNature) {
                if (game.hasNature(card, 'fire')) name = 'huosha';
                else if (game.hasNature(card, 'thunder')) name = 'leisha';
            }
        } catch (e) {}
        return { key: suit + '|' + num, name: name };
    } catch (e) { return null; }
}

/* 记录：牌已出现 */
export function deckConsume(card) {
    try {
        _initRemaining();
        const k = _keyOf(card);
        if (!k) return;
        const arr = REMAINING[k.key];
        if (!arr || !arr.length) return;
        let idx = arr.indexOf(k.name);
        if (idx < 0 && (k.name === 'huosha' || k.name === 'leisha')) {
            idx = arr.indexOf('sha');
        }
        if (idx < 0) idx = arr.indexOf(_normCard(k.name));
        if (idx >= 0) arr.splice(idx, 1);
        else arr.shift();
        _invalidateCache();   /* ★ 缓存失效 */
        _dirty = true;        /* ★ 标记需要对账 */
    } catch (e) {}
}

/* 查询接口 */
export function suitRemaining(suit) {
    try {
        _initRemaining();
        /* ★ 脏标记对账 */
        if (_dirty) { deckSyncFromUI(false); }
        /* ★ 缓存检查 */
        if (!_cacheDirty && _suitCache[suit] !== undefined) return _suitCache[suit];
        const short = _suitShort(suit);
        if (!short) return 0;
        const prefix = short + '|';
        let total = 0;
        for (const key in REMAINING) {
            if (key.indexOf(prefix) !== 0) continue;
            total += REMAINING[key].length;
        }
        _suitCache[suit] = total;
        return total;
    } catch (e) { return 0; }
}

export function numberRemaining(number) {
    try {
        _initRemaining();
        const num = _numStr(number);
        if (!num) return 0;
        const suffix = '|' + num;
        let total = 0;
        for (const key in REMAINING) {
            if (key.indexOf(suffix) === key.length - suffix.length) total += REMAINING[key].length;
        }
        return total;
    } catch (e) { return 0; }
}

export function totalRemaining() {
    try {
        _initRemaining();
        /* ★ 脏标记对账 */
        if (_dirty) { deckSyncFromUI(false); }
        /* ★ 缓存检查 */
        if (!_cacheDirty && _totalCache >= 0) return _totalCache;
        let total = 0;
        for (const key in REMAINING) total += REMAINING[key].length;
        _totalCache = total;
        _cacheDirty = false;
        return total;
    } catch (e) { return 0; }
}

export function suitDensity(suit) {
    try {
        const r = suitRemaining(suit);
        const t = totalRemaining();
        return t > 0 ? r / t : 0.25;
    } catch (e) { return 0.25; }
}

export function cardRemaining(cardName) {
    try {
        _initRemaining();
        const name = _normCard(cardName);
        let total = 0;
        for (const key in REMAINING) {
            const arr = REMAINING[key];
            for (let i = 0; i < arr.length; i++) {
                if (_normCard(arr[i]) === name) total++;
            }
        }
        return total;
    } catch (e) { return 0; }
}

export function cardRemainingAt(suitShort, number) {
    try {
        _initRemaining();
        const key = suitShort + '|' + number;
        const arr = REMAINING[key];
        return arr ? arr.length : 0;
    } catch (e) { return 0; }
}

export function deckSnapshot() {
    try {
        _initRemaining();
        const out = {};
        for (const key in REMAINING) {
            if (REMAINING[key].length > 0) out[key] = REMAINING[key].slice();
        }
        return out;
    } catch (e) { return {}; }
}

export function deckReset() {
    try {
        for (const key in REMAINING) delete REMAINING[key];
        _initialized = false;
        _libCardVersion = -1;
        _initRemaining();
        _invalidateCache();   /* ★ 缓存失效 */
    } catch (e) {}
}

/* 统计接口 */
export function deckInitialCounts() {
    try {
        _initRemaining();
        let h = 0, d = 0, c = 0, s = 0;
        for (const key in REMAINING) {
            const n = REMAINING[key].length;
            if (key.indexOf('h|') === 0) h += n;
            else if (key.indexOf('d|') === 0) d += n;
            else if (key.indexOf('c|') === 0) c += n;
            else if (key.indexOf('s|') === 0) s += n;
        }
        return {
            heart: h, diamond: d, club: c, spade: s,
            total: h + d + c + s,
            mode: _currentMode,
            base: _currentBase,
            banned: _currentBanList.slice(),
        };
    } catch (e) { return { total: 0, mode: 'unknown', base: 'unknown' }; }
}

/* 可用模式列表 */
export function deckAvailableModes() {
    return Object.keys(MODE_CONFIGS);
}

/* ★ 洗牌事件处理 */
export function deckWash() {
    try {
        deckReset();
        /* 扣除所有玩家手牌、装备、判定区的牌 */
        if (typeof game !== 'undefined' && game.players) {
            game.players.forEach(function (p) {
                if (!p) return;
                try {
                    p.getCards('hej').forEach(function (c) {
                        try { deckConsume(c); } catch (e) {}
                    });
                } catch (e) {}
            });
        }
        _invalidateCache();
    } catch (e) {}
}

/* ★ 挂载到全局，供其他模块使用 */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.deckSnapshot = deckSnapshot;
    window.__DJSC.deckSync = deckSyncFromUI;
    window.__DJSC.deckMemory = {
        suitRemaining: suitRemaining,
        numberRemaining: numberRemaining,
        totalRemaining: totalRemaining,
        cardRemaining: cardRemaining,
        cardRemainingAt: cardRemainingAt,
        deckSnapshot: deckSnapshot,
        deckConsume: deckConsume,
        deckReset: deckReset,
        deckSetMode: deckSetMode,
        deckAutoDetect: deckAutoDetect,
        deckGetMode: deckGetMode,
        deckInitialCounts: deckInitialCounts,
        deckAvailableModes: deckAvailableModes,
        deckWash: deckWash,
        deckSyncFromUI: deckSyncFromUI,
        deckMarkDirty: deckMarkDirty,
    };
}
