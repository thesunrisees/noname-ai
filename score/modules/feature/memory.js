/* ================= 决策积分引擎 · 跨局记忆 =================
 * 目的：把每局观察到的对手风格持久化，下一局遇到同一玩家时作为先验。
 * 叶子模块：不 import 任何业务模块，只依赖 localStorage 与玩家对象属性。
 * 只在有稳定 ID（昵称 / UID）时生效；本地 AI 对局因身份随机，无意义。
 */
import { lib, game, _status } from '../../../../../noname.js';

const STORE_KEY = "无名AI_playerMemory";
const STORE_VERSION = 1;
const MAX_ENTRIES = 200;
const STALE_MS = 30 * 24 * 60 * 60 * 1000; /* 30 天未见过期 */

let STORE = { v: STORE_VERSION, players: {} };
let _loaded = false;

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
			STORE.players[k] = {
				tag: liveStyle.tag || "balanced",
				aggr: Math.round((liveStyle.aggr || 0.5) * 100) / 100,
				vengeful: Math.round((liveStyle.vengeful || 0) * 100) / 100,
				sampleCount: liveCount,
				lastSeen: Date.now(),
				// ★ 新增
				aoeUse: liveStyle.aoeUse || 0,
				saveUse: liveStyle.saveUse || 0,
				trickUse: liveStyle.trickUse || {},
			};
		} else {
			const oldW = Math.max(0, (old.sampleCount || 0) * 0.7);
			const newW = liveCount;
			const total = oldW + newW;
			const aggr = total > 0 ? (old.aggr * oldW + (liveStyle.aggr || 0.5) * newW) / total : 0.5;
			const ven = total > 0 ? (old.vengeful * oldW + (liveStyle.vengeful || 0) * newW) / total : 0;
			let tag = "balanced";
			if (ven >= 0.6 && (old.sampleCount + liveCount) >= 4) tag = "vengeful";
			else if (aggr >= 0.75) tag = "aggressive";
			else if (aggr <= 0.3) tag = "cautious";
			STORE.players[k] = {
				tag: tag,
				aggr: Math.round(aggr * 100) / 100,
				vengeful: Math.round(ven * 100) / 100,
				sampleCount: Math.min(9999, (old.sampleCount || 0) + liveCount),
				lastSeen: Date.now(),
				// ★ 新增（累加行为次数）
				aoeUse: (old.aoeUse || 0) + (liveStyle.aoeUse || 0),
				saveUse: (old.saveUse || 0) + (liveStyle.saveUse || 0),
				trickUse: (function() {
					var t = JSON.parse(JSON.stringify(old.trickUse || {}));
					var lt = liveStyle.trickUse || {};
					for (var tk in lt) { t[tk] = (t[tk] || 0) + lt[tk]; }
					return t;
				})(),
			};
		}
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
