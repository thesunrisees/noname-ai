/*
 * ============================================
 * // Wydawca: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 决策对比面板 =================
 * 全屏遮罩版（和 openSimplePanel 一致）
 */
import { compareStats, compareRecent, resetCompare } from './decisionCompare.js';

function _donutChart(segments, opts) {
// Autor: Feisheng Original | Licença: GPL-3.0
    opts = opts || {};
    const size = opts.size || 100;
    const thickness = opts.thickness || 14;
    const total = segments.reduce(function (s, x) { return s + Math.max(0, x.value); }, 0);
    if (total <= 0) return '<div style="font-size:10px; color:#888;">无数据</div>';

    const r = size / 2 - thickness / 2;
    const cx = size / 2, cy = size / 2;
    let angle = -Math.PI / 2;

    let svg = '<svg width="' + size + '" height="' + size + '">';
    segments.forEach(function (seg) {
        const frac = Math.max(0, seg.value) / total;
        if (frac <= 0) return;
        const a2 = angle + frac * Math.PI * 2;
        const large = (a2 - angle) > Math.PI ? 1 : 0;
        const x1 = cx + r * Math.cos(angle);
        const y1 = cy + r * Math.sin(angle);
        const x2 = cx + r * Math.cos(a2);
        const y2 = cy + r * Math.sin(a2);
        svg += '<path d="M ' + x1 + ' ' + y1 + ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2 +
               '" fill="none" stroke="' + seg.color + '" stroke-width="' + thickness + '"/>';
        angle = a2;
    });
    svg += '</svg>';
    return svg;
}

function _openFullscreenPanel(title, html) {
    openUtilityHtml(title, html, 'djsc-compare-panel');
    _bind();
}

export function openComparePanel() {
    try {
        const html = _buildHtml();
        _openFullscreenPanel('⚖️ 决策对比模式', html);
    } catch (e) {
        alert('对比面板异常：' + e.message);
    }
}

function _buildHtml() {
    const stats = compareStats();
    const recent = compareRecent(15);

    let h = '<div style="font-size:12px; color:#dbe7f5; padding:8px; line-height:1.7;">';

    h += '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">';
    h += _card('对比记录', stats.total, '#9ad8ff');
    h += _card('档案分歧', stats.disagreements, '#ffd479');
    h += _card('分歧率', stats.disagreementRate, '#ff9c9c');
    h += '</div>';

    if (stats.total > 0) {
        h += '<div style="display:flex; justify-content:center; margin-bottom:12px;">';
        h += _donutChart([
            { label: '一致', value: stats.total - stats.disagreements, color: '#7fe3a0' },
            { label: '分歧', value: stats.disagreements, color: '#ff9c9c' },
        ], { size: 100, thickness: 14 });
        h += '</div>';
    }

    if (!recent.length) {
        h += '<div style="color:#888; padding:8px;">暂无对比记录。打几局后自动生成。</div>';
    } else {
        h += '<b style="color:#9ad8ff;">最近 ' + recent.length + ' 次决策对比</b>';
        recent.forEach(function (r) {
            h += _renderRecord(r);
        });
    }

    h += '<br><div style="text-align:center; padding-top:8px; border-top:1px solid #2a3a5a;">';
    h += '<button id="djsc-compare-reset" style="background:#c33; color:#fff; border:none; padding:5px 12px; border-radius:4px; cursor:pointer;">🗑️ 清空对比记录</button>';
    h += '</div></div>';
    return h;
}

function _renderRecord(r) {
    const disagreement = r.disagreement ? '⚡' : '';
    const t = new Date(r.ts);
    const pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    const tstr = pad(t.getHours()) + ':' + pad(t.getMinutes()) + ':' + pad(t.getSeconds());

    let h = '<div style="border:1px solid #2a3a5a; border-radius:4px; padding:6px; margin:6px 0;">';
    h += '<div style="color:' + (r.disagreement ? '#ffd479' : '#7fe3a0') + '; font-size:11px;">';
    h += disagreement + ' ' + tstr + ' 玩家 ' + r.player;
    if (r.actual) h += ' → 实际选 ' + r.actual.id;
    h += '</div>';

    const profiles = Object.keys(r.perProfile || {});
    if (profiles.length) {
        h += '<table style="width:100%; font-size:10px; border-collapse:collapse; margin-top:4px;">';
        h += '<tr style="color:#9ad8ff;">';
        h += '<th style="text-align:left; padding:2px;">档案</th>';
        h += '<th>首选</th><th>次选</th><th>第三</th>';
        h += '</tr>';
        profiles.forEach(function (k) {
            const top3 = r.perProfile[k] || [];
            const rowColor = (r.actual && top3[0] && top3[0].id === r.actual.id) ? '#7fe3a0' : '#dbe7f5';
            h += '<tr style="color:' + rowColor + ';">';
            h += '<td style="padding:2px;">' + k + '</td>';
            for (let i = 0; i < 3; i++) {
                const it = top3[i];
                h += '<td style="text-align:center;">' + (it ? it.id + '(' + it.score + ')' : '-') + '</td>';
            }
            h += '</tr>';
        });
        h += '</table>';
    }
    h += '</div>';
    return h;
}

function _card(label, val, color) {
    return '<div style="flex:1; min-width:64px; padding:6px; background:rgba(255,255,255,0.04); border-radius:6px; text-align:center;">' +
        '<div style="font-size:10px; color:#9ad8ff; margin-bottom:2px;">' + label + '</div>' +
        '<div style="font-size:14px; font-weight:600; color:' + color + ';">' + val + '</div></div>';
}

function _bind() {
    const btn = document.getElementById('djsc-compare-reset');
    if (btn) btn.addEventListener('click', function () {
        if (confirm('清空决策对比记录？')) {
            resetCompare();
            try {
                if (window.__DJSC_PANEL) {
                    try { window.__DJSC_PANEL.remove(); } catch (e) {}
                    window.__DJSC_PANEL = null;
                }
            } catch (e) {}
            openComparePanel();
        }
    });
}

if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.openComparePanel = openComparePanel;
}
import { openUtilityHtml } from './panelTheme.js';
