/*
 * ============================================
 * // 作者: 飞升原创
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 认知日志 ================= */
import { log } from './logger.js';

const MAX = 100;
const LOG = [];
const STATS = { total: 0, byLevel: { high: 0, mid: 0, low: 0, none: 0 }, byIntervention: { model: 0, blend: 0, rule: 0, skip: 0 } };

export function logCognition(entry) {
    try {
        if (!entry) return;
        const rec = {
            ts: Date.now(),
            round: entry.round || 0,
            player: entry.player || '?',
            action: entry.action || '?',
            model: entry.model ? { label: entry.model.label, confidence: entry.model.confidence } : null,
            meta: entry.meta ? { familiarity: entry.meta.familiarity, modulator: entry.meta.modulator, level: entry.meta.level } : null,
            intervention: entry.intervention || 'skip',
            effective: entry.effective || 0,
        };
        LOG.push(rec);
        while (LOG.length > MAX) LOG.shift();

        STATS.total++;
        if (rec.meta && STATS.byLevel[rec.meta.level] !== undefined) STATS.byLevel[rec.meta.level]++;
        if (STATS.byIntervention[rec.intervention] !== undefined) STATS.byIntervention[rec.intervention]++;
    } catch (e) {}
}

export function getCognitionLog(n) {
    return LOG.slice(-(n || 20)).reverse();
}

export function cognitionStats() {
    try {
        const rate = {};
        Object.keys(STATS.byLevel).forEach(k => {
            rate[k] = STATS.total > 0 ? Math.round(STATS.byLevel[k] / STATS.total * 100) + '%' : '0%';
        });
        return { total: STATS.total, byLevel: Object.assign({}, STATS.byLevel), byLevelRate: rate, byIntervention: Object.assign({}, STATS.byIntervention) };
    } catch (e) { return {}; }
}

export function resetCognitionLog() {
    LOG.length = 0;
    STATS.total = 0;
    Object.keys(STATS.byLevel).forEach(k => STATS.byLevel[k] = 0);
    Object.keys(STATS.byIntervention).forEach(k => STATS.byIntervention[k] = 0);
    log.info('cogLog', '认知日志已复位');
}

if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.cognitionLog = { log: logCognition, recent: getCognitionLog, stats: cognitionStats, reset: resetCognitionLog };
}
