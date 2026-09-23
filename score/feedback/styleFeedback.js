/* ================= 决策积分引擎 · 对手风格反馈 ================= */
const KEY = "无名AI_styleFeedback";
const VERSION = 1;
const DECAY = 0.75;
const MIN_SAMPLES = 5;
const CONF_MIN = 0.3;
const CONF_MAX = 1.5;

let FB = { v: VERSION, tags: {} };
let _loaded = false;
let _pending = [];

export function loadStyleFeedback() {
	try {
		if (_loaded) return;
		const raw = localStorage.getItem(KEY);
		if (raw) {
			const o = JSON.parse(raw);
			if (o && o.v === VERSION && o.tags) FB = o;
		}
		_loaded = true;
	} catch (e) { _loaded = true; }
}

export function saveStyleFeedback() {
	try { localStorage.setItem(KEY, JSON.stringify(FB)); } catch (e) {}
}

export function recordStyleOutcome(tag, playerKey, scoreDelta) {
	try {
		if (!tag || tag === "unknown" || !playerKey) return;
		const d = Number(scoreDelta);
		if (isNaN(d)) return;
		_pending.push({ tag, playerKey, scoreDelta: d, ts: Date.now() });
	} catch (e) {}
}

export function flushStyleFeedback() {
	try {
		if (!_pending.length) return;
		const byTag = {};
		for (const it of _pending) {
			if (!byTag[it.tag]) byTag[it.tag] = [];
			byTag[it.tag].push(it);
		}
		for (const tag in byTag) {
			const items = byTag[tag];
			let score = 0, cnt = 0;
			for (const it of items) {
				let expect;
				if (tag === "aggressive" || tag === "vengeful") expect = -1;
				else if (tag === "cautious") expect = 0.5;
				else expect = 0;
				const sign = Math.sign(it.scoreDelta);
				const match = (expect * sign > 0) ? 1 : (sign === 0 ? 0.5 : 0);
				score += match;
				cnt++;
			}
			if (!cnt) continue;
			const observed = score / cnt;
			const conf = CONF_MIN + observed * (CONF_MAX - CONF_MIN);
			_updateConf(tag, conf);
		}
		_pending = [];
		saveStyleFeedback();
	} catch (e) { _pending = []; }
}

function _updateConf(tag, newConf) {
	if (!FB.tags) FB.tags = {};
	const f = FB.tags[tag] || { conf: 1.0, samples: 0 };
	if (f.samples < 1) f.conf = newConf;
	else f.conf = f.conf * DECAY + newConf * (1 - DECAY);
	f.conf = Math.max(CONF_MIN, Math.min(CONF_MAX, f.conf));
	f.samples++;
	f.lastUpdate = Date.now();
	FB.tags[tag] = f;
}

export function getTagConf(tag) {
	try {
		loadStyleFeedback();
		const f = FB.tags && FB.tags[tag];
		if (!f || f.samples < MIN_SAMPLES) return 1.0;
		return f.conf;
	} catch (e) { return 1.0; }
}

export function getStyleFeedbackStats() {
	try {
		loadStyleFeedback();
		const out = [];
		for (const tag in (FB.tags || {})) {
			const f = FB.tags[tag];
			out.push({
				tag,
				conf: Math.round(f.conf * 100) / 100,
				samples: f.samples,
				active: f.samples >= MIN_SAMPLES && Math.abs(f.conf - 1) >= 0.1,
			});
		}
		return out;
	} catch (e) { return []; }
}

export function resetStyleFeedback() {
	try {
		FB = { v: VERSION, tags: {} };
		_pending = [];
		localStorage.removeItem(KEY);
	} catch (e) {}
}

/* ================= 按对手独立存储的风格反馈 ================= */
const MIN_PLAYER_SAMPLES = 3;
const PLAYER_STALE_MS = 30 * 24 * 60 * 60 * 1000;

export function recordPlayerTag(playerKey, tag, weight) {
	try {
		if (!playerKey || !tag || tag === "unknown") return;
		loadStyleFeedback();
		if (!FB.perPlayer) FB.perPlayer = {};
		const e = FB.perPlayer[playerKey] || { tag: "unknown", counts: {}, samples: 0, conf: 1.0, lastSeen: 0 };
		const w = Math.max(1, Math.min(3, Number(weight) || 1));
		e.counts[tag] = (e.counts[tag] || 0) + w;
		e.samples += w;
		e.lastSeen = Date.now();
		let bestTag = e.tag, bestN = 0;
		for (const k in e.counts) if (e.counts[k] > bestN) { bestN = e.counts[k]; bestTag = k; }
		e.tag = bestTag;
		const total = e.samples || 1;
		const ratio = bestN / total;
		const saturation = Math.min(1, e.samples / 6);
		e.conf = Math.round((0.5 + ratio * 0.5) * saturation * 100) / 100;
		FB.perPlayer[playerKey] = e;
	} catch (e) {}
}

export function getPlayerTag(playerKey) {
	try {
		loadStyleFeedback();
		if (!FB.perPlayer) return null;
		const e = FB.perPlayer[playerKey];
		if (!e) return null;
		if (Date.now() - e.lastSeen > PLAYER_STALE_MS) return null;
		if (e.samples < MIN_PLAYER_SAMPLES) return null;
		return { tag: e.tag, conf: e.conf, samples: e.samples };
	} catch (e) { return null; }
}

export function getPlayerShanFactor(playerKey, defaultFactor) {
	try {
		const pt = getPlayerTag(playerKey);
		if (!pt) return defaultFactor;
		return 1.0 + (defaultFactor - 1.0) * pt.conf;
	} catch (e) { return defaultFactor; }
}

export function getPlayerMemoryStats() {
	try {
		loadStyleFeedback();
		if (!FB.perPlayer) return [];
		const out = [];
		for (const k in FB.perPlayer) {
			const e = FB.perPlayer[k];
			if (!e || e.samples < 2) continue;
			out.push({ key: k, tag: e.tag, conf: e.conf, samples: e.samples, lastSeen: e.lastSeen, counts: Object.assign({}, e.counts) });
		}
		out.sort(function (a, b) { return b.samples - a.samples; });
		return out;
	} catch (e) { return []; }
}

export function resetPlayerMemory() {
	try { loadStyleFeedback(); FB.perPlayer = {}; saveStyleFeedback(); } catch (e) {}
}
