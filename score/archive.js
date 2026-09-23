/* ================= 决策积分引擎 · 战报归档 =================
 * 目的：把每局结果沉淀到 localStorage，支持跨局对比与趋势分析。
 * 叶子模块：不 import 任何业务模块（避免与 engine 循环依赖）；
 *          所有数据由调用方作为 snapshot 传入。
 */
const STORE_KEY = "无名AI_archive";
const STORE_VERSION = 1;
const MAX_GAMES = 30;

let STORE = { v: STORE_VERSION, games: [] };
let _loaded = false;

export function loadArchive() {
	try {
		if (_loaded) return;
		const raw = localStorage.getItem(STORE_KEY);
		if (raw) {
			const obj = JSON.parse(raw);
			if (obj && obj.v === STORE_VERSION && Array.isArray(obj.games)) {
				STORE = obj;
			}
		}
		_loaded = true;
	} catch (e) { _loaded = true; }
}

export function saveArchive() {
	try {
		while (STORE.games.length > MAX_GAMES) STORE.games.shift();
		localStorage.setItem(STORE_KEY, JSON.stringify(STORE));
	} catch (e) {}
}

export function archiveGame(snapshot) {
	try {
		if (!snapshot || typeof snapshot !== "object") return null;
		loadArchive();
		const entry = {
			ts: snapshot.ts || Date.now(),
			mode: snapshot.mode || "unknown",
			myIdentity: snapshot.myIdentity || null,
			myScore: Number(snapshot.myScore) || 0,
			playerCount: Number(snapshot.playerCount) || 0,
			roundCount: Number(snapshot.roundCount) || 0,
			decisionSteps: Number(snapshot.decisionSteps) || 0,
			quality: snapshot.quality || { crush: 0, normal: 0, close: 0 },
			topCards: Array.isArray(snapshot.topCards) ? snapshot.topCards.slice(0, 3) : [],
			verdict: snapshot.verdict || "unknown",
			decisions: Array.isArray(snapshot.decisions) ? snapshot.decisions.slice(-10) : [],
		};
		STORE.games.push(entry);
		saveArchive();
		return entry;
	} catch (e) { return null; }
}

export function getArchive() {
	loadArchive();
	return STORE.games.slice();
}

export function getLatest(n) {
	loadArchive();
	return STORE.games.slice(-(n || 10));
}

export function clearArchive() {
	try {
		STORE = { v: STORE_VERSION, games: [] };
		localStorage.removeItem(STORE_KEY);
	} catch (e) {}
}

export function archiveStats() {
	try {
		loadArchive();
		const g = STORE.games;
		if (!g.length) return { count: 0, wins: 0, loses: 0, draws: 0, avgScore: 0, maxScore: 0, minScore: 0, trend: 0 };
		let wins = 0, loses = 0, draws = 0, sum = 0;
		let max = -Infinity, min = Infinity;
		g.forEach(function (x) {
			sum += x.myScore;
			if (x.verdict === "win") wins++;
			else if (x.verdict === "lose") loses++;
			else draws++;
			if (x.myScore > max) max = x.myScore;
			if (x.myScore < min) min = x.myScore;
		});
		const recentN = Math.min(5, g.length);
		const recent = g.slice(-recentN);
		const earlier = g.slice(0, g.length - recentN);
		const avg = function (arr) { return arr.length ? arr.reduce(function (s, x) { return s + x.myScore; }, 0) / arr.length : 0; };
		const trend = Math.round((avg(recent) - avg(earlier)) * 100) / 100;
		return {
			count: g.length, wins, loses, draws,
			avgScore: Math.round((sum / g.length) * 100) / 100,
			maxScore: Math.round(max * 100) / 100,
			minScore: Math.round(min * 100) / 100,
			trend: trend,
		};
	} catch (e) { return { count: 0, wins: 0, loses: 0, draws: 0, avgScore: 0, maxScore: 0, minScore: 0, trend: 0 }; }
}

export function verdictOf(myScore) {
	const s = Number(myScore) || 0;
	if (s > 3) return "win";
	if (s < -3) return "lose";
	return "draw";
}

export function fmtTime(ts) {
	try {
		const d = new Date(ts);
		const pad = function (n) { return n < 10 ? "0" + n : "" + n; };
		return pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
	} catch (e) { return "?"; }
}

/* ---------- 查询指定归档的决策详情 ---------- */
export function getGameDecisions(index) {
	try {
		loadArchive();
		const g = STORE.games[index];
		if (!g) return null;
		return {
			ts: g.ts,
			mode: g.mode,
			myIdentity: g.myIdentity,
			myScore: g.myScore,
			verdict: g.verdict,
			decisions: Array.isArray(g.decisions) ? g.decisions : [],
			legacy: !Array.isArray(g.decisions),
		};
	} catch (e) { return null; }
}

/* ---------- 导出归档为 JSON 字符串 ---------- */
export function exportArchiveJson() {
	try {
		loadArchive();
		return JSON.stringify({ v: STORE_VERSION, games: STORE.games }, null, 2);
	} catch (e) { return "{}"; }
}

/* ---------- 出牌频率 Top N ---------- */
export function topCardsAcrossGames(n) {
	try {
		loadArchive();
		const counter = {};
		for (const g of STORE.games) {
			if (!g.topCards) continue;
			for (const c of g.topCards) counter[c] = (counter[c] || 0) + 1;
		}
		return Object.keys(counter)
			.map(function (k) { return { card: k, count: counter[k] }; })
			.sort(function (a, b) { return b.count - a.count; })
			.slice(0, n || 10);
	} catch (e) { return []; }
}

/* ---------- 身份胜率对比 ---------- */
export function winRateByIdentity() {
	try {
		loadArchive();
		const byId = {};
		for (const g of STORE.games) {
			const id = g.myIdentity || "unknown";
			if (!byId[id]) byId[id] = { wins: 0, loses: 0, draws: 0, total: 0, sum: 0 };
			byId[id].total++;
			byId[id].sum += g.myScore;
			if (g.verdict === "win") byId[id].wins++;
			else if (g.verdict === "lose") byId[id].loses++;
			else byId[id].draws++;
		}
		for (const k in byId) {
			const e = byId[k];
			e.avgScore = Math.round((e.sum / e.total) * 100) / 100;
			e.winRate = Math.round((e.wins / e.total) * 100);
			delete e.sum;
		}
		return byId;
	} catch (e) { return {}; }
}

/* ---------- 模式胜率对比 ---------- */
export function winRateByMode() {
	try {
		loadArchive();
		const byMode = {};
		for (const g of STORE.games) {
			const m = g.mode || "unknown";
			if (!byMode[m]) byMode[m] = { wins: 0, loses: 0, draws: 0, total: 0, sum: 0 };
			byMode[m].total++;
			byMode[m].sum += g.myScore;
			if (g.verdict === "win") byMode[m].wins++;
			else if (g.verdict === "lose") byMode[m].loses++;
			else byMode[m].draws++;
		}
		for (const k in byMode) {
			const e = byMode[k];
			e.avgScore = Math.round((e.sum / e.total) * 100) / 100;
			e.winRate = Math.round((e.wins / e.total) * 100);
			delete e.sum;
		}
		return byMode;
	} catch (e) { return {}; }
}

/* ---------- 综合统计报告 ---------- */
export function fullArchiveStats() {
	return {
		basic: archiveStats(),
		topCards: topCardsAcrossGames(10),
		byIdentity: winRateByIdentity(),
		byMode: winRateByMode(),
	};
}

/* ---------- 导入归档 JSON（合并 / 覆盖） ---------- */
export function importArchiveJson(jsonStr, mode) {
	try {
		if (typeof jsonStr !== "string") return { ok: false, err: "输入为空" };
		const obj = JSON.parse(jsonStr);
		if (!obj || obj.v !== STORE_VERSION || !Array.isArray(obj.games)) {
			return { ok: false, err: "格式错误或版本不匹配" };
		}
		loadArchive();
		const incoming = obj.games.filter(function (g) { return g && typeof g.ts === "number" && typeof g.myScore === "number"; });
		if (!incoming.length) return { ok: false, err: "无有效归档条目" };
		if (mode === "replace") {
			STORE.games = incoming.slice(-MAX_GAMES);
		} else {
			const seen = {};
			STORE.games.forEach(function (g) { seen[g.ts] = 1; });
			incoming.forEach(function (g) { if (!seen[g.ts]) STORE.games.push(g); });
			STORE.games.sort(function (a, b) { return a.ts - b.ts; });
			while (STORE.games.length > MAX_GAMES) STORE.games.shift();
		}
		saveArchive();
		return { ok: true, imported: incoming.length, total: STORE.games.length };
	} catch (e) {
		return { ok: false, err: "解析异常：" + String(e).slice(0, 80) };
	}
}
