/*
 * ============================================
 * // 作者: 飞升原创
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 训练数据缓冲（3万样本极限版） ================= */

const MAX_SAMPLES = 30000;  /* ★ 手机端极限：拉到3万样本 */
const STORAGE_KEY = 'djsc_training_samples_v1';

/* ★ IndexedDB 封装（替换 localStorage，支持3万+样本） */
// 作者：飞升原创 | License: GPL-3.0
const DB_NAME = 'djsc_ai_db';
const DB_STORE = 'samples';
let _dbReady = false;

function initDB() {
    return new Promise((resolve) => {
        try {
            if (typeof indexedDB === 'undefined') { resolve(false); return; }
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = (e) => {
                const d = e.target.result;
                if (!d.objectStoreNames.contains(DB_STORE)) {
                    d.createObjectStore(DB_STORE, { autoIncrement: true });
                }
            };
            req.onsuccess = (e) => { _dbReady = true; resolve(true); };
            req.onerror = () => { resolve(false); };
        } catch (e) { resolve(false); }
    });
}

/* ★ 异步保存单条样本到 IndexedDB */
function saveSampleAsync(sample) {
    return new Promise((resolve) => {
        if (!_dbReady) { resolve(false); return; }
        try {
            const req = indexedDB.open(DB_NAME, 1);
            req.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction(DB_STORE, 'readwrite');
                tx.objectStore(DB_STORE).add(sample);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            };
        } catch (e) { resolve(false); }
    });
}

/* ★ 从 IndexedDB 读取所有样本 */
function getAllSamplesAsync() {
    return new Promise((resolve) => {
        if (!_dbReady) { resolve([]); return; }
        try {
            const req = indexedDB.open(DB_NAME, 1);
            req.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction(DB_STORE, 'readonly');
                const r = tx.objectStore(DB_STORE).getAll();
                r.onsuccess = () => resolve(r.result || []);
                r.onerror = () => resolve([]);
            };
        } catch (e) { resolve([]); }
    });
}

/* ★ 启动时初始化 IndexedDB */
initDB();

/* ★ 从 localStorage 加载历史样本（兼容旧版） */
function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
                BUFFER = arr.slice(0, MAX_SAMPLES);
                _keyIndex.clear();
                console.log('[trainExport] ✅ 从本地加载了 ' + BUFFER.length + ' 条历史样本');
            }
        }
    } catch (e) {
        console.warn('[trainExport] 加载历史样本失败：', e);
    }
}

/* ★ 保存样本到 localStorage（防抖优化，避免频繁序列化卡顿） */
let _saveTimer = null;
function saveToStorage() {
    try {
        /* ★ 防抖：1秒内多次调用只保存一次 */
        if (_saveTimer) clearTimeout(_saveTimer);
        _saveTimer = setTimeout(function() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(BUFFER));
            } catch (e) {
                console.warn('[trainExport] 保存样本失败：', e);
            }
        }, 1000);
    } catch (e) {
        console.warn('[trainExport] 保存样本失败：', e);
    }
}

let BUFFER = [];
let _keyIndex = new Map();  /* 特征去重索引：key -> sample，避免每次 push O(N) 重建 join */
let _exportCount = 0;

/* 启动时自动加载历史样本 */
loadFromStorage();

export function pushSample(features, reward, meta) {
    const arr = new Array(features.length);
    for (let i = 0; i < features.length; i++) arr[i] = features[i] | 0;
    
    /* ★ 精确样本合并：特征 + reward + player + action + id 相同才合并 */
    const rewardKey = reward | 0;
    const playerKey = (meta && meta.player) || '';
    const actionKey = (meta && meta.action) || '';
    const idKey = (meta && meta.id) || '';
    /* 用 \u0001 作分隔防止字段拼接碰撞 */
    const key = arr.join(',') + '\u0001' + rewardKey + '\u0001' + playerKey + '\u0001' + actionKey + '\u0001' + idKey;
    
    /* ★ O(1) 命中：直接让已有样本计数+1，不用 O(N) 扫描重建 join */
    const existing = _keyIndex.get(key);
    if (existing !== undefined) {
        existing.count = (existing.count || 1) + 1;  // 计数+1
        existing.ts = Date.now();                     // 更新时间
        saveToStorage();
        return true;
    }
    
    /* ★ 滑动窗口：样本超过上限时，批量删除最旧的 */
    if (BUFFER.length >= MAX_SAMPLES) {
        /* 计算要删除多少条：超出部分 + 缓冲5000条 */
        const overFlow = BUFFER.length - MAX_SAMPLES;
        const toDelete = Math.max(overFlow + 1000, 1000);  /* 至少删1000条 */
        
        /* 按时间排序，删最旧的N条 */
        BUFFER.sort(function (a, b) {
            return (a.ts || 0) - (b.ts || 0);
        });
        BUFFER.splice(0, toDelete);  /* 删最旧的 */
        _keyIndex.clear();           /* 索引失效，下次 push 时重建 */
    }
    
    const sample = {
        f: arr,
        r: reward | 0,
        m: meta || null,
        conf: (meta && meta.conf && !isNaN(meta.conf)) ? meta.conf : 0.3,  /* ★ 存置信度，默认30% */
        value_target: 0,  /* ★ Critic目标价值：游戏结束时回填（赢=+1，输=-1，平=0） */
        count: 1,
        ts: Date.now(),
    };
    BUFFER.push(sample);
    _keyIndex.set(key, sample);
    /* ★ 自动保存到本地 */
    saveToStorage();
    return true;
}

export function bufferSize() { return BUFFER.length; }
export function bufferClear() { BUFFER = []; _keyIndex.clear(); saveToStorage(); }
export function resetAll() { BUFFER = []; _keyIndex.clear(); _exportCount = 0; saveToStorage(); }
export function getSamples() { return BUFFER; }
export function isFull() { return BUFFER.length >= MAX_SAMPLES; }

/* ★ 自动清洗：最新7000条 + 随机3000条 = 总共10000条 */
export function cleanLowValue() {
    try {
        if (BUFFER.length < MAX_SAMPLES * 0.8) return 0;  /* 样本不够多，不清洗 */
        
        /* ★ 按时间排序（最新的在后面） */
        BUFFER.sort(function(a, b) { return (a.ts || 0) - (b.ts || 0); });
        
        const RECENT_COUNT = 7000;   /* 保留最新的7000条 */
        const RANDOM_COUNT = 3000;   /* 从历史里随机选3000条 */
        
        /* 分割成：历史样本 + 最新样本 */
        const recentSamples = BUFFER.slice(-RECENT_COUNT);  /* 最新的7000条 */
        const oldSamples = BUFFER.slice(0, -RECENT_COUNT);   /* 剩下的历史样本 */
        
        /* 从历史样本里随机选3000条 */
        oldSamples.sort(() => Math.random() - 0.5);  /* 打乱 */
        const randomSamples = oldSamples.slice(0, RANDOM_COUNT);
        
        /* 合并：最新7000 + 随机3000 */
        BUFFER = recentSamples.concat(randomSamples);
        _keyIndex.clear();   /* BUFFER 被整体替换，索引重建 */
        
        saveToStorage();
        
        const oldLen = recentSamples.length + oldSamples.length;
        const cleaned = oldLen - BUFFER.length;
        try { log.info('train', '自动清洗完成：最新7000条全保留，历史样本随机选3000条，共删除 ' + cleaned + ' 条，剩余 ' + BUFFER.length + ' 条'); } catch (e) {}
        return cleaned;
    } catch (e) { return 0; }
}

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
        /* ★ 保存到完整路径：extension/无名AI/data/training/ */
        const filename = 'djsc_training_' + Date.now() + '.json';
        const dir = 'extension/无名AI/data/training/';
        game.writeFile(json, dir, filename, function () {
            console.log('[trainExport] ✅ 文件已保存到 ' + dir + filename);
        });
        _exportCount++;
        return { ok: true, size: (json.length / 1024).toFixed(1) + 'KB', count: BUFFER.length, file: dir + filename };
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
            conf: (best && best._conf && !isNaN(best._conf)) ? best._conf : 0.3,  /* ★ 存置信度 */
            violation: violation,
            violationType: violationInfo ? violationInfo.type : null,
            violationCard: violationInfo ? violationInfo.card : null,
            violationTarget: violationInfo ? violationInfo.target : null,
        });
    } catch (e) {}
}

export function trainSettleGame(me, won) {
    try {
        /* ★ 游戏结束：批量回填本局所有样本的value_target */
        const target = won ? 1.0 : -1.0;
        let updated = 0;
        for (let i = 0; i < BUFFER.length; i++) {
            /* 只回填本局的样本（用时间戳判断：最近5分钟内的） */
            const age = Date.now() - (BUFFER[i].ts || 0);
            if (age < 5 * 60 * 1000) {  /* 5分钟内的样本认为是本局的 */
                BUFFER[i].value_target = target;
                updated++;
            }
        }
        if (updated > 0) {
            saveToStorage();
        }
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


/* ============================================
 * ★ 扩展：把所有能接入训练的模块都接入
 * ============================================ */

/* 导入各个模块的训练数据 */
async function collectExtendedTrainingData() {
    const data = {
        /* 对局总结相关 */
        archive: null,
        replay: null,
        report: null,
        feedback: null,
        
        /* 身份与势力相关 */
        identity: null,
        threat: null,
        
        /* 牌堆与手牌相关 */
        deckMemory: null,
        handInference: null,
        
        /* 技能与卡牌相关 */
        skillTags: null,
        cardStrategy: null,
        
        /* 局势与规划相关 */
        situationEval: null,
        multiTurnPlan: null,
        
        /* 对手预测相关 */
        opponentPredict: null,
        
        /* 软指标相关 */
        softMetrics: null,
    };
    
    try {
        /* 尝试从 window.__DJSC 获取数据 */
        if (window.__DJSC) {
            if (window.__DJSC.archive) data.archive = window.__DJSC.archive();
            if (window.__DJSC.replay) data.replay = window.__DJSC.replay();
            if (window.__DJSC.report) data.report = window.__DJSC.report();
            if (window.__DJSC.feedback) data.feedback = window.__DJSC.feedback();
            if (window.__DJSC.identity) data.identity = window.__DJSC.identity();
            if (window.__DJSC.threat) data.threat = window.__DJSC.threat();
            if (window.__DJSC.deckMemory) data.deckMemory = window.__DJSC.deckMemory();
            if (window.__DJSC.handInference) data.handInference = window.__DJSC.handInference();
            if (window.__DJSC.skillTags) data.skillTags = window.__DJSC.skillTags();
            if (window.__DJSC.cardStrategy) data.cardStrategy = window.__DJSC.cardStrategy();
            if (window.__DJSC.situationEval) data.situationEval = window.__DJSC.situationEval();
            if (window.__DJSC.multiTurnPlan) data.multiTurnPlan = window.__DJSC.multiTurnPlan();
            if (window.__DJSC.opponentPredict) data.opponentPredict = window.__DJSC.opponentPredict();
            if (window.__DJSC.softMetrics) data.softMetrics = window.__DJSC.softMetrics();
        }
    } catch (e) {
        console.warn('[trainExport] 收集扩展数据失败：', e);
    }
    
    return data;
}

/* 导出扩展训练数据 */
export async function exportExtendedTrainingData() {
    const extended = await collectExtendedTrainingData();
    return {
        ...extended,
        timestamp: Date.now(),
        version: 'v2.3.25_extended'
    };
}

/* 修改原有的 exportJSONL 函数，加入扩展数据 */
/* 注意：exportJSONL 不存在于当前代码库，此劫持已废弃。
 * 扩展数据通过 collectExtendedTrainingData() 单独导出，见上方。 */

/* ================= ★ 导入功能（合并样本，不覆盖） ================= */
export function importFromJson(jsonStr) {
    try {
        jsonStr = String(jsonStr).trim();
        if (!jsonStr) return { ok: false, err: '文件内容为空' };

        let samples = null;

        /* 第1步：先试直接解析成对象 */
        try {
            const data = JSON.parse(jsonStr);
            if (Array.isArray(data)) {
                samples = data;  // 纯数组格式
            } else if (data.samples && Array.isArray(data.samples)) {
                samples = data.samples;  // { samples: [...] } 格式
            } else if (data.features && Array.isArray(data.features)) {
                samples = [data];  // 单个样本格式
            }
        } catch (e) {}

        /* 第2步：JSONL 逐行解析 */
        if (!samples) {
            samples = [];
            const lines = jsonStr.split('\n').filter(l => l.trim());
            for (const line of lines) {
                try {
                    const obj = JSON.parse(line);
                    if (Array.isArray(obj)) {
                        samples = obj;  // 整行就是数组
                        break;
                    } else if (obj.samples && Array.isArray(obj.samples)) {
                        samples = obj.samples;  // 元数据行
                        break;
                    } else if (obj.f || obj.features) {
                        samples.push(obj);  // 单行样本
                    }
                } catch (e2) {}
            }
        }

        /* 第3步：实在不行，把整个文件当一个大数组找 */
        if (!samples || samples.length === 0) {
            const match = jsonStr.match(/\[\s*\{.*\}\s*\]/s);
            if (match) {
                try { samples = JSON.parse(match[0]); } catch (e3) {}
            }
        }

        if (!samples || !Array.isArray(samples)) {
            return { ok: false, err: '格式错误：找不到样本数组（请确认是导出的训练文件）' };
        }

        let added = 0, merged = 0, skipped = 0;

        for (const s of samples) {
            const featArr = s.f || s.features || s.x;
            if (!featArr || !Array.isArray(featArr)) { skipped++; continue; }
            if (BUFFER.length >= MAX_SAMPLES) { skipped++; continue; }

            const reward = s.r !== undefined ? s.r : (s.reward !== undefined ? s.reward : 0);
            const featKey = featArr.join(',');
            
            let found = false;
            for (let i = 0; i < BUFFER.length; i++) {
                if (BUFFER[i].f.join(',') === featKey) {
                    BUFFER[i].r = Math.round((BUFFER[i].r + reward) / 2);
                    BUFFER[i].count = (BUFFER[i].count || 1) + 1;
                    merged++;
                    found = true;
                    break;
                }
            }

            if (!found) {
                BUFFER.push({ f: featArr, r: reward | 0, m: s.m || s.meta || null, count: 1, ts: Date.now() });
                added++;
            }
        }

        saveToStorage();
        return {
            ok: true,
            added: added,
            merged: merged,
            skipped: skipped,
            total: BUFFER.length,
        };
    } catch (e) {
        return { ok: false, err: '解析失败：' + String(e) };
    }
}

/* 导出成友好格式（方便导入） */
export function exportForImport() {
    return JSON.stringify({
        version: 1,
        exportedAt: Date.now(),
        count: BUFFER.length,
        samples: BUFFER,
    });
}

/* 面板接口 */
export function trainImport(jsonStr) {
    return importFromJson(jsonStr);
}

console.log('[trainExport] ✅ 已接入 14 个扩展训练模块 + 导入/导出功能');
