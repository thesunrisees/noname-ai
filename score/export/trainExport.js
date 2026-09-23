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
        return exportAsJsonl({ dropViolations: true, minReward: -50 });
    } catch (e) { return '{"err":"' + String(e) + '"}'; }
}

/* ★ 第3层：带过滤的导出 */
export function exportAsJsonl(options) {
    options = options || {};
    const dropViolations = options.dropViolations !== false;   // 默认丢弃
    const minReward = typeof options.minReward === 'number' ? options.minReward : -50;

    const lines = [];
    let total = 0, dropped = 0, rewardDropped = 0;

    for (const s of BUFFER) {
        total++;

        /* ① 违规样本丢弃 */
        if (dropViolations && s.m && s.m.violation) {
            dropped++;
            continue;
        }

        /* ② reward 过低的丢弃 */
        if (typeof s.r === 'number' && s.r < minReward) {
            rewardDropped++;
            continue;
        }

        /* 拼成一行：features + reward + meta */
        const row = {
            features: Array.from(s.f || []),
            reward: s.r || 0,
            meta: s.m || {},
        };
        lines.push(JSON.stringify(row));
    }

    try {
        console.log('[exportJSONL] 总样本 ' + total +
                    '，丢弃违规 ' + dropped +
                    '，丢弃低分 ' + rewardDropped +
                    '，导出 ' + lines.length);
    } catch (e) {}

    /* 返回 jsonl 字符串 */
    const result = lines.join('\n');

    /* 同时返回统计 */
    try {
        const meta = {
            v: 2,
            dim: (BUFFER[0] ? BUFFER[0].f.length : 0),
            exportedAt: Date.now(),
            count: lines.length,
            total: total,
            droppedViolation: dropped,
            droppedLowReward: rewardDropped,
            stats: { count: lines.length },
        };
        return JSON.stringify(meta) + '\n' + result;
    } catch (e) {
        return result;
    }
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

export function trainRecordSample(me, best, sit, score, features) {
    try {
        if (!me || !best) return;

        /* ★ 第2层：读取违规标记 */
        let violation = false;
        let violationInfo = null;
        try {
            if (_status && _status.djsc_lastViolation) {
                const v = _status.djsc_lastViolation;
                if (v && (Date.now() - v.ts) < 5000) {
                    violation = true;
                    violationInfo = { type: v.type, card: v.card, target: v.target };
                }
            }
        } catch (e) {}

        /* ★ 用真实特征（从 engine.js 传入的 best._feat），如果没有就用96维全0占位 */
        const f = features && features.length ? features : new Array(96).fill(0);

        pushSample(f, score | 0, {
            player: me.name || me.name1 || '?',
            action: best.type || 'unknown',
            id: best.id || '',
            score: Math.round(score || 0),
            violation: violation,
            violationType: violationInfo ? violationInfo.type : null,
            violationCard: violationInfo ? violationInfo.card : null,
            violationTarget: violationInfo ? violationInfo.target : null,
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
