/* ================= 决策积分引擎 · 校准趋势面板 ================= */
import { log } from './logger.js';

const HISTORY_KEY = 'djsc_calib_history_v1';
const MAX_HISTORY = 200;

let HISTORY = [];
try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) HISTORY = JSON.parse(raw) || [];
} catch (e) {}

function _save() {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(HISTORY.slice(-MAX_HISTORY))); } catch (e) {}
}

/* 每次游戏结算时调用 */
export function recordCalibrationSnapshot() {
    try {
        const cal = window.__DJSC && window.__DJSC.calibrator;
        if (!cal) return;
        const s = cal.stats();
        const cf = window.__DJSC.conflict && window.__DJSC.conflict.stats ? window.__DJSC.conflict.stats() : null;
        const cl = window.__DJSC.cognitionLog && window.__DJSC.cognitionLog.stats ? window.__DJSC.cognitionLog.stats() : null;
        HISTORY.push({
            ts: Date.now(),
            round: s.total,
            ruleWin: s.ruleWin,
            modelWin: s.modelWin,
            tie: s.tie,
            winRate: s.winRate,
            shift: Object.assign({}, s.shift),
            conflicts: cf ? cf.conflicts : 0,
            cognitions: cl ? cl.total : 0,
        });
        while (HISTORY.length > MAX_HISTORY) HISTORY.shift();
        _save();
    } catch (e) {}
}

export function getCalibrationHistory(n) {
    return HISTORY.slice(-(n || 30));
}

export function resetCalibrationHistory() {
    HISTORY = [];
    try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
}

/* ================= 简单图表（纯 CSS） ================= */
function _barChart(items, opts) {
    opts = opts || {};
    const barH = opts.barH || 12;
    let h = '<div style="margin:4px 0;">';
    items.forEach(function (it) {
        const w = Math.min(100, Math.abs(it.value));
        h += '<div style="display:flex; align-items:center; margin:2px 0;">';
        h += '<div style="width:80px; font-size:10px; color:#a8b8c8;">' + it.label + '</div>';
        h += '<div style="flex:1; height:' + barH + 'px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden;">';
        h += '<div style="height:100%; width:' + w + '%; background:' + (it.color || '#7fe3a0') + '; border-radius:3px;"></div>';
        h += '</div>';
        h += '<div style="width:50px; text-align:right; font-size:10px; color:#fff;">' + it.value.toFixed(1) + '</div>';
        h += '</div>';
    });
    h += '</div>';
    return h;
}

function _lineChart(data, opts) {
    opts = opts || {};
    const w = opts.width || 360;
    const h = opts.height || 90;
    const color = opts.color || '#7fe3a0';
    if (!data || data.length < 2) return '<div style="font-size:10px; color:#888;">数据不足</div>';

    const max = Math.max.apply(null, data.map(Math.abs));
    if (max === 0) return '<div style="font-size:10px; color:#888;">数据为 0</div>';

    const stepX = w / (data.length - 1);
    const midY = h / 2;
    const scaleY = (h / 2 - 5) / max;

    let path = '';
    data.forEach(function (v, i) {
        const x = i * stepX;
        const y = midY - v * scaleY;
        path += (i === 0 ? 'M' : 'L') + x + ',' + y;
    });

    return '<svg width="' + w + '" height="' + h + '" style="background:rgba(255,255,255,0.03); border-radius:4px;">' +
        '<line x1="0" y1="' + midY + '" x2="' + w + '" y2="' + midY + '" stroke="#444" stroke-width="0.5"/>' +
        '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="1.5"/></svg>';
}

/* ================= 打开面板（全屏遮罩版，和 openSimplePanel 一致） ================= */
function _openFullscreenPanel(title, html) {
    try {
        /* 关闭旧面板 */
        try {
            if (window.__DJSC_PANEL) {
                try { window.__DJSC_PANEL.remove(); } catch (e) {}
                window.__DJSC_PANEL = null;
            }
        } catch (e) {}

        const W = window.innerWidth;
        const H = window.innerHeight;

        const panel = document.createElement('div');
        panel.id = 'djsc-calib-panel';
        panel.style.cssText = [
            'position: fixed',
            'top: 0',
            'left: 0',
            'width: ' + W + 'px',
            'height: ' + H + 'px',
            'max-width: ' + W + 'px',
            'max-height: ' + H + 'px',
            'margin: 0',
            'padding: 0',
            'box-sizing: border-box',
            'z-index: 2147483647',
            'background: #0a1018',
            'overflow-y: auto',
            'overflow-x: hidden',
            '-webkit-overflow-scrolling: touch',
            'color: white',
            'font-size: 16px',
            'line-height: 1.8',
        ].join('; ') + ';';

        /* 标题栏 */
        const header = document.createElement('div');
        header.style.cssText = 'font-size: 20px; color: #00FFB0; margin: 20px; text-align: center; font-weight: bold; padding: 10px; background: #14243c; border-radius: 8px;';
        header.textContent = title;
        panel.appendChild(header);

        /* 内容区 */
        const body = document.createElement('div');
        body.style.cssText = 'color: #dbe7f5; background: #14243c; border-radius: 12px; padding: 20px; margin: 10px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);';
        body.innerHTML = html;
        panel.appendChild(body);

        /* 关闭按钮 */
        const closeBtn = document.createElement('div');
        closeBtn.textContent = '✕ 关闭';
        closeBtn.style.cssText = [
            'position: fixed',
            'bottom: 20px',
            'right: 16px',
            'padding: 12px 20px',
            'background: #1E90FF',
            'color: white',
            'border-radius: 26px',
            'font-size: 15px',
            'cursor: pointer',
            'box-shadow: 0 4px 12px rgba(0,0,0,0.6)',
            'z-index: 2147483646',
        ].join('; ') + ';';
        closeBtn.addEventListener('click', function () {
            try { panel.remove(); } catch (e) {}
            window.__DJSC_PANEL = null;
        });
        panel.appendChild(closeBtn);

        document.body.appendChild(panel);
        window.__DJSC_PANEL = panel;

        /* 绑定按钮 */
        setTimeout(function () {
            try {
                const btn1 = document.getElementById('djsc-calib-reset-hist');
                if (btn1) btn1.addEventListener('click', function () {
                    if (confirm('清空历史快照？')) { resetCalibrationHistory(); alert('已清空'); }
                });
                const btn2 = document.getElementById('djsc-calib-reset-all');
                if (btn2) btn2.addEventListener('click', function () {
                    if (confirm('重置校准器？所有偏移归零。')) {
                        const cal = window.__DJSC.calibrator;
                        if (cal && cal.reset) cal.reset();
                        alert('已重置');
                    }
                });
            } catch (e) {}
        }, 50);
    } catch (e) {
        alert('打开面板失败：' + e.message);
    }
}

export function openCalibratorPanel() {
    try {
        const cal = window.__DJSC && window.__DJSC.calibrator;
        const s = cal ? cal.stats() : null;
        if (!s) { alert('校准器未就绪'); return; }

        const html = _buildHtml(s);
        _openFullscreenPanel('📈 决策校准趋势', html);
    } catch (e) {
        alert('校准面板异常：' + e.message);
    }
}

function _buildHtml(s) {
    const hist = getCalibrationHistory(30);
    let h = '<div style="font-size:12px; color:#dbe7f5; padding:8px; line-height:1.7;">';

    h += '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">';
    h += _card('总评估', s.total, '#9ad8ff');
    h += _card('规则胜率', s.winRate, '#7fe3a0');
    h += _card('学习率', s.lr.toFixed(2), '#ffd479');
    h += _card('待评估', s.pending || 0, '#ff9c9c');
    h += '</div>';

    h += '<b style="color:#9ad8ff;">权重偏移（累计）</b><br>';
    h += _barChart([
        { label: '攻击倾向', value: s.shift.atk * 100, color: '#7fe3a0' },
        { label: '防守倾向', value: s.shift.def * 100, color: '#9ad8ff' },
        { label: '进攻牌系数', value: s.shift.wAtkCard * 100, color: '#ffd479' },
        { label: '防御牌系数', value: s.shift.wDefCard * 100, color: '#ff9c9c' },
        { label: '模型信任', value: s.shift.modelTrust * 100, color: '#a8b8c8' },
    ], { barH: 12 });
    h += '<div style="font-size:10px; color:#888; margin-top:4px;">正值=规则引擎胜出倾向增强；负值=模型胜出倾向增强</div>';

    if (hist.length >= 2) {
        h += '<br><b style="color:#9ad8ff;">规则胜率趋势（最近 ' + hist.length + ' 局）</b><br>';
        const data = hist.map(function (x) {
            return parseFloat((x.winRate || '0%').replace('%', '')) || 0;
        });
        h += '<div style="margin:4px 0;">' + _lineChart(data, { width: 360, height: 90, color: '#7fe3a0' }) + '</div>';

        h += '<br><b style="color:#9ad8ff;">模型信任偏移趋势</b><br>';
        const trustData = hist.map(function (x) { return x.shift.modelTrust * 100; });
        h += '<div style="margin:4px 0;">' + _lineChart(trustData, { width: 360, height: 90, color: '#ffd479' }) + '</div>';

        h += '<br><b style="color:#9ad8ff;">认知冲突次数</b><br>';
        const cfData = hist.map(function (x) { return x.conflicts; });
        h += '<div style="margin:4px 0;">' + _lineChart(cfData, { width: 360, height: 90, color: '#ff9c9c' }) + '</div>';
    } else {
        h += '<br><span style="color:#888; font-size:11px;">趋势图需要至少 2 局数据</span>';
    }

    if (hist.length > 0) {
        h += '<br><b style="color:#9ad8ff;">最近 ' + Math.min(8, hist.length) + ' 局快照</b><br>';
        h += '<table style="width:100%; font-size:11px; border-collapse:collapse;">';
        h += '<tr style="background:#2a3a5a; color:#9ad8ff;">';
        h += '<th style="padding:3px;">时间</th><th>胜率</th><th>模型信任</th><th>冲突</th><th>认知</th></tr>';
        hist.slice(-8).reverse().forEach(function (x) {
            const t = new Date(x.ts);
            const pad = function (n) { return n < 10 ? '0' + n : '' + n; };
            h += '<tr style="border-bottom:1px solid #2a3a5a;">';
            h += '<td style="padding:3px;">' + pad(t.getHours()) + ':' + pad(t.getMinutes()) + '</td>';
            h += '<td style="text-align:center;">' + x.winRate + '</td>';
            h += '<td style="text-align:center;">' + (x.shift.modelTrust * 100).toFixed(1) + '</td>';
            h += '<td style="text-align:center;">' + x.conflicts + '</td>';
            h += '<td style="text-align:center;">' + x.cognitions + '</td>';
            h += '</tr>';
        });
        h += '</table>';
    }

    h += '<br><div style="text-align:center; margin-top:8px;">';
    h += '<button id="djsc-calib-reset-hist" style="background:#c55; color:#fff; border:none; padding:5px 12px; border-radius:4px; cursor:pointer; margin-right:6px;">清空历史</button>';
    h += '<button id="djsc-calib-reset-all" style="background:#c33; color:#fff; border:none; padding:5px 12px; border-radius:4px; cursor:pointer;">重置校准器</button>';
    h += '</div>';

    h += '</div>';

    setTimeout(function () {
        try {
            const btn1 = document.getElementById('djsc-calib-reset-hist');
            if (btn1) btn1.addEventListener('click', function () {
                if (confirm('清空历史快照？')) { resetCalibrationHistory(); alert('已清空'); }
            });
            const btn2 = document.getElementById('djsc-calib-reset-all');
            if (btn2) btn2.addEventListener('click', function () {
                if (confirm('重置校准器？所有偏移归零。')) {
                    const cal = window.__DJSC.calibrator;
                    if (cal && cal.reset) cal.reset();
                    alert('已重置');
                }
            });
        } catch (e) {}
    }, 50);

    return h;
}

function _card(label, val, color) {
    return '<div style="flex:1; min-width:80px; padding:8px; background:rgba(255,255,255,0.04); border-radius:6px; text-align:center;">' +
        '<div style="font-size:11px; color:#9ad8ff; margin-bottom:3px;">' + label + '</div>' +
        '<div style="font-size:16px; font-weight:600; color:' + color + ';">' + val + '</div></div>';
}

/* ================= 挂载 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.openCalibratorPanel = openCalibratorPanel;
    window.__DJSC.calibHistory = {
        record: recordCalibrationSnapshot,
        get: getCalibrationHistory,
        reset: resetCalibrationHistory,
    };
}
