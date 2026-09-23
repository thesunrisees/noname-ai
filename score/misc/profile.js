/* ================= 决策积分引擎 · 武将定位画像 =================
 * 依赖：skills.js 的 aggregateSkillTags / charComboOf
 * 输出：把技能标签聚合成可被决策层直接使用的语义化画像。
 * 覆盖表：CHAR_PROFILE_OVERRIDE —— 手工调整少数关键武将的画像，
 *         未列出的武将全部由标签自动推导。
 */
import { lib } from '../../../noname.js';
import { aggregateSkillTags, charComboOf, skillTagsOf } from '../skill/skills.js';

/* ---------- 手工覆盖表：key 为武将 id ---------- */
const CHAR_PROFILE_OVERRIDE = {
	// 主公模板
	"liubei":   { role: "aux",   aggression: 0.25, priority: 0.55, fragile: 0.7, comboHook: ["give"], counter: ["fanjian","tieji"] },
	"caocao":   { role: "def",   aggression: 0.4,  priority: 0.65, fragile: 0.4, comboHook: ["damage"], counter: ["huogong","juedou"] },
	"sunquan":  { role: "hybrid",aggression: 0.5,  priority: 0.6,  fragile: 0.5, comboHook: [], counter: [] },
	"liushan":  { role: "aux",   aggression: 0.3,  priority: 0.35, fragile: 0.9, comboHook: ["give"], counter: [] },
	// 高输出模板
	"zhangfei": { role: "atk",   aggression: 0.95, priority: 0.9,  fragile: 0.55, comboHook: ["give"], counter: ["lebu","bingliang"] },
	"guanyu":   { role: "atk",   aggression: 0.85, priority: 0.85, fragile: 0.5, comboHook: [], counter: [] },
	"lvbu":     { role: "atk",   aggression: 0.9,  priority: 0.95, fragile: 0.5, comboHook: [], counter: ["tieji"] },
	"huangyueying": { role: "hybrid", aggression: 0.6, priority: 0.7, fragile: 0.7, comboHook: [], counter: [] },
	// 辅助 / 回复
	"zhugeliang": { role: "ctrl", aggression: 0.4, priority: 0.75, fragile: 0.8, comboHook: [], counter: ["lebu"] },
	"huatuo":   { role: "aux",   aggression: 0.15, priority: 0.6,  fragile: 0.9, comboHook: ["give"], counter: [] },
	// 控制型
	"zhangliao":{ role: "ctrl",  aggression: 0.6,  priority: 0.7,  fragile: 0.5, comboHook: [], counter: [] },
	"ganning":  { role: "ctrl",  aggression: 0.65, priority: 0.7,  fragile: 0.55, comboHook: [], counter: [] },
	// 盾 / 站场
	"zhouyu":   { role: "hybrid",aggression: 0.5,  priority: 0.8,  fragile: 0.6, comboHook: [], counter: [] },
	"simayi":   { role: "ctrl",  aggression: 0.5,  priority: 0.75, fragile: 0.6, comboHook: [], counter: [] },
	"xiahoudun":{ role: "def",   aggression: 0.3,  priority: 0.7,  fragile: 0.3, comboHook: [], counter: ["jueqing"] },
};

/* ---------- 画像缓存（以 char 对象 / charId 为键均可） ---------- */
const _PROFILE_CACHE = new Map();

function _emptyProfile() {
	return {
		role: "balanced", aggression: 0.5, priority: 0.5, fragile: 0.5,
		comboHook: [], counter: [], source: "empty", tags: null,
	};
}

/* ---------- 由标签自动推导 role ---------- */
function _deriveRole(t) {
	const scores = {
		atk:   t.atk * 1.4 + t.burst * 0.8,
		def:   t.def * 1.3 + t.sustain * 0.5,
		aux:   t.aux * 1.3 + t.sustain * 0.3,
		ctrl:  t.ctrl * 1.4,
		draw:  t.draw * 1.0,
	};
	let best = "balanced", bestVal = 0.4;
	for (const k in scores) {
		if (scores[k] > bestVal) { best = k; bestVal = scores[k]; }
	}
	// 两个标签接近 → hybrid
	const sorted = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
	if (scores[sorted[0]] > 0.3 && scores[sorted[1]] > scores[sorted[0]] * 0.75 && sorted[0] !== sorted[1]) {
		best = "hybrid";
	}
	return { role: best, scores: scores };
}

/* ---------- 由标签 + 血量推导其他维度 ---------- */
function _deriveAggression(t) {
	// 攻/爆 拉高，盾/回复 拉低
	const raw = 0.15 + t.atk * 0.55 + t.burst * 0.25 - t.def * 0.2 - t.sustain * 0.15;
	return Math.max(0.05, Math.min(1, raw));
}

function _derivePriority(t, hp, mhp) {
	// 输出 + 控制越高越优先打；残血时优先度反而降低（因为快死了不用优先）
	const threatBase = 0.3 + t.atk * 0.4 + t.ctrl * 0.35 + t.aux * 0.15;
	const hpFactor = mhp > 0 ? Math.max(0.3, Math.min(1.2, hp / mhp)) : 1;
	return Math.max(0.1, Math.min(1, threatBase * hpFactor));
}

function _deriveFragile(t, hp, mhp) {
	// 血上限越低越脆；有防御技能降低脆弱度
	const hpF = 1 - Math.min(1, (mhp || 4) / 6);
	const defF = -t.def * 0.35 - t.sustain * 0.15;
	const raw = 0.4 + hpF * 0.5 + defF;
	return Math.max(0.05, Math.min(1, raw));
}

/* ---------- 主入口 ---------- */
export function profileOf(charOrId) {
	try {
		let char = charOrId, cid = "";
		if (typeof charOrId === "string") {
			cid = charOrId;
			char = (lib.character && lib.character[cid]) || null;
		} else if (charOrId && charOrId.name) {
			cid = charOrId.name || charOrId.name1 || "";
		}
		if (!char && !cid) return _emptyProfile();

		const cacheKey = cid || (char && char.name) || "";
		const hit = _PROFILE_CACHE.get(cacheKey);
		if (hit && hit.s === char) return hit.value;

		/* 1) 手工覆盖优先 */
		const ovr = CHAR_PROFILE_OVERRIDE[cid];
		if (ovr) {
			const value = {
				role: ovr.role || "balanced",
				aggression: ovr.aggression !== undefined ? ovr.aggression : 0.5,
				priority: ovr.priority !== undefined ? ovr.priority : 0.5,
				fragile: ovr.fragile !== undefined ? ovr.fragile : 0.5,
				comboHook: ovr.comboHook || [],
				counter: ovr.counter || [],
				source: "override",
				tags: null,
			};
			_PROFILE_CACHE.set(cacheKey, { s: char, value: value });
			return value;
		}

		/* 2) 自动推导 */
		const skills = char && Array.isArray(char.skills) ? char.skills
			: (Array.isArray(char) && Array.isArray(char[3]) ? char[3] : []);
		const tags = aggregateSkillTags(skills);
		const hp = (char && char.hp) || 4;
		const mhp = (char && char.maxHp) || hp;
		const { role } = _deriveRole(tags);

		let comboHook = [];
		try {
			const cc = charComboOf(cid);
			if (cc && cc.style && /攻击/.test(cc.style)) comboHook.push("give");
			if (cc && cc.style && /回复/.test(cc.style)) comboHook.push("protect");
		} catch (e) {}

		const value = {
			role: role,
			aggression: _deriveAggression(tags),
			priority: _derivePriority(tags, hp, mhp),
			fragile: _deriveFragile(tags, hp, mhp),
			comboHook: comboHook,
			counter: [],
			source: "auto",
			tags: tags,
		};
		_PROFILE_CACHE.set(cacheKey, { s: char, value: value });
		return value;
	} catch (e) { return _emptyProfile(); }
}

/* 供外部清缓存（scanReset / 热重载） */
export function clearProfileCache() {
	try { _PROFILE_CACHE.clear(); } catch (e) {}
}

/* 便捷：当前对局中某个 Player 的画像（自动取 name1） */
export function profileOfPlayer(p) {
	try {
		if (!p) return _emptyProfile();
		const cid = p.name1 || p.name || "";
		const prof = profileOf(cid);
		/* 用当前 hp 微调 priority / fragile */
		if (typeof p.hp === "number" && typeof p.maxHp === "number" && p.maxHp > 0) {
			const ratio = p.hp / p.maxHp;
			prof.priority = Math.max(0.1, Math.min(1, prof.priority * (0.5 + ratio * 0.5)));
			prof.fragile = Math.max(0.05, Math.min(1, prof.fragile + (1 - ratio) * 0.4));
		}
		return prof;
	} catch (e) { return _emptyProfile(); }
}
