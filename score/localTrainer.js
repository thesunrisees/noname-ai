/* ================= 本地训练器 · 多层网络 SGD ================= */

import { getSamples } from './trainExport.js';
import { FEATURE_DIM } from './features.js';
import { trainOne, saveWeights, setAccuracy, markReady, getMeta, forward } from './weights.js';

const EPOCHS = 60;
const LR = 0.02;
const VAL_RATIO = 0.2;

let _training = false;
let _lastResult = null;

export function isTraining() { return _training; }
export function lastResult() { return _lastResult; }

export function trainLocalAsync(onDone) {
    if (_training) { if (onDone) onDone({ ok: false, err: '正在训练' }); return; }
    _training = true;
    setTimeout(function () {
        let r;
        try { r = _train(); } catch (e) { r = { ok: false, err: String(e) }; }
        _training = false;
        _lastResult = r;
        if (onDone) onDone(r);
    }, 50);
}

function _scoreToLabel(score) {
    /* 把分数映射到 6 个标签 [A/B/C/D/E/F] */
    /* score 范围大约 -127 ~ 127 */
    if (score >= 80) return 0;      /* A: 极好 */
    if (score >= 30) return 1;      /* B: 好 */
    if (score >= 0) return 2;       /* C: 一般 */
    if (score >= -30) return 3;     /* D: 差 */
    if (score >= -80) return 4;     /* E: 很差 */
    return 5;                       /* F: 极差 */
}

function _train() {
    const samples = getSamples();
    if (!samples || samples.length < 200) {
        return { ok: false, err: '样本不足（需 ≥200，当前 ' + (samples ? samples.length : 0) + '）' };
    }

    const t0 = performance.now();
    const n = samples.length;
    const dim = FEATURE_DIM;

    /* 准备训练数据 */
    const X = new Int8Array(n * dim);
    const Y = new Int8Array(n);
    let posCount = 0, negCount = 0;
    for (let i = 0; i < n; i++) {
        const s = samples[i];
        const off = i * dim;
        for (let j = 0; j < dim; j++) X[off + j] = s.f[j] | 0;
        const label = _scoreToLabel(s.r);
        Y[i] = label;
        if (s.r > 0) posCount++; else negCount++;
    }

    /* 打乱顺序 */
    const idx = new Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    for (let i = n - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }

    /* 划分训练集/验证集 */
    const valN = Math.max(20, (n * VAL_RATIO) | 0);
    const trN = n - valN;

    /* ★ 多层网络训练：用 trainOne 做反向传播 */
    for (let epoch = 0; epoch < EPOCHS; epoch++) {
        let mistakes = 0;
        for (let i = 0; i < trN; i++) {
            const src = idx[i];
            const off = src * dim;
            const feat = new Int8Array(dim);
            for (let j = 0; j < dim; j++) feat[j] = X[off + j];
            trainOne(feat, Y[src], LR);
        }

        /* 验证集准确率 */
        let correct = 0;
        for (let i = trN; i < n; i++) {
            const src = idx[i];
            const off = src * dim;
            const feat = new Int8Array(dim);
            for (let j = 0; j < dim; j++) feat[j] = X[off + j];
            const logits = forward(feat);
            if (logits) {
                let maxIdx = 0, maxVal = -Infinity;
                for (let k = 0; k < 6; k++) {
                    if (logits[k] > maxVal) { maxVal = logits[k]; maxIdx = k; }
                }
                if (maxIdx === Y[src]) correct++;
            }
        }
        const acc = correct / valN;

        /* 每 10 轮输出一次 */
        if (epoch % 10 === 0) {
            try { console.log('[训练] epoch=' + epoch + ' acc=' + (acc * 100).toFixed(1) + '%'); } catch (e) {}
        }
    }

    /* ★ 保存权重 */
    const finalAcc = 0; // TODO: 用验证集准确率
    try {
        setAccuracy(finalAcc);
        markReady(true);
        saveWeights();
    } catch (e) {}

    const meta = getMeta();
    return {
        ok: true,
        accuracy: Math.round(finalAcc * 1e4) / 1e4,
        posRatio: Math.round(posCount / n * 1e4) / 1e4,
        samples: n,
        epochs: EPOCHS,
        trained: meta.trained,
        ms: Math.round(performance.now() - t0),
    };
}

/* 挂到全局方便控制台调试 */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.trainLocalAsync = trainLocalAsync;
    window.__DJSC.isTraining = isTraining;
    window.__DJSC.lastResult = lastResult;
}
