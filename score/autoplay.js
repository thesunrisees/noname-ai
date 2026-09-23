/* ================= 决策积分引擎 · AI 观战模式 ================= */
import { lib, game, ui, get, _status } from '../../../noname.js';
import { lineChart, barChart, donutChart } from './charts.js';

const STATE = {
	running: false,
	target: 0,
	done: 0,
	results: [],
	interval: null,
	startTime: 0,
};
let _onProgress = null;
let _lastOverFlag = false;

function _emit(phase, data) {
	try { if (_onProgress) _onProgress(phase, Object.assign({ done: STATE.done, target: STATE.target }, data || {})); } catch (e) {}
}

function _startMonitor() {
	if (STATE.interval) return;
	STATE.interval = setInterval(function () {
		try {
			const over = (_status && _status.over === true) || (game && game.over === true);
			if (over && !_lastOverFlag) {
				_lastOverFlag = true;
				setTimeout(function () { _recordAndNext(); }, 3500);
			}
			if (!over && _lastOverFlag) _lastOverFlag = false;
		} catch (e) {}
	}, 1200);
}

function _recordAndNext() {
	try {
		let entry = null;
		try {
			const all = JSON.parse(localStorage.getItem("无名AI_archive") || "{}");
			const gs = (all && all.games) || [];
			if (gs.length) entry = gs[gs.length - 1];
		} catch (e) {}
		const rec = {
			idx: STATE.done + 1,
			ts: Date.now(),
			mode: entry ? entry.mode : ((get && get.mode) ? get.mode() : "unknown"),
			identity: entry ? entry.myIdentity : null,
			score: entry ? entry.myScore : 0,
			verdict: entry ? entry.verdict : "unknown",
		};
		STATE.results.push(rec);
		STATE.done++;
		_emit("progress", { last: rec });
		if (STATE.done >= STATE.target) _finish();
		else setTimeout(function () { _kickNextGame(); }, 1500);
	} catch (e) { _finish(); }
}

function _kickNextGame() {
	try {
		if (!STATE.running) return;
		if (typeof game.reload === "function") { game.reload(); return; }
		if (typeof game.startGame === "function") { game.startGame(); return; }
		if (ui && ui.create && typeof ui.create.start === "function") { ui.create.start(); return; }
		const btn = document.querySelector(".menubutton[data-name='restart'], .menubutton[data-name='new_game']");
		if (btn) { btn.click(); return; }
		_finish();
	} catch (e) { _finish(); }
}

function _finish() {
	try {
		STATE.running = false;
		if (STATE.interval) { clearInterval(STATE.interval); STATE.interval = null; }
		_lastOverFlag = false;
		_emit("done", { results: STATE.results.slice() });
		showAutoplayReport();
	} catch (e) {}
}

export function startAutoplay(games, onProgress) {
	try {
		if (STATE.running) return { ok: false, err: "已在运行中" };
		const n = Math.max(1, Math.min(50, Number(games) || 5));
		STATE.running = true; STATE.target = n; STATE.done = 0;
		STATE.results = []; STATE.startTime = Date.now();
		_onProgress = onProgress || null;
		_startMonitor();
		_kickNextGame();
		return { ok: true, target: n };
	} catch (e) { STATE.running = false; return { ok: false, err: String(e) }; }
}

export function stopAutoplay() {
	try {
		STATE.running = false;
		if (STATE.interval) { clearInterval(STATE.interval); STATE.interval = null; }
		return { ok: true };
	} catch (e) { return { ok: false, err: String(e) }; }
}

export function autoplayStatus() {
	return { running: STATE.running, target: STATE.target, done: STATE.done, elapsed: STATE.startTime ? (Date.now() - STATE.startTime) : 0, results: STATE.results.slice() };
}

function _buildSummaryHtml(r) {
	const wins = r.filter(function (x) { return x.verdict === "win"; }).length;
	const loses = r.filter(function (x) { return x.verdict === "lose"; }).length;
	const draws = r.length - wins - loses;
	const avg = Math.round((r.reduce(function (s, x) { return s + x.score; }, 0) / r.length) * 100) / 100;
	const byId = {}, byMode = {};
	r.forEach(function (x) {
		const ki = x.identity || "unknown";
		(byId[ki] = byId[ki] || { w: 0, l: 0, d: 0, total: 0 });
		byId[ki].total++; if (x.verdict === "win") byId[ki].w++; else if (x.verdict === "lose") byId[ki].l++; else byId[ki].d++;
		const km = x.mode || "unknown";
		(byMode[km] = byMode[km] || { w: 0, l: 0, d: 0, total: 0 });
		byMode[km].total++; if (x.verdict === "win") byMode[km].w++; else if (x.verdict === "lose") byMode[km].l++; else byMode[km].d++;
	});
	const card = function (label, val, color) {
		return "<div style='flex:1;min-width:80px;padding:8px;background:rgba(255,255,255,0.04);border-radius:6px;text-align:center;'>" +
			"<div style='font-size:11px;color:#9ad8ff;margin-bottom:3px;'>" + label + "</div>" +
			"<div style='font-size:16px;font-weight:600;color:" + (color || "#dbe7f5") + ";'>" + val + "</div></div>";
	};
	let h = "<div style='font-size:12px;color:#dbe7f5;line-height:1.8;padding:6px;'>";
	h += "<div style='display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;'>";
	h += card("总局数", r.length, "#9ad8ff");
	h += card("胜/负/平", wins + "/" + loses + "/" + draws, "#7fe3a0");
	h += card("胜率", Math.round((wins / r.length) * 100) + "%", wins / r.length >= 0.5 ? "#7fe3a0" : "#ff9c9c");
	h += card("平均积分", avg, avg >= 0 ? "#7fe3a0" : "#ff9c9c");
	h += "</div>";
	/* 身份胜率 → 水平条形图 */
	h += "<b style='color:#9ad8ff'>身份胜率（水平条）：</b><br>";
	const idItems = Object.keys(byId).map(function (k) {
		const e = byId[k];
		const wr = Math.round((e.w / e.total) * 100);
		const col = wr >= 60 ? "#7fe3a0" : wr >= 40 ? "#ffd479" : "#ff9c9c";
		return { label: k, value: wr, color: col };
	});
	h += barChart(idItems, { barH: 12 });

	h += "<br><b style='color:#9ad8ff'>模式胜率（水平条）：</b><br>";
	const modeItems = Object.keys(byMode).map(function (k) {
		const e = byMode[k];
		const wr = Math.round((e.w / e.total) * 100);
		const col = wr >= 60 ? "#7fe3a0" : wr >= 40 ? "#ffd479" : "#ff9c9c";
		return { label: k, value: wr, color: col };
	});
	h += barChart(modeItems, { barH: 12 });

	/* 逐局积分折线 */
	h += "<br><b style='color:#9ad8ff'>逐局积分曲线：</b><br>";
	const scoresLine = r.map(function (x) { return x.score; });
	h += "<div style='margin:4px 0;'>" + lineChart(scoresLine, { width: 360, height: 90, color: "#7fe3a0" }) + "</div>";

	/* 胜负分布 donut */
	h += "<div style='display:flex;justify-content:center;gap:20px;align-items:center;margin-top:8px;'>";
	h += donutChart([
		{ label: "胜", value: wins, color: "#7fe3a0" },
		{ label: "负", value: loses, color: "#ff9c9c" },
		{ label: "平", value: draws, color: "#ffd479" },
	], { size: 100 });
	h += "<div style='font-size:11px;color:#a8b8c8;'>";
	h += "<span style='color:#7fe3a0'>● 胜 " + wins + "</span><br>";
	h += "<span style='color:#ff9c9c'>● 负 " + loses + "</span><br>";
	h += "<span style='color:#ffd479'>● 平 " + draws + "</span>";
	h += "</div></div></div>";
	return h;
}

export function showAutoplayReport() {
	try {
		const r = STATE.results;
		if (!r.length) { alert("无对局记录"); return; }
		let dlg = null;
		try { dlg = ui.create.dialog("AI 观战汇总"); } catch (e) {}
		if (!dlg) { alert("观战汇总：" + r.length + " 局"); return; }
		try { dlg.classList.add("fullheight"); dlg.style.width = "min(92vw, 720px)"; dlg.style.maxWidth = "92vw"; dlg.style.left = "4vw"; } catch (e) {}
		const d = document.createElement("div");
		d.innerHTML = _buildSummaryHtml(r);
		dlg.content.appendChild(d);
	} catch (e) {}
}

export function initAutoplayMonitor() { _startMonitor(); }

/* ================= 批量观战 ================= */
const BATCH = { running: false, list: [], curIdx: 0, results: {}, original: null };
let _batchProgress = null;

function _applyConfig(c) {
	try {
		lib.config["extension_无名AI_riskProfile"] = "custom";
		lib.config["extension_无名AI_personalityAggression"] = c.agg;
		lib.config["extension_无名AI_personalityRisk"] = c.rsk;
		lib.config["extension_无名AI_personalityTeam"] = c.tea;
		game.saveConfig("extension_无名AI_riskProfile", "custom");
		game.saveConfig("extension_无名AI_personalityAggression", c.agg);
		game.saveConfig("extension_无名AI_personalityRisk", c.rsk);
		game.saveConfig("extension_无名AI_personalityTeam", c.tea);
	} catch (e) {}
}

export function startBatchAutoplay(configs, gamesPerConfig, onProgress) {
	try {
		if (BATCH.running || STATE.running) return { ok: false, err: "已有观战运行中" };
		if (!Array.isArray(configs) || !configs.length) return { ok: false, err: "配置列表为空" };
		BATCH.original = {
			riskProfile: lib.config["extension_无名AI_riskProfile"],
			personalityAggression: lib.config["extension_无名AI_personalityAggression"],
			personalityRisk: lib.config["extension_无名AI_personalityRisk"],
			personalityTeam: lib.config["extension_无名AI_personalityTeam"],
		};
		BATCH.list = configs.map(function (c) { return Object.assign({ games: c.games || gamesPerConfig || 3 }, c); });
		BATCH.curIdx = 0; BATCH.results = {}; BATCH.running = true;
		_batchProgress = onProgress || null;
		_runBatchEntry();
		return { ok: true, batches: BATCH.list.length };
	} catch (e) { BATCH.running = false; return { ok: false, err: String(e) }; }
}

function _runBatchEntry() {
	try {
		if (BATCH.curIdx >= BATCH.list.length) { _finishBatch(); return; }
		const c = BATCH.list[BATCH.curIdx];
		_applyConfig(c);
		BATCH.results[c.name] = [];
		STATE.running = false; STATE.target = c.games; STATE.done = 0; STATE.results = [];
		startAutoplay(c.games, function (phase, data) {
			if (phase === "done") {
				BATCH.results[c.name] = STATE.results.slice();
				BATCH.curIdx++;
				setTimeout(_runBatchEntry, 2500);
			}
		});
	} catch (e) { _finishBatch(); }
}

function _finishBatch() {
	try {
		BATCH.running = false;
		if (BATCH.original) {
			try {
				game.saveConfig("extension_无名AI_riskProfile", BATCH.original.riskProfile);
				game.saveConfig("extension_无名AI_personalityAggression", BATCH.original.personalityAggression);
				game.saveConfig("extension_无名AI_personalityRisk", BATCH.original.personalityRisk);
				game.saveConfig("extension_无名AI_personalityTeam", BATCH.original.personalityTeam);
			} catch (e) {}
		}
		showBatchReport();
	} catch (e) {}
}

export function stopBatchAutoplay() {
	try { BATCH.running = false; stopAutoplay(); return { ok: true }; }
	catch (e) { return { ok: false, err: String(e) }; }
}

export function batchStatus() {
	return { running: BATCH.running, curIdx: BATCH.curIdx, total: BATCH.list.length, curName: BATCH.list[BATCH.curIdx] ? BATCH.list[BATCH.curIdx].name : null, results: BATCH.results };
}

export function showBatchReport() {
	try {
		const names = Object.keys(BATCH.results);
		if (!names.length) { alert("无批量记录"); return; }
		const rows = names.map(function (n) {
			const arr = BATCH.results[n];
			const wins = arr.filter(function (x) { return x.verdict === "win"; }).length;
			const loses = arr.filter(function (x) { return x.verdict === "lose"; }).length;
			const draws = arr.length - wins - loses;
			const avg = arr.length ? Math.round((arr.reduce(function (s, x) { return s + x.score; }, 0) / arr.length) * 100) / 100 : 0;
			return { name: n, count: arr.length, wins, loses, draws, avg, wr: arr.length ? Math.round((wins / arr.length) * 100) : 0 };
		});
		rows.sort(function (a, b) { return b.avg - a.avg; });
		let h = "<div style='font-size:12px;color:#dbe7f5;line-height:1.8;padding:6px;'>";
		h += "<b style='color:#9ad8ff'>配置对比（按平均积分降序）</b>";

		/* 配置均分对比 → 柱状图 */
		h += "<div style='margin-top:8px;'><b style='color:#9ad8ff'>配置均分对比：</b><br>";
		h += barChart(rows.map(function (r, i) {
			const col = i === 0 ? "#7fe3a0" : (i === rows.length - 1 ? "#ff9c9c" : "#9ad8ff");
			return { label: r.name, value: r.avg, color: col };
		}), { barH: 14 });
		h += "</div>";

		/* 胜率对比 */
		h += "<div style='margin-top:8px;'><b style='color:#9ad8ff'>胜率对比：</b><br>";
		h += barChart(rows.map(function (r) {
			const col = r.wr >= 60 ? "#7fe3a0" : r.wr >= 40 ? "#ffd479" : "#ff9c9c";
			return { label: r.name, value: r.wr, color: col };
		}), { barH: 14 });
		h += "</div>";

		h += "</div>";
		let dlg = null;
		try { dlg = ui.create.dialog("AI 观战批量对比"); } catch (e) {}
		if (!dlg) { alert("批量汇总：" + rows.length + " 组配置"); return; }
		try { dlg.classList.add("fullheight"); dlg.style.width = "min(92vw, 760px)"; dlg.style.maxWidth = "92vw"; dlg.style.left = "4vw"; } catch (e) {}
		const d = document.createElement("div");
		d.innerHTML = h;
		dlg.content.appendChild(d);
	} catch (e) {}
}
