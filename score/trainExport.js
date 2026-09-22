/* ================= 训练数据缓冲 ================= */

const MAX_SAMPLES = 3000;
let BUFFER = [];
let _exportCount = 0;

export function pushSample(features, reward, meta) {
    if (BUFFER.length >= MAX_SAMPLES) return false;
    const arr = new Array(features.length);
    for (let i = 0; i < features.length; i++) arr[i] = features[i] | 0;
    BUFFER.push({ f: arr, r: reward | 0, m: meta || null });
    return true;
}

export function bufferSize() { return BUFFER.length; }
export function bufferClear() { BUFFER = []; }
export function resetAll() { BUFFER = []; _exportCount = 0; }
export function getSamples() { return BUFFER; }
export function isFull() { return BUFFER.length >= MAX_SAMPLES; }

export function exportAsJson() {
    try {
        const samples = new Array(BUFFER.length);
        for (let i = 0; i < BUFFER.length; i++) {
            const s = BUFFER[i];
            const row = new Array(s.f.length + 1);
            for (let j = 0; j < s.f.length; j++) row[j] = s.f[j];
            row[s.f.length] = s.r;
            samples[i] = row;
        }
        const meta = {
            v: 2,
            dim: (samples[0] ? samples[0].length - 1 : 0),
            exportedAt: Date.now(),
            count: samples.length,
            samples: samples,
        };
        /* ★ 附带校准/认知/冲突元数据 */
        try {
            const cal = window.__DJSC && window.__DJSC.calibrator;
            if (cal && cal.stats) meta.calibration = cal.stats();
            const cf = window.__DJSC && window.__DJSC.conflict && window.__DJSC.conflict.stats;
            if (cf) meta.conflictStats = cf();
            const cl = window.__DJSC && window.__DJSC.cognitionLog && window.__DJSC.cognitionLog.stats;
            if (cl) meta.cognitionStats = cl();
            const meta2 = window.__DJSC && window.__DJSC.metaCognition && window.__DJSC.metaCognition.stats;
            if (meta2) meta.metaStats = meta2();
        } catch (e) {}
        return JSON.stringify(meta);
    } catch (e) { return '{"err":"' + String(e) + '"}'; }
}

export function downloadJson() {
    try {
        const json = exportAsJson();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'djsc_training_' + Date.now() + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        _exportCount++;
        return { ok: true, size: (json.length / 1024).toFixed(1) + 'KB', count: BUFFER.length };
    } catch (e) {
        return { ok: false, err: String(e) };
    }
}

export function exportStats() { return { count: BUFFER.length, max: MAX_SAMPLES, exports: _exportCount }; }

/* ================= 训练钩子 ================= */
let _gameStart = null;

export function trainStartGame(me) {
    try {
        _gameStart = {
            time: Date.now(),
            player: me ? (me.name || me.name1 || '?') : '?',
        };
    } catch (e) {}
}

export function trainRecordSample(me, best, sit, score) {
    try {
        if (!me || !best) return;
        /* 记录一条样本占位 */
        pushSample(new Array(48).fill(0), score | 0, {
            player: me.name || me.name1 || '?',
            action: best.type || 'unknown',
            id: best.id || '',
            score: Math.round(score || 0),
        });
    } catch (e) {}
}

export function trainSettleGame(me, won) {
    try {
        _gameStart = null;
    } catch (e) {}
}

/* ================= 面板接口 ================= */
export function trainClearBuffer() {
    bufferClear();
    return { ok: true, count: 0 };
}

export function trainStats() {
    return exportStats();
}

export function trainExportAndDownload() {
    return downloadJson();
}
