/* ================= 决策积分引擎 · 配置档案管理 ================= */
const KEY = "无名AI_profiles";
const VERSION = 1;
const MAX_PROFILES = 20;

let STORE = { v: VERSION, active: "", list: [] };
let _loaded = false;

function _load() {
	if (_loaded) return;
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			const o = JSON.parse(raw);
			if (o && o.v === VERSION && Array.isArray(o.list)) STORE = o;
		}
	} catch (e) {}
	_loaded = true;
}

function _save() {
	try { localStorage.setItem(KEY, JSON.stringify(STORE)); } catch (e) {}
}

export function buildSnapshot(getters) {
	try {
		if (!getters || typeof getters !== "object") return null;
		const snap = {};
		for (const k in getters) {
			try { snap[k] = getters[k](); } catch (e) { snap[k] = null; }
		}
		return snap;
	} catch (e) { return null; }
}

export function applySnapshot(snap, setters) {
	try {
		if (!snap || !setters) return { ok: false, err: "参数缺失" };
		let applied = 0;
		for (const k in snap) {
			if (typeof setters[k] === "function" && snap[k] !== null && snap[k] !== undefined) {
				try { setters[k](snap[k]); applied++; } catch (e) {}
			}
		}
		return { ok: true, applied: applied };
	} catch (e) { return { ok: false, err: String(e) }; }
}

export function listProfiles() {
	_load();
	return {
		active: STORE.active,
		list: STORE.list.map(function (p) { return { name: p.name, ts: p.ts, keys: Object.keys(p.data || {}) }; }),
	};
}

export function saveProfile(name, snap) {
	try {
		_load();
		if (!name || typeof name !== "string") return { ok: false, err: "名称不能为空" };
		name = name.trim().slice(0, 16);
		if (!name) return { ok: false, err: "名称不能为空" };
		if (!snap) return { ok: false, err: "无快照数据" };
		const exist = STORE.list.findIndex(function (p) { return p.name === name; });
		const entry = { name: name, data: snap, ts: Date.now() };
		if (exist >= 0) STORE.list[exist] = entry;
		else {
			if (STORE.list.length >= MAX_PROFILES) return { ok: false, err: "已达上限 " + MAX_PROFILES };
			STORE.list.push(entry);
		}
		STORE.active = name;
		_save();
		return { ok: true, name: name };
	} catch (e) { return { ok: false, err: String(e) }; }
}

export function loadProfile(name) {
	try {
		_load();
		const p = STORE.list.find(function (x) { return x.name === name; });
		if (!p) return { ok: false, err: "未找到档案 " + name };
		STORE.active = name;
		_save();
		return { ok: true, data: p.data, name: name };
	} catch (e) { return { ok: false, err: String(e) }; }
}

export function deleteProfile(name) {
	try {
		_load();
		const i = STORE.list.findIndex(function (p) { return p.name === name; });
		if (i < 0) return { ok: false, err: "未找到" };
		STORE.list.splice(i, 1);
		if (STORE.active === name) STORE.active = "";
		_save();
		return { ok: true };
	} catch (e) { return { ok: false, err: String(e) }; }
}

export function renameProfile(oldName, newName) {
	try {
		_load();
		if (!newName || !newName.trim()) return { ok: false, err: "新名称不能为空" };
		newName = newName.trim().slice(0, 16);
		const p = STORE.list.find(function (x) { return x.name === oldName; });
		if (!p) return { ok: false, err: "未找到" };
		if (STORE.list.some(function (x) { return x.name === newName; })) return { ok: false, err: "名称已存在" };
		p.name = newName;
		if (STORE.active === oldName) STORE.active = newName;
		_save();
		return { ok: true };
	} catch (e) { return { ok: false, err: String(e) }; }
}

export function exportProfilesJson() {
	try {
		_load();
		return JSON.stringify({ v: VERSION, active: STORE.active, list: STORE.list }, null, 2);
	} catch (e) { return "{}"; }
}

export function importProfilesJson(jsonStr, mode) {
	try {
		const o = JSON.parse(jsonStr);
		if (!o || o.v !== VERSION || !Array.isArray(o.list)) return { ok: false, err: "格式错误或版本不匹配" };
		_load();
		if (mode === "replace") {
			STORE = { v: VERSION, active: o.active || "", list: o.list.slice(0, MAX_PROFILES) };
		} else {
			o.list.forEach(function (p) {
				if (!p || !p.name || !p.data) return;
				const i = STORE.list.findIndex(function (x) { return x.name === p.name; });
				if (i >= 0) STORE.list[i] = p;
				else if (STORE.list.length < MAX_PROFILES) STORE.list.push(p);
			});
		}
		_save();
		return { ok: true, count: STORE.list.length, active: STORE.active };
	} catch (e) { return { ok: false, err: "解析异常：" + String(e).slice(0, 80) }; }
}

export function resetProfiles() {
	try {
		STORE = { v: VERSION, active: "", list: [] };
		localStorage.removeItem(KEY);
	} catch (e) {}
}

export function profileCount() {
	_load();
	return STORE.list.length;
}
