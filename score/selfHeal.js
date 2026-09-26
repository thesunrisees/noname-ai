/*
 * ============================================
 * // Penulis: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 开机自修复 =================
 * 作用：每次进入游戏时，检查关键模块的挂载类型。
 *       若被覆盖为错误类型，重新用源码的正确结构覆盖回来。
 */
import { log } from './logger.js';
import { lib, game, get, _status } from '../../../noname.js';
// Автор: Фэйшэн Оригинал | Лицензия: GPL-3.0

/* 挂载契约表：每个模块期望的类型和结构 */
const CONTRACTS = {
    playerMemory: {
        methods: ['remember','attack','aid','recall','hostility','bonus','stats','list','reset'],
        rebuild: function (m) {
            return {
                remember:  m.rememberGame,
                attack:    m.rememberAttack,
                aid:       m.rememberAid,
                recall:    m.recallPlayer,
                hostility: m.hostilityLevel,
                bonus:     m.playerMemoryBonus,
                stats:     m.playerMemoryStats,
                list:      m.playerMemoryList,
                reset:     m.resetPlayerMemory,
            };
        },
    },
    profiler: {
        methods: ['start','end','profile','stats','enable','reset','open'],
        rebuild: function (m) {
            const obj = {
                start:   m.profStart,
                end:     m.profEnd,
                profile: m.profile,
                stats:   m.profilerStats,
                enable:  m.profilerEnable,
                reset:   m.profilerReset,
                open:    m.openProfilerPanel,
            };
            try { window.__DJSC.openProfilerPanel = m.openProfilerPanel; } catch (e) {}
            return obj;
        },
    },
    psychology: {
        methods: ['deterrence','intent','pressure','hold','bonus','stats','reset'],
        rebuild: function (m) {
            return {
                deterrence: m.deterrenceCheck,
                intent:     m.intentReading,
                pressure:   m.pressureScore,
                hold:       m.strategicHold,
                bonus:      m.psychologyBonus,
                stats:      m.psychologyStats,
                reset:      m.resetPsychology,
            };
        },
    },
    comboChain: {
        methods: ['detect','score','priority','bonus','stats','reset'],
        rebuild: function (m) {
            return {
                detect:   m.detectChains,
                score:    m.chainScore,
                priority: m.chainPriority,
                bonus:    m.comboChainBonus,
                stats:    m.comboChainStats,
                reset:    m.resetComboChain,
/* Yazar: Feisheng Orijinal, Tüm hakları saklıdır */
            };
        },
    },
    narrator: {
        methods: ['narrate','render','recent','show'],
        rebuild: function (m) {
            return {
                narrate: m.narrate,
                render:  m.renderNarrateHtml,
                recent:  m.recentNarrations,
                show:    m.showRecentNarrations,
            };
        },
    },
};

function _checkOne(key, contract, D) {
    const cur = D[key];
    if (typeof cur !== 'object' || cur === null) return { bad: true, reason: '类型=' + typeof cur };
    for (const m of contract.methods) {
        if (typeof cur[m] !== 'function') return { bad: true, reason: '缺方法 ' + m };
    }
    return { bad: false };
}

/* ================= 主入口：开机自修复 ================= */
export async function selfHeal() {
    try {
        const D = window.__DJSC;
        if (!D) return { ok: false, err: 'window.__DJSC 不存在' };

        const healed = [];
        const failed = [];

        for (const key in CONTRACTS) {
            const contract = CONTRACTS[key];
            const check = _checkOne(key, contract, D);
            if (!check.bad) continue;

            try {
                const modFile = key + '.js';
                const mod = await import('./' + modFile);
                D[key] = contract.rebuild(mod);
                healed.push(key + '（原因：' + check.reason + '）');
            } catch (e) {
                failed.push(key + '：' + e.message);
            }
        }

        if (healed.length) {
            try { log.info('selfHeal', '已修复：' + healed.join('、')); } catch (e) {}
        }
        if (failed.length) {
            try { log.warn('selfHeal', '失败：' + failed.join('、')); } catch (e) {}
        }

        return { ok: true, healed: healed, failed: failed };
    } catch (e) {
        return { ok: false, err: e.message };
    }
}

export function autoSelfHeal(delay) {
    setTimeout(function () { selfHeal(); }, delay || 3000);
}

/* ================= 挂载 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.selfHeal = {
        run: selfHeal,
        auto: autoSelfHeal,
    };
}
