/* ================= 全局反射扫描器 =================
 * 反射扫描 lib.element.Player.prototype 上所有方法，
 * 过滤出「决策接口」，安装运行时探针，自动分类，
 * 自动注册到 DECISION_REGISTRY。
 */

import { lib, game, get } from '../../../noname.js';
import { DECISION_REGISTRY } from '../analysis/decisionRegistry.js';
import { log } from '../core/logger.js';

const DJSC_PROBE = '__djsc_probe_orig';
const STORAGE_KEY = 'djsc_global_scan';

/* 必须排除的方法（会破坏游戏） */
const BLACKLIST = new Set([
    'getCards', 'getEquip', 'countCards', 'hasCard',
    'isDead', 'isAlive', 'isLinked', 'isTurnedOver',
    'getSkills', 'hasSkill', 'addSkill', 'removeSkill',
    'getAttackRange', 'getDefenseRange', 'getHandcardLimit',
    'getHp', 'getMaxHp', 'setHp', 'setMaxHp',
    'addHp', 'loseHp', 'gainHp', 'recover',
    'draw', 'discard', 'gain', 'lose',
    'damage', 'die', 'link', 'turnOver',
    'useCard', 'respond', 'judge', 'equip',
    'canUse', 'canRespond', 'canDiscard',
    'getStat', 'setStat', 'addStat',
    'getCardIndex', 'getCardNumber', 'getCardSuit',
    'getHistory', 'getLastCard',
    'showCards', 'hideCards',
    'mark', 'unmark', 'hasMark',
    'addMark', 'removeMark',
    'changeGroup', 'setIdentity',
    'chooseToPlayBeatmap', 'chooseToMoveCardInBoard',
]);

/* 探针统计 */
const PROBE = {};
let _loaded = false;

function loadProbe() {
    try {
        if (_loaded) return;
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const obj = JSON.parse(raw);
            if (obj && typeof obj === 'object') {
                for (const k in obj) PROBE[k] = obj[k];
            }
        }
        _loaded = true;
    } catch (e) { _loaded = true; }
}

function saveProbe() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(PROBE)); } catch (e) {}
}

/* ========== 反射扫描 ========== */
export function scanPlayerPrototype() {
    try {
        /* ★ 修复：兼容控制台环境，多种方式获取 proto */
        let proto = null;
        try {
            if (typeof lib !== 'undefined' && lib.element && lib.element.Player) {
                proto = lib.element.Player.prototype;
            }
        } catch (e) {}
        if (!proto && typeof noname !== 'undefined' && noname.Player) {
            proto = noname.Player.prototype;
        }
        if (!proto) return [];

        const found = [];
        for (const key in proto) {
            if (typeof proto[key] !== 'function') continue;
            if (BLACKLIST.has(key)) continue;
            if (key.startsWith('_')) continue;
            if (key.startsWith('$')) continue;
            found.push(key);
        }
        return found;
    } catch (e) {
        console.error('scanAll error:', e);
        return [];
    }
}

/* ========== 方法名启发式（第一层过滤） ========== */
function isDecisionLike(name) {
    const lower = name.toLowerCase();
    /* 明确是决策 */
    if (lower.startsWith('choose')) return true;
    if (lower.startsWith('select')) return true;
    if (lower.startsWith('pick')) return true;
    /* 常见决策语义 */
    if (lower.indexOf('decision') >= 0) return true;
    if (lower.indexOf('choose') >= 0) return true;
    if (lower.indexOf('select') >= 0) return true;
    if (lower.indexOf('pick') >= 0) return true;
    return false;
}

/* ========== 返回值类型推断 ========== */
function inferReturnType(value) {
    if (value === null || value === undefined) return 'void';
    if (typeof value === 'boolean') return 'bool';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') return 'string';
    if (Array.isArray(value)) {
        if (value.length === 0) return 'array';
        const first = value[0];
        if (first && first.hp !== undefined) return 'target-array';
        if (first && (first.name || first.suit !== undefined)) return 'card-array';
        if (first && (first.skill || first.link)) return 'button-array';
        return 'array';
    }
    if (value && typeof value === 'object') {
        if (value.hp !== undefined) return 'target';
        if (value.name || value.suit !== undefined) return 'card';
        if (value.skill || value.link) return 'button';
        return 'object';
    }
    return 'unknown';
}

/* ========== 安装探针 ========== */
export function installProbes() {
    const proto = lib.element && lib.element.Player && lib.element.Player.prototype;
    if (!proto) return false;
    if (proto[DJSC_PROBE]) return true;

    const orig = {};
    proto[DJSC_PROBE] = orig;

    /* 第一层：反射扫描所有方法 */
    const all = scanPlayerPrototype();

    /* 第二层：名字启发式过滤 */
    const candidates = [];
    for (let i = 0; i < all.length; i++) {
        if (isDecisionLike(all[i])) candidates.push(all[i]);
    }

    /* 第三层：对候选安装探针 */
    for (let i = 0; i < candidates.length; i++) {
        const name = candidates[i];
        orig[name] = proto[name];
        proto[name] = (function (n, fn) {
            return function () {
                const me = this, args = arguments;
                const t0 = performance.now();
                let result;
                let threw = false;
                try {
                    result = fn.apply(me, args);
                } catch (e) {
                    threw = true;
                    throw e;
                } finally {
                    const ms = performance.now() - t0;
                    const s = PROBE[n] || {
                        calls: 0, errors: 0, totalMs: 0,
                        retTypes: {}, argCounts: {}, lastRet: null,
                    };
                    s.calls++;
                    if (threw) s.errors++;
                    s.totalMs += ms;
                    const rt = inferReturnType(result);
                    s.retTypes[rt] = (s.retTypes[rt] || 0) + 1;
                    s.argCounts[args.length] = (s.argCounts[args.length] || 0) + 1;
                    s.lastRet = rt;
                    PROBE[n] = s;
                }
                /* 每 50 次调用存一次 */
                if (PROBE[name] && PROBE[name].calls % 50 === 0) saveProbe();
                return result;
            };
        })(name, proto[name]);
    }

    try { log.info('scan', '探针挂载 ' + candidates.length + ' 个方法（总方法 ' + all.length + '）'); } catch (e) {}
    return true;
}

/* ========== 自动分类器 ========== */
/* 允许注册的返回值类型白名单 */
const ALLOWED_TYPES = [
    'target', 'target-array',
    'card', 'card-array',
    'button', 'button-array',
    'bool', 'string', 'number',
];

function classify(name, stat) {
    if (!stat || stat.calls < 3) return null;

    /* 错误率 > 50% → 跳过 */
    if (stat.errors / stat.calls > 0.5) return null;

    /* 找主导返回类型 */
    let dominant = null, maxCount = 0;
    for (const t in stat.retTypes) {
        if (stat.retTypes[t] > maxCount) {
            maxCount = stat.retTypes[t];
            dominant = t;
        }
    }
    if (!dominant) return null;

    /* ★ 白名单检查：void / object / array / unknown 全部跳过 */
    if (ALLOWED_TYPES.indexOf(dominant) < 0) return null;

    /* 映射到分类 */
    let category = 'unknown';
    if (dominant === 'target' || dominant === 'target-array') category = 'target';
    else if (dominant === 'card' || dominant === 'card-array') category = 'card';
    else if (dominant === 'button' || dominant === 'button-array') category = 'button';
    else if (dominant === 'bool') category = 'bool';
    else if (dominant === 'string') category = 'string';
    else if (dominant === 'number') category = 'number';
    else return null;

    /* 初始 trust：基于调用频率 */
    const freq = stat.calls;
    let trust;
    if (freq < 10) trust = 0.1;
    else if (freq < 50) trust = 0.3;
    else if (freq < 200) trust = 0.5;
    else trust = 0.7;

    /* 错误率高的降 trust */
    const errRate = stat.errors / stat.calls;
    if (errRate > 0.1) trust *= 0.5;
    if (errRate > 0.3) trust *= 0.5;

    return { category, trust, dominant, calls: freq };
}

/* ========== 自动注册 ========== */
export function autoRegister() {
    loadProbe();
    const registered = [];
    const skipped = [];
    const rejected = [];   /* ★ 新增：被拒绝的 */

    for (const name in PROBE) {
        if (DECISION_REGISTRY[name]) {
            skipped.push(name);
            continue;
        }
        const info = classify(name, PROBE[name]);
        if (!info) {
            /* ★ 记录被白名单拒绝的 */
            const stat = PROBE[name];
            if (stat && stat.calls >= 3) {
                let dominant = null, maxCount = 0;
                for (const t in stat.retTypes) {
                    if (stat.retTypes[t] > maxCount) { maxCount = stat.retTypes[t]; dominant = t; }
                }
                rejected.push({ name: name, type: dominant, calls: stat.calls });
            }
            continue;
        }
        DECISION_REGISTRY[name] = {
            name: '自动发现·' + name,
            trust: Math.round(info.trust * 100) / 100,
            category: 'auto',
            input: info.category,
            output: (PROBE[name].retTypes[info.dominant + '-array'] !== undefined) ? 'array' : 'single',
            desc: '自动发现（调用 ' + info.calls + '，返回 ' + info.dominant + '）',
            autoDiscovered: true,
            skip: false,
        };
        registered.push(name);
    }

    if (registered.length) {
        try { log.info('scan', '自动注册 ' + registered.length + ' 个：' + registered.join(', ')); } catch (e) {}
    }
    if (rejected.length) {
        try { log.info('scan', '白名单拒绝 ' + rejected.length + ' 个：' + rejected.map(r => r.name + '(' + r.type + ')').join(', ')); } catch (e) {}
    }
    return { registered, skipped, rejected };
}

/* ========== 查询接口 ========== */
export function getProbeStats() {
    loadProbe();
    return JSON.parse(JSON.stringify(PROBE));
}

export function getProbeStatOf(name) {
    loadProbe();
    return PROBE[name] || null;
}

export function resetProbes() {
    for (const k in PROBE) delete PROBE[k];
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

/* ========== 挂到全局 ========== */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.scan = {
        install: installProbes,
        autoRegister,
        scanAll: scanPlayerPrototype,
        getStats: getProbeStats,
        getStatOf: getProbeStatOf,
        reset: resetProbes,
    };
}
