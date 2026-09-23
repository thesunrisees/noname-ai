/* ================= 决策积分引擎 · 学习效率优化器 =================
 * 4个高优先级优化：
 *   ① 优先级经验回放：优先回放高损失样本
 *   ② 特征重要性筛选：去掉权重接近0的特征
 *   ③ 课程学习：先学简单，再学复杂
 *   ④ 自适应学习率：根据指标重要性调整学习率
 */

import { lib, game, get, _status } from '../../../noname.js';
import { log } from './logger.js';

/* ================= ① 优先级经验回放 ================= */
const LOSS_BUFFER = [];  // 记录最近的损失
const MAX_LOSS_BUFFER = 1000;

export function recordLoss(loss) {
    try {
        if (typeof loss !== 'number' || isNaN(loss)) return;
        LOSS_BUFFER.push(Math.abs(loss));
        if (LOSS_BUFFER.length > MAX_LOSS_BUFFER) LOSS_BUFFER.shift();
    } catch (e) {}
}

/* 根据损失决定学习权重：损失越大，学习权重越高 */
export function getSampleWeight(loss) {
    try {
        const absLoss = Math.abs(loss || 0);
        /* 平均损失 */
        const avgLoss = LOSS_BUFFER.length > 0
            ? LOSS_BUFFER.reduce((a, b) => a + b, 0) / LOSS_BUFFER.length
            : 1;
        /* 损失是平均的2倍以上 → 权重2.0；损失是平均的0.5倍 → 权重0.5 */
        return Math.max(0.3, Math.min(3.0, absLoss / Math.max(0.1, avgLoss)));
    } catch (e) {
        return 1.0;
    }
}

/* ================= ② 特征重要性筛选 ================= */
const FEATURE_IMPORTANCE = {};  // featureIndex → importance

export function updateFeatureImportance(featureIndex, gradient) {
    try {
        if (typeof featureIndex !== 'number') return;
        const absGrad = Math.abs(gradient || 0);
        if (!FEATURE_IMPORTANCE[featureIndex]) {
            FEATURE_IMPORTANCE[featureIndex] = 0.1;  // 初始值
        }
        /* 指数移动平均 */
        FEATURE_IMPORTANCE[featureIndex] = FEATURE_IMPORTANCE[featureIndex] * 0.9 + absGrad * 0.1;
    } catch (e) {}
}

/* 获取重要特征列表（重要性 > 阈值） */
export function getImportantFeatures(threshold) {
    try {
        const t = threshold || 0.1;
        const important = [];
        Object.keys(FEATURE_IMPORTANCE).forEach(function (k) {
            if (FEATURE_IMPORTANCE[k] > t) {
                important.push(parseInt(k));
            }
        });
        return important.sort(function (a, b) {
            return FEATURE_IMPORTANCE[b] - FEATURE_IMPORTANCE[a];
        });
    } catch (e) {
        return [];
    }
}

/* 统计信息 */
export function featureImportanceStats() {
    try {
        const keys = Object.keys(FEATURE_IMPORTANCE);
        let totalImportance = 0, maxImportance = 0;
        keys.forEach(function (k) {
            totalImportance += FEATURE_IMPORTANCE[k];
            if (FEATURE_IMPORTANCE[k] > maxImportance) maxImportance = FEATURE_IMPORTANCE[k];
        });
        return {
            totalFeatures: keys.length,
            avgImportance: keys.length > 0 ? totalImportance / keys.length : 0,
            maxImportance: maxImportance,
            importantFeatures: getImportantFeatures(0.2).length,
        };
    } catch (e) {
        return { totalFeatures: 0, avgImportance: 0, maxImportance: 0 };
    }
}

/* ================= ③ 课程学习 ================= */
const COURSE_STAGES = {
    STAGE_1_IDENTITY: { name: '身份判断', minGames: 0, maxGames: 20 },
    STAGE_2_TARGET: { name: '目标选择', minGames: 20, maxGames: 50 },
    STAGE_3_CARD: { name: '出牌选择', minGames: 50, maxGames: 100 },
    STAGE_4_ADVANCED: { name: '高级策略', minGames: 100, maxGames: 9999 },
};

let _totalGames = 0;

export function recordGame() {
    _totalGames++;
}

export function getCurrentCourseStage() {
    try {
        const games = _totalGames;
        if (games < 20) return { stage: 1, name: '身份判断', focus: 'identity' };
        if (games < 50) return { stage: 2, name: '目标选择', focus: 'target' };
        if (games < 100) return { stage: 3, name: '出牌选择', focus: 'card' };
        return { stage: 4, name: '高级策略', focus: 'advanced' };
    } catch (e) {
        return { stage: 1, name: '身份判断', focus: 'identity' };
    }
}

/* 根据课程阶段调整学习重点 */
export function getCourseBias() {
    try {
        const stage = getCurrentCourseStage();
        switch (stage.focus) {
            case 'identity': return { identityWeight: 2.0, cardWeight: 0.5 };
            case 'target': return { identityWeight: 1.5, targetWeight: 2.0, cardWeight: 0.8 };
            case 'card': return { targetWeight: 1.2, cardWeight: 2.0 };
            case 'advanced': return { identityWeight: 1.0, targetWeight: 1.0, cardWeight: 1.0 };
            default: return {};
        }
    } catch (e) {
        return {};
    }
}

/* ================= ④ 自适应学习率 ================= */
const ADAPTIVE_LR = {};  // metricKey → current LR

export function getAdaptiveLR(metricKey, baseLR) {
    try {
        const base = baseLR || 0.05;
        if (!ADAPTIVE_LR[metricKey]) {
            ADAPTIVE_LR[metricKey] = base;
        }
        return ADAPTIVE_LR[metricKey];
    } catch (e) {
        return baseLR || 0.05;
    }
}

/* 根据指标的重要性调整学习率 */
export function adaptLR(metricKey, importance, baseLR) {
    try {
        const base = baseLR || 0.05;
        const imp = importance || 1.0;
        /* 重要性越高，学习率越小（重要指标要稳） */
        /* 重要性越低，学习率越大（不重要指标可以大胆试） */
        const newLR = base / Math.max(0.5, Math.min(2.0, imp));
        ADAPTIVE_LR[metricKey] = newLR;
        return newLR;
    } catch (e) {
        return baseLR || 0.05;
    }
}

/* ================= 综合统计 ================= */
export function learningStats() {
    try {
        return {
            priorityReplay: {
                bufferSize: LOSS_BUFFER.length,
                avgLoss: LOSS_BUFFER.length > 0
                    ? LOSS_BUFFER.reduce((a, b) => a + b, 0) / LOSS_BUFFER.length
                    : 0,
            },
            featureImportance: featureImportanceStats(),
            courseStage: getCurrentCourseStage(),
            adaptiveLR: {
                totalMetrics: Object.keys(ADAPTIVE_LR).length,
            },
        };
    } catch (e) {
        return { error: e.message };
    }
}

/* ================= 挂载 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.learningOptimizer = {
        recordLoss: recordLoss,
        getSampleWeight: getSampleWeight,
        updateFeatureImportance: updateFeatureImportance,
        getImportantFeatures: getImportantFeatures,
        featureImportanceStats: featureImportanceStats,
        recordGame: recordGame,
        getCurrentCourseStage: getCurrentCourseStage,
        getCourseBias: getCourseBias,
        getAdaptiveLR: getAdaptiveLR,
        adaptLR: adaptLR,
        stats: learningStats,
    };
}
