/*
 * ============================================
 * // 作者: 飞升原创
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= Bandit · 自动调整决策点 trust =================
 * 每个决策点是一个臂。
 * reward = 本局我方最终归一化分。
 * 用 UCB1 算法调 trust：接管后表现好 → trust 升；表现差 → trust 降。
 */

import { DECISION_REGISTRY, setTrust, getTrust } from './decisionRegistry.js';

const STORAGE_KEY = 'djsc_bandit_stats_v1';

/* 每个决策点的统计：{ pulls, totalReward, lastReward } */
let STATS = {};
let _loaded = false;

/* 每局临时缓冲：本局触发了哪些决策点 */
let _pendingPulls = [];

/* ================= 加载/保存 ================= */
function loadStats() {
    try {
        if (_loaded) return;
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const obj = JSON.parse(raw);
            if (obj && typeof obj === 'object') STATS = obj;
        }
        _loaded = true;
    } catch (e) { _loaded = true; }
}

function saveStats() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(STATS));
    } catch (e) {}
}

/* ================= 记录一次触发 =================
 * 当某个决策点被「接管」时调用
 */
export function recordPull(name) {
    try {
        if (!name) return;
        _pendingPulls.push(name);
    } catch (e) {}
}

/* ================= 每局结束调用 =================
 * @param reward 本局我方最终归一化分（Int8，约 -127 ~ 127）
 */
export function recordGameEnd(reward) {
    try {
        loadStats();
        /* 本局触发的每个决策点，都算一次 pull */
        const uniqueNames = {};
        for (let i = 0; i < _pendingPulls.length; i++) {
            uniqueNames[_pendingPulls[i]] = true;
        }
        const names = Object.keys(uniqueNames);

        for (let i = 0; i < names.length; i++) {
            const name = names[i];
            const s = STATS[name] || { pulls: 0, totalReward: 0, lastReward: 0 };
            s.pulls++;
            s.totalReward += reward;
            s.lastReward = reward;
            STATS[name] = s;
        }

        saveStats();
        _pendingPulls = [];

        /* 每局结束后自动更新 trust */
        updateTrust();
    } catch (e) {}
}

/* ================= UCB1 更新 trust =================
 * UCB = 平均收益 + 探索项
 * 映射到 [0, 1] 后写入 trust
 */
export function updateTrust() {
    try {
        loadStats();
        const totalPulls = Object.values(STATS)
            .reduce(function (s, x) { return s + (x.pulls || 0); }, 0);

        if (totalPulls < 5) return;   /* 数据太少，不动 */

        const logTotal = Math.log(totalPulls + 1);

        for (const name in STATS) {
            if (!DECISION_REGISTRY[name]) continue;
            if (DECISION_REGISTRY[name].skip) continue;   /* 核心决策跳过 */

            const s = STATS[name];
            if (s.pulls < 2) continue;   /* 单个决策点样本太少，跳过 */

            const avgReward = s.totalReward / s.pulls;
            /* UCB1：越冷门（pulls小）探索项越大 */
            const explore = Math.sqrt(2 * logTotal / s.pulls);
            const ucb = avgReward + explore;

            /* UCB 映射到 trust：
             * avgReward 通常在 -127 ~ 127
             * UCB 范围约 -150 ~ 150
             * 映射到 [0, 1]
             */
            let newTrust = (ucb + 127) / 254;
            if (newTrust < 0) newTrust = 0;
            if (newTrust > 1) newTrust = 1;
            /* 保守一点，不要一步到位 */
            newTrust = Math.round(newTrust * 100) / 100;

            setTrust(name, newTrust);
        }
    } catch (e) {}
}

/* ================= 查询接口 ================= */
export function getStats() {
    loadStats();
    return JSON.parse(JSON.stringify(STATS));
}

export function getStatsOf(name) {
    loadStats();
    return STATS[name] || { pulls: 0, totalReward: 0, lastReward: 0 };
}

export function resetStats() {
    STATS = {};
    _pendingPulls = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

/* ================= 挂到全局 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.bandit = {
        recordPull,
        recordGameEnd,
        updateTrust,
        getStats,
        getStatsOf,
        resetStats,
    };
}
