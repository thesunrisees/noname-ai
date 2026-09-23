/* ================= 决策点观测面板 =================
 * 把 4 个数据源合并成一张主表，可视化 + 手动干预。
 */

import { DECISION_REGISTRY, listDecisionPoints, setTrust, getTrust } from '../analysis/decisionRegistry.js';
import { getStats as getBanditStats } from '../learning/bandit.js';
import { getRegretStats, resetRegretStats } from '../learning/autoDiscover.js';
import { getProbeStats, resetProbes, autoRegister } from '../misc/globalScanner.js';

/* ========== 合并数据 ========== */
function buildMasterTable() {
    const reg = DECISION_REGISTRY;
    const bandit = getBanditStats();
    const regret = getRegretStats();
    const probe = getProbeStats();

    const allNames = new Set();
    for (const k in reg) allNames.add(k);
    for (const k in bandit) allNames.add(k);
    for (const k in regret) allNames.add(k);
    for (const k in probe) allNames.add(k);

    const rows = [];
    for (const name of allNames) {
        const r = reg[name] || {};
        const b = bandit[name] || {};
        const g = regret[name] || {};
        const p = probe[name] || {};

        rows.push({
            name: name,
            category: r.category || (g.count > 0 ? 'shadow' : 'probe'),
            trust: r.trust !== undefined ? r.trust : 0,
            desc: r.desc || '',
            auto: !!r.autoDiscovered,
            skip: !!r.skip,

            /* Bandit 数据 */
            pulls: b.pulls || 0,
            avgReward: b.pulls > 0 ? (b.totalReward / b.pulls) : 0,

            /* 后悔值 */
            regretCount: g.count || 0,
            regretAvg: g.count > 0 ? (g.totalDiff / g.count) : 0,

            /* 探针数据 */
            calls: p.calls || 0,
            errors: p.errors || 0,
            errorRate: p.calls > 0 ? (p.errors / p.calls) : 0,
            retType: dominantType(p.retTypes),
        });
    }

    rows.sort(function (a, b) {
        /* 排序优先级：auto > core > low > shadow > probe */
        const order = { auto: 0, core: 1, low: 2, mid: 3, other: 4, shadow: 5, probe: 6 };
        const oa = order[a.category] !== undefined ? order[a.category] : 9;
        const ob = order[b.category] !== undefined ? order[b.category] : 9;
        if (oa !== ob) return oa - ob;
        return b.calls - a.calls;
    });
    return rows;
}

function dominantType(types) {
    if (!types) return '-';
    let max = 0, ret = '-';
    for (const t in types) {
        if (types[t] > max) { max = types[t]; ret = t; }
    }
    return ret;
}

/* ========== 面板 HTML ========== */
function buildPanelHtml(rows) {
    let html = '';
    html += '<div style="padding: 12px; max-height: 75vh; overflow-y: auto; font-size: 12px;">';
    html += '<h3 style="color: #9ad8ff; margin: 0 0 8px;">决策点观测面板</h3>';

    /* ★ 训练状态区域 */
    let trainState = 'unknown', gamesSince = 0, ready = false, accuracy = 0, sampleCount = 0;
    try { if (window.__DJSC && window.__DJSC.modelState) {
        trainState = window.__DJSC.modelState.getState();
        gamesSince = window.__DJSC.modelState.getGamesSince();
    }} catch (e) {}
    try { ready = window.__DJSC.weightsReady(); } catch (e) {}
    try { accuracy = window.__DJSC.getAccuracy ? window.__DJSC.getAccuracy() : 0; } catch (e) {}
    try { sampleCount = window.__DJSC.trainBufferSize ? window.__DJSC.trainBufferSize() : 0; } catch (e) {}

    const stateColor = trainState === 'stable' ? '#6f6' : (trainState === 'training' ? '#fd6' : '#fa0');

    html += '<div style="background:#1e2a3e; border-radius:6px; padding:10px; margin-bottom:12px;">';
    html += '<div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:8px; text-align:center;">';
    html += '<div><div style="color:#888; font-size:10px;">样本数</div><div style="color:#9ad8ff; font-size:16px;">' + sampleCount + '</div></div>';
    html += '<div><div style="color:#888; font-size:10px;">模型状态</div><div style="color:' + stateColor + '; font-size:16px;">' + trainState + '</div></div>';
    html += '<div><div style="color:#888; font-size:10px;">就绪</div><div style="color:' + (ready ? '#6f6' : '#888') + '; font-size:16px;">' + (ready ? '是' : '否') + '</div></div>';
    html += '<div><div style="color:#888; font-size:10px;">准确率</div><div style="color:#fd6; font-size:16px;">' + (accuracy * 100).toFixed(1) + '%</div></div>';
    html += '</div>';
    html += '<div style="margin-top:8px; text-align:center; color:#888; font-size:10px;">当前阶段局数：' + gamesSince + '</div>';
    html += '</div>';

    /* 训练控制按钮 */
    html += '<div style="margin-bottom:10px; text-align:center;">';
    html += '<button id="djsc-btn-force-train" style="background:#4a6; color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; margin-right:4px; font-size:11px;">强制训练</button>';
    html += '<button id="djsc-btn-force-promote" style="background:#64a; color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; margin-right:4px; font-size:11px;">强制提升</button>';
    html += '<button id="djsc-btn-force-discard" style="background:#c55; color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:11px;">丢弃候选</button>';
    html += '</div>';

    html += '<p style="color: #888; margin: 0 0 12px;">共 ' + rows.length + ' 个决策点</p>';

    /* 顶部按钮 */
    html += '<div style="margin-bottom: 10px;">';
    html += '<button id="djsc-btn-autoreg" style="background:#4a6; color:#fff; border:none; padding:5px 12px; border-radius:4px; cursor:pointer; margin-right:6px;">执行自动注册</button>';
    html += '<button id="djsc-btn-reset-regret" style="background:#c55; color:#fff; border:none; padding:5px 12px; border-radius:4px; cursor:pointer; margin-right:6px;">清空后悔值</button>';
    html += '<button id="djsc-btn-reset-probe" style="background:#c55; color:#fff; border:none; padding:5px 12px; border-radius:4px; cursor:pointer;">清空探针</button>';
    html += '</div>';

    /* 表头 */
    html += '<table style="width:100%; border-collapse: collapse; color:#ddd;">';
    html += '<tr style="background:#2a2a3e; color:#9ad8ff;">';
    html += '<th style="padding:4px; text-align:left;">决策点</th>';
    html += '<th style="padding:4px;">trust</th>';
    html += '<th style="padding:4px;">调用</th>';
    html += '<th style="padding:4px;">平均分</th>';
    html += '<th style="padding:4px;">后悔</th>';
    html += '<th style="padding:4px;">返回</th>';
    html += '<th style="padding:4px;">操作</th>';
    html += '</tr>';

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const bg = i % 2 === 0 ? '#1e1e2e' : '#25253a';
        html += '<tr style="background:' + bg + ';">';
        html += '<td style="padding:4px;">';
        if (r.auto) html += '<span style="color:#fa0;">●</span> ';
        html += '<span style="color:' + (r.skip ? '#888' : '#fff') + ';">' + r.name + '</span>';
        html += '</td>';
        html += '<td style="padding:4px; text-align:center; color:' + trustColor(r.trust) + ';">' + r.trust.toFixed(2) + '</td>';
        html += '<td style="padding:4px; text-align:center;">' + r.calls + '</td>';
        html += '<td style="padding:4px; text-align:center;">' + r.avgReward.toFixed(1) + '</td>';
        html += '<td style="padding:4px; text-align:center; color:' + (r.regretAvg > 30 ? '#f66' : '#aaa') + ';">' + Math.round(r.regretAvg) + '</td>';
        html += '<td style="padding:4px; text-align:center; color:#7ae;">' + r.retType + '</td>';
        html += '<td style="padding:4px; text-align:center;">';
        html += '<button class="djsc-trust-btn" data-name="' + r.name + '" data-delta="-0.1" style="background:#333; color:#fff; border:none; padding:2px 6px; border-radius:3px; cursor:pointer;">-</button>';
        html += '<button class="djsc-trust-btn" data-name="' + r.name + '" data-delta="0.1" style="background:#333; color:#fff; border:none; padding:2px 6px; border-radius:3px; cursor:pointer; margin-left:2px;">+</button>';
        html += '</td>';
        html += '</tr>';
    }
    html += '</table>';
    html += '</div>';

    /* ===== 认知日志区块 ===== */
    try {
        const CS = window.__DJSC.cognitionLog && window.__DJSC.cognitionLog.stats
            ? window.__DJSC.cognitionLog.stats() : { total: 0 };
        const CF = window.__DJSC.conflict && window.__DJSC.conflict.stats
            ? window.__DJSC.conflict.stats() : { checks: 0, conflicts: 0 };
        const recent = window.__DJSC.cognitionLog && window.__DJSC.cognitionLog.recent
            ? window.__DJSC.cognitionLog.recent(8) : [];

        html += '<div style="background:#1e2a3e; border-radius:6px; padding:10px; margin:12px 0;">';
        html += '<div style="color:#9ad8ff; font-weight:bold; margin-bottom:6px;">🧠 元认知与冲突</div>';
        html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; text-align:center; font-size:11px;">';
        html += '<div><div style="color:#888;">认知日志</div><div style="color:#7fe3a0; font-size:16px;">' + CS.total + '</div></div>';
        html += '<div><div style="color:#888;">认知冲突</div><div style="color:#ff9c9c; font-size:16px;">' + (CF.conflicts || 0) + ' (' + (CF.rate || '0%') + ')</div></div>';
        html += '</div>';
        html += '<div style="font-size:11px; color:#a8b8c8; margin-top:8px;">';
        html += '干预分布：';
        if (CS.byIntervention) {
            Object.keys(CS.byIntervention).forEach(function (k) {
                html += k + '=' + CS.byIntervention[k] + ' ';
            });
        }
        html += '</div>';
        html += '<div style="font-size:11px; color:#a8b8c8; margin-top:4px;">';
        html += '认知级别：';
        if (CS.byLevelRate) {
            Object.keys(CS.byLevelRate).forEach(function (k) {
                html += k + '=' + CS.byLevelRate[k] + ' ';
            });
        }
        html += '</div>';

        if (recent.length) {
            html += '<div style="margin-top:8px; font-size:11px; max-height:140px; overflow-y:auto;">';
            recent.forEach(function (r) {
                const col = r.intervention === 'model' ? '#7fe3a0' : (r.intervention === 'blend' ? '#ffd479' : '#ff9c9c');
                html += '<div style="border-bottom:1px solid #2a3a5a; padding:3px 0;">';
                html += '<span style="color:' + col + ';">[' + r.intervention + ']</span> ';
                html += r.player + ' → ' + r.action;
                if (r.meta) html += ' <span style="color:#888;">F' + Math.round(r.meta.familiarity * 100) + '%</span>';
                html += '</div>';
            });
            html += '</div>';
        }
        html += '</div>';
    } catch (e) {}

    return html;
}

function trustColor(t) {
    if (t >= 0.7) return '#6f6';
    if (t >= 0.4) return '#fd6';
    if (t >= 0.2) return '#f96';
    return '#888';
}

/* ========== 打开面板 ========== */
export function openDecisionDashboard() {
    const rows = buildMasterTable();
    const html = buildPanelHtml(rows);

    const dialog = document.createElement('div');
    dialog.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center;';
    const panel = document.createElement('div');
    panel.style.cssText = 'background:#1a1a2e; border-radius:10px; width:92%; max-width:720px; color:#fff;';
    panel.innerHTML = html;
    dialog.appendChild(panel);
    document.body.appendChild(dialog);

    /* 关闭：点外部 */
    dialog.addEventListener('click', function (e) {
        if (e.target === dialog) document.body.removeChild(dialog);
    });

    /* trust 加减 */
    panel.querySelectorAll('.djsc-trust-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const name = this.dataset.name;
            const delta = parseFloat(this.dataset.delta);
            const cur = getTrust(name);
            const nv = Math.max(0, Math.min(1, cur + delta));
            setTrust(name, nv);
            /* 简单刷新：重开面板 */
            document.body.removeChild(dialog);
            openDecisionDashboard();
        });
    });

    /* 自动注册 */
    panel.querySelector('#djsc-btn-autoreg').addEventListener('click', function () {
        const r = autoRegister();
        alert('自动注册完成\n新增：' + (r.registered.length) + ' 个\n跳过：' + (r.skipped.length) + ' 个');
        document.body.removeChild(dialog);
        openDecisionDashboard();
    });

    /* 清空后悔值 */
    panel.querySelector('#djsc-btn-reset-regret').addEventListener('click', function () {
        if (confirm('清空所有后悔值？')) {
            resetRegretStats();
            document.body.removeChild(dialog);
            openDecisionDashboard();
        }
    });

    /* 清空探针 */
    panel.querySelector('#djsc-btn-reset-probe').addEventListener('click', function () {
        if (confirm('清空所有探针数据？')) {
            resetProbes();
            document.body.removeChild(dialog);
            openDecisionDashboard();
        }
    });

    /* ★ 强制训练 */
    const btnTrain = panel.querySelector('#djsc-btn-force-train');
    if (btnTrain) {
        btnTrain.addEventListener('click', function () {
            try {
                if (window.__DJSC && window.__DJSC.forceTrain) {
                    window.__DJSC.forceTrain();
                    alert('已触发训练，请等待几秒钟后刷新面板');
                } else {
                    alert('训练系统未就绪');
                }
            } catch (e) { alert('训练失败：' + e.message); }
        });
    }

    /* ★ 强制提升 */
    const btnPromote = panel.querySelector('#djsc-btn-force-promote');
    if (btnPromote) {
        btnPromote.addEventListener('click', function () {
            try {
                if (window.__DJSC && window.__DJSC.forcePromote) {
                    window.__DJSC.forcePromote();
                    alert('已强制提升候选模型');
                    document.body.removeChild(dialog);
                    openDecisionDashboard();
                } else {
                    alert('没有候选模型可提升');
                }
            } catch (e) { alert('提升失败：' + e.message); }
        });
    }

    /* ★ 丢弃候选 */
    const btnDiscard = panel.querySelector('#djsc-btn-force-discard');
    if (btnDiscard) {
        btnDiscard.addEventListener('click', function () {
            try {
                if (window.__DJSC && window.__DJSC.forceDiscard) {
                    window.__DJSC.forceDiscard();
                    alert('已丢弃候选模型');
                    document.body.removeChild(dialog);
                    openDecisionDashboard();
                } else {
                    alert('没有候选模型可丢弃');
                }
            } catch (e) { alert('丢弃失败：' + e.message); }
        });
    }
}

if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.openDecisionDashboard = openDecisionDashboard;
    window.__DJSC.masterTable = buildMasterTable;
}
