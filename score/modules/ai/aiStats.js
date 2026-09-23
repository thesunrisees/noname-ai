/* ================= 决策积分引擎 · AI 统计对比 ================= */
export function aggregateByPlayer(decisionLog, recCards) {
	try {
		const map = {};
		const ensure = function (k) {
			if (!map[k]) map[k] = { player: k, decisions: 0, skillUses: {}, cardUses: {}, totalSkillUse: 0, totalCardUse: 0, avgScore: 0, scoreSum: 0 };
			return map[k];
		};
		(decisionLog || []).forEach(function (e) {
			const p = e.player || "?";
			const m = ensure(p);
			m.decisions++;
			if (e.winner) {
				if (e.winner.type === "skill") { m.skillUses[e.winner.id] = (m.skillUses[e.winner.id] || 0) + 1; m.totalSkillUse++; }
				else if (e.winner.type === "card") { m.cardUses[e.winner.id] = (m.cardUses[e.winner.id] || 0) + 1; m.totalCardUse++; }
				if (typeof e.winner.score === "number") { m.scoreSum += e.winner.score; m.avgScore = Math.round((m.scoreSum / m.decisions) * 100) / 100; }
			}
		});
		return map;
	} catch (e) { return {}; }
}

export function buildComparisonHtml(aggregated) {
	try {
		const rows = Object.keys(aggregated).map(function (k) { return aggregated[k]; });
		if (!rows.length) return "<div style='color:#666;font-size:11px;'>暂无决策记录</div>";
		rows.sort(function (a, b) { return b.decisions - a.decisions; });
		let html = "<div style='font-size:11px;'>";
		html += "<span style='display:inline-block;width:74px;color:#9ad8ff'>玩家</span>";
		html += "<span style='display:inline-block;width:52px;color:#9ad8ff'>决策数</span>";
		html += "<span style='display:inline-block;width:52px;color:#9ad8ff'>技能</span>";
		html += "<span style='display:inline-block;width:52px;color:#9ad8ff'>出牌</span>";
		html += "<span style='display:inline-block;width:56px;color:#9ad8ff'>均分</span>";
		html += "<span style='color:#9ad8ff'>常用技能</span><br>";
		rows.forEach(function (r) {
			const skills = Object.keys(r.skillUses).sort(function (a, b) { return r.skillUses[b] - r.skillUses[a]; }).slice(0, 3);
			html += "<span style='display:inline-block;width:74px;color:#dbe7f5'>" + r.player + "</span>";
			html += "<span style='display:inline-block;width:52px'>" + r.decisions + "</span>";
			html += "<span style='display:inline-block;width:52px;color:#ffd479'>" + r.totalSkillUse + "</span>";
			html += "<span style='display:inline-block;width:52px;color:#7fe3a0'>" + r.totalCardUse + "</span>";
			html += "<span style='display:inline-block;width:56px;color:#9ad8ff'>" + r.avgScore + "</span>";
			html += "<span style='color:#a8b8c8'>" + skills.join("、") + "</span><br>";
		});
		html += "</div>";
		return html;
	} catch (e) { return "<div style='color:#666;font-size:11px;'>统计异常</div>"; }
}
