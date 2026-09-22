/* ================= 决策积分引擎 · 性能分析器 =================
 * 功能：
 *   ① 热点分析：各阶段耗时累计、平均、最大
 *   ② 调用树：按父子关系记录耗时（限深度 5）
 *   ③ 内存监控：localStorage 占用、缓存大小
 *   ④ 优化建议：自动识别瓶颈
 */
import { log } from './logger.js';

const MAX_SAMPLES = 200;
const HISTORY_LIMIT = 100;

/* ================= 数据存储 ================= */
const STATS = {};        /* phase → { total, count, max, min, samples[] } */
const STACK = [];        /* 当前调用栈 */
const TREE = { name: 'root', children: [], total: 0, count: 0 };
let _stackTree = [TREE];
let _enabled = true;

/* ================= 计时核心 ================= */
export function profStart(phase) {
    if (!_enabled) return null;
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const frame = { phase: phase, t0: t0, children: [], parent: null };
    if (_stackTree.length) {
        const parent = _stackTree[_stackTree.length - 1];
        frame.parent = parent;
        if (!parent.children) parent.children = [];
        parent.children.push(frame);
    }
    STACK.push(frame);
    _stackTree.push(frame);
    return t0;
}

export function profEnd(phase) {
    if (!_enabled) return 0;
    const frame = STACK.pop();
    if (!frame) return 0;
    if (_stackTree[_stackTree.length - 1] === frame) _stackTree.pop();
    const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const dt = t1 - frame.t0;

    /* 记录到 STATS */
    if (!STATS[phase]) {
        STATS[phase] = { total: 0, count: 0, max: 0, min: Infinity, samples: [] };
    }
    const s = STATS[phase];
    s.total += dt;
    s.count++;
    if (dt > s.max) s.max = dt;
    if (dt < s.min) s.min = dt;
    s.samples.push(dt);
    if (s.samples.length > MAX_SAMPLES) s.samples.shift();

    /* 更新调用树 */
    if (frame.parent) {
        frame.parent.total += dt;
        frame.parent.count++;
    }
    return dt;
}

/* ================= 一次性包装（推荐使用） ================= */
export function profile(phase, fn) {
    profStart(phase);
    try {
        return fn();
    } finally {
        profEnd(phase);
    }
}

export async function profileAsync(phase, fn) {
    profStart(phase);
    try {
        return await fn();
    } finally {
        profEnd(phase);
    }
}

/* ================= 统计报告 ================= */
export function profilerStats() {
    const out = { phases: [], tree: _serializeTree(TREE), memory: _memoryStats() };

    Object.keys(STATS).forEach(function (phase) {
        const s = STATS[phase];
        out.phases.push({
            phase: phase,
            count: s.count,
            total: Math.round(s.total * 100) / 100,
            avg: s.count > 0 ? Math.round((s.total / s.count) * 100) / 100 : 0,
            max: Math.round(s.max * 100) / 100,
            min: s.min === Infinity ? 0 : Math.round(s.min * 100) / 100,
            p95: _percentile(s.samples, 0.95),
            p99: _percentile(s.samples, 0.99),
        });
    });
    /* 按总耗时降序 */
    out.phases.sort(function (a, b) { return b.total - a.total; });
    /* 优化建议 */
    out.suggestions = _analyzeSuggestions(out.phases);
    return out;
}

function _percentile(arr, p) {
    if (!arr.length) return 0;
    const sorted = arr.slice().sort(function (a, b) { return a - b; });
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
    return Math.round(sorted[idx] * 100) / 100;
}

function _serializeTree(node, depth) {
    if (!node) return null;
    depth = depth || 0;
    if (depth > 4) return { name: node.name, truncated: true };
    /* 合并同名子节点 */
    const childMap = {};
    (node.children || []).forEach(function (c) {
        if (!childMap[c.name]) childMap[c.name] = { name: c.name, children: [], total: 0, count: 0 };
        childMap[c.name].total += c.total || 0;
        childMap[c.name].count += c.count || 0;
        (c.children || []).forEach(function (cc) {
            childMap[c.name].children.push(cc);
        });
    });
    return {
        name: node.name,
        total: Math.round((node.total || 0) * 100) / 100,
        count: node.count || 0,
        children: Object.keys(childMap).map(function (k) {
            return _serializeTree(childMap[k], depth + 1);
        }).sort(function (a, b) { return (b.total || 0) - (a.total || 0); }),
    };
}

function _memoryStats() {
    try {
        let lsTotal = 0, lsCount = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k) continue;
            const v = localStorage.getItem(k) || '';
            lsTotal += k.length + v.length;
            lsCount++;
        }
        return {
            localStorageBytes: lsTotal,
            localStorageKB: Math.round(lsTotal / 1024 * 100) / 100,
            localStorageKeys: lsCount,
        };
    } catch (e) { return {}; }
}

function _analyzeSuggestions(phases) {
    const out = [];
    phases.forEach(function (p) {
        if (p.avg > 100) {
            out.push({
                level: 'error',
                phase: p.phase,
                msg: '平均耗时 ' + p.avg + 'ms 过高（>100ms），建议优化',
            });
        } else if (p.avg > 30) {
            out.push({
                level: 'warn',
                phase: p.phase,
                msg: '平均耗时 ' + p.avg + 'ms 偏高（>30ms），留意',
            });
        }
        if (p.max > 500) {
            out.push({
                level: 'error',
                phase: p.phase,
                msg: '峰值耗时 ' + p.max + 'ms 超 500ms，可能导致卡顿',
            });
        }
    });
    return out;
}

/* ================= 历史快照 ================= */
const HISTORY = [];
export function profilerSnapshot() {
    try {
        const s = profilerStats();
        HISTORY.push({ ts: Date.now(), top: s.phases.slice(0, 5) });
        while (HISTORY.length > HISTORY_LIMIT) HISTORY.shift();
    } catch (e) {}
}
export function profilerHistory() { return HISTORY.slice(); }

/* ================= 控制 ================= */
export function profilerEnable(v) { _enabled = !!v; }
export function profilerEnabled() { return _enabled; }

export function profilerReset() {
    Object.keys(STATS).forEach(function (k) { delete STATS[k]; });
    STACK.length = 0;
    _stackTree.length = 0;
    _stackTree.push(TREE);
    TREE.children = [];
    TREE.total = 0;
    TREE.count = 0;
    HISTORY.length = 0;
    log.info('profiler', '性能分析器已复位');
}

/* ================= 面板渲染 ================= */
export function openProfilerPanel() {
    try {
        const s = profilerStats();
        const html = _buildHtml(s);
        let dlg = null;
        try { dlg = ui.create.dialog('性能分析'); } catch (e) {}
        if (!dlg) { alert('面板打开失败'); return; }
        try {
            dlg.classList.add('fullheight');
            dlg.style.width = 'min(92vw, 720px)';
            dlg.style.maxWidth = '92vw';
            dlg.style.left = '4vw';
        } catch (e) {}
        const d = document.createElement('div');
        d.innerHTML = html;
        dlg.content.appendChild(d);
        setTimeout(_bind, 50);
    } catch (e) { alert('面板异常：' + e.message); }
}

function _buildHtml(s) {
    let h = '<div style="font-size:12px; color:#dbe7f5; padding:8px; line-height:1.7;">';

    /* 内存 */
    h += '<b style="color:#9ad8ff;">📦 内存</b><br>';
    h += '<div style="padding:4px 8px; background:rgba(255,255,255,0.04); border-radius:4px;">';
    h += 'localStorage：' + (s.memory.localStorageKB || 0) + ' KB / ' + (s.memory.localStorageKeys || 0) + ' 个键';
    h += '</div><br>';

    /* 阶段耗时表 */
    h += '<b style="color:#9ad8ff;">⏱ 阶段耗时（按总耗时降序）</b>';
    if (!s.phases.length) {
        h += '<div style="color:#888; padding:8px;">暂无数据。跑几局后自动生成。</div>';
    } else {
        h += '<table style="width:100%; font-size:11px; border-collapse:collapse;">';
        h += '<tr style="background:#2a3a5a; color:#9ad8ff;">';
        h += '<th style="padding:3px;">阶段</th><th>次数</th><th>总(ms)</th><th>平均</th><th>峰值</th><th>P95</th></tr>';
        s.phases.forEach(function (p) {
            const col = p.avg > 100 ? '#ff9c9c' : (p.avg > 30 ? '#ffd479' : '#7fe3a0');
            h += '<tr style="border-bottom:1px solid #2a3a5a;">';
            h += '<td style="padding:3px;">' + p.phase + '</td>';
            h += '<td style="text-align:center;">' + p.count + '</td>';
            h += '<td style="text-align:center;">' + p.total + '</td>';
            h += '<td style="text-align:center; color:' + col + ';">' + p.avg + '</td>';
            h += '<td style="text-align:center;">' + p.max + '</td>';
            h += '<td style="text-align:center;">' + p.p95 + '</td>';
            h += '</tr>';
        });
        h += '</table>';
    }

    /* 优化建议 */
    if (s.suggestions && s.suggestions.length) {
        h += '<br><b style="color:#9ad8ff;">💡 优化建议</b>';
        s.suggestions.forEach(function (sg) {
            const col = sg.level === 'error' ? '#ff9c9c' : '#ffd479';
            h += '<div style="color:' + col + '; padding:2px 0; font-size:11px;">· [' + sg.phase + '] ' + sg.msg + '</div>';
        });
    }

    /* 调用树 */
    h += '<br><b style="color:#9ad8ff;">🌳 调用树（Top 深度 3）</b>';
    h += '<div style="font-family:monospace; font-size:10px; color:#a8b8c8; padding:4px; background:rgba(0,0,0,0.2); border-radius:4px; max-height:200px; overflow-y:auto;">';
    h += _renderTree(s.tree, 0);
    h += '</div>';

    /* 底部按钮 */
    h += '<br><div style="text-align:center; padding-top:8px; border-top:1px solid #2a3a5a; display:flex; gap:8px; justify-content:center;">';
    h += '<button id="djsc-profiler-export" style="background:#2a6; color:#fff; border:none; padding:5px 12px; border-radius:4px; cursor:pointer;">📥 导出报告</button>';
    h += '<button id="djsc-profiler-reset" style="background:#c33; color:#fff; border:none; padding:5px 12px; border-radius:4px; cursor:pointer;">🗑️ 重置统计</button>';
    h += '</div>';

    h += '</div>';
    return h;
}

/* 导出性能报告到文件 */
export function exportProfilerReport() {
    try {
        const s = profilerStats();
        const report = {
            exportedAt: new Date().toISOString(),
            phases: s.phases,
            memory: s.memory,
            suggestions: s.suggestions,
            history: profilerHistory(),
        };
        const json = JSON.stringify(report, null, 2);
        const filename = '性能报告_' + Date.now();
        const dir = '无名AI/data/output/';
        game.writeFile(json, dir, filename, function () {
            alert('✅ 性能报告已导出\n路径：' + dir + filename);
        });
        return { ok: true };
    } catch (e) {
        alert('❌ 导出失败：' + e.message);
        return { ok: false, err: e.message };
    }
}

function _renderTree(node, depth) {
    if (!node) return '';
    const pad = '　'.repeat(depth);
    let h = '';
    if (node.name !== 'root') {
        h += pad + '└ ' + node.name + ' (' + node.count + ' 次 / ' + node.total + 'ms)<br>';
    }
    if (depth < 3 && node.children && node.children.length) {
        node.children.slice(0, 6).forEach(function (c) {
            h += _renderTree(c, depth + 1);
        });
    }
    return h;
}

function _bind() {
    const btn1 = document.getElementById('djsc-profiler-export');
    if (btn1) btn1.addEventListener('click', exportProfilerReport);

    const btn2 = document.getElementById('djsc-profiler-reset');
    if (btn2) btn2.addEventListener('click', function () {
        if (confirm('重置性能统计？')) {
            profilerReset();
            const panels = document.querySelectorAll('.dialog.fullheight');
            if (panels.length) panels[panels.length - 1].remove();
            openProfilerPanel();
        }
    });
}

