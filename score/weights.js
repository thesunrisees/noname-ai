
/* ===== 关键参数校验（功能层面防盗） ===== */
const _fs_checksum = {
    dim: 130,
    hid1: 128,
    hid2: 64,
    out: 6,
    check: function() {
        // 简单的一致性校验，被改了就返回false
        return (this.dim === 130 && this.hid1 === 128 && this.hid2 === 64 && this.out === 6);
    }
};
// ====================================
/*
 * ============================================
// Autor: Feisheng Original | Licencia: GPL-3.0
 * // Wydawca: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 权重系统（多层版 v3） =================
 * 结构：130 → 128 (ReLU+残差) → 64 (ReLU+残差) → 6 标签 [A/B/C/D/E/F]
 * 兼容旧 getWeights/getBias/isReady/predict 接口
 */
import { log } from './logger.js';
import { cfg } from './util.js';  /* ★ 导入配置读取函数 */

const STORE_KEY = 'djsc_weights_v3';
const VERSION = 6;  /* ★ 版本升级：加入Critic头，强制重新初始化 */
const IN_DIM = 130, HID1_DIM = 128, HID2_DIM = 64, OUT_DIM = 6;  /* ★ 修复：输入维度130，和features.js对齐 */
const SCALE = 128;
const DEFAULT_LR = 0.005;  /* ★ 默认学习率 */
const BETA1 = 0.9;  /* ★ AdamW 一阶矩衰减 */
const BETA2 = 0.999;  /* ★ AdamW 二阶矩衰减 */
const EPS = 1e-8;  /* ★ AdamW 数值稳定项 */
const WEIGHT_DECAY = 0.001;  /* ★ L2 权重衰减，防止过拟合 */
let adamT = 0;  /* ★ AdamW 时间步 */

/* ★ 从配置读取学习率 */
function _getLearningRate() {
    try {
        const lr = parseFloat(cfg('learningRate', DEFAULT_LR));
        if (isNaN(lr) || lr <= 0) return DEFAULT_LR;
        return Math.min(0.01, Math.max(0.001, lr));  /* 限制在0.001~0.01之间 */
    } catch (e) {
        return DEFAULT_LR;
    }
}

export const LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

let W1 = null, B1 = null;   // 130*128, 128
let W2 = null, B2 = null;   // 128*64, 64
let W3 = null, B3 = null;   // 64*6, 6 (Actor头)
let W4 = null, B4 = null;   // 64*1, 1 (Critic头：价值评估) ★ 新增
let W_proj1 = null;  /* ★ 残差连接1：130→128 投影矩阵 */
let W_proj2 = null;  /* ★ 残差连接2：128→64 投影矩阵 */
let mW1 = null, mB1 = null;  /* ★ AdamW 一阶矩 m */
let mW2 = null, mB2 = null;
let mW3 = null, mB3 = null;
let mW4 = null, mB4 = null;  /* ★ Critic头的一阶矩 */
let mW_proj1 = null, mW_proj2 = null;  /* ★ 投影矩阵的一阶矩 */
let vW1 = null, vB1 = null;  /* ★ AdamW 二阶矩 v */
let vW2 = null, vB2 = null;
let vW3 = null, vB3 = null;
let vW4 = null, vB4 = null;  /* ★ Critic头的二阶矩 */
let vW_proj1 = null, vW_proj2 = null;  /* ★ 投影矩阵的二阶矩 */
let currentLR = _getLearningRate();  /* 当前学习率（从配置读取） */
let META = { version: VERSION, trained: 0, accuracy: 0, ready: false };

/* ---------- 初始化 ---------- */
function _initRandom() {
    W1 = new Int8Array(IN_DIM * HID1_DIM);
    B1 = new Int16Array(HID1_DIM);
    W2 = new Int8Array(HID1_DIM * HID2_DIM);
    B2 = new Int16Array(HID2_DIM);
    W3 = new Int8Array(HID2_DIM * OUT_DIM);
    B3 = new Int16Array(OUT_DIM);
    W4 = new Int8Array(HID2_DIM * 1);  /* ★ Critic头：64*1 */
    B4 = new Int16Array(1);              /* ★ Critic头偏置：1维 */
    W_proj1 = new Int8Array(IN_DIM * HID1_DIM);  /* ★ 残差连接1：130→128 */
    W_proj2 = new Int8Array(HID1_DIM * HID2_DIM);  /* ★ 残差连接2：128→64 */
    
    /* ★ AdamW 一阶矩 m 和二阶矩 v 初始化 */
    mW1 = new Float32Array(IN_DIM * HID1_DIM);
    mB1 = new Float32Array(HID1_DIM);
    mW2 = new Float32Array(HID1_DIM * HID2_DIM);
    mB2 = new Float32Array(HID2_DIM);
    mW3 = new Float32Array(HID2_DIM * OUT_DIM);
    mB3 = new Float32Array(OUT_DIM);
    mW4 = new Float32Array(HID2_DIM * 1);  /* ★ Critic头的一阶矩 */
    mB4 = new Float32Array(1);              /* ★ Critic头偏置的一阶矩 */
    mW_proj1 = new Float32Array(IN_DIM * HID1_DIM);  /* ★ 投影矩阵1的一阶矩 */
    mW_proj2 = new Float32Array(HID1_DIM * HID2_DIM);  /* ★ 投影矩阵2的一阶矩 */
    vW1 = new Float32Array(IN_DIM * HID1_DIM);
    vB1 = new Float32Array(HID1_DIM);
    vW2 = new Float32Array(HID1_DIM * HID2_DIM);
    vB2 = new Float32Array(HID2_DIM);
    vW3 = new Float32Array(HID2_DIM * OUT_DIM);
    vB3 = new Float32Array(OUT_DIM);
    vW4 = new Float32Array(HID2_DIM * 1);  /* ★ Critic头的二阶矩 */
    vB4 = new Float32Array(1);              /* ★ Critic头偏置的二阶矩 */
    vW_proj1 = new Float32Array(IN_DIM * HID1_DIM);  /* ★ 投影矩阵1的二阶矩 */
    vW_proj2 = new Float32Array(HID1_DIM * HID2_DIM);  /* ★ 投影矩阵2的二阶矩 */
    adamT = 0;  /* ★ AdamW 时间步重置 */
    
    const lim = Math.max(1, Math.floor(SCALE / 8));
    for (let i = 0; i < W1.length; i++) W1[i] = ((Math.random() * 2 - 1) * lim) | 0;
    for (let i = 0; i < W2.length; i++) W2[i] = ((Math.random() * 2 - 1) * lim) | 0;
    for (let i = 0; i < W3.length; i++) W3[i] = ((Math.random() * 2 - 1) * lim) | 0;
    for (let i = 0; i < W4.length; i++) W4[i] = ((Math.random() * 2 - 1) * lim / 2) | 0;  /* ★ Critic头初始值小一点 */
    for (let i = 0; i < W_proj1.length; i++) W_proj1[i] = ((Math.random() * 2 - 1) * lim / 4) | 0;  /* ★ 投影矩阵初始值小一点 */
    for (let i = 0; i < W_proj2.length; i++) W_proj2[i] = ((Math.random() * 2 - 1) * lim / 4) | 0;  /* ★ 投影矩阵初始值小一点 */
    
    currentLR = _getLearningRate();  /* 重置学习率（从配置读取） */
    META.ready = false;
}

/* ---------- 加载/保存 ---------- */
export function loadWeights() {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) { _initRandom(); META.ready = true; try { log.info('weights', '无存档 → 随机初始化并标记就绪（开箱即用，日志显示 M）'); } catch (e) {} return false; }
        const obj = JSON.parse(raw);
        if (!obj || obj.v !== VERSION) { _initRandom(); META.ready = true; return false; }
        W1 = _decodeInt8(obj.w1); B1 = _decodeInt8(obj.b1);
        W2 = _decodeInt8(obj.w2); B2 = _decodeInt8(obj.b2);
        W3 = _decodeInt8(obj.w3); B3 = _decodeInt8(obj.b3);
        /* ★ 加载Critic头权重（如果旧版本没有就随机初始化） */
        if (obj.w4 && obj.b4) {
            W4 = _decodeInt8(obj.w4); B4 = _decodeInt8(obj.b4);
        } else {
            W4 = new Int8Array(HID2_DIM * 1);
            B4 = new Int16Array(1);
            for (let i = 0; i < W4.length; i++) W4[i] = 0;
            for (let i = 0; i < B4.length; i++) B4[i] = 0;
        }
        META.trained = obj.trained || 0;
        META.accuracy = obj.accuracy || 0;
        META.ready = !!obj.ready;
        try { log.info('weights', '已加载权重（含Critic头），训练次数=' + META.trained); } catch (e) {}
        return true;
    } catch (e) { _initRandom(); return false; }
}
export function saveWeights() {
    try {
        const obj = {
            v: VERSION,
            w1: _encodeInt8(W1), b1: _encodeInt8(B1),
            w2: _encodeInt8(W2), b2: _encodeInt8(B2),
            w3: _encodeInt8(W3), b3: _encodeInt8(B3),
            w4: _encodeInt8(W4), b4: _encodeInt8(B4),  /* ★ 保存Critic头 */
            trained: META.trained, accuracy: META.accuracy, ready: META.ready,
        };
        localStorage.setItem(STORE_KEY, JSON.stringify(obj));
        return true;
    } catch (e) { return false; }
}

/* ---------- Base64 编解码 ---------- */
function _encodeInt8(arr) {
    if (!arr) return '';
    const bytes = new Uint8Array(arr.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}
function _decodeInt8(str) {
    if (!str) return new Int8Array(0);
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Int8Array(bytes.buffer);
}

/* ---------- GELU 激活函数（近似版） ---------- */
function gelu(x) {
    return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)));
}

/* ---------- 前向传播 ---------- */
export function forward(features, outBuf) {
    try {
        if (!W1 || !features) return null;
        const I = IN_DIM, H1 = HID1_DIM, H2 = HID2_DIM, O = OUT_DIM;
        
        /* 第一层：130 → 128 */
        const hidden1 = new Float32Array(H1);
        for (let j = 0; j < H1; j++) {
            let sum = 0;
            const base = j * I;
            for (let i = 0; i < I; i++) sum += W1[base + i] * features[i];
            hidden1[j] = (sum + B1[j] * SCALE) / SCALE;
        }
        for (let j = 0; j < H1; j++) hidden1[j] = gelu(hidden1[j]);  /* GELU 激活函数 */

        /* ★ Layer Normalization（第一层） */
        let mean1 = 0;
        for (let j = 0; j < H1; j++) mean1 += hidden1[j];
        mean1 /= H1;
        let var1 = 0;
        for (let j = 0; j < H1; j++) var1 += (hidden1[j] - mean1) * (hidden1[j] - mean1);
        var1 /= H1;
        const std1 = Math.sqrt(var1 + 1e-8);
        for (let j = 0; j < H1; j++) hidden1[j] = (hidden1[j] - mean1) / std1;
        
        /* 第二层：128 → 64 */
        const hidden2 = new Float32Array(H2);
        for (let j = 0; j < H2; j++) {
            let sum = 0;
            const base = j * H1;
            for (let i = 0; i < H1; i++) sum += W2[base + i] * hidden1[i];
            hidden2[j] = (sum + B2[j] * SCALE) / SCALE;
        }
        for (let j = 0; j < H2; j++) hidden2[j] = gelu(hidden2[j]);  /* GELU 激活函数 */

        /* ★ Layer Normalization（第二层） */
        let mean2 = 0;
        for (let j = 0; j < H2; j++) mean2 += hidden2[j];
        mean2 /= H2;
        let var2 = 0;
        for (let j = 0; j < H2; j++) var2 += (hidden2[j] - mean2) * (hidden2[j] - mean2);
        var2 /= H2;
        const std2 = Math.sqrt(var2 + 1e-8);
        for (let j = 0; j < H2; j++) hidden2[j] = (hidden2[j] - mean2) / std2;
        
        /* 输出层：64 → 6 (Actor头) */
        const out = outBuf || new Float32Array(O);
        for (let k = 0; k < O; k++) {
            let sum = 0;
            const base = k * H2;
            for (let j = 0; j < H2; j++) sum += W3[base + j] * hidden2[j];
            out[k] = (sum + B3[k] * SCALE) / SCALE;
        }
        return out;
    } catch (e) { return null; }
}

/* ★ 前向传播（带Critic头）：同时输出Actor logits和Value估值 */
export function forwardWithValue(features) {
    try {
        if (!W1 || !features) return null;
        const I = IN_DIM, H1 = HID1_DIM, H2 = HID2_DIM, O = OUT_DIM;
        
        /* 第一层：130 → 128 */
        const hidden1 = new Float32Array(H1);
        for (let j = 0; j < H1; j++) {
            let sum = 0;
            const base = j * I;
            for (let i = 0; i < I; i++) sum += W1[base + i] * features[i];
            hidden1[j] = (sum + B1[j] * SCALE) / SCALE;
        }
        for (let j = 0; j < H1; j++) hidden1[j] = gelu(hidden1[j]);

        /* Layer Normalization（第一层） */
        let mean1 = 0;
        for (let j = 0; j < H1; j++) mean1 += hidden1[j];
        mean1 /= H1;
        let var1 = 0;
        for (let j = 0; j < H1; j++) var1 += (hidden1[j] - mean1) * (hidden1[j] - mean1);
        var1 /= H1;
        const std1 = Math.sqrt(var1 + 1e-8);
        for (let j = 0; j < H1; j++) hidden1[j] = (hidden1[j] - mean1) / std1;
        
        /* 第二层：128 → 64 */
        const hidden2 = new Float32Array(H2);
        for (let j = 0; j < H2; j++) {
            let sum = 0;
            const base = j * H1;
            for (let i = 0; i < H1; i++) sum += W2[base + i] * hidden1[i];
            hidden2[j] = (sum + B2[j] * SCALE) / SCALE;
        }
        for (let j = 0; j < H2; j++) hidden2[j] = gelu(hidden2[j]);

        /* Layer Normalization（第二层） */
        let mean2 = 0;
        for (let j = 0; j < H2; j++) mean2 += hidden2[j];
        mean2 /= H2;
        let var2 = 0;
        for (let j = 0; j < H2; j++) var2 += (hidden2[j] - mean2) * (hidden2[j] - mean2);
        var2 /= H2;
        const std2 = Math.sqrt(var2 + 1e-8);
        for (let j = 0; j < H2; j++) hidden2[j] = (hidden2[j] - mean2) / std2;
        
        /* Actor头：64 → 6 */
        const actorLogits = new Float32Array(O);
        for (let k = 0; k < O; k++) {
            let sum = 0;
            const base = k * H2;
            for (let j = 0; j < H2; j++) sum += W3[base + j] * hidden2[j];
            actorLogits[k] = (sum + B3[k] * SCALE) / SCALE;
        }
        
        /* Critic头：64 → 1，用Tanh压缩到[-1, 1] */
        let valueRaw = 0;
        for (let j = 0; j < H2; j++) valueRaw += W4[j] * hidden2[j];
        valueRaw = (valueRaw + B4[0] * SCALE) / SCALE;
        const value = Math.tanh(valueRaw);
        
        return {
            actorLogits: actorLogits,
            value: value,
            hidden2: hidden2  /* 训练时反向传播用 */
        };
    } catch (e) { return null; }
}

/* ---------- softmax ---------- */
export function softmax(logits) {
    if (!logits || !logits.length) return [];
    let max = -Infinity;
    for (let i = 0; i < logits.length; i++) if (logits[i] > max) max = logits[i];
    const exps = new Float32Array(logits.length);
    let sum = 0;
    for (let i = 0; i < logits.length; i++) {
        exps[i] = Math.exp(logits[i] - max);  /* ★ 已经是浮点了，不用再除SCALE */
        sum += exps[i];
    }
    const probs = new Float32Array(logits.length);
    for (let i = 0; i < logits.length; i++) probs[i] = exps[i] / sum;
    return probs;
}

/* ---------- 单样本 SGD（带动量+权重衰减+学习率衰减） ---------- */
export function trainOne(features, labelIdx, lr) {
    if (!features || labelIdx < 0 || labelIdx >= OUT_DIM) return false;
    try {
        const I = IN_DIM, H1 = HID1_DIM, H2 = HID2_DIM, O = OUT_DIM;
        lr = currentLR;  /* 使用衰减后的学习率 */
        
        /* 前向传播（ResNet 残差连接可开关，默认关闭） */
        const useRes = (typeof cfg === 'function') ? cfg('useResidual', false) : false;  /* ★ 读取残差开关，默认关闭 */
        const hidden1 = new Float32Array(H1);
        for (let j = 0; j < H1; j++) {
            let sum = 0;
            const base = j * I;
            /* 主路径：W1 * x + B1 */
            for (let i = 0; i < I; i++) sum += (W1[base + i] / SCALE) * (features[i] / 127);
            sum += B1[j] / SCALE;
            /* ★ 残差连接：如果开启才加 */
            if (useRes) {
                for (let i = 0; i < I; i++) sum += (W_proj1[base + i] / SCALE) * (features[i] / 127);
            }
            hidden1[j] = sum > 0 ? sum : 0;  /* ReLU 激活 */
        }
        const hidden2 = new Float32Array(H2);
        for (let j = 0; j < H2; j++) {
            let sum = 0;
            const base = j * H1;
            /* 主路径：W2 * hidden1 + B2 */
            for (let i = 0; i < H1; i++) sum += (W2[base + i] / SCALE) * hidden1[i];
            sum += B2[j] / SCALE;
            /* ★ 残差连接：如果开启才加 */
            if (useRes) {
                for (let i = 0; i < H1; i++) sum += (W_proj2[base + i] / SCALE) * hidden1[i];
            }
            hidden2[j] = sum > 0 ? sum : 0;  /* ReLU 激活 */
        }
        const logits = new Float32Array(O);
        for (let k = 0; k < O; k++) {
            let sum = 0;
            const base = k * H2;
            for (let j = 0; j < H2; j++) sum += (W3[base + j] / SCALE) * hidden2[j];
            sum += B3[k] / SCALE;
            logits[k] = sum;
        }
        
        /* 反向传播 */
        const probs = softmax(logits);
        const dLogits = new Float32Array(O);
        for (let k = 0; k < O; k++) dLogits[k] = probs[k] - (k === labelIdx ? 1 : 0);
        
        const dHidden2 = new Float32Array(H2);
        for (let j = 0; j < H2; j++) {
            let sum = 0;
            for (let k = 0; k < O; k++) sum += dLogits[k] * (W3[k * H2 + j] / SCALE);
            dHidden2[j] = hidden2[j] > 0 ? sum : 0;
        }
        
        const dHidden1 = new Float32Array(H1);
        for (let j = 0; j < H1; j++) {
            let sum = 0;
            for (let k = 0; k < H2; k++) sum += dHidden2[k] * (W2[k * H1 + j] / SCALE);
            dHidden1[j] = hidden1[j] > 0 ? sum : 0;
        }
        
        /* ★ AdamW 优化器：时间步+1 */
        adamT++;
        const biasCorrection1 = 1 - Math.pow(BETA1, adamT);
        const biasCorrection2 = 1 - Math.pow(BETA2, adamT);
        
        /* 更新输出层（AdamW + 权重衰减） */
        for (let k = 0; k < O; k++) {
            const base = k * H2;
            for (let j = 0; j < H2; j++) {
                const grad = dLogits[k] * hidden2[j];
                /* 1. 更新一阶矩 m */
                mW3[base + j] = BETA1 * mW3[base + j] + (1 - BETA1) * grad;
                /* 2. 更新二阶矩 v */
                vW3[base + j] = BETA2 * vW3[base + j] + (1 - BETA2) * grad * grad;
                /* 3. 偏差修正 */
                const mHat = mW3[base + j] / biasCorrection1;
                const vHat = vW3[base + j] / biasCorrection2;
                /* 4. 权重衰减（解耦） */
                W3[base + j] -= Math.round(lr * WEIGHT_DECAY * W3[base + j]);
                /* 5. 梯度更新 */
                W3[base + j] = _clamp(W3[base + j] - Math.round(lr * mHat / (Math.sqrt(vHat) + EPS) * SCALE));
            }
            /* 偏置更新 */
            mB3[k] = BETA1 * mB3[k] + (1 - BETA1) * dLogits[k];
            vB3[k] = BETA2 * vB3[k] + (1 - BETA2) * dLogits[k] * dLogits[k];
            const mHatB = mB3[k] / biasCorrection1;
            const vHatB = vB3[k] / biasCorrection2;
            B3[k] = _clamp16(B3[k] - Math.round(lr * mHatB / (Math.sqrt(vHatB) + EPS) * SCALE));
        }
        
        /* 更新第二层隐藏层（主路径 + 残差投影W_proj2，可开关） */
        for (let j = 0; j < H2; j++) {
            const base = j * H1;
            for (let i = 0; i < H1; i++) {
                /* 主路径梯度 */
                const grad = dHidden2[j] * hidden1[i];
                /* 更新 W2 */
                mW2[base + i] = BETA1 * mW2[base + i] + (1 - BETA1) * grad;
                vW2[base + i] = BETA2 * vW2[base + i] + (1 - BETA2) * grad * grad;
                const mHat = mW2[base + i] / biasCorrection1;
                const vHat = vW2[base + i] / biasCorrection2;
                W2[base + i] -= Math.round(lr * WEIGHT_DECAY * W2[base + i]);
                W2[base + i] = _clamp(W2[base + i] - Math.round(lr * mHat / (Math.sqrt(vHat) + EPS) * SCALE));
                /* ★ 更新残差投影 W_proj2（只有开启残差才更新） */
                if (useRes) {
                    mW_proj2[base + i] = BETA1 * mW_proj2[base + i] + (1 - BETA1) * grad;
                    vW_proj2[base + i] = BETA2 * vW_proj2[base + i] + (1 - BETA2) * grad * grad;
                    const mHatP = mW_proj2[base + i] / biasCorrection1;
                    const vHatP = vW_proj2[base + i] / biasCorrection2;
                    W_proj2[base + i] -= Math.round(lr * WEIGHT_DECAY * W_proj2[base + i]);
                    W_proj2[base + i] = _clamp(W_proj2[base + i] - Math.round(lr * mHatP / (Math.sqrt(vHatP) + EPS) * SCALE));
                }
            }
            mB2[j] = BETA1 * mB2[j] + (1 - BETA1) * dHidden2[j];
            vB2[j] = BETA2 * vB2[j] + (1 - BETA2) * dHidden2[j] * dHidden2[j];
            const mHatB = mB2[j] / biasCorrection1;
            const vHatB = vB2[j] / biasCorrection2;
            B2[j] = _clamp16(B2[j] - Math.round(lr * mHatB / (Math.sqrt(vHatB) + EPS) * SCALE));
        }
        
        /* 更新第一层隐藏层（主路径 + 残差投影W_proj1） */
        for (let j = 0; j < H1; j++) {
            const base = j * I;
            for (let i = 0; i < I; i++) {
                const grad = dHidden1[j] * (features[i] / 127);
                /* 更新 W1（主路径） */
                mW1[base + i] = BETA1 * mW1[base + i] + (1 - BETA1) * grad;
                vW1[base + i] = BETA2 * vW1[base + i] + (1 - BETA2) * grad * grad;
                const mHat = mW1[base + i] / biasCorrection1;
                const vHat = vW1[base + i] / biasCorrection2;
                W1[base + i] -= Math.round(lr * WEIGHT_DECAY * W1[base + i]);
                W1[base + i] = _clamp(W1[base + i] - Math.round(lr * mHat / (Math.sqrt(vHat) + EPS) * SCALE));
                /* ★ 更新残差投影 W_proj1（只有开启残差才更新） */
                if (useRes) {
                    mW_proj1[base + i] = BETA1 * mW_proj1[base + i] + (1 - BETA1) * grad;
                    vW_proj1[base + i] = BETA2 * vW_proj1[base + i] + (1 - BETA2) * grad * grad;
                    const mHatP = mW_proj1[base + i] / biasCorrection1;
                    const vHatP = vW_proj1[base + i] / biasCorrection2;
                    W_proj1[base + i] -= Math.round(lr * WEIGHT_DECAY * W_proj1[base + i]);
                    W_proj1[base + i] = _clamp(W_proj1[base + i] - Math.round(lr * mHatP / (Math.sqrt(vHatP) + EPS) * SCALE));
                }
            }
            mB1[j] = BETA1 * mB1[j] + (1 - BETA1) * dHidden1[j];
            vB1[j] = BETA2 * vB1[j] + (1 - BETA2) * dHidden1[j] * dHidden1[j];
            const mHatB = mB1[j] / biasCorrection1;
            const vHatB = vB1[j] / biasCorrection2;
            B1[j] = _clamp16(B1[j] - Math.round(lr * mHatB / (Math.sqrt(vHatB) + EPS) * SCALE));
        }
        
        /* ★ AdamW 不需要手动学习率衰减，已经自适应了 */
        META.trained++;
        return true;
    } catch (e) { return false; }
}
/* ★ 带Critic的训练函数：同时训练Actor（分类）和Critic（价值回归） */
export function trainOneWithValue(features, labelIdx, valueTarget, lr) {
    if (!features || labelIdx < 0 || labelIdx >= OUT_DIM) return false;
    try {
        const I = IN_DIM, H1 = HID1_DIM, H2 = HID2_DIM, O = OUT_DIM;
        lr = currentLR;
        
        /* 前向传播 */
        const result = forwardWithValue(features);
        if (!result) return false;
        
        const actorLogits = result.actorLogits;
        const value = result.value;
        const hidden2 = result.hidden2;
        
        /* ★ 反向传播：Actor损失（交叉熵） */
        const probs = softmax(actorLogits);
        const dLogits = new Float32Array(O);
        for (let k = 0; k < O; k++) dLogits[k] = probs[k] - (k === labelIdx ? 1 : 0);
        
        /* ★ 反向传播：Critic损失（MSE） */
        const valueLoss = value - valueTarget;
        const dValue = valueLoss * (1 - value * value);  /* tanh的导数 */
        
        /* 合并梯度：dHidden2 = Actor梯度 + 0.5 * Critic梯度 */
        const dHidden2 = new Float32Array(H2);
        for (let j = 0; j < H2; j++) {
            let sum = 0;
            /* Actor头的梯度 */
            for (let k = 0; k < O; k++) sum += dLogits[k] * (W3[k * H2 + j] / SCALE);
            /* Critic头的梯度（权重0.5） */
            sum += 0.5 * dValue * (W4[j] / SCALE);
            dHidden2[j] = sum;
        }
        
        /* 更新Critic头（W4, B4） */
        adamT++;
        const biasCorrection1 = 1 - Math.pow(BETA1, adamT);
        const biasCorrection2 = 1 - Math.pow(BETA2, adamT);
        
        for (let j = 0; j < H2; j++) {
            const grad = dValue * hidden2[j];
            mW4[j] = BETA1 * mW4[j] + (1 - BETA1) * grad;
            vW4[j] = BETA2 * vW4[j] + (1 - BETA2) * grad * grad;
            const mHat = mW4[j] / biasCorrection1;
            const vHat = vW4[j] / biasCorrection2;
            W4[j] -= Math.round(lr * WEIGHT_DECAY * W4[j]);
            W4[j] = _clamp(W4[j] - Math.round(lr * mHat / (Math.sqrt(vHat) + EPS) * SCALE));
        }
        mB4[0] = BETA1 * mB4[0] + (1 - BETA1) * dValue;
        vB4[0] = BETA2 * vB4[0] + (1 - BETA2) * dValue * dValue;
        const mHatB = mB4[0] / biasCorrection1;
        const vHatB = vB4[0] / biasCorrection2;
        B4[0] = _clamp16(B4[0] - Math.round(lr * mHatB / (Math.sqrt(vHatB) + EPS) * SCALE));
        
        /* 更新Actor输出层（W3, B3） */
        for (let k = 0; k < O; k++) {
            const base = k * H2;
            for (let j = 0; j < H2; j++) {
                const grad = dLogits[k] * hidden2[j];
                mW3[base + j] = BETA1 * mW3[base + j] + (1 - BETA1) * grad;
                vW3[base + j] = BETA2 * vW3[base + j] + (1 - BETA2) * grad * grad;
                const mHat = mW3[base + j] / biasCorrection1;
                const vHat = vW3[base + j] / biasCorrection2;
                W3[base + j] -= Math.round(lr * WEIGHT_DECAY * W3[base + j]);
                W3[base + j] = _clamp(W3[base + j] - Math.round(lr * mHat / (Math.sqrt(vHat) + EPS) * SCALE));
            }
            mB3[k] = BETA1 * mB3[k] + (1 - BETA1) * dLogits[k];
            vB3[k] = BETA2 * vB3[k] + (1 - BETA2) * dLogits[k] * dLogits[k];
            const mHatB3 = mB3[k] / biasCorrection1;
            const vHatB3 = vB3[k] / biasCorrection2;
            B3[k] = _clamp16(B3[k] - Math.round(lr * mHatB3 / (Math.sqrt(vHatB3) + EPS) * SCALE));
        }
        
        /* 简化：不再反向传播到隐藏层（手机端性能优先） */
        /* 如果需要更好的效果，可以加上隐藏层的反向传播 */
        
        META.trained++;
        return true;
    } catch (e) { return false; }
}

function _clamp(v) { if (v > 127) return 127; if (v < -127) return -127; return v | 0; }
function _clamp16(v) { if (v > 32767) return 32767; if (v < -32767) return -32767; return v | 0; }

/* ---------- 兼容旧接口 ---------- */
export function getWeights() { return W1; }
export function getBias()    { return B1; }
export function isReady()    { return !!META.ready; }
export function getAccuracy() { return META.accuracy; }
export function setAccuracy(a) { META.accuracy = a; }
export function markReady(ok) { META.ready = !!ok; saveWeights(); }
export function getTrained() { return META.trained; }
export function getMeta()    { return Object.assign({}, META); }
export function predict(features) {
    /* ★ 兜底返回值：防止 undefined 导致冲突检测疯狂报警 */
    const fallback = {
        action: 'B',
        label: 'B',
        probs: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2],
        confidence: 0.0,
        value: 0.0  /* ★ 兜底价值评估 */
    };

    try {
        /* ★ 如果权重还没初始化，自动初始化 */
        if (!W1) {
            _initRandom();
            META.ready = false;
        }
        
        /* ★ 调试日志 */
        try { console.log('[weights] W1长度=' + (W1 ? W1.length : 'null') + ', features长度=' + (features ? features.length : 'null')); } catch(e) {}
        
        /* ★ 用forwardWithValue同时获取Actor概率和Critic价值 */
        const result = forwardWithValue(features);
        try { console.log('[weights] forwardWithValue结果: ' + (result ? '有actorLogits=' + (result.actorLogits ? result.actorLogits.length : 'null') : 'null')); } catch(e) {}
        
        if (!result || !result.actorLogits) return fallback;
        
        const probs = softmax(result.actorLogits);
        if (!probs || !Array.isArray(probs) || probs.length < 6) return fallback;

        /* ★ 从概率分布中推导出 action 和 label */
        let bestIdx = 0;
        let bestProb = -1;
        for (let i = 0; i < probs.length; i++) {
            if (probs[i] > bestProb) {
                bestProb = probs[i];
                bestIdx = i;
            }
        }

        const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
        const action = labels[bestIdx] || 'B';

        return {
            action: action,
            label: action,
            probs: Array.from(probs),
            confidence: bestProb,
            value: result.value  /* ★ 价值评估：-1到1之间 */
        };
    } catch (e) {
        return fallback;
    }
}
export function resetWeights() {
    _initRandom(); META.trained = 0; META.accuracy = 0; META.ready = false;
    saveWeights();
}

/* ---------- 兼容旧变量导出 ---------- */
export const WEIGHTS = W1;
export const BIAS = 0;

/* ---------- 兼容旧函数导出 ---------- */
export function saveLocalWeights(w, b, acc) {
    try {
        if (w) {
            for (let i = 0; i < W1.length && i < w.length; i++) W1[i] = w[i] | 0;
        }
        if (b !== undefined && B1.length > 0) B1[0] = b | 0;
        if (acc !== undefined) META.accuracy = acc;
        META.ready = true;
        saveWeights();
        return true;
    } catch (e) { return false; }
}
export function reloadWeights() {
    return loadWeights();
}

loadWeights();
export const WEIGHTS_DIMS = { IN: IN_DIM, HID1: HID1_DIM, HID2: HID2_DIM, OUT: OUT_DIM };

/* ================= 供权重固化模块使用 ================= */
export function __getW2() { return W2; }
export function __getB2() { return B2; }
export function __getW1() { return W1; }
export function __getB1() { return B1; }

/* ================= 供热更新使用 ================= */
export function __applySnapshot(snapshot) {
    try {
        if (!snapshot) return false;
        if (snapshot.w1) W1 = new Int8Array(snapshot.w1);
        if (snapshot.b1) B1 = new Int8Array(snapshot.b1);
        if (snapshot.w2) W2 = new Int8Array(snapshot.w2);
        if (snapshot.b2) B2 = new Int8Array(snapshot.b2);
        META.ready = true;
        return true;
    } catch (e) { return false; }
}

/* ================= ★ Critic头导出（供控制台检查） ================= */
export const W4_critic = W4;    /* 别名：W4_critic */
export const b4_critic = B4;    /* 别名：b4_critic */

/* ★ 挂载到window上，方便控制台检查（用getter自动获取最新值） */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.weights = window.__DJSC.weights || {};
    
    /* ★ 用getter自动获取最新的W4，不管什么时候初始化都能拿到 */
    Object.defineProperty(window.__DJSC.weights, 'W4_critic', {
        get: function () { return W4; },
        configurable: true
    });
    Object.defineProperty(window.__DJSC.weights, 'b4_critic', {
        get: function () { return B4; },
        configurable: true
    });
    Object.defineProperty(window.__DJSC.weights, 'W1', {
        get: function () { return W1; },
        configurable: true
    });
    
    window.__DJSC.weights.criticReady = (W4 !== null);  /* Critic头是否已初始化 */
    window.__DJSC.weights.forwardWithValue = forwardWithValue;  /* ★ 直接暴露forwardWithValue */
    window.__DJSC.weights.VERSION = '2.9.60';  /* ★ 版本号：用来确认是不是新版本 */
}
