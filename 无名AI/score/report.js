/* ================= 决策积分引擎 · 结算战报 =================
 * 目的：终局时生成一页图文报告，浓缩本局决策质量与关键节点。
 * 叶子模块：仅依赖 engine / observer / memory 的对外查询接口。
 */
import { lib, game, ui, get, _status } from '../../../noname.js';
import { getRound, getScoreLog, getDecisionLog } from './engine.js';
import { styleOf } from './observer.js';
import { storeStats } from './memory.js';
import { archiveStats } from './archive.js';

let _reportShown = false;
let _reportDialog = null;

function _esc(s) {
	return String(s == null ? "" : s)
		.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function _bar(pct, color) {
	const c = color || (pct >= 60 ? "#7fe3a0" : pct >= 30 ? "#ffd479" : "#5a7aa8");
	return "<span style='display:inline-block;width:120px;height:10px;background:#14243c;border-radius:5px;overflow:hidden;vertical-align:middle;'>" +
		"<span style='display:inline-block;width:" + Math.max(0, Math.min(100, pct)) + "%;height:100%;background:" + c + ";'></span>" +
		"</span>";
}
function _identityTag(p) {
	try {
		const id = p && p.identity;
		if (id === "zhu") return "<span style='color:#ffd479'>[主公]</span>";
		if (id === "zhong" || id === "mingzhong") return "<span style='color:#7fe3a0'>[忠臣]</span>";
		if (id === "fan") return "<span style='color:#ff9c9c'>[反贼]</span>";
		if (id === "nei") return "<span style='color:#9ad8ff'>[内奸]</span>";
		return "";
	} catch (e) { return ""; }
}

function _getRoundNumber() {
	try {
		if (_status && typeof _status.roundNumber === "number") return _status.roundNumber;
		if (typeof game === "object" && typeof game.roundNumber === "number") return game.roundNumber;
		if (typeof game === "object" && typeof game.round === "number") return game.round;
	} catch (e) {}
	return 0;
}

function _sectionOverview() {
	const round = _getRoundNumber();
	const alive = (game.players || []).filter(function (p) { return p && p.alive !== false; }).length;
	const total = (game.players || []).length;
	const log = getDecisionLog();
	const scores = getScoreLog();
	/* 性格三维卡（含身份基线） */
	const personalityCard = (function () {
		try {
			const preset = (lib.config && lib.config["extension_无名AI_riskProfile"]) || "custom";
			const PS = { aggressive: {agg:80,rsk:70,team:40}, balanced: {agg:50,rsk:50,team:50}, cautious: {agg:30,rsk:30,team:70}, loner: {agg:70,rsk:60,team:10}, guardian: {agg:30,rsk:20,team:90} };
			let agg, rsk, tea;
			if (preset !== "custom" && PS[preset]) { agg = PS[preset].agg; rsk = PS[preset].rsk; tea = PS[preset].team; }
			else {
				const gv = function (k, d) { return (lib.config["extension_无名AI_" + k] !== undefined) ? lib.config["extension_无名AI_" + k] : d; };
				agg = Number(gv("personalityAggression", 50)) || 50;
				rsk = Number(gv("personalityRisk", 50)) || 50;
				tea = Number(gv("personalityTeam", 50)) || 50;
			}
			let idMod = { agg: 0, rsk: 0, team: 0 };
			let idTag = "none";
			try {
				const md = (_status && _status.mode) || (get && get.mode ? get.mode() : "");
				if ((md === "identity" || md === "guozhan") && game.me && game.me.identity) {
					const IM = { zhu: {agg:-15,rsk:-10,team:10}, zhong: {agg:5,rsk:-5,team:15}, mingzhong: {agg:5,rsk:-5,team:15}, fan: {agg:15,rsk:10,team:5}, nei: {agg:5,rsk:15,team:-10} };
					if (IM[game.me.identity]) { idMod = IM[game.me.identity]; idTag = game.me.identity; }
				}
			} catch (e) {}
			const effAgg = Math.max(0, Math.min(100, agg + idMod.agg));
			const effRsk = Math.max(0, Math.min(100, rsk + idMod.rsk));
			const effTea = Math.max(0, Math.min(100, tea + idMod.team));
			return _card("性格预设", preset, "#ffd479") +
				_card("身份基线", idTag === "none" ? "—" : idTag + " " + (idMod.agg >= 0 ? "+" : "") + idMod.agg + "/" + (idMod.rsk >= 0 ? "+" : "") + idMod.rsk + "/" + (idMod.team >= 0 ? "+" : "") + idMod.team, "#9ad8ff") +
				_card("攻守/冒险/团队", effAgg + "/" + effRsk + "/" + effTea, "#7fe3a0");
		} catch (e) { return ""; }
	})();
	/* 归档统计 */
	let archiveCards = "";
	try {
		const st = archiveStats();
		if (st && st.count > 0) {
			archiveCards = _card("历史局数", st.count, "#9ad8ff") +
				_card("历史平均", st.avgScore, st.avgScore >= 0 ? "#7fe3a0" : "#ff9c9c");
		}
	} catch (e) {}
	return "<div style='display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;'>" +
		_card("回合数", round, "#9ad8ff") +
		_card("存活", alive + " / " + total, "#7fe3a0") +
		_card("决策步数", log.length, "#ffd479") +
		_card("记分事件", scores.length, "#a8b8c8") +
		personalityCard +
		archiveCards +
		"</div>";
}
function _card(label, value, color) {
	return "<div style='flex:1;min-width:88px;padding:8px;background:rgba(255,255,255,0.04);border-radius:6px;text-align:center;'>" +
		"<div style='font-size:11px;color:#9ad8ff;margin-bottom:3px;'>" + _esc(label) + "</div>" +
		"<div style='font-size:18px;font-weight:600;color:" + (color || "#dbe7f5") + ";'>" + _esc(value) + "</div>" +
		"</div>";
}

function _sectionRank() {
	const rr = getRound();
	const keys = Object.keys(rr);
	if (!keys.length) return "";
	const name2p = {};
	(game.players || []).forEach(function (p) { try { if (p) name2p[p.name] = p; } catch (e) {} });
	const rows = keys.map(function (k) {
		const p = name2p[k];
		return { name: k, pts: rr[k], player: p };
	}).sort(function (a, b) { return b.pts - a.pts; });
	const maxAbs = Math.max(1, Math.max.apply(null, rows.map(function (r) { return Math.abs(r.pts); })));
	let h = "<b style='color:#9ad8ff'>① 积分排行（守恒：一方的分=另一方的失分）</b><br>";
	h += "<div style='font-size:11px;color:#c8d8ea;margin-top:4px;'>";
	rows.forEach(function (r) {
		const pct = Math.round((Math.abs(r.pts) / maxAbs) * 100);
		const color = r.pts >= 0 ? "#7fe3a0" : "#ff9c9c";
		h += "<div style='display:flex;align-items:center;margin:3px 0;gap:8px;'>";
		h += "<span style='width:90px;color:#dbe7f5;'>" + _esc(r.name) + " " + (r.player ? _identityTag(r.player) : "") + "</span>";
		h += _bar(pct, color);
		h += "<span style='width:56px;text-align:right;color:" + color + ";font-weight:500;'>" + (r.pts > 0 ? "+" : "") + r.pts + "</span>";
		h += "</div>";
	});
	h += "</div>";
	const sum = Math.round(rows.reduce(function (s, r) { return s + r.pts; }, 0) * 100) / 100;
	h += "<div style='font-size:11px;color:#666;margin-top:3px;'>合计：" + sum + "（应恒为 0）</div>";
	return h;
}

function _sectionQuality() {
	const log = getDecisionLog();
	if (!log.length) return "";
	let crush = 0, close = 0, normal = 0;
	log.forEach(function (e) {
		const cands = e.candidates || [];
		if (cands.length < 2) { normal++; return; }
		const gap = (cands[0].score || 0) - (cands[1].score || 0);
		if (gap >= 3) crush++;
		else if (gap <= 0.8) close++;
		else normal++;
	});
	let h = "<b style='color:#9ad8ff'>② 决策质量分布（本局 " + log.length + " 步）</b><br>";
	h += "<div style='font-size:11px;margin-top:4px;'>";
	h += "<div style='margin:2px 0;'><span style='display:inline-block;width:96px;color:#7fe3a0;'>碾压胜出(≥3分)</span>" + _bar(Math.round((crush / log.length) * 100), "#7fe3a0") + " " + crush + " 步</div>";
	h += "<div style='margin:2px 0;'><span style='display:inline-block;width:96px;color:#9ad8ff;'>正常决策</span>" + _bar(Math.round((normal / log.length) * 100), "#9ad8ff") + " " + normal + " 步</div>";
	h += "<div style='margin:2px 0;'><span style='display:inline-block;width:96px;color:#ffd479;'>接近五五开(≤0.8)</span>" + _bar(Math.round((close / log.length) * 100), "#ffd479") + " " + close + " 步</div>";
	h += "</div>";
	return h;
}

function _sectionHighlights() {
	const log = getDecisionLog();
	if (log.length < 1) return "";
	let best = null, closest = null, closestGap = Infinity;
	log.forEach(function (e) {
		if (!e.winner || !e.candidates) return;
		if (!best || (e.winner.score || 0) > (best.winner.score || 0)) best = e;
		if (e.candidates.length >= 2) {
			const gap = Math.abs((e.candidates[0].score || 0) - (e.candidates[1].score || 0));
			if (gap < closestGap) { closestGap = gap; closest = e; }
		}
	});
	let h = "<b style='color:#9ad8ff'>③ 精选决策</b><br>";
	h += "<div style='font-size:11px;color:#c8d8ea;margin-top:4px;'>";
	const render = function (tag, color, entry) {
		if (!entry) return "";
		const w = entry.winner || {};
		const L = entry.layers || {};
		let s = "<div style='padding:6px 8px;border-left:3px solid " + color + ";background:rgba(255,255,255,0.02);margin:4px 0;'>";
		s += "<div><span style='color:" + color + ";'>" + tag + "</span> 轮 " + entry.round + " · " + _esc(entry.player) + " → <b>" + _esc(w.type) + ":" + _esc(w.id) + "</b>（" + (w.score || 0) + "）</div>";
		if (L.tempo && L.risk) s += "<div style='color:#888;'>信号：" + _esc(L.tempo.stage) + " / " + _esc(L.risk.label) +
			(L.team && L.team.focus ? " / 集火" + _esc(L.team.focus) : "") +
			(L.style && L.style.tag ? " / 对手" + _esc(L.style.tag) : "") + "</div>";
		s += "</div>";
		return s;
	};
	h += render("最高评分", "#7fe3a0", best);
	h += render("最胶着", "#ffd479", closest);
	h += "</div>";
	return h;
}

function _sectionOpponents() {
	const alive = (game.players || []).filter(function (p) { return p && p !== game.me; });
	if (!alive.length) return "";
	let h = "<b style='color:#9ad8ff'>④ 对手风格总结</b><br>";
	h += "<div style='font-size:11px;margin-top:4px;'>";
	alive.forEach(function (p) {
		const s = styleOf(p);
		const col = s.tag === "aggressive" ? "#ff9c9c" : s.tag === "cautious" ? "#7fe3a0" : s.tag === "vengeful" ? "#ffd479" : "#9ad8ff";
		const src = s.source === "stored" ? "历史" : s.source === "live" ? "本局" : "未知";
		h += "<div style='margin:2px 0;'><span style='display:inline-block;width:88px;color:#dbe7f5;'>" + _esc(p.name) + " " + _identityTag(p) + "</span>" +
			"<span style='display:inline-block;width:80px;color:" + col + ";'>" + _esc(s.tag) + "</span>" +
			"<span style='color:#666;'>攻" + (s.attacks || 0) + " 援" + (s.aids || 0) + " 记仇" + Math.round((s.vengeful || 0) * 100) + "% （" + src + "）</span></div>";
	});
	h += "</div>";
	return h;
}

function _sectionMemory() {
	let st = null;
	try { st = storeStats(); } catch (e) {}
	if (!st) return "";
	return "<b style='color:#9ad8ff'>⑤ 跨局记忆库</b><br>" +
		"<div style='font-size:11px;color:#c8d8ea;margin-top:4px;'>" +
		"已记录 <b style='color:#ffd479'>" + st.entries + "</b> 位老对手，共 <b style='color:#ffd479'>" + st.samples + "</b> 条行为样本。<br>" +
		"<span style='color:#666;'>（仅联机 / 有稳定 ID 时写入；本地 AI 对局不计入）</span>" +
		"</div>";
}

export function buildReportHtml() {
	try {
		const parts = [];
		parts.push(_sectionOverview());
		parts.push(_sectionRank());
		parts.push(_sectionQuality());
		parts.push(_sectionHighlights());
		parts.push(_sectionOpponents());
		parts.push(_sectionMemory());
		return parts.filter(Boolean).join("<br>");
	} catch (e) {
		return "<div style='color:#ff9c9c;'>战报生成异常：" + _esc(String(e).slice(0, 120)) + "</div>";
	}
}

export function showReport(force) {
	try {
		if (_reportShown && !force) return;
		if (_reportDialog) { try { _reportDialog.close(); } catch (e) {} _reportDialog = null; }

		let dlg = null;
		try { dlg = ui.create.dialog("无名AI · 对局战报"); } catch (eD) { dlg = null; }
		if (!dlg) return;
		_reportDialog = dlg;
		_reportShown = true;

		try {
			dlg.classList.add("fullheight");
			dlg.style.width = "min(92vw, 860px)";
			dlg.style.maxWidth = "92vw";
			dlg.style.left = "4vw";
		} catch (eS) {}

		const d = document.createElement("div");
		d.style.cssText = "color:#dbe7f5;font-size:12px;line-height:1.7;padding:6px 4px;";
		d.innerHTML = buildReportHtml();
		dlg.content.appendChild(d);
	} catch (e) {}
}

export function resetReportShown() { _reportShown = false; }
export function closeReport() {
	try { if (_reportDialog) _reportDialog.close(); } catch (e) {}
	_reportDialog = null;
}

/* ================= 决策回放导出 ================= */
export function exportDecisionsJson() {
	try {
		const log = getDecisionLog ? getDecisionLog() : [];
		const payload = {
			v: 1, ts: Date.now(),
			mode: (get && get.mode) ? get.mode() : (_status && _status.mode) || "unknown",
			round: _getRoundNumber(),
			player: game.me ? (game.me.name || "?") : "?",
			decisions: log.map(function (e) {
				const L = e.layers || {};
				return {
					round: e.round || 0, player: e.player || "?",
					winner: e.winner ? { type: e.winner.type, id: e.winner.id, score: e.winner.score, reason: e.winner.reason } : null,
					candidates: (e.candidates || []).map(function (c) { return { type: c.type, id: c.id, score: c.score, target: c.target || null, reason: c.reason || "" }; }),
					signals: { tempo: L.tempo || null, risk: L.risk || null, team: L.team || null, seat: L.seat || null, econ: L.econ || null, style: L.style || null, multiturn: L.multiturn || null },
				};
			}),
		};
		return JSON.stringify(payload, null, 2);
	} catch (e) { return "{}"; }
}

export function exportDecisionsMarkdown() {
	try {
		const log = getDecisionLog ? getDecisionLog() : [];
		if (!log.length) return "# 决策回放\n\n（无记录）";
		const mode = (get && get.mode) ? get.mode() : (_status && _status.mode) || "unknown";
		const round = _getRoundNumber();
		const player = game.me ? (game.me.name || "?") : "?";
		let md = "# 决策回放 · " + mode + " · 轮 " + round + "\n\n";
		md += "**玩家**：" + player + "　|　**记录步数**：" + log.length + "\n\n---\n\n";
		log.forEach(function (e, i) {
			const w = e.winner || {};
			const L = e.layers || {};
			md += "## #" + (log.length - i) + " 轮 " + (e.round || 0) + " · " + (e.player || "?") + "\n\n";
			md += "**胜出动作**：`" + (w.type || "?") + ":" + (w.id || "?") + "`";
			if (w.score !== undefined) md += "（评分 " + w.score + "）";
			md += "\n\n";
			if (w.reason) md += "> " + w.reason + "\n\n";
			md += "**信号**：\n\n";
			if (L.tempo) md += "- 节奏：" + L.tempo.stage + "\n";
			if (L.risk) md += "- 性格：" + L.risk.label + "\n";
			if (L.team) md += "- 团队：" + (L.team.focus ? "集火 " + L.team.focus : "无集火") + "\n";
			if (L.econ) md += "- 经济：手" + L.econ.handCount + " HP" + L.econ.hp + "/" + L.econ.maxHp + "\n";
			if (L.style && L.style.tag) md += "- 博弈：" + L.style.tag + "\n";
			if (L.multiturn) md += "- 趋势：" + L.multiturn.overall + "\n";
			md += "\n";
			if (e.candidates && e.candidates.length) {
				md += "**候选 Top" + Math.min(5, e.candidates.length) + "**：\n\n";
				md += "| # | 类型 | ID | 评分 | 目标 |\n|---|---|---|---|---|\n";
				e.candidates.slice(0, 5).forEach(function (c, j) {
					const isWin = w.type === c.type && w.id === c.id;
					md += "| " + (j + 1) + (isWin ? " ★" : "") + " | " + c.type + " | " + c.id + " | " + c.score + " | " + (c.target || "—") + " |\n";
				});
				md += "\n";
			}
			md += "---\n\n";
		});
		return md;
	} catch (e) { return "# 导出异常\n\n" + String(e); }
}

/* ================= 决策回放导入 ================= */
export function parseDecisionsJson(jsonStr) {
	try {
		if (typeof jsonStr !== "string") return { ok: false, err: "输入为空" };
		const obj = JSON.parse(jsonStr);
		if (!obj || typeof obj !== "object") return { ok: false, err: "JSON 结构错误" };
		if (!Array.isArray(obj.decisions)) return { ok: false, err: "无 decisions 数组" };
		return { ok: true, meta: { ts: obj.ts || 0, mode: obj.mode || "unknown", round: obj.round || 0, player: obj.player || "?" }, decisions: obj.decisions };
	} catch (e) {
		return { ok: false, err: "解析异常：" + String(e).slice(0, 80) };
	}
}

export function renderImportedDecisions(parsed) {
	try {
		if (!parsed || !parsed.ok) return "<div style='color:#ff9c9c;'>数据无效</div>";
		const meta = parsed.meta;
		const decs = parsed.decisions;
		const padTime = function (ts) {
			try {
				const d = new Date(ts);
				const p = function (n) { return n < 10 ? "0" + n : n; };
				return p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
			} catch (e) { return "?"; }
		};
		let html = "<div style='font-size:12px;color:#dbe7f5;line-height:1.7;'>";
		html += "<div style='display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;'>";
		const card = function (label, val, color) {
			return "<div style='flex:1;min-width:76px;padding:8px;background:rgba(255,255,255,0.04);border-radius:6px;text-align:center;'>" +
				"<div style='font-size:11px;color:#9ad8ff;margin-bottom:3px;'>" + label + "</div>" +
				"<div style='font-size:14px;font-weight:600;color:" + (color || "#dbe7f5") + ";'>" + val + "</div></div>";
		};
		html += card("时间", padTime(meta.ts), "#a8b8c8");
		html += card("模式", meta.mode, "#9ad8ff");
		html += card("轮次", meta.round, "#ffd479");
		html += card("玩家", meta.player, "#9ad8ff");
		html += card("步数", decs.length, "#7fe3a0");
		html += "</div>";
		if (!decs.length) { html += "<div style='color:#666;'>无决策记录</div></div>"; return html; }
		html += "<b style='color:#9ad8ff'>决策回放（导入）：</b><br>";
		decs.forEach(function (dd, i) {
			const w = dd.winner || {};
			const S = dd.signals || {};
			const sigParts = [];
			if (S.tempo && S.tempo.stage) sigParts.push("节奏:" + S.tempo.stage);
			if (S.risk && S.risk.label) sigParts.push("性格:" + S.risk.label);
			if (S.team && S.team.focus) sigParts.push("集火:" + S.team.focus);
			if (S.style && S.style.tag) sigParts.push("对手:" + S.style.tag);
			if (S.multiturn && S.multiturn.overall) sigParts.push("趋势:" + S.multiturn.overall);
			html += "<div style='margin:6px 0;padding:6px 8px;border-left:3px solid #5a7aa8;background:rgba(255,255,255,0.02);border-radius:3px;'>";
			html += "<div style='color:#9ad8ff;'><b>#" + (i + 1) + "</b> 轮 " + (dd.round || 0) + " · " + (dd.player || "?") + " → ";
			html += "<b style='color:#7fe3a0'>" + (w.type || "?") + ":" + (w.id || "?") + "</b>";
			if (w.score !== undefined) html += "（" + w.score + "）";
			html += "</div>";
			if (sigParts.length) html += "<div style='color:#888;font-size:10px;margin-top:2px;'>" + sigParts.join("｜") + "</div>";
			if (dd.candidates && dd.candidates.length) {
				const maxAbs = Math.max(1, Math.max.apply(null, dd.candidates.slice(0, 5).map(function (c) { return Math.abs(c.score || 0); })));
				html += "<div style='margin-top:4px;font-size:10px;'>";
				dd.candidates.slice(0, 5).forEach(function (c) {
					const isWin = w.type === c.type && w.id === c.id;
					const col = isWin ? "#7fe3a0" : "#a8b8c8";
					const pct = Math.round((Math.abs(c.score || 0) / maxAbs) * 100);
					html += "<div style='display:flex;align-items:center;gap:6px;margin:1px 0;'>";
					html += "<span style='width:60px;color:" + col + ";font-size:10px;'>" + c.type + "</span>";
					html += "<span style='width:80px;color:" + col + ";font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'>" + c.id + "</span>";
					html += "<span style='flex:1;height:7px;background:#14243c;border-radius:3px;overflow:hidden;'>";
					html += "<span style='display:block;width:" + pct + "%;height:100%;background:" + col + ";'></span></span>";
					html += "<span style='width:44px;text-align:right;color:" + col + ";font-size:10px;'>" + (c.score > 0 ? "+" : "") + c.score + "</span>";
					html += "</div>";
				});
				html += "</div>";
			}
			html += "</div>";
		});
		html += "</div>";
		return html;
	} catch (e) { return "<div style='color:#ff9c9c;'>渲染异常：" + String(e).slice(0, 80) + "</div>"; }
}

export function showImportedDecisions(parsed) {
	try {
		let dlg = null;
		try { dlg = ui.create.dialog("决策回放导入"); } catch (e) { dlg = null; }
		if (!dlg) { alert("无法创建弹窗"); return; }
		try { dlg.classList.add("fullheight"); dlg.style.width = "min(92vw, 820px)"; dlg.style.maxWidth = "92vw"; dlg.style.left = "4vw"; } catch (e) {}
		const d = document.createElement("div");
		d.innerHTML = renderImportedDecisions(parsed);
		dlg.content.appendChild(d);
	} catch (e) {}
}
