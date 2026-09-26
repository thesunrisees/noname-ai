/*
 * ============================================
 * // الناشر: في شينغ الأصلي
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 跨局记忆 =================
 * 目的：把每局观察到的对手风格持久化，下一局遇到同一玩家时作为先验。
 * 叶子模块：不 import 任何业务模块，只依赖 localStorage 与玩家对象属性。
 * 只在有稳定 ID（昵称 / UID）时生效；本地 AI 对局因身份随机，无意义。
 */
import { lib, game, _status } from '../../../noname.js';
// ผู้เขียน: เฟยเซิง ออริจินัล | ใบอนุญาต: GPL-3.0

const STORE_KEY = "无名AI_playerMemory";
const STORE_VERSION = 1;
const MAX_ENTRIES = 200;
const STALE_MS = 30 * 24 * 60 * 60 * 1000; /* 30 天未见过期 */

let STORE = { v: STORE_VERSION, players: {} };
let _loaded = false;

/* ================= 精密记忆算法参数 =================
 * 目的：修复旧算法"旧权重 = sampleCount*0.7 无上限增长"导致旧记忆永久压制
 * 新观测、且完全无时域遗忘的问题。改为：
 *   1) 有效样本数封顶（EFF_CAP），使 EWMA 对近期数据保持敏感；
 *   2) 遗忘半衰期（HALF_LIFE_DAYS）：越久远的记忆越向中性先验回归，
 *      同时收缩其有效样本权重（遗忘曲线）；
 *   3) 置信度 confidence：由有效样本数刻画估计可靠性，供下游按可靠度加权。
 */
const NEUTRAL_AGGR = 0.5;      /* aggr 的中性先验 */
const NEUTRAL_VEN = 0;         /* vengeful 的中性先验 */
const EFF_CAP = 40;            /* 有效样本上限：旧数据最多按 40 份计 */
const HALF_LIFE_DAYS = 21;     /* 遗忘半衰期（天） */
const CONF_K = 15;             /* 置信度曲线参数：conf = 1 - exp(-effN/K) */
const _MS_PER_DAY = 86400000;

const _clamp01 = function (v) { return v > 1 ? 1 : (v < 0 ? 0 : v); };
const _clamp = function (v, lo, hi) { return v > hi ? hi : (v < lo ? lo : v); };
const _r2 = function (v) { return Math.round(v * 100) / 100; };

/* 遗忘曲线：距今 days 天后，旧估计向中性先验衰减的比例 */
function _decayFactor(days) {
	if (!(days > 0)) return 1;
	return Math.pow(0.5, days / HALF_LIFE_DAYS);
}
/* 把旧估计按遗忘曲线拉回先验 */
function _driftToPrior(oldVal, prior, days) {
	const decay = _decayFactor(days);
	return prior + (oldVal - prior) * decay;
}
/* EWMA 学习率：有效旧样本越多越稳，但封顶保证对近期敏感 */
function _learnRate(liveN, effOld) {
	if (effOld <= 0) return 1;
	return liveN / (liveN + effOld);
}
/* 行为计数（trick）合并 */
function _mergeTrick(oldTrick, liveTrick) {
	const t = oldTrick ? JSON.parse(JSON.stringify(oldTrick)) : {};
	const lt = liveTrick || {};
	for (const tk in lt) t[tk] = (t[tk] || 0) + (lt[tk] || 0);
	return t;
}
/* 标签判定（保持旧语义，供下游 tag 匹配复用） */
function _classifyTag(aggr, vengeful, n) {
	if (n < 3) return "balanced";
	if (vengeful >= 0.6 && n >= 4) return "vengeful";
	if (aggr >= 0.75) return "aggressive";
	if (aggr <= 0.3) return "cautious";
	return "balanced";
}

export function memoryKeyOf(p) {
	try {
		if (!p) return null;

		/* 优先级 1：昵称（联机/自定义昵称时最精确） */
		if (typeof p.nickname === "string" && p.nickname) return "n:" + p.nickname;

		/* 优先级 2：UID */
		if (p.uid !== undefined && p.uid !== null && String(p.uid)) return "u:" + String(p.uid);

		/* 优先级 3：联机模式用 name */
		if (_status && _status.connectMode && typeof p.name === "string" && p.name) {
			return "c:" + p.name;
		}

		/* ★ 优先级 4：兜底 —— 所有模式都用武将 ID 作 key
		 *   - 单机 AI：用 AI 的武将 ID（如 "h:re_zhonghui"）
		 *   - 单机人类：用玩家的武将 ID（如 "self:re_zhonghui"，与 AI 分开）
		 *   - 观战：用被观战者的武将 ID
		 *   语义："钟会这个武将的打法风格"，跨局稳定、跨模式统一、所有人都能记录。 */
		if (typeof p.name1 === "string" && p.name1) {
			/* 人类玩家加 self 前缀，与 AI 的 h 前缀区分，避免混数据 */
			if (p === game.me) return "self:" + p.name1;
			return "h:" + p.name1;
		}
		if (typeof p.name === "string" && p.name) return "h:" + p.name;

		return null;
	} catch (e) { return null; }
}

export function loadStore(force) {
	try {
		if (_loaded && !force) return;
		const raw = localStorage.getItem(STORE_KEY);
		if (raw) {
			const obj = JSON.parse(raw);
			if (obj && obj.v === STORE_VERSION && obj.players && typeof obj.players === "object") {
				STORE = obj;
			}
		}
		_loaded = true;
		pruneStore();
	} catch (e) { _loaded = true; }
}

export function saveStore() {
	try {
		pruneStore();
		localStorage.setItem(STORE_KEY, JSON.stringify(STORE));
	} catch (e) {}
}

export function pruneStore() {
	try {
		const now = Date.now();
		const keys = Object.keys(STORE.players || {});
		for (const k of keys) {
			const e = STORE.players[k];
			if (!e || !e.lastSeen || (now - e.lastSeen) > STALE_MS) {
				delete STORE.players[k];
			}
		}
		const remain = Object.keys(STORE.players);
		if (remain.length > MAX_ENTRIES) {
			remain.sort(function (a, b) { return (STORE.players[b].lastSeen || 0) - (STORE.players[a].lastSeen || 0); });
			for (let i = MAX_ENTRIES; i < remain.length; i++) delete STORE.players[remain[i]];
		}
	} catch (e) {}
}

export function getStored(p) {
	try {
		const k = memoryKeyOf(p);
		if (!k) return null;
		const e = STORE.players && STORE.players[k];
		if (!e) return null;
		return {
			key: k,
			tag: e.tag || "unknown",
			aggr: typeof e.aggr === "number" ? e.aggr : 0.5,
			vengeful: typeof e.vengeful === "number" ? e.vengeful : 0,
			sampleCount: e.sampleCount || 0,
			/* ★ 精密算法新增：有效样本数、置信度、规范化行为率 */
			effN: typeof e.effN === "number" ? e.effN : Math.min(e.sampleCount || 0, EFF_CAP),
			confidence: typeof e.confidence === "number" ? e.confidence : 0,
			aoeRate: typeof e.aoeRate === "number" ? e.aoeRate : (e.sampleCount ? (e.aoeUse || 0) / e.sampleCount : 0),
			saveRate: typeof e.saveRate === "number" ? e.saveRate : (e.sampleCount ? (e.saveUse || 0) / e.sampleCount : 0),
			lastSeen: e.lastSeen || 0,
			/* ★ 新增：区分记录来源 */
			keyType: k.split(":")[0] || "unknown",
			/* ★ 新增读取 */
			aoeUse: typeof e.aoeUse === "number" ? e.aoeUse : 0,
			saveUse: typeof e.saveUse === "number" ? e.saveUse : 0,
			trickUse: e.trickUse || {},
		};
	} catch (e) { return null; }
}

export function mergeOnSettle(p, liveStyle) {
	try {
		if (!p || !liveStyle) return;
		const k = memoryKeyOf(p);
		if (!k) return;
		if (!STORE.players) STORE.players = {};
		const old = STORE.players[k];
		const liveCount = (liveStyle.attacks || 0) + (liveStyle.aids || 0);
		if (liveCount < 1) return;  // ★ 从 2 降到 1

		if (!old) {
			/* 首次记录：直接采用本局观测，但按先验轻微收缩，避免单局噪音过大 */
			const liveAggr = _clamp01(liveStyle.aggr || 0.5);
			const liveVen = _clamp01(liveStyle.vengeful || 0);
			const n = liveCount;
			const effN = Math.min(n, EFF_CAP);
			const confidence = 1 - Math.exp(-effN / CONF_K);
			STORE.players[k] = {
				tag: _classifyTag(liveAggr, liveVen, n),
				aggr: _r2(liveAggr),
				vengeful: _r2(liveVen),
				sampleCount: n,
				effN: Math.round(effN),
				confidence: _r2(confidence),
				lastSeen: Date.now(),
				/* ★ 新增：保留规范化行为率（每局），与累计计数并存 */
				aoeUse: liveStyle.aoeUse || 0,
				saveUse: liveStyle.saveUse || 0,
				trickUse: liveStyle.trickUse || {},
			};
			return;
		}

		/* ---- 精密合并（旧记录存在）---- */
		const now = Date.now();
		const days = old.lastSeen ? Math.max(0, (now - old.lastSeen) / _MS_PER_DAY) : 0;

		/* ① 遗忘曲线：把旧的 aggr/vengeful 按陷入时长向中性先验拉回 */
		const oldAggr = _driftToPrior(_clamp01(old.aggr), NEUTRAL_AGGR, days);
		const oldVen = _driftToPrior(_clamp01(old.vengeful), NEUTRAL_VEN, days);
		/* ② 旧记忆的有效强度：同样按遗忘曲线收缩，并封顶 */
		const oldEff = Math.floor(Math.min(old.sampleCount || 0, EFF_CAP) * _decayFactor(days));

		const liveAggr = _clamp01(liveStyle.aggr || 0.5);
		const liveVen = _clamp01(liveStyle.vengeful || 0);

		/* ③ EWMA 学习率：本局样本权重占比，旧有效样本封顶避免永久压制新数据 */
		const alpha = _learnRate(liveCount, oldEff);
		const aggr = alpha * liveAggr + (1 - alpha) * oldAggr;
		const ven = alpha * liveVen + (1 - alpha) * oldVen;

		const sampleCount = Math.min(9999, (old.sampleCount || 0) + liveCount);
		const effN = Math.min(sampleCount, EFF_CAP);
		const confidence = 1 - Math.exp(-effN / CONF_K);
		const tag = _classifyTag(aggr, ven, sampleCount);

		STORE.players[k] = {
			tag: tag,
			aggr: _r2(aggr),
			vengeful: _r2(ven),
			sampleCount: sampleCount,
			effN: Math.round(effN),
			confidence: _r2(confidence),
			lastSeen: now,
			/* 行为计数保持累加（向后兼容），并归一化为每局率 */
			aoeUse: (old.aoeUse || 0) + (liveStyle.aoeUse || 0),
			saveUse: (old.saveUse || 0) + (liveStyle.saveUse || 0),
			aoeRate: sampleCount > 0 ? ((old.aoeUse || 0) + (liveStyle.aoeUse || 0)) / sampleCount : 0,
			saveRate: sampleCount > 0 ? ((old.saveUse || 0) + (liveStyle.saveUse || 0)) / sampleCount : 0,
			trickUse: _mergeTrick(old.trickUse, liveStyle.trickUse),
		};
	} catch (e) {}
}

export function resetStore() {
	try { STORE = { v: STORE_VERSION, players: {} }; localStorage.removeItem(STORE_KEY); } catch (e) {}
}

export function storeStats() {
	try {
		loadStore(true);  // ★ 强制重新读 localStorage
		const keys = Object.keys(STORE.players || {});
		let total = 0;
		let aiCount = 0;
		let selfCount = 0;
		let onlineCount = 0;
		for (const k of keys) {
			total += (STORE.players[k].sampleCount || 0);
			if (k.indexOf("h:") === 0) aiCount++;
			else if (k.indexOf("self:") === 0) selfCount++;
			else onlineCount++;
		}
		return {
			entries: keys.length,
			samples: total,
			aiEntries: aiCount,
			selfEntries: selfCount,
			onlineEntries: onlineCount,
		};
	} catch (e) { return { entries: 0, samples: 0, aiEntries: 0, selfEntries: 0, onlineEntries: 0 }; }
}

/* ================= 记忆库导出 / 导入 ================= */

/** 导出完整记忆库（供 export.js 调用） */
export function exportStore() {
	try {
		loadStore();
		return {
			v: STORE_VERSION,
			players: JSON.parse(JSON.stringify(STORE.players || {})),
			exportedAt: Date.now(),
			stats: storeStats(),
		};
	} catch (e) { return { v: STORE_VERSION, players: {}, err: String(e) }; }
}

/** 导入记忆库（合并 / 覆盖） */
export function importStore(data, mode) {
	try {
		if (!data || typeof data !== "object") return { ok: false, err: "数据为空" };
		if (data.v !== STORE_VERSION) return { ok: false, err: "版本不匹配（期望 v" + STORE_VERSION + "）" };
		if (!data.players || typeof data.players !== "object") {
			return { ok: false, err: "players 字段缺失或格式错误" };
		}
		loadStore();

		const incoming = data.players;
		const incomingKeys = Object.keys(incoming);
		if (!incomingKeys.length) return { ok: false, err: "导入数据为空" };

		if (mode === "replace") {
			STORE.players = JSON.parse(JSON.stringify(incoming));
		} else {
			/* 合并模式：按 sampleCount 加权平均 */
			for (const k of incomingKeys) {
				const inc = incoming[k];
				if (!inc || typeof inc !== "object") continue;
				const old = STORE.players[k];
				if (!old) {
					STORE.players[k] = inc;
					continue;
				}
				const oldW = Math.max(0, (old.sampleCount || 0) * 0.7);
				const newW = Math.max(0, inc.sampleCount || 0);
				const total = oldW + newW;
				if (total <= 0) continue;
				const aggr = (old.aggr * oldW + (inc.aggr || 0.5) * newW) / total;
				const ven = (old.vengeful * oldW + (inc.vengeful || 0) * newW) / total;
				let tag = "balanced";
				if (ven >= 0.6 && total >= 4) tag = "vengeful";
				else if (aggr >= 0.75) tag = "aggressive";
				else if (aggr <= 0.3) tag = "cautious";
				STORE.players[k] = {
					tag: tag,
					aggr: Math.round(aggr * 100) / 100,
					vengeful: Math.round(ven * 100) / 100,
					sampleCount: Math.min(9999, total),
					lastSeen: Math.max(old.lastSeen || 0, inc.lastSeen || 0),
				};
			}
		}
		pruneStore();
		saveStore();
		return { ok: true, imported: incomingKeys.length, total: Object.keys(STORE.players).length };
	} catch (e) {
		return { ok: false, err: "导入异常：" + String(e).slice(0, 80) };
	}
}

/** 清空记忆库（面板按钮用） */
export function clearStore() {
	try {
		STORE = { v: STORE_VERSION, players: {} };
		localStorage.removeItem(STORE_KEY);
		return { ok: true };
	} catch (e) { return { ok: false, err: String(e) }; }
}

export function isStoreLoaded() { return _loaded; }
