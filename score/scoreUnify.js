/*
 * ============================================
 * // Autor: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 统一值域 · 分层量化 + 累积饱和 =================
 * 特殊算法：分层量化，小分数高精度，大分数低精度
 * 
 * 层级划分：
 *   |v| <= 10：高精度，用 0~50 的 Int8 范围（精度 0.2）
 *   |v| <= 50：中精度，用 50~100（精度 0.8）
 *   |v| >  50：低精度，用 100~127（精度 1.85）
 * 
 * 这样既保证了小分数的区分度，又不会溢出。
 */

const MAX = 127;
const MIN = -127;

/* 分层边界 */
const TIER1_MAX = 10;     // 第一层：0~10
const TIER2_MAX = 50;     // 第二层：10~50

/* 每层的 Int8 范围 */
const TIER1_RANGE = 50;   // 第一层：0~50
const TIER2_RANGE = 50;   // 第二层：50~100
const TIER3_RANGE = 27;   // 第三层：100~127

/**
 * 分层量化：浮点 → Int8
 */
export function toInt8(raw) {
    if (!isFinite(raw)) return 0;
    
    const sign = raw < 0 ? -1 : 1;
    const absV = Math.abs(raw);
    
    let q;
    if (absV <= TIER1_MAX) {
        /* 第一层：高精度 */
        q = (absV / TIER1_MAX) * TIER1_RANGE;
    } else if (absV <= TIER2_MAX) {
        /* 第二层：中精度 */
        const t = (absV - TIER1_MAX) / (TIER2_MAX - TIER1_MAX);
        q = TIER1_RANGE + t * TIER2_RANGE;
    } else {
        /* 第三层：低精度（累积饱和） */
        const t = Math.min(1, (absV - TIER2_MAX) / (TIER2_MAX * 2));
        q = TIER1_RANGE + TIER2_RANGE + t * TIER3_RANGE;
    }
    
    const result = sign * q;
    if (result > MAX) return MAX;
    if (result < MIN) return MIN;
    return Math.round(result);
}

/**
 * 反量化：Int8 → 浮点（近似）
 */
export function toFloat(i8) {
    if (!isFinite(i8)) return 0;
    
    const sign = i8 < 0 ? -1 : 1;
    const absQ = Math.abs(i8);
    
    let v;
    if (absQ <= TIER1_RANGE) {
        /* 第一层 */
        v = (absQ / TIER1_RANGE) * TIER1_MAX;
    } else if (absQ <= TIER1_RANGE + TIER2_RANGE) {
        /* 第二层 */
        const t = (absQ - TIER1_RANGE) / TIER2_RANGE;
        v = TIER1_MAX + t * (TIER2_MAX - TIER1_MAX);
    } else {
        /* 第三层 */
        const t = (absQ - TIER1_RANGE - TIER2_RANGE) / TIER3_RANGE;
        v = TIER2_MAX + t * (TIER2_MAX * 2);
    }
    
    return sign * v;
}

/**
 * 混合多个分数（加权平均）
 */
export function mixScores(scores, weights) {
    let sum = 0;
    const n = Math.min(scores.length, weights ? weights.length : scores.length);
    for (let i = 0; i < n; i++) {
        /* 先反量化成浮点，再混合，最后再量化 */
        sum += toFloat(scores[i]) * (weights ? weights[i] : 1);
    }
    return toInt8(sum);
}

/**
 * 直接截断到 Int8 范围（不做分层量化）
 */
export function clampInt8(v) {
    if (v > MAX) return MAX;
    if (v < MIN) return MIN;
    return v | 0;
}

/* ================= 无偏舍入补偿 =================
 * 本次舍，下次必定入；反之亦然
 * 原理：记录每次舍掉的小数部分，下次补回来
 */
const _compensation = {};

/**
 * 无偏舍入：本次舍下次必入
 * @param raw 浮点值
 * @param key 玩家 key（每个玩家独立补偿）
 * @returns 整数
 */
export function unbiasedRound(raw, key) {
    if (!isFinite(raw)) return 0;
    
    /* 取出上次的补偿（舍掉的小数部分） */
    const comp = _compensation[key] || 0;
    
    /* 加上补偿 */
    const adjusted = raw + comp;
    
    /* 取整 */
    const result = Math.round(adjusted);
    
    /* 计算这次的补偿（新的舍掉的小数部分） */
    _compensation[key] = adjusted - result;
    
    return result;
}

/**
 * 清空补偿表
 */
export function clearCompensation() {
    for (const key in _compensation) delete _compensation[key];
}

/**
 * 获取补偿表（调试用）
 */
export function getCompensation() {
    return { ..._compensation };
}

/**
 * 压缩比例（调试用）
 */
export function compressRatio(raw) {
    const q = toInt8(raw);
    const f = toFloat(q);
    return f / Math.max(0.001, Math.abs(raw));
}

/**
 * 精度表（调试用）
 */
export function precisionTable() {
    return {
        tier1: { range: '0~10', int8: '0~50', precision: 0.2 },
        tier2: { range: '10~50', int8: '50~100', precision: 0.8 },
        tier3: { range: '50+', int8: '100~127', precision: 1.85 },
    };
}
