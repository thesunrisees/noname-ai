/* ================= 决策积分引擎 · 一键导出打包 =================
 * 三种导出模式：
 *   ① 最小蒸馏包（train.jsonl + manifest.json + weights.djscw + meta.json）
 *   ② 完整训练包（A+B+C1+C5）
 *   ③ 全量备份包（24 个单元一键还原）
 * 导出路径：无名AI/data/output/
 * 导入路径：无名AI/data/input/
 */
import { lib, game, get, _status } from '../../../noname.js';
import { log } from './logger.js';
import { FEATURE_NAMES, FEATURE_DIM } from './features.js';
import { getWeights, getBias, getMeta as getWeightMeta, isReady } from './weights.js';
import { getSamples, bufferSize, bufferClear } from './trainExport.js';

const OUTPUT_DIR = 'extension/无名AI/data/output/';
const INPUT_DIR = 'extension/无名AI/data/input/';

/* ================= 自动导出配置 ================= */
const AUTO_KEY = 'djsc_auto_export_v1';
let _autoCfg = null;

function _loadAutoCfg() {
    if (_autoCfg) return _autoCfg;
    try {
        const raw = localStorage.getItem(AUTO_KEY);
        _autoCfg = raw ? JSON.parse(raw) : { enabled: false, interval: 10, type: 'distill', lastExport: 0, gameCount: 0 };
    } catch (e) {
        _autoCfg = { enabled: false, interval: 10, type: 'distill', lastExport: 0, gameCount: 0 };
    }
    return _autoCfg;
}
function _saveAutoCfg() {
    try { localStorage.setItem(AUTO_KEY, JSON.stringify(_autoCfg)); } catch (e) {}
}

/* 每局结束后调用，检查是否该自动导出 */
export function autoExportCheck() {
    try {
        const cfg = _loadAutoCfg();
        if (!cfg.enabled) return;
        cfg.gameCount++;
        if (cfg.gameCount >= cfg.interval) {
            cfg.gameCount = 0;
            cfg.lastExport = Date.now();
            _saveAutoCfg();
            if (cfg.type === 'distill') exportDistillPackage();
            else if (cfg.type === 'fulltrain') exportFullTrainingPackage();
            else if (cfg.type === 'backup') exportFullBackup();
            log.info('autoExport', '自动导出完成（类型：' + cfg.type + '）');
        }
    } catch (e) {}
}

export function getAutoExportConfig() {
    return _loadAutoCfg();
}

export function setAutoExportConfig(cfg) {
    _autoCfg = Object.assign(_loadAutoCfg(), cfg);
    _saveAutoCfg();
    return _autoCfg;
}

/* ================= 工具函数 ================= */
function _safe(fn, fallback) {
    try { return fn(); } catch (e) { return fallback !== undefined ? fallback : null; }
}
function _b64Encode(arr) {
    try {
        let s = '';
        for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i] & 0xff);
        return btoa(s);
    } catch (e) { return ''; }
}
function _lsGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}
function _lsKeys() {
    const out = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.indexOf('djsc_') === 0 || k.indexOf('无名AI_') === 0)) out.push(k);
        }
    } catch (e) {}
    return out;
}

/* ================= ① 最小蒸馏包（纯 .jsonl 导出） ================= */
export function exportDistillPackage() {
    try {
        const samples = getSamples();
        const lines = [];
        let total = 0, droppedViolation = 0, droppedLowReward = 0;

        for (const s of samples) {
            total++;

            /* ★ 第3层过滤：丢弃违规样本 */
            if (s.m && s.m.violation) {
                droppedViolation++;
                continue;
            }

            /* ★ 第3层过滤：丢弃低分样本 */
            if (typeof s.r === 'number' && s.r < -50) {
                droppedLowReward++;
                continue;
            }

            const row = {
                features: s.f ? s.f.slice() : [],
                reward: s.r || 0,
                meta: s.m || {},
            };
            if (s.logits) row.teacher_logits = s.logits;
            if (s.probs) row.teacher_probs = s.probs;
            lines.push(JSON.stringify(row));
        }

        const jsonl = lines.join('\n');
        const ts = Date.now();

        /* 导出 train.jsonl（纯 jsonl 格式，Python 可直接读） */
        game.writeFile(jsonl, OUTPUT_DIR, 'train_' + ts, function () {
            /* 同时导出 manifest.json */
            const manifest = {
                version: 1,
                exportedAt: new Date().toISOString(),
                featureDim: FEATURE_DIM,
                sampleCount: lines.length,
                totalSamples: total,
                droppedViolation: droppedViolation,
                droppedLowReward: droppedLowReward,
                featureNames: FEATURE_NAMES.slice(),
                labels: ['A', 'B', 'C', 'D', 'E', 'F'],
                structure: { input: FEATURE_DIM, hidden: 64, output: 6, type: 'int8_mlp', scale: 32 },
            };
            game.writeFile(JSON.stringify(manifest, null, 2), OUTPUT_DIR, 'manifest_' + ts, function () {
                /* 同时导出 weights.djscw */
                try {
                    const W1 = getWeights();
                    const B1 = getBias();
                    const meta = getWeightMeta();
                    const wdata = {
                        v: meta.v || 3,
                        trained: meta.trained || 0,
                        accuracy: meta.accuracy || 0,
                        ready: !!meta.ready,
                        w1: _b64Encode(W1),
                        b1: _b64Encode(B1),
                    };
                    game.writeFile(JSON.stringify(wdata), OUTPUT_DIR, 'weights_' + ts, function () {
                        _showExportResult(
                            '✅ 蒸馏包已导出（纯 .jsonl）',
                            OUTPUT_DIR + 'train_' + ts + '.jsonl',
                            lines.length + ' 条样本（丢弃违规 ' + droppedViolation + ' / 低分 ' + droppedLowReward + '）'
                        );
                    });
                } catch (e) {
                    _showExportResult('✅ 蒸馏包已导出', OUTPUT_DIR + 'train_' + ts + '.jsonl', lines.length + ' 条样本');
                }
            });
        });

        return { ok: true, samples: lines.length, total: total, droppedViolation, droppedLowReward };
    } catch (e) {
        return { ok: false, err: e.message };
    }
}

/* ================= ② 完整训练包 ================= */
function _buildFullTrainingPackage() {
    /* 直接构造蒸馏包数据（不调用已删除的 _buildDistillPackage） */
    const samples = getSamples();
    const distillSamples = [];
    for (const s of samples) {
        if (s.m && s.m.violation) continue;
        if (typeof s.r === 'number' && s.r < -50) continue;
        const row = { features: s.f ? s.f.slice() : [], reward: s.r || 0, meta: s.m || {} };
        if (s.logits) row.teacher_logits = s.logits;
        if (s.probs) row.teacher_probs = s.probs;
        distillSamples.push(row);
    }

    const W1 = _safe(getWeights, []);
    const B1 = _safe(getBias, []);
    const weightMeta = _safe(getWeightMeta, {});

    return {
        meta: { version: 1, exportedAt: new Date().toISOString(), type: 'full_training' },
        distill: {
            meta: { version: 1, featureDim: FEATURE_DIM, sampleCount: distillSamples.length },
            manifest: { featureNames: FEATURE_NAMES.slice(), labels: ['A','B','C','D','E','F'], structure: { input: FEATURE_DIM, hidden: 64, output: 6 } },
            weights: { v: weightMeta.v||3, trained: weightMeta.trained||0, accuracy: weightMeta.accuracy||0, ready: !!weightMeta.ready, w1: _b64Encode(W1), b1: _b64Encode(B1) },
            train: distillSamples,
        },
        metacog: _safe(() => JSON.parse(_lsGet('djsc_metacog_v1') || '{}')),
        calibrator: _safe(() => JSON.parse(_lsGet('djsc_calibrator_v1') || '{}')),
        multiProfile: _safe(() => JSON.parse(_lsGet('djsc_multi_profile_v1') || '{}')),
        archive: _safe(() => JSON.parse(_lsGet('无名AI_archive') || '[]')),
    };
}

/* ================= ③ 全量备份包 ================= */
function _buildFullBackup() {
    const keys = _lsKeys();
    const data = {};
    for (const k of keys) data[k] = _lsGet(k);
    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        device: { ua: navigator.userAgent, screen: window.screen ? (window.screen.width + 'x' + window.screen.height) : '' },
        data: data,
    };
}

/* ================= 导出（game.writeFile） ================= */

/* ★ 鸿蒙兼容：带 fallback 的文件写入 */
function _safeWriteFile(content, dir, filename, onSuccess, onFail) {
    try {
        if (typeof game !== 'undefined' && game.writeFile) {
            game.writeFile(content, dir, filename, function () {
                if (onSuccess) onSuccess();
            });
        } else {
            throw new Error('game.writeFile 不可用');
        }
    } catch (e) {
        /* fallback：存到 localStorage */
        try {
            const key = 'djsc_export_' + filename;
            localStorage.setItem(key, content);
            if (onFail) onFail('文件系统不可用，已存到 localStorage（键：' + key + '）');
        } catch (e2) {
            if (onFail) onFail('导出失败：' + e.message);
        }
    }
}

export function exportFullTrainingPackage() {
    const pkg = _buildFullTrainingPackage();
    const json = JSON.stringify(pkg, null, 2);
    const filename = '完整训练包_' + Date.now();
    _safeWriteFile(json, OUTPUT_DIR, filename,
        function () {
            _showExportResult('✅ 完整训练包已导出', OUTPUT_DIR + filename, '含蒸馏+元认知+校准器+战报');
        },
        function (msg) {
            _showExportResult('⚠️ 完整训练包已导出（本地存储）', 'localStorage: djsc_export_' + filename, msg);
        }
    );
    return { ok: true };
}

export function exportFullBackup() {
    const pkg = _buildFullBackup();
    const json = JSON.stringify(pkg, null, 2);
    const filename = '全量备份_' + Date.now();
    _safeWriteFile(json, OUTPUT_DIR, filename,
        function () {
            _showExportResult('✅ 全量备份包已导出', OUTPUT_DIR + filename, Object.keys(pkg.data).length + ' 个键');
        },
        function (msg) {
            _showExportResult('⚠️ 全量备份包已导出（本地存储）', 'localStorage: djsc_export_' + filename, msg);
        }
    );
    return { ok: true };
}

/* 在面板里显示导出结果 */
function _showExportResult(title, path, detail) {
    const el = document.getElementById('djsc-export-result');
    if (!el) return;
    el.innerHTML = '<div style="background:#0f2a1e; border:1px solid #2a6; border-radius:6px; padding:10px; margin:10px 0;">' +
        '<div style="color:#7fe3a0; font-weight:bold; margin-bottom:4px;">' + title + '</div>' +
        '<div style="color:#a8b8c8; font-size:11px; word-break:break-all; margin-bottom:4px;">📁 ' + path + '</div>' +
        '<div style="color:#888; font-size:11px;">' + detail + '</div>' +
        '</div>';
    /* 自动刷新文件列表 */
    setTimeout(_refreshFileLists, 500);
}

/* ================= 导入还原 ================= */
export function importBackup(filename) {
    game.readFileAsText(INPUT_DIR + filename, function (data) {
        try {
            const pkg = JSON.parse(data);
            if (!pkg || !pkg.data) { alert('❌ 格式错误'); return; }
            let restored = 0;
            for (const k of Object.keys(pkg.data)) {
                try { localStorage.setItem(k, pkg.data[k]); restored++; } catch (e) {}
            }
            alert('✅ 导入完成（还原 ' + restored + ' 个键）\n刷新游戏后生效');
        } catch (e) {
            alert('❌ 解析失败：' + e.message);
        }
    });
}

/* ================= 列出导出文件 ================= */
export function listExportedFiles() {
    return new Promise(function (resolve) {
        game.getFileList(OUTPUT_DIR, function (folders, files) {
            resolve(files || []);
        }, function () {
            resolve([]);
        });
    });
}

export function listImportableFiles() {
    return new Promise(function (resolve) {
        game.getFileList(INPUT_DIR, function (folders, files) {
            resolve(files || []);
        }, function () {
            resolve([]);
        });
    });
}

/* ================= 面板 UI ================= */
export function openExportPanel() {
    const html = _buildPanelHtml();
    let dlg = null;
    try { dlg = ui.create.dialog('数据导出中心'); } catch (e) {}
    if (!dlg) { _openOverlayPanel('数据导出中心', html); return; }
    try {
        dlg.classList.add('fullheight');
        dlg.style.width = 'min(92vw, 640px)';
        dlg.style.maxWidth = '92vw';
        dlg.style.left = '4vw';
    } catch (e) {}
    const d = document.createElement('div');
    d.innerHTML = html;
    dlg.content.appendChild(d);
    setTimeout(_bindExportButtons, 50);
}

function _buildPanelHtml() {
    const sampleN = bufferSize();
    const weightReady = isReady();
    const lsKeys = _lsKeys().length;

    let h = '<div style="font-size:12px; color:#dbe7f5; padding:10px; line-height:1.8;">';

    h += '<div style="background:rgba(154,216,255,0.08); border-radius:6px; padding:10px; margin-bottom:12px;">';
    h += '<div style="color:#9ad8ff; font-weight:bold; margin-bottom:6px;">📊 当前数据概览</div>';
    h += '<div>训练样本：<b style="color:#7fe3a0;">' + sampleN + '</b> 条</div>';
    h += '<div>模型权重：' + (weightReady ? '<b style="color:#7fe3a0;">已就绪</b>' : '<b style="color:#ff9c9c;">未就绪</b>') + '</div>';
    h += '<div>localStorage 键：' + lsKeys + ' 个</div>';
    h += '<div style="color:#888; font-size:11px; margin-top:4px;">导出路径：' + OUTPUT_DIR + '</div>';
    h += '</div>';

    /* 导出按钮 */
    h += '<div style="margin-bottom:12px;">';
    h += '<div style="color:#9ad8ff; font-weight:bold; margin-bottom:6px;">📦 导出到 data/output/</div>';

    /* 导出结果显示区 */
    h += '<div id="djsc-export-result" style="margin-bottom:8px;"></div>';

    /* 一键全量导出 */
    h += '<div style="background:#2a1e3e; border:1px solid #6a4a9a; border-radius:6px; padding:10px; margin-bottom:8px;">';
    h += '<div style="color:#c9aaff; font-weight:bold;">⚡ 一键全量导出</div>';
    h += '<div style="color:#a8b8c8; font-size:11px; margin:4px 0;">点一下自动导出全部 3 个包，无需其他操作</div>';
    h += '<div style="color:#888; font-size:10px; margin:2px 0;">保存到：' + OUTPUT_DIR + '</div>';
    h += '<button id="djsc-export-all" style="background:linear-gradient(135deg,#c9aaff,#6a4a9a); color:#fff; border:none; padding:8px 16px; border-radius:4px; cursor:pointer; margin-top:4px; font-weight:bold;">一键导出全部</button>';
    h += '</div>';

    h += '<div style="color:#888; font-size:11px; margin:8px 0; text-align:center;">—— 或单独导出 ——</div>';

    h += '<div style="background:#1e2a3e; border-radius:6px; padding:10px; margin-bottom:8px;">';
    h += '<div style="color:#7fe3a0; font-weight:bold;">① 最小蒸馏包</div>';
    h += '<div style="color:#a8b8c8; font-size:11px; margin:4px 0;">训练样本 + 特征清单 + 权重 → 直接喂给 Python 蒸馏</div>';
    h += '<div style="color:#888; font-size:10px; margin:2px 0;">保存到：' + OUTPUT_DIR + '蒸馏包_时间戳</div>';
    h += '<button id="djsc-export-distill" style="background:linear-gradient(135deg,#7fe3a0,#2a6); color:#fff; border:none; padding:6px 14px; border-radius:4px; cursor:pointer; margin-top:4px;">导出</button>';
    h += '</div>';

    h += '<div style="background:#1e2a3e; border-radius:6px; padding:10px; margin-bottom:8px;">';
    h += '<div style="color:#ffd479; font-weight:bold;">② 完整训练包</div>';
    h += '<div style="color:#a8b8c8; font-size:11px; margin:4px 0;">蒸馏包 + 元认知 + 校准器 + 多档案 + 战报</div>';
    h += '<div style="color:#888; font-size:10px; margin:2px 0;">保存到：' + OUTPUT_DIR + '完整训练包_时间戳</div>';
    h += '<button id="djsc-export-fulltrain" style="background:linear-gradient(135deg,#ffd479,#c58b22); color:#fff; border:none; padding:6px 14px; border-radius:4px; cursor:pointer; margin-top:4px;">导出</button>';
    h += '</div>';

    h += '<div style="background:#1e2a3e; border-radius:6px; padding:10px;">';
    h += '<div style="color:#9ad8ff; font-weight:bold;">③ 全量备份包</div>';
    h += '<div style="color:#a8b8c8; font-size:11px; margin:4px 0;">所有 localStorage 数据 → 一键还原到另一台设备</div>';
    h += '<div style="color:#888; font-size:10px; margin:2px 0;">保存到：' + OUTPUT_DIR + '全量备份_时间戳</div>';
    h += '<button id="djsc-export-backup" style="background:linear-gradient(135deg,#9ad8ff,#4a6a9a); color:#fff; border:none; padding:6px 14px; border-radius:4px; cursor:pointer; margin-top:4px;">导出</button>';
    h += '</div>';
    h += '</div>';

    /* 已导出文件列表 */
    h += '<div style="margin-bottom:12px;">';
    h += '<div style="color:#9ad8ff; font-weight:bold; margin-bottom:6px;">📁 已导出文件（data/output/）</div>';
    h += '<div id="djsc-exported-list" style="background:#1e2a3e; border-radius:6px; padding:10px; min-height:40px;">';
    h += '<div style="color:#888; font-size:11px;">加载中...</div>';
    h += '</div>';
    h += '</div>';

    /* 导入 */
    h += '<div style="margin-bottom:12px;">';
    h += '<div style="color:#9ad8ff; font-weight:bold; margin-bottom:6px;">📥 从 data/input/ 导入</div>';
    h += '<div style="background:#1e2a3e; border-radius:6px; padding:10px;">';
    h += '<div id="djsc-import-list" style="margin-bottom:8px;">';
    h += '<div style="color:#888; font-size:11px;">加载中...</div>';
    h += '</div>';
    h += '<div style="color:#888; font-size:11px; margin-top:4px;">把备份文件放到 无名AI/data/input/ 目录下</div>';
    h += '</div>';
    h += '</div>';

    /* 清空 */
    h += '<div style="text-align:center; border-top:1px solid #2a3a5a; padding-top:10px;">';
    h += '<button id="djsc-export-clear" style="background:#666; color:#fff; border:none; padding:5px 12px; border-radius:4px; cursor:pointer; font-size:11px;">清空训练样本缓冲</button>';
    h += '</div>';

    h += '</div>';
    return h;
}

function _bindExportButtons() {
    /* 导出按钮 */
    const btn1 = document.getElementById('djsc-export-distill');
    if (btn1) btn1.addEventListener('click', exportDistillPackage);

    const btn2 = document.getElementById('djsc-export-fulltrain');
    if (btn2) btn2.addEventListener('click', exportFullTrainingPackage);

    const btn3 = document.getElementById('djsc-export-backup');
    if (btn3) btn3.addEventListener('click', exportFullBackup);

    /* 一键全量导出 */
    const btn0 = document.getElementById('djsc-export-all');
    if (btn0) btn0.addEventListener('click', function () {
        exportDistillPackage();
        setTimeout(exportFullTrainingPackage, 300);
        setTimeout(exportFullBackup, 600);
    });

    /* 清空 */
    const btn5 = document.getElementById('djsc-export-clear');
    if (btn5) btn5.addEventListener('click', function () {
        if (!confirm('确定清空训练样本缓冲？此操作不可恢复！')) return;
        bufferClear();
        alert('✅ 已清空');
        const panels = document.querySelectorAll('.dialog.fullheight');
        if (panels.length) panels[panels.length - 1].remove();
        openExportPanel();
    });

    /* 加载文件列表 */
    _refreshFileLists();
}

function _refreshFileLists() {
    /* 已导出 */
    listExportedFiles().then(function (files) {
        const el = document.getElementById('djsc-exported-list');
        if (!el) return;
        if (!files.length) { el.innerHTML = '<div style="color:#888; font-size:11px;">暂无文件</div>'; return; }
        let html = '';
        files.forEach(function (f) {
            html += '<div style="padding:4px 0; border-bottom:1px dashed #2a3a5a; font-size:11px;">';
            html += '<span style="color:#7fe3a0;">📄</span> ' + f;
            html += '</div>';
        });
        el.innerHTML = html;
    });

    /* 可导入 */
    listImportableFiles().then(function (files) {
        const el = document.getElementById('djsc-import-list');
        if (!el) return;
        if (!files.length) { el.innerHTML = '<div style="color:#888; font-size:11px;">暂无文件（把备份文件放到 input/ 目录）</div>'; return; }
        let html = '';
        files.forEach(function (f) {
            html += '<div style="padding:4px 0; border-bottom:1px dashed #2a3a5a;">';
            html += '<span style="color:#9ad8ff; margin-right:8px;">📄</span>' + f;
            html += '<button class="djsc-import-btn" data-file="' + f + '" style="background:#c58b22; color:#fff; border:none; padding:3px 10px; border-radius:3px; cursor:pointer; font-size:11px; float:right;">导入</button>';
            html += '</div>';
        });
        el.innerHTML = html;
        /* 绑定导入按钮 */
        el.querySelectorAll('.djsc-import-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const f = this.getAttribute('data-file');
                if (confirm('确定导入 ' + f + '？这会覆盖当前所有数据！')) {
                    importBackup(f);
                }
            });
        });
    });
}

/* 全屏遮罩降级 */
function _openOverlayPanel(title, html) {
    const mask = document.createElement('div');
    mask.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:99999; display:flex; align-items:center; justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#1a2438; border-radius:8px; width:min(92vw,640px); max-height:90vh; overflow-y:auto; padding:16px; color:#dbe7f5;';
    box.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;"><span style="font-size:14px; font-weight:bold; color:#9ad8ff;">' + title + '</span><button onclick="this.parentElement.parentElement.parentElement.remove()" style="background:none; border:none; color:#888; font-size:18px; cursor:pointer;">✕</button></div>' + html;
    mask.appendChild(box);
    document.body.appendChild(mask);
    setTimeout(_bindExportButtons, 50);
}

/* ================= 挂载 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.export = {
        distill: exportDistillPackage,
        fullTrain: exportFullTrainingPackage,
        backup: exportFullBackup,
        import: importBackup,
        listExported: listExportedFiles,
        listImportable: listImportableFiles,
        panel: openExportPanel,
    };
    window.__DJSC.openExportPanel = openExportPanel;
}
