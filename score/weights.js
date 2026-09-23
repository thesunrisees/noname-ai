/* ================= 决策积分引擎 · 权重系统（多层版 v3） =================
 * 结构：96 → 64 (ReLU) → 6 标签 [A/B/C/D/E/F]
 * 兼容旧 getWeights/getBias/isReady/predict 接口
 */
import { log } from './logger.js';

const STORE_KEY = 'djsc_weights_v3';
const VERSION = 3;
const IN_DIM = 96, HID_DIM = 64, OUT_DIM = 6;
const SCALE = 32;

export const LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

let W1 = null, B1 = null;   // 96*64, 64
let W2 = null, B2 = null;   // 64*6,  6
let META = { version: VERSION, trained: 0, accuracy: 0, ready: false };

/* ---------- 初始化 ---------- */
function _initRandom() {
    W1 = new Int8Array(IN_DIM * HID_DIM);
    B1 = new Int8Array(HID_DIM);
    W2 = new Int8Array(HID_DIM * OUT_DIM);
    B2 = new Int8Array(OUT_DIM);
    const lim = Math.max(1, Math.floor(SCALE / 4));
    for (let i = 0; i < W1.length; i++) W1[i] = ((Math.random() * 2 - 1) * lim) | 0;
    for (let i = 0; i < W2.length; i++) W2[i] = ((Math.random() * 2 - 1) * lim) | 0;
    META.ready = false;
}

/* ---------- 加载/保存 ---------- */
export function loadWeights() {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) { _initRandom(); return false; }
        const obj = JSON.parse(raw);
        if (!obj || obj.v !== VERSION) { _initRandom(); return false; }
        W1 = _decodeInt8(obj.w1); B1 = _decodeInt8(obj.b1);
        W2 = _decodeInt8(obj.w2); B2 = _decodeInt8(obj.b2);
        META.trained = obj.trained || 0;
        META.accuracy = obj.accuracy || 0;
        META.ready = !!obj.ready;
        try { log.info('weights', '已加载 v3 权重，训练次数=' + META.trained); } catch (e) {}
        return true;
    } catch (e) { _initRandom(); return false; }
}
export function saveWeights() {
    try {
        const obj = {
            v: VERSION,
            w1: _encodeInt8(W1), b1: _encodeInt8(B1),
            w2: _encodeInt8(W2), b2: _encodeInt8(B2),
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

/* ---------- 前向传播 ---------- */
export function forward(features, outBuf) {
    try {
        if (!W1 || !features) return null;
        const I = IN_DIM, H = HID_DIM, O = OUT_DIM;
        const hidden = new Int32Array(H);
        for (let j = 0; j < H; j++) {
            let sum = 0;
            const base = j * I;
            for (let i = 0; i < I; i++) sum += W1[base + i] * features[i];
            hidden[j] = sum + B1[j] * SCALE;
        }
        for (let j = 0; j < H; j++) if (hidden[j] < 0) hidden[j] = 0;
        const out = outBuf || new Int32Array(O);
        for (let k = 0; k < O; k++) {
            let sum = 0;
            const base = k * H;
            for (let j = 0; j < H; j++) sum += W2[base + j] * hidden[j];
            out[k] = sum + B2[k] * SCALE;
        }
        return out;
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
        exps[i] = Math.exp((logits[i] - max) / SCALE);
        sum += exps[i];
    }
    const probs = new Float32Array(logits.length);
    for (let i = 0; i < logits.length; i++) probs[i] = exps[i] / sum;
    return probs;
}

/* ---------- 单样本 SGD ---------- */
export function trainOne(features, labelIdx, lr) {
    if (!features || labelIdx < 0 || labelIdx >= OUT_DIM) return false;
    lr = lr || 0.01;
    try {
        const I = IN_DIM, H = HID_DIM, O = OUT_DIM;
        const hidden = new Float32Array(H);
        for (let j = 0; j < H; j++) {
            let sum = 0;
            const base = j * I;
            for (let i = 0; i < I; i++) sum += (W1[base + i] / SCALE) * (features[i] / 127);
            sum += B1[j] / SCALE;
            hidden[j] = sum > 0 ? sum : 0;
        }
        const logits = new Float32Array(O);
        for (let k = 0; k < O; k++) {
            let sum = 0;
            const base = k * H;
            for (let j = 0; j < H; j++) sum += (W2[base + j] / SCALE) * hidden[j];
            sum += B2[k] / SCALE;
            logits[k] = sum;
        }
        const probs = softmax(logits);
        const dLogits = new Float32Array(O);
        for (let k = 0; k < O; k++) dLogits[k] = probs[k] - (k === labelIdx ? 1 : 0);
        const dHidden = new Float32Array(H);
        for (let j = 0; j < H; j++) {
            let sum = 0;
            for (let k = 0; k < O; k++) sum += dLogits[k] * (W2[k * H + j] / SCALE);
            dHidden[j] = hidden[j] > 0 ? sum : 0;
        }
        for (let k = 0; k < O; k++) {
            const base = k * H;
            for (let j = 0; j < H; j++) {
                W2[base + j] = _clamp(W2[base + j] - Math.round(dLogits[k] * hidden[j] * lr * SCALE));
            }
            B2[k] = _clamp(B2[k] - Math.round(dLogits[k] * lr * SCALE));
        }
        for (let j = 0; j < H; j++) {
            const base = j * I;
            for (let i = 0; i < I; i++) {
                W1[base + i] = _clamp(W1[base + i] - Math.round(dHidden[j] * (features[i] / 127) * lr * SCALE));
            }
            B1[j] = _clamp(B1[j] - Math.round(dHidden[j] * lr * SCALE));
        }
        META.trained++;
        return true;
    } catch (e) { return false; }
}
function _clamp(v) { if (v > 127) return 127; if (v < -127) return -127; return v | 0; }

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
        confidence: 0.0
    };

    try {
        const logits = forward(features);
        if (!logits) return fallback;
        const result = softmax(logits);
        if (!result || !Array.isArray(result) || result.length < 6) return fallback;

        /* ★ 从概率分布中推导出 action 和 label */
        let bestIdx = 0;
        let bestProb = -1;
        for (let i = 0; i < result.length; i++) {
            if (result[i] > bestProb) {
                bestProb = result[i];
                bestIdx = i;
            }
        }

        const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
        const action = labels[bestIdx] || 'B';

        return {
            action: action,
            label: action,
            probs: Array.from(result),
            confidence: bestProb
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
export const WEIGHTS_DIMS = { IN: IN_DIM, HID: HID_DIM, OUT: OUT_DIM };

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
