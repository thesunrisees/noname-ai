/* ================= 决策积分引擎 · 认知冲突检测 =================
 * 触发条件：
 *   ① 规则引擎选出 best，模型选出 modelPick
 *   ② 两者不同
 *   ③ 规则分和模型分都超过阈值（都"很有主见"）
 * 触发后：写进 conflictLog，供复盘分析。
 */
import { log } from '../core/logger.js';

const MAX = 50;
const CONF = [];
const STATS = { checks: 0, conflicts: 0, byId: {} };

export function detectConflict(ruleBest, modelConf, metaMod, actionMeta) {
    try {
        STATS.checks++;
        if (!ruleBest || !modelConf) return false;
        if (modelConf.confidence < 0.55) return false;

        const ruleLabel = _ruleLabel(ruleBest);
        if (ruleLabel === modelConf.label) return false;

        STATS.conflicts++;
        const key = ruleLabel + '→' + modelConf.label;
        STATS.byId[key] = (STATS.byId[key] || 0) + 1;

        const rec = {
            ts: Date.now(),
            rule: { label: ruleLabel, action: ruleBest.id, score: ruleBest.score },
            model: { label: modelConf.label, confidence: modelConf.confidence },
            meta: metaMod ? { familiarity: metaMod.familiarity, level: metaMod.level } : null,
            action: actionMeta || {},
        };
        CONF.push(rec);
        while (CONF.length > MAX) CONF.shift();

        try { log.warn('conflict', '认知冲突：规则选 ' + ruleLabel + '(' + ruleBest.id + ')，模型选 ' + modelConf.label); } catch (e) {}
        return true;
    } catch (e) { return false; }
}

function _ruleLabel(best) {
    try {
        if (!best) return 'A';
        if (best.type === 'skill') return 'F';
        if (best.type === 'equip') return 'E';
        if (best.type === 'end') return 'C';
        const id = best.id;
        if (['sha','juedou','huogong','nanman','wanjian','zhujin','shunshou','guohe','tiesuo','lebu','bingliang'].indexOf(id) >= 0) return 'D';
        if (['shan','tao','wuxie','jiu'].indexOf(id) >= 0) return 'C';
        return 'B';
    } catch (e) { return 'A'; }
}

export function conflictLog(n) { return CONF.slice(-(n || 10)).reverse(); }
export function conflictStats() {
    return { checks: STATS.checks, conflicts: STATS.conflicts, rate: STATS.checks > 0 ? Math.round(STATS.conflicts / STATS.checks * 100) + '%' : '0%', byId: Object.assign({}, STATS.byId) };
}
export function resetConflict() {
    CONF.length = 0;
    STATS.checks = 0;
    STATS.conflicts = 0;
    STATS.byId = {};
    log.info('conflict', '认知冲突日志已复位');
}

if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.conflict = { detect: detectConflict, recent: conflictLog, stats: conflictStats, reset: resetConflict };
}
