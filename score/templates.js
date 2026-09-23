/* ================= 决策积分引擎 · 性格模板市场 ================= */
export const PERSONALITY_TEMPLATES = [
	{ key: "balanced",   name: "均衡型",   desc: "不偏不倚，按局势灵活应变", agg: 50, rsk: 50, tea: 50 },
	{ key: "aggressive", name: "激进型",   desc: "宁可攻错，不可错过", agg: 80, rsk: 70, tea: 40 },
	{ key: "cautious",   name: "保守型",   desc: "稳字当头，留牌过冬", agg: 30, rsk: 30, tea: 70 },
	{ key: "loner",      name: "独狼型",   desc: "各人自扫门前雪", agg: 70, rsk: 60, tea: 10 },
	{ key: "guardian",   name: "守护型",   desc: "护队友如护自己", agg: 30, rsk: 20, tea: 90 },
	{ key: "zhangfei",   name: "张飞型",   desc: "一身是胆，谁与争锋", agg: 95, rsk: 75, tea: 20 },
	{ key: "zhugeliang", name: "诸葛亮型", desc: "谋定而后动，控局为先", agg: 35, rsk: 25, tea: 85 },
	{ key: "lvbu",       name: "吕布型",   desc: "有进无退，猛攻不止", agg: 100, rsk: 85, tea: 10 },
	{ key: "simayi",     name: "司马懿型", desc: "隐忍待时，谋定乾坤", agg: 40, rsk: 30, tea: 65 },
	{ key: "huatuo",     name: "华佗型",   desc: "医者仁心，救死扶伤", agg: 15, rsk: 20, tea: 95 },
	{ key: "zhouyu",     name: "周瑜型",   desc: "火攻连环，控场大才", agg: 60, rsk: 55, tea: 70 },
	{ key: "diaochan",   name: "貂蝉型",   desc: "美人离间，四两拨千斤", agg: 45, rsk: 60, tea: 60 },
	{ key: "sunquan",    name: "孙权型",   desc: "稳坐江东，制衡天下", agg: 50, rsk: 40, tea: 75 },
	{ key: "caocao",     name: "曹操型",   desc: "宁教我负天下人", agg: 75, rsk: 65, tea: 30 },
];

export function findTemplate(key) {
	return PERSONALITY_TEMPLATES.find(function (t) { return t.key === key; }) || null;
}

export function templateNames() {
	return PERSONALITY_TEMPLATES.map(function (t) { return t.key; });
}

/* ================= 自定义模板 ================= */
const KEY_CUSTOM = "无名AI_customTemplates";
const MAX_CUSTOM = 20;
let _CUSTOM = null;

function _loadCustom() {
	if (_CUSTOM) return _CUSTOM;
	try {
		const raw = localStorage.getItem(KEY_CUSTOM);
		_CUSTOM = raw ? JSON.parse(raw) : [];
		if (!Array.isArray(_CUSTOM)) _CUSTOM = [];
	} catch (e) { _CUSTOM = []; }
	return _CUSTOM;
}

function _saveCustom() {
	try { localStorage.setItem(KEY_CUSTOM, JSON.stringify(_CUSTOM)); } catch (e) {}
}

export function listCustomTemplates() {
	try { return _loadCustom().slice(); } catch (e) { return []; }
}

export function saveCustomTemplate(name, desc, agg, rsk, tea) {
	try {
		if (!name || typeof name !== "string") return { ok: false, err: "名称不能为空" };
		name = name.trim().slice(0, 12);
		if (!name) return { ok: false, err: "名称不能为空" };
		agg = Math.max(0, Math.min(100, Number(agg) || 50));
		rsk = Math.max(0, Math.min(100, Number(rsk) || 50));
		tea = Math.max(0, Math.min(100, Number(tea) || 50));
		const list = _loadCustom();
		if (list.length >= MAX_CUSTOM) return { ok: false, err: "已达上限 " + MAX_CUSTOM + " 条" };
		const t = { key: "custom_" + Date.now(), name, desc: (desc || "").slice(0, 30), agg, rsk, tea, custom: true };
		list.push(t); _CUSTOM = list; _saveCustom();
		return { ok: true, template: t };
	} catch (e) { return { ok: false, err: String(e) }; }
}

export function deleteCustomTemplate(key) {
	try {
		const list = _loadCustom();
		const idx = list.findIndex(function (t) { return t.key === key; });
		if (idx < 0) return { ok: false, err: "未找到" };
		list.splice(idx, 1); _CUSTOM = list; _saveCustom();
		return { ok: true };
	} catch (e) { return { ok: false, err: String(e) }; }
}

export function allTemplates() {
	return PERSONALITY_TEMPLATES.concat(listCustomTemplates());
}

export function findTemplateAll(key) {
	return allTemplates().find(function (t) { return t.key === key; }) || null;
}
