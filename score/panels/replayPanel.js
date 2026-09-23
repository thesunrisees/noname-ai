/* ================= 决策积分引擎 · 决策回放面板 =================
 * 全屏遮罩版（和 openSimplePanel / calibratorPanel 一致）
 */
import { replayListGames, replayGetGame, replayStats, replayReset, replayExportJson } from '../modules/decision/decisionReplay.js';

let _filterIntervention = 'all';
let _selectedGame = -1;

function _donutChart(segments, opts) {
    opts = opts || {};
    const size = opts.size || 120;
    const thickness = opts.thickness || 16;
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
    try {
        try {
            if (window.__DJSC_PANEL) {
                try { window.__DJSC_PANEL.remove(); } catch (e) {}
                window.__DJSC_PANEL = null;
            }
        } catch (e) {}

        const W = window.innerWidth;
        const H = window.innerHeight;

        const panel = document.createElement('div');
        panel.id = 'djsc-replay-panel';
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

        const header = document.createElement('div');
        header.style.cssText = 'font-size: 20px; color: #00FFB0; margin: 20px; text-align: center; font-weight: bold; padding: 10px; background: #14243c; border-radius: 8px;';
        header.textContent = title;
        panel.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = 'color: #dbe7f5; background: #14243c; border-radius: 12px; padding: 20px; margin: 10px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);';
        body.innerHTML = html;
        panel.appendChild(body);

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

        setTimeout(_bind, 50);
    } catch (e) {
        alert('打开面板失败：' + e.message);
    }
}

export function openReplayPanel(gameIdx) {
    try {
        if (gameIdx !== undefined && gameIdx !== null) _selectedGame = gameIdx;
        const html = _buildHtml();
        _openFullscreenPanel('🎬 决策回放时间轴', html);
    } catch (e) {
        alert('回放面板异常：' + e.message);
    }
}

function _buildHtml() {
    const stats = replayStats();
    const games = replayListGames();

    let h = '<div style="font-size:12px; color:#dbe7f5; padding:8px; line-height:1.7;">';

    h += '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">';
    h += _card('归档局数', stats.games, '#9ad8ff');
    h += _card('决策总数', stats.decisions, '#7fe3a0');
    h += _card('护栏拦截', stats.blocked, '#ff9c9c');
    h += _card('认知冲突', stats.conflicts, '#ffd479');
    h += _card('总线仲裁', stats.busArbitrations, '#a8b8c8');
    h += '</div>';

    if (stats.decisions > 0) {
        h += '<b style="color:#9ad8ff;">干预分布</b><br>';
        h += '<div style="display:flex; justify-content:center;">';
        h += _donutChart([
            { label: '模型', value: stats.byIntervention.model || 0, color: '#7fe3a0' },
            { label: '混合', value: stats.byIntervention.blend || 0, color: '#ffd479' },
            { label: '规则', value: stats.byIntervention.rule || 0, color: '#ff9c9c' },
            { label: '跳过', value: stats.byIntervention.skip || 0, color: '#888' },
        ], { size: 120, thickness: 16 });
        h += '</div>';
    }

    h += '<br><b style="color:#9ad8ff;">归档对局（点击回放）</b><br>';
    if (!games.length) {
        h += '<div style="color:#888; padding:8px;">暂无归档。跑一局后自动生成。</div>';
    } else {
        h += '<table style="width:100%; font-size:11px; border-collapse:collapse;">';
        h += '<tr style="background:#2a3a5a; color:#9ad8ff;">';
        h += '<th style="padding:4px;">时间</th><th>模式</th><th>身份</th><th>决策</th><th>结果</th></tr>';
        games.slice(0, 12).forEach(function (g) {
            const t = new Date(g.ts);
            const pad = function (n) { return n < 10 ? '0' + n : '' + n; };
            const tstr = pad(t.getMonth() + 1) + '/' + pad(t.getDate()) + ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes());
            const col = g.verdict === 'win' ? '#7fe3a0' : (g.verdict === 'lose' ? '#ff9c9c' : '#888');
            const sel = (g.idx === _selectedGame) ? 'background:rgba(127,227,160,0.1);' : '';
            h += '<tr style="border-bottom:1px solid #2a3a5a; ' + sel + ' cursor:pointer;" class="djsc-replay-game" data-idx="' + g.idx + '">';
            h += '<td style="padding:4px;">' + tstr + '</td>';
            h += '<td style="text-align:center;">' + g.mode + '</td>';
            h += '<td style="text-align:center;">' + (g.identity || '-') + '</td>';
            h += '<td style="text-align:center;">' + g.decisions + '</td>';
            h += '<td style="text-align:center; color:' + col + ';">' + (g.myScore || 0) + '</td>';
            h += '</tr>';
        });
        h += '</table>';
    }

    if (_selectedGame >= 0) {
        const g = replayGetGame(_selectedGame);
        if (g) {
            h += '<br><b style="color:#9ad8ff;">对局 #' + _selectedGame + ' 时间轴</b>';
            h += '<div style="font-size:10px; color:#888; margin-bottom:4px;">';
            h += '模式 ' + (g.meta.mode || '?') + ' | 玩家 ' + (g.meta.meKey || '?') +
                 ' | 身份 ' + (g.meta.myIdentity || '-') + ' | ' + g.decisions.length + ' 条决策';
            h += '</div>';

            h += '<div style="margin-bottom:6px;">';
            h += '<select id="djsc-replay-filter" style="font-size:11px; padding:2px; background:#2a3a5a; color:#fff; border:1px solid #4a6a9a; border-radius:3px;">';
            ['all', 'model', 'blend', 'rule', 'skip'].forEach(function (k) {
                const sel = (k === _filterIntervention) ? ' selected' : '';
                h += '<option value="' + k + '"' + sel + '>' + (k === 'all' ? '全部干预' : k) + '</option>';
            });
            h += '</select>';
            h += '</div>';

            h += '<div style="max-height:340px; overflow-y:auto; background:rgba(0,0,0,0.15); border-radius:4px; padding:6px;">';
            let shown = 0;
            g.decisions.forEach(function (d, i) {
                if (_filterIntervention !== 'all' && d.intervention !== _filterIntervention) return;
                shown++;
                h += _renderDecision(d, i);
            });
            if (!shown) h += '<div style="color:#888; text-align:center; padding:12px;">该筛选条件下无记录</div>';
            h += '</div>';
        }
    }

    h += '<br><div style="text-align:center; margin-top:10px; padding-top:8px; border-top:1px solid #2a3a5a;">';
    h += '<button id="djsc-replay-export" style="background:#2a6; color:#fff; border:none; padding:5px 12px; border-radius:4px; cursor:pointer; margin-right:6px;">📥 导出 JSON</button>';
    h += '<button id="djsc-replay-reset" style="background:#c33; color:#fff; border:none; padding:5px 12px; border-radius:4px; cursor:pointer;">🗑️ 清空回放</button>';
    h += '</div>';

    h += '</div>';
    return h;
}

function _renderDecision(d, idx) {
    const iv = d.intervention || 'none';
    const ivColor = iv === 'model' ? '#7fe3a0' : (iv === 'blend' ? '#ffd479' : (iv === 'rule' ? '#ff9c9c' : '#888'));
    const guards = d.guard && d.guard.blocked ? ' 🛡️' : '';
    const conflicts = d.conflict && d.conflict.detected ? ' ⚡' : '';
    const bus = d.bus ? ' 🎯' : '';

    let h = '<div style="border-bottom:1px solid #2a3a5a; padding:5px 0; font-size:11px;">';
    h += '<div style="color:' + ivColor + '; font-weight:bold;">';
    h += '#' + (idx + 1) + ' R' + d.round + ' ' + d.player;
    h += ' <span style="color:#888;">[' + iv + ']</span>';
    h += guards + conflicts + bus;
    h += '</div>';

    if (d.final) {
        h += '<div style="padding-left:10px; color:#dbe7f5;">';
        h += '▶ ' + d.final.type + ':' + d.final.id +
             (d.final.target ? '→' + d.final.target : '') +
             ' <span style="color:#888;">(分 ' + d.final.score + ')</span>';
        h += '</div>';
    }

    if (d.conflict && d.conflict.detected) {
        h += '<div style="padding-left:10px; color:#ffd479;">';
        h += '⚡ 冲突：规则 ' + d.conflict.ruleLabel + ' vs 模型 ' + d.conflict.modelLabel;
        h += '</div>';
    }

    if (d.bus) {
        h += '<div style="padding-left:10px; color:#a8b8c8;">';
        h += '🎯 总线：' + d.bus.winner + '（' + d.bus.reason + '）';
        h += '</div>';
    }

    if (d.guard && d.guard.blocked) {
        h += '<div style="padding-left:10px; color:#ff9c9c;">';
        h += '🛡️ 拦截：' + d.guard.rule + '（' + d.guard.reason + '）';
        h += '</div>';
    }

    if (d.outcome) {
        h += '<div style="padding-left:10px; color:#888; font-size:10px;">';
        h += '结果：HP ' + d.outcome.meHp + ' | 手牌 ' + d.outcome.meHand +
             ' | 累计分 ' + d.outcome.scoreDelta;
        h += '</div>';
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
    try {
        document.querySelectorAll('.djsc-replay-game').forEach(function (tr) {
            tr.addEventListener('click', function () {
                const idx = parseInt(this.dataset.idx, 10);
                _selectedGame = idx;
                _refreshPanel();
            });
        });

        const sel = document.getElementById('djsc-replay-filter');
        if (sel) {
            sel.addEventListener('change', function () {
                _filterIntervention = this.value;
                _refreshPanel();
            });
        }

        const exp = document.getElementById('djsc-replay-export');
        if (exp) exp.addEventListener('click', function () {
            try {
                const json = replayExportJson();
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = '无名AI_决策回放_' + Date.now() + '.json';
                a.click();
                URL.revokeObjectURL(url);
            } catch (e) { alert('导出失败：' + e.message); }
        });

        const rst = document.getElementById('djsc-replay-reset');
        if (rst) rst.addEventListener('click', function () {
            if (!confirm('清空所有决策回放记录？')) return;
            replayReset();
            _selectedGame = -1;
            _refreshPanel();
        });
    } catch (e) {}
}

function _refreshPanel() {
    try {
        if (window.__DJSC_PANEL) {
            try { window.__DJSC_PANEL.remove(); } catch (e) {}
            window.__DJSC_PANEL = null;
        }
    } catch (e) {}
    openReplayPanel(_selectedGame);
}

if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.openReplayPanel = openReplayPanel;
}
