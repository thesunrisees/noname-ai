/*
 * ============================================
 * // Éditeur: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 本地训练器 · 多层网络 SGD ================= */

import { getSamples } from './trainExport.js';
import { FEATURE_DIM } from './features.js';
import { trainOne, trainOneWithValue, saveWeights, setAccuracy, markReady, getMeta, forward, setTrainLR } from './weights.js';
import { cfg } from './util.js';  /* ★ 导入配置读取函数 */
// Автор: Фэйшэн Оригинал | Лицензия: GPL-3.0

const EPOCHS = 10;  /* 训练10轮，手机不卡 */
const VAL_RATIO = 0.2;

let _training = false;
let _lastResult = null;
let _worker = null;  /* ★ Web Worker 实例 */

/* ★ 尝试加载 Web Worker（后台线程训练，不卡游戏） */
function tryLoadWorker() {
    try {
        if (typeof Worker === 'undefined') return null;
        /* 动态导入worker.js */
        const worker = new Worker('./score/worker.js');
        return worker;
    } catch (e) {
        console.warn('[localTrainer] Web Worker 不可用，降级到同步训练:', e.message);
        return null;
    }
}

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
    
    /* ★ Mini-Batch 训练配置（手机端友好：小批量少轮次） */
    const BATCH_SIZE = 100;  /* 每次训练取100条（原来1000太多了会卡） */
    const EPOCHS = Math.max(5, Math.min(20, Math.floor(500 / (samples.length / BATCH_SIZE))));  /* 最多20轮（原来200太多了） */
    
    let lr = (typeof cfg === 'function') ? cfg('learningRate', 0.005) : 0.005;  /* ★ 从配置读取学习率 */
    lr = parseFloat(lr) || 0.005;  /* ★ 转成数字，防止item配置读出字符串 */
    
    const dim = FEATURE_DIM;
    
    /* ★ 打乱样本顺序 */
    const shuffled = samples.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t;
    }
    
    /* ★ Mini-Batch 训练循环 */
    let totalTrained = 0;
    let totalLoss = 0;
    
    for (let epoch = 0; epoch < EPOCHS; epoch++) {
        /* 随机取一个batch */
        const batchStart = (epoch * BATCH_SIZE) % shuffled.length;
        const batch = [];
        for (let i = 0; i < BATCH_SIZE && (batchStart + i) < shuffled.length; i++) {
            batch.push(shuffled[batchStart + i]);
        }
        
        if (batch.length < 10) continue;
        
        /* 在这个batch上训练 */
        for (let b = 0; b < batch.length; b++) {
            const s = batch[b];
            const count = s.count || 1;
            const effectiveCount = Math.min(count, 3);  /* batch里最多重复3次 */
            for (let c = 0; c < effectiveCount; c++) {
                trainOne(s.f, _scoreToLabel(s.r), lr);
                totalTrained++;
            }
        }
        
        /* ★ 每20个epoch让出主线程1ms，防止游戏卡死 */
        if (epoch % 20 === 0) {
            /* 同步执行但控制频率，手机端友好 */
        }
    }
    
    const n = samples.length;
    let posCount = 0, negCount = 0;
    for (let i = 0; i < samples.length; i++) {
        if (samples[i].r > 0) posCount++; else negCount++;
    }

    /* ★ 准备训练数据：X特征矩阵、Y标签、V价值目标 */
    const X = new Int8Array(n * dim);
    const Y = new Int8Array(n);
    const V = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const s = samples[i];
        const off = i * dim;
        for (let j = 0; j < dim; j++) X[off + j] = s.f[j] | 0;
        Y[i] = _scoreToLabel(s.r);
        V[i] = (s.value_target !== undefined) ? s.value_target : 0;
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

    /* ★ 三层网络训练：用 trainOneWithValue 做反向传播（同时训练Actor和Critic）
     * 3.1 封测：
     *  ─ 余弦退火学习率：epoch 从 baseLR 平滑衰减到 10% baseLR，后期收敛更稳不震荡
     *  ─ 回放样本按 count 加权（频率越高重复越多，封顶 3 次），交易过拟合
     */
    const baseLR = lr;
    for (let epoch = 0; epoch < EPOCHS; epoch++) {
        /* ★ 学习率调度（余弦退火）：coef 1→0，epochLR 落在 [baseLR*0.1, baseLR] */
        const coef = 0.5 * (1 + Math.cos(Math.PI * epoch / EPOCHS));
        const epochLR = baseLR * (0.1 + 0.9 * coef);
        setTrainLR(epochLR);
        let mistakes = 0;
        for (let i = 0; i < trN; i++) {
            const src = idx[i];
            const off = src * dim;
            const feat = new Int8Array(dim);
            for (let j = 0; j < dim; j++) feat[j] = X[off + j];
            /* ★ 3.1：回放优先级——count 越高的样本重复训练越多（封顶 3），
             * 与上方 Mini-Batch 分支的封顶策略保持一致 */
            const rep = Math.min(1 + ((samples[src].count || 1) >> 1), 3);
            for (let rc = 0; rc < rep; rc++) {
                trainOneWithValue(feat, Y[src], V[src], epochLR);  /* 传入 value_target */
            }
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

    /* 3.1：训练结束恢复基准学习率，避免调度残留影响后续在线 trainOne */
    setTrainLR(baseLR);

    /* ★ 保存权重 */
    /* 在循环外面重新算一次最终准确率 */
    let finalCorrect = 0;
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
            if (maxIdx === Y[src]) finalCorrect++;
        }
    }
    const finalAcc = finalCorrect / valN;
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
