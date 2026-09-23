/* ================= 决策积分引擎 · 决策解释器 ================= */
import { getDecisionLog } from '../core/engine.js';

const SIGNAL_LABELS = {
	tempo: {
		early: '蓄爆期：AI 倾向留闪桃、观察局势',
		mid: '常规期：AI 按正常节奏出牌',
		late: '发力期：AI 主动进攻、减少保留',
		endgame: '残局：AI 全力收割',
	},
	risk: {
		aggressive: '激进性格：AI 更爱拼点/属性杀/火攻',
		cautious: '保守性格：AI 留牌过冬，不轻易冒险',
		balanced: '均衡性格：AI 按局势灵活应对',
		loner: '独狼性格：AI 只关心自己',
		guardian: '守护性格：AI 优先保护队友',
	},
};

export function explainDecision(entry) {
	try {
		if (!entry) return null;
		const w = entry.winner || {};
		const L = entry.layers || {};
		const candidates = entry.candidates || [];

		const lines = [];
		lines.push({
			icon: '🎯',
			title: '最终选择',
			content: w.type + ':' + w.id + (w.score !== undefined ? '（评分 ' + w.score + '）' : ''),
		});

		if (L.tempo) {
			const t = L.tempo;
			const lbl = SIGNAL_LABELS.tempo[t.stage] || t.stage;
			lines.push({
				icon: '⏱',
				title: '节奏（' + t.stage + ' ×' + t.baseTempo + '）',
				content: lbl + '｜攻×' + t.atkMul + ' 守×' + t.keepMul + ' 爆×' + t.burstMul,
			});
		}

		if (L.risk) {
			const r = L.risk;
			const lbl = SIGNAL_LABELS.risk[r.label] || r.label;
			lines.push({
				icon: '🎭',
				title: '性格（' + r.label + '）',
				content: lbl + '｜攻×' + r.atk + ' 守×' + r.def,
			});
		}

		if (L.team) {
			const tm = L.team;
			const parts = [];
			if (tm.focus) parts.push('集火 ' + tm.focus + '（' + tm.focusScore + '）');
			if (tm.protect) parts.push('保护 ' + tm.protect + '（' + tm.protectScore + '）');
			if (tm.comboCount) parts.push('联动 ' + tm.comboCount + ' 条');
			if (parts.length) {
				lines.push({
					icon: '🤝',
					title: '团队',
					content: parts.join('｜'),
				});
			}
		}

		if (L.econ) {
			const e = L.econ;
			lines.push({
				icon: '💰',
				title: '经济',
				content: '手' + e.handCount + '张(' + e.handValue + ') 装' + e.equipCount + '件(' + e.equipValue + ') HP' + e.hp + '/' + e.maxHp,
			});
		}

		if (L.style && L.style.tag) {
			lines.push({
				icon: '🕵',
				title: '博弈',
				content: '目标 ' + (L.style.target || '?') + ' 风格：' + L.style.tag,
			});
		}

		if (L.forecast) {
			const f = L.forecast;
			lines.push({
				icon: '🔮',
				title: '预测',
				content: f.advice + '（压力 ' + f.incomingTotal + ' 风险 ' + Math.round((f.selfRisk || 0) * 100) + '%）',
			});
		}

		let gapHtml = '';
		if (candidates.length >= 2) {
			const gap = (candidates[0].score || 0) - (candidates[1].score || 0);
			const quality = gap >= 3 ? '碾压胜出' : (gap <= 0.8 ? '五五开' : '正常');
			const qColor = gap >= 3 ? '#7fe3a0' : (gap <= 0.8 ? '#ffd479' : '#9ad8ff');
			gapHtml = '<div style="color:' + qColor + ';font-size:10px;margin-top:2px;">决策质量：' + quality + '（差距 ' + Math.round(gap * 100) / 100 + '）</div>';
		}

		return { lines: lines, gapHtml: gapHtml, entry: entry };
	} catch (e) { return null; }
}

export function renderExplainHtml(entry) {
	const ex = explainDecision(entry);
	if (!ex) return '';
	let h = "<div style='font-size:11px;padding:6px 8px;background:rgba(154,216,255,0.04);border-left:3px solid #9ad8ff;border-radius:3px;margin:6px 0;'>";
	ex.lines.forEach(function (l) {
		h += "<div style='margin:3px 0;'>";
		h += "<span style='display:inline-block;width:20px;color:#9ad8ff;'>" + l.icon + "</span>";
		h += "<span style='display:inline-block;width:120px;color:#7fe3a0;font-size:10px;'>" + l.title + "</span>";
		h += "<span style='color:#dbe7f5;'>" + l.content + "</span>";
		h += "</div>";
	});
	h += ex.gapHtml;
	h += "</div>";
	return h;
}

export function recentExplains(n) {
	try {
		const log = getDecisionLog();
		return log.slice(-(n || 3)).reverse().map(explainDecision).filter(function (x) { return !!x; });
	} catch (e) { return []; }
}
