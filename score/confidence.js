/*
 * ============================================
 * // Éditeur: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 置信度评估 ================= */
import { forward, softmax, isReady } from './weights.js';

const HIGH_CONF = 0.3;
const MID_CONF  = 0.6;

export function confidenceOf(probs) {
    try {
        if (!probs || !probs.length) return 0;
        let entropy = 0;
        for (let i = 0; i < probs.length; i++) {
            const p = probs[i];
            if (p > 1e-9) entropy -= p * Math.log(p);
        }
        const maxEntropy = Math.log(probs.length);
        return maxEntropy > 0 ? 1 - entropy / maxEntropy : 1;
    } catch (e) { return 0; }
}

export function evaluateConfidence(features) {
    try {
        if (!isReady()) return { level: 'none', confidence: 0, action: 'skip', probs: null, label: null };
        const logits = forward(features);
        if (!logits) return { level: 'none', confidence: 0, action: 'skip', probs: null, label: null };
        const probs = softmax(logits);
        const conf = confidenceOf(probs);
        /* 最大概率下标 = 模型推荐标签 */
        let maxIdx = 0, maxP = 0;
        for (let i = 0; i < probs.length; i++) if (probs[i] > maxP) { maxP = probs[i]; maxIdx = i; }
        let level = 'low', action = 'rule';
        if (conf >= 1 - HIGH_CONF) { level = 'high'; action = 'model'; }
        else if (conf >= 1 - MID_CONF) { level = 'mid'; action = 'blend'; }
        return {
            level, action,
            confidence: Math.round(conf * 1000) / 1000,
            label: ['A', 'B', 'C', 'D', 'E', 'F'][maxIdx],
            probs: Array.from(probs),
        };
    } catch (e) {
        return { level: 'none', confidence: 0, action: 'skip', probs: null, label: null };
    }
}

export function blendScore(ruleScore, modelScore, conf) {
    const w = Math.max(0.1, Math.min(0.7, conf));
    return ruleScore * (1 - w) + modelScore * w;
}

if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.confidence = evaluateConfidence;
    window.__DJSC.confidenceOf = confidenceOf;
    window.__DJSC.blendScore = blendScore;
}
