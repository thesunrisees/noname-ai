/* ================= 决策点钩子 =================
 * 拦截无名杀的 chooseTo* 接口，根据 trust 决定是否接管。
 */

import { getTrust, DECISION_REGISTRY } from '../../decisionRegistry.js';
import { recordPull } from '../ai/bandit.js';

/* 已安装的钩子记录 */
const _installed = {};

/* 接管阈值：分差大于这个值才接管 */
const THRESHOLD = 20;

/* ================= 三层防护 ================= */

/* ★ 第一层：合法性回退（让无名杀本体负责） */
function _checkLegality(me, name, value, args) {
    try {
        /* 目标合法性：死人不选 */
        if (value && value.hp !== undefined) {
            if (value.alive === false) return false;
            if (value.hp <= 0 && name.indexOf('Target') >= 0) return false;
        }
        /* 牌合法性：不能用自己没有的牌 */
        if (value && (value.name || typeof value === 'string')) {
            const cardName = typeof value === 'string' ? value : value.name;
            if (cardName && me.countCards) {
                /* 只在"从手牌选"的场景检查 */
                if (name.indexOf('Discard') >= 0 || name.indexOf('Use') >= 0) {
                    if (me.countCards('h', cardName) <= 0) return false;
                }
            }
        }
        return true;
    } catch (e) { return false; }
}

/* ★ 第三层：红线禁止（只做绝对必要的 5 条） */
const REDLINES = [
    /* 1. 不能对自己出攻击牌 */
    function (me, card, target) {
        if (target === me && ['sha', 'juedou', 'huogong'].indexOf(card) >= 0) return false;
        return true;
    },
    /* 2. 不能对已死的人出牌 */
    function (me, card, target) {
        if (target && target.alive === false) return false;
        return true;
    },
    /* 3. 不能在没牌时选牌 */
    function (me, card) {
        if (typeof card === 'string' && me.countCards) {
            if (me.countCards('h', card) <= 0) return false;
        }
        return true;
    },
    /* 4. 不能对无懈可击对非锦囊使用 */
    function (me, card, target) {
        if (card === 'wuxie' && target) {
            try {
                if (typeof get !== 'undefined' && get.type) {
                    const t = get.type(target, 'trick');
                    if (t !== 'trick') return false;
                }
            } catch (e) {}
        }
        return true;
    },
    /* 5. 不能选中不存在的技能 */
    function (me, button) {
        if (button && button.skill) {
            if (!me.hasSkill || !me.hasSkill(button.skill)) return false;
        }
        return true;
    },
];

function _checkRedline(me, card, target) {
    for (let i = 0; i < REDLINES.length; i++) {
        if (!REDLINES[i](me, card, target)) return false;
    }
    return true;
}

/* ================= 安装一个决策点钩子 ================= */
function installOne(name) {
    try {
        const proto = (typeof noname !== 'undefined' && noname.Player) ? noname.Player.prototype : null;
        if (!proto || !proto[name]) return;

        const ORIG_KEY = '__djsc_orig_' + name;
        if (proto[ORIG_KEY]) return;   /* 已安装 */

        const orig = proto[name];
        proto[ORIG_KEY] = orig;

        proto[name] = function (...args) {
            try {
                /* 获取 trust，决定是否接管 */
                const trust = getTrust(name);
                if (trust < 0.5) {
                    /* trust 太低，直接走原生 AI */
                    return orig.apply(this, args);
                }

                /* 记录一次 Bandit pull */
                try { recordPull(name); } catch (e) {}

                /* 走原生决策（暂时不接管，只做记录） */
                const result = orig.apply(this, args);

                /* ★ 三层防护：合法性检查 */
                try {
                    if (!_checkLegality(this, name, result, args)) {
                        return orig.apply(this, args);
                    }
                } catch (e) {}

                /* ★ 三层防护：红线检查 */
                try {
                    const cardId = (result && result.name) ? result.name : (typeof result === 'string' ? result : null);
                    const target = (args && args[0] && args[0].target) ? args[0].target : null;
                    if (!_checkRedline(this, cardId, target)) {
                        return orig.apply(this, args);
                    }
                } catch (e) {}

                return result;
            } catch (e) {
                /* 出错就走原生 */
                return orig.apply(this, args);
            }
        };

        _installed[name] = true;
        try { log.info('decision', '已接管 ' + name + '（trust=' + getTrust(name) + '）'); } catch (e) {}
    } catch (e) {}
}

/* ================= 安装所有决策点钩子 ================= */
export function installDecisionHooks() {
    try {
        /* ★ 自动接管：从 DECISION_REGISTRY 读取所有决策点 */
        let names = [];
        for (const name in DECISION_REGISTRY) {
            if (DECISION_REGISTRY[name].skip) continue;
            names.push(name);
        }

        /* 如果注册表是空的，用硬编码列表兜底 */
        if (names.length === 0) {
            names = [
                'chooseToUse',
                'chooseToRespond',
                'chooseToDiscard',
                'chooseToCompare',
                'chooseToGive',
                'chooseToGuanxing',
                'chooseToPindian',
                'chooseButton',
                'chooseCard',
                'chooseTarget',
            ];
        }

        names.forEach(function (name) {
            installOne(name);
        });

        try { log.info('decision', '所有决策点钩子已安装（共 ' + names.length + ' 个）'); } catch (e) {}
    } catch (e) {}
}

/* ================= 卸载所有决策点钩子 ================= */
export function uninstallDecisionHooks() {
    try {
        const proto = (typeof noname !== 'undefined' && noname.Player) ? noname.Player.prototype : null;
        if (!proto) return;

        for (const name in _installed) {
            const ORIG_KEY = '__djsc_orig_' + name;
            if (proto[ORIG_KEY]) {
                proto[name] = proto[ORIG_KEY];
                delete proto[ORIG_KEY];
            }
        }

        for (const k in _installed) delete _installed[k];
        try { log.info('decision', '所有决策点钩子已卸载'); } catch (e) {}
    } catch (e) {}
}

/* 挂到全局 */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.decisionHooks = {
        install: installDecisionHooks,
        uninstall: uninstallDecisionHooks,
    };
}
