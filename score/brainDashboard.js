/*
 * ============================================
 * // Wydawca: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · AI 大脑总览面板 ================= */
import { log } from './logger.js';

/* 简单图表（纯 SVG/CSS） */
function _barChart(items, opts) {
    opts = opts || {};
    const barH = opts.barH || 12;
    let h = '<div style="margin:4px 0;">';
    items.forEach(function (it) {
        const w = Math.min(100, Math.abs(it.value));
        h += '<div style="display:flex; align-items:center; margin:2px 0;">';
        h += '<div style="width:70px; font-size:10px; color:#a8b8c8;">' + it.label + '</div>';
        h += '<div style="flex:1; height:' + barH + 'px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden;">';
        h += '<div style="height:100%; width:' + w + '%; background:' + (it.color || '#7fe3a0') + '; border-radius:3px;"></div>';
        h += '</div>';
        h += '<div style="width:45px; text-align:right; font-size:10px; color:#fff;">' + it.value.toFixed(1) + '</div>';
        h += '</div>';
    });
    h += '</div>';
    return h;
}

function _donutChart(segments, opts) {
    opts = opts || {};
    const size = opts.size || 130;
    const thickness = opts.thickness || 18;
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

function _radarChart(labels, values, opts) {
    opts = opts || {};
    const size = opts.size || 160;
    const max = opts.max || 1;
    const cx = size / 2, cy = size / 2;
    const r = size / 2 - 10;
    const n = labels.length;

    let points = [];
    for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const v = Math.min(1, Math.max(0, values[i] / max));
        points.push([cx + r * v * Math.cos(ang), cy + r * v * Math.sin(ang)]);
    }

    let polygon = points.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    let grid = [];
    for (let level = 1; level <= 3; level++) {
        let pts = [];
        for (let i = 0; i < n; i++) {
            const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
            pts.push((cx + r * (level / 3) * Math.cos(ang)).toFixed(1) + ',' + (cy + r * (level / 3) * Math.sin(ang)).toFixed(1));
        }
        grid.push('<polygon points="' + pts.join(' ') + '" fill="none" stroke="#444" stroke-width="0.5"/>');
    }

    let labelSvg = [];
    for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const lx = cx + (r + 12) * Math.cos(ang);
        const ly = cy + (r + 12) * Math.sin(ang);
        labelSvg.push('<text x="' + lx + '" y="' + ly + '" fill="#a8b8c8" font-size="10" text-anchor="middle">' + labels[i] + '</text>');
    }

    return '<svg width="' + size + '" height="' + size + '">' + grid.join('') +
           '<polygon points="' + polygon + '" fill="rgba(127,227,160,0.3)" stroke="#7fe3a0" stroke-width="1.5"/>' +
           labelSvg.join('') + '</svg>';
}

/* ================= 全屏遮罩打开面板（和 openSimplePanel 一致） ================= */
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
        panel.id = 'djsc-brain-panel';
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

        setTimeout(_bindButtons, 50);
    } catch (e) {
        alert('打开面板失败：' + e.message);
    }
}

export function openBrainDashboard() {
    try {
        const html = _buildHtml();
        _openFullscreenPanel('🧠 AI 大脑总览', html);
    } catch (e) {
        alert('大脑面板异常：' + e.message);
    }
}

function _buildHtml() {
    const D = window.__DJSC || {};
    const cal = D.calibrator && D.calibrator.stats ? D.calibrator.stats() : null;
    const cog = D.cognitionLog && D.cognitionLog.stats ? D.cognitionLog.stats() : null;
    const conf = D.conflict && D.conflict.stats ? D.conflict.stats() : null;
    const mp = D.multiProfile && D.multiProfile.stats ? D.multiProfile.stats() : null;
    const bus = D.strategyBus && D.strategyBus.stats ? D.strategyBus.stats() : null;
    const guard = D.modelGuard && D.modelGuard.status ? D.modelGuard.status() : null;
    const meta = D.metaCognition && D.metaCognition.stats ? D.metaCognition.stats() : null;

    let h = '<div style="font-size:12px; color:#dbe7f5; padding:8px; line-height:1.7;">';

    h += '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">';
    h += _card('校准评估', cal ? cal.total : 0, '#9ad8ff');
    h += _card('规则胜率', cal ? cal.winRate : '0%', '#7fe3a0');
    h += _card('认知日志', cog ? cog.total : 0, '#ffd479');
    h += _card('冲突次数', conf ? conf.conflicts : 0, '#ff9c9c');
    h += _card('档案数', mp ? mp.profileCount : 0, '#a8b8c8');
    h += '</div>';

    /* ① 干预分布 */
    h += '<b style="color:#9ad8ff;">① 干预分布</b><br>';
    if (cog && cog.byIntervention) {
        h += '<div style="display:flex; justify-content:center; margin:6px 0;">';
        h += _donutChart([
            { label: '模型', value: cog.byIntervention.model || 0, color: '#7fe3a0' },
            { label: '混合', value: cog.byIntervention.blend || 0, color: '#ffd479' },
            { label: '规则', value: cog.byIntervention.rule || 0, color: '#ff9c9c' },
            { label: '跳过', value: cog.byIntervention.skip || 0, color: '#888' },
        ], { size: 130, thickness: 18 });
        h += '</div>';
        h += '<div style="font-size:11px; color:#a8b8c8; text-align:center;">';
        h += '模型 ' + (cog.byIntervention.model || 0) + ' · ';
        h += '混合 ' + (cog.byIntervention.blend || 0) + ' · ';
        h += '规则 ' + (cog.byIntervention.rule || 0) + ' · ';
        h += '跳过 ' + (cog.byIntervention.skip || 0);
        h += '</div>';
    } else h += '<span style="color:#888;">无数据</span>';
    h += '<br>';

    /* ② 认知级别 */
    h += '<b style="color:#9ad8ff;">② 认知级别分布</b><br>';
    if (cog && cog.byLevelRate) {
        const lv = cog.byLevel || {};
        h += '<div style="display:flex; justify-content:center;">';
        h += _radarChart(
            ['高', '中', '低', '未定'],
            [lv.high || 0, lv.mid || 0, lv.low || 0, lv.none || 0],
            { size: 160, max: Math.max(1, (lv.high || 0) + (lv.mid || 0) + (lv.low || 0) + (lv.none || 0)) }
        );
        h += '</div>';
        h += '<div style="font-size:11px; color:#a8b8c8; text-align:center;">';
        Object.keys(cog.byLevelRate).forEach(function (k) {
            h += k + '=' + cog.byLevelRate[k] + ' ';
        });
        h += '</div>';
    } else h += '<span style="color:#888;">无数据</span>';
    h += '<br>';

    /* ③ 权重偏移 */
    h += '<b style="color:#9ad8ff;">③ 权重偏移</b><br>';
    if (cal && cal.shift) {
        h += _barChart([
            { label: '攻击倾向', value: cal.shift.atk * 100, color: '#7fe3a0' },
            { label: '防守倾向', value: cal.shift.def * 100, color: '#9ad8ff' },
            { label: '进攻牌', value: cal.shift.wAtkCard * 100, color: '#ffd479' },
            { label: '防御牌', value: cal.shift.wDefCard * 100, color: '#ff9c9c' },
            { label: '模型信任', value: cal.shift.modelTrust * 100, color: '#a8b8c8' },
        ], { barH: 12 });
    } else h += '<span style="color:#888;">无数据</span>';
    h += '<br>';

    /* ④ 多档案对比 */
    h += '<b style="color:#9ad8ff;">④ 多档案对比</b><br>';
    if (mp && mp.profiles && mp.profiles.length) {
        h += '<table style="width:100%; font-size:11px; border-collapse:collapse;">';
        h += '<tr style="background:#2a3a5a; color:#9ad8ff;">';
        h += '<th style="padding:3px;">档案</th><th>胜率</th><th>样本</th><th>攻击偏移</th><th>模型信任</th></tr>';
        mp.profiles.forEach(function (p) {
            const isCur = p.key === mp.currentKey;
            h += '<tr style="border-bottom:1px solid #2a3a5a;' + (isCur ? 'background:rgba(127,227,160,0.1);' : '') + '">';
            h += '<td style="padding:3px;">' + (isCur ? '★ ' : '') + p.label + '</td>';
            h += '<td style="text-align:center; color:' + (p.winRate >= 0.5 ? '#7fe3a0' : '#ff9c9c') + ';">' + (p.winRate * 100).toFixed(0) + '%</td>';
            h += '<td style="text-align:center;">' + p.samples + '</td>';
            h += '<td style="text-align:center;">' + (p.shift.atk * 100).toFixed(1) + '</td>';
            h += '<td style="text-align:center;">' + (p.shift.modelTrust * 100).toFixed(1) + '</td>';
            h += '</tr>';
        });
        h += '</table>';
    } else h += '<span style="color:#888;">无数据</span>';
    h += '<br>';

    /* ⑤ 策略总线 */
    h += '<b style="color:#9ad8ff;">⑤ 策略总线</b><br>';
    if (bus) {
        h += '<div style="font-size:11px; color:#a8b8c8; padding:6px; background:rgba(255,255,255,0.03); border-radius:4px;">';
        h += '检查 ' + bus.checks + ' 次 | 仲裁 ' + bus.arbitrations + ' 次 (' + bus.arbitrationRate + ')<br>';
        h += '规划胜 ' + bus.plannerWins + ' | 规则胜 ' + bus.ruleWins + ' | 模型胜 ' + bus.modelWins;
        h += '</div>';
    } else h += '<span style="color:#888;">无数据</span>';
    h += '<br>';

    /* ⑥ 模型护栏 */
    h += '<b style="color:#9ad8ff;">⑥ 模型护栏</b><br>';
    if (guard) {
        h += '<div style="font-size:11px; color:#a8b8c8; padding:6px; background:rgba(255,255,255,0.03); border-radius:4px;">';
        h += '检查 ' + guard.checks + ' 次 | 拦截 ' + guard.blocks + ' 次';
        h += '</div>';
    } else h += '<span style="color:#888;">无数据</span>';
    h += '<br>';

    /* ⑦ 元认知全局 */
    h += '<b style="color:#9ad8ff;">⑦ 元认知积累</b><br>';
    if (meta) {
        h += '<div style="font-size:11px; color:#a8b8c8; padding:6px; background:rgba(255,255,255,0.03); border-radius:4px;">';
        h += '累计对局 ' + (meta.global.totalGames || 0) + ' 局<br>';
        h += '技能认知 ' + (meta.global.skillEntries || 0) + ' 个 | 卡牌认知 ' + (meta.global.cardEntries || 0) + ' 个';
        h += '</div>';
    } else h += '<span style="color:#888;">无数据</span>';
    h += '<br>';

    h += '<div style="text-align:center; margin-top:12px; padding-top:8px; border-top:1px solid #2a3a5a;">';
    /* 查看类按钮 */
    h += '<div style="font-size:10px; color:#7ad; margin-bottom:4px;">👀 查看</div>';
    h += '<button id="djsc-brain-refresh" style="background:#2a6; color:#fff; border:none; padding:6px 14px; border-radius:4px; cursor:pointer; margin:2px; font-size:12px;">🔄 刷新面板</button>';
    h += '<button id="djsc-brain-show-features" style="background:#48c; color:#fff; border:none; padding:6px 14px; border-radius:4px; cursor:pointer; margin:2px; font-size:12px;">📊 查看130维特征</button>';
    h += '</div>';

    /* 危险操作 */
    h += '<div style="text-align:center; margin-top:10px; padding-top:8px; border-top:1px dashed #a33;">';
    h += '<div style="font-size:10px; color:#a66; margin-bottom:4px;">⚠️ 危险操作（不可恢复）</div>';
    h += '<button id="djsc-brain-reset-all" style="background:#c33; color:#fff; border:none; padding:6px 14px; border-radius:4px; cursor:pointer; font-size:12px;">🗑️ 清空所有学习数据</button>';
    h += '<div style="font-size:10px; color:#688; margin-top:4px;">💡 导出/导入功能在扩展设置里</div>';
    h += '</div>';

    h += '</div>';
    return h;
}

function _card(label, val, color) {
    return '<div style="flex:1; min-width:64px; padding:6px; background:rgba(255,255,255,0.04); border-radius:6px; text-align:center;">' +
        '<div style="font-size:10px; color:#9ad8ff; margin-bottom:2px;">' + label + '</div>' +
        '<div style="font-size:14px; font-weight:600; color:' + color + ';">' + val + '</div></div>';
}

function _bindButtons() {
    try {
        const btn = document.getElementById('djsc-brain-refresh');
        if (btn) btn.addEventListener('click', function () {
            const panels = document.querySelectorAll('.dialog.fullheight');
            if (panels.length) panels[panels.length - 1].remove();
            openBrainDashboard();
        });
        const featBtn = document.getElementById('djsc-brain-show-features');
        if (featBtn) featBtn.addEventListener('click', function () {
            showFeatures();
        });
        const resetBtn = document.getElementById('djsc-brain-reset-all');
        if (resetBtn) resetBtn.addEventListener('click', function () {
            if (!confirm('重置所有学习数据？\n将清空：校准器/认知日志/冲突/多档案/策略总线/护栏\n此操作不可恢复！')) return;
            try { window.__DJSC.calibrator && window.__DJSC.calibrator.reset && window.__DJSC.calibrator.reset(); } catch (e) {}
            try { window.__DJSC.cognitionLog && window.__DJSC.cognitionLog.reset && window.__DJSC.cognitionLog.reset(); } catch (e) {}
            try { window.__DJSC.conflict && window.__DJSC.conflict.reset && window.__DJSC.conflict.reset(); } catch (e) {}
            try { window.__DJSC.multiProfile && window.__DJSC.multiProfile.reset && window.__DJSC.multiProfile.reset(); } catch (e) {}
            try { window.__DJSC.strategyBus && window.__DJSC.strategyBus.reset && window.__DJSC.strategyBus.reset(); } catch (e) {}
            try { window.__DJSC.metaCognition && window.__DJSC.metaCognition.reset && window.__DJSC.metaCognition.reset(); } catch (e) {}
            try { window.__DJSC.calibHistory && window.__DJSC.calibHistory.reset && window.__DJSC.calibHistory.reset(); } catch (e) {}
            alert('✅ 已重置');
            const panels = document.querySelectorAll('.dialog.fullheight');
            if (panels.length) panels[panels.length - 1].remove();
        });

        /* ★ 导出按钮（用 game.writeFile 保存到 data 文件夹） */
        const exportBtn = document.getElementById('djsc-brain-export');
        if (exportBtn) exportBtn.addEventListener('click', function () {
            try {
                const json = window.__DJSC.trainExport ? window.__DJSC.trainExport() : '{}';
                const filename = '无名AI学习数据_' + Date.now() + '.json';
                game.writeFile(json, 'data', filename, function () {
                    alert('✅ 导出成功！\n\n文件已保存到：\ndata/' + filename);
                });
            } catch (e) {
                alert('❌ 导出失败：' + e);
            }
        });

        /* ★ 导入按钮 */
        const importBtn = document.getElementById('djsc-brain-import');
        if (importBtn) importBtn.addEventListener('click', function () {
            const input = prompt('请粘贴别人发给你的学习数据JSON：\n（太长可以分段粘贴，建议用文件）');
            if (!input) return;
            try {
                const result = window.__DJSC.trainImport ? window.__DJSC.trainImport(input) : { ok: false, err: '功能未加载' };
                if (result.ok) {
                    alert('✅ 导入成功！\n\n新增样本：' + result.added + ' 条\n合并样本：' + result.merged + ' 条\n跳过样本：' + result.skipped + ' 条\n\n当前总样本：' + result.total + ' 条');
                    const panels = document.querySelectorAll('.dialog.fullheight');
                    if (panels.length) panels[panels.length - 1].remove();
                    openBrainDashboard();
                } else {
                    alert('❌ 导入失败：' + result.err);
                }
            } catch (e) {
                alert('❌ 导入失败：' + e);
            }
        });
    } catch (e) {}
}

if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.openBrainDashboard = openBrainDashboard;
}

/* ================= 特征实时显示面板 ================= */
export function showFeatures() {
    try {
        const me = game.me;
        if (!me) { alert('游戏未开始'); return; }

        /* 动态导入 features.js */
        import('./features.js').then(function(featMod) {
            const { extractFeatures, FEATURE_DIM } = featMod;
            const feat = new Int8Array(FEATURE_DIM);
            extractFeatures(me, { type: 'end', id: 'end' }, {}, feat,
                (game.players || []).filter(function(p) { return p && p.alive !== false; })
            );

            /* 特征名称 */
            const names = [
                // 0-31 状态特征
                '0:我的血量', '1:我的手牌数', '2:我的装备数', '3:我的总价值',
                '4:我的血量比例', '5:手牌平均价值', '6:装备平均价值', '7:存活玩家数',
                '8:敌方存活数', '9:友方存活数', '10:下一玩家距离', '11:上一玩家距离',
                '12:牌堆剩余', '13:弃牌堆剩余', '14:当前回合数', '15:游戏阶段',
                '16:我有杀', '17:我有闪', '18:我有桃', '19:我有酒',
                '20:我有无懈', '21:我有决斗', '22:我有AOE', '23:我有武器',
                '24:我有防具', '25:我有+1马', '26:我有-1马', '27:我有连弩',
                '28:我有八卦阵', '29:我有仁王盾', '30:我有藤甲', '31:我有狮子',
                // 32-47 动作特征
                '32:动作类型', '33:目标距离', '34:目标血量', '35:目标手牌数',
                '36:目标装备数', '37:目标血量比例', '38:是否可反击', '39:是否有闪',
                '40:是否有桃', '41:是否有酒', '42:是否有无懈', '43:是否有防具',
                '44:是否有马', '45:是否有武器', '46:是否残血', '47:是否满血',
                // 48-63 时序特征
                '48:节奏模式', '49:节奏阶段', '50:基础节奏分', '51:攻击倍率',
                '52:防守倍率', '53:爆发倍率', '54:风险等级', '55:进攻风险',
                '56:防守安全', '57:团队焦点', '58:焦点分数', '59:团队保护',
                '60:保护分数', '61:团队连招数', '62:座位压力', '63:下一敌人',
                // 64-79 相对强度特征
                '64:我的进攻力', '65:我的防御力', '66:我的爆发力', '67:我的控制力',
                '68:我的辅助力', '69:目标进攻力', '70:目标防御力', '71:目标爆发力',
                '72:目标控制力', '73:目标辅助力', '74:我vs目标进攻', '75:我vs目标防御',
                '76:我vs目标爆发', '77:我vs目标控制', '78:我vs目标辅助', '79:综合差距',
                // 80-95 概率/牌堆特征
                '80:目标有闪概率', '81:目标有桃概率', '82:目标有无懈概率', '83:目标有杀概率',
                '84:目标有酒概率', '85:牌堆闪比例', '86:牌堆杀比例', '87:牌堆桃比例',
                '88:牌堆总数比例', '89:下一回合威胁', '90:下一回合自伤', '91:下一回合击杀',
                '92:游戏阶段', '93:规则胜率', '94:冲突率', '95:样本数量',
                // 96-119 面板扩展特征
                '96:我的攻击技能数', '97:我的防御技能数', '98:我的爆发技能数', '99:我的控制技能数',
                '100:目标攻击技能数', '101:目标爆发技能数', '102:对手进攻倾向', '103:对手仇恨度',
                '104:可触发连招数', '105:连招威胁度', '106:对手摸牌概率', '107:对手出杀概率',
                '108:对手激进程度', '109:对手紧张度', '110:下家威胁度', '111:上家威胁度',
                '112:队友集火数', '113:队友保护数', '114:未来1回合收益', '115:未来3回合收益',
                '116:我的牌价值', '117:我的装备价值', '118:模型置信度', '119:历史冲突次数',
            ];

            /* 生成HTML */
            let html = '<div style="padding:16px; max-height:70vh; overflow-y:auto;">';
            html += '<div style="text-align:center; margin-bottom:16px; font-size:16px; color:#7fe3a0;">';
            html += '当前特征值（' + FEATURE_DIM + '维）';
            html += '</div>';

            /* 按组显示 */
            const groups = [
                { name: '状态特征 (0-31)', start: 0, end: 32 },
                { name: '动作特征 (32-47)', start: 32, end: 48 },
                { name: '时序特征 (48-63)', start: 48, end: 64 },
                { name: '相对强度 (64-79)', start: 64, end: 80 },
                { name: '概率/牌堆 (80-95)', start: 80, end: 96 },
                { name: '面板扩展 (96-119)', start: 96, end: 120 },
            ];

            groups.forEach(function(g) {
                html += '<div style="margin:12px 0 6px; font-size:13px; color:#7fd4e3; border-bottom:1px solid #333; padding-bottom:4px;">' + g.name + '</div>';
                html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:2px 12px; font-size:11px;">';
                for (let i = g.start; i < g.end && i < FEATURE_DIM; i++) {
                    const v = feat[i];
                    const color = v > 60 ? '#7fe3a0' : (v > 20 ? '#ffd43b' : '#ff6b6b');
                    html += '<div style="display:flex; justify-content:space-between; padding:1px 0;">';
                    html += '<span style="color:#a8b8c8;">' + (names[i] || ('特征' + i)) + '</span>';
                    html += '<span style="color:' + color + '; font-weight:bold;">' + v + '</span>';
                    html += '</div>';
                }
                html += '</div>';
            });

            html += '</div>';

            /* 打开面板 */
            const dlg = ui.create.dialog('特征实时显示');
            dlg.classList.add('fullheight');
            dlg.style.width = 'min(92vw, 500px)';
            dlg.style.left = '4vw';
            dlg.content.innerHTML = html;
        }).catch(function(e) {
            alert('加载特征模块失败：' + e.message);
        });

    } catch (e) {
        alert('显示特征失败：' + e.message);
    }
}

if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.showFeatures = showFeatures;
}
