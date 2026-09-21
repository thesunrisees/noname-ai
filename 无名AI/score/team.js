/* ================= 决策积分引擎 · 团队协同 =================
 * 目标：集火同一目标、接力保护、队友技能联动
 * 叶子模块：仅依赖 threat.js / observer.js / identity.js
 */
import { lib, game, get, _status } from '../../../noname.js';
import { isEnemyOf, threatOf } from './threat.js';
import { attackBy } from './observer.js';
import { beliefOf, confidenceOf, currentMode } from './identity.js';
import { isSameCamp } from './modeStrategy.js';

/* ★ 本地辅助：判断是否是敌人（用模式策略） */
function _isEnemy(me, other) {
	try {
		if (!me || !other || me === other) return false;
		const att = get.attitude(me, other);
		if (att !== 0) return att < 0;
		return !isSameCamp(me, other);
	} catch (e) { return false; }
}

function keyOf(p) {
	try { return p && (p.name1 || p.name || p.name2 || ""); } catch (e) { return ""; }
}
function nameOfP(p) {
	try { return (p && (p.name || p.name1)) || "?"; } catch (e) { return "?"; }
}

/* ---------- 集火目标：队友共同攻击压力最大的敌人 ---------- */
export function focusTarget(me) {
	try {
		if (!me) return null;
		const enemies = [], allies = [];
		for (const p of (game.players || [])) {
			if (!p || p === me || p.alive === false) continue;
			if (_isEnemy(me, p)) enemies.push(p);
			else allies.push(p);
		}
		if (!enemies.length) return null;

		let best = null, bestScore = 0;
		for (const e of enemies) {
			let pressure = 0;
			for (const a of allies) pressure += attackBy(a, e);
			const th = threatOf(e);
			const hp = e.hp || 0;
			const killable = hp <= 1 ? 1.5 : (hp <= 2 ? 0.8 : 0);
			const s = pressure * 0.6 + th * 0.8 + killable;
			if (s > bestScore) { bestScore = s; best = e; }
		}
		if (!best || bestScore < 0.8) return null;
		return { target: best, score: Math.round(bestScore * 100) / 100, name: nameOfP(best) };
	} catch (e) { return null; }
}

/* ---------- 接力保护：队友是否值得救 ---------- */
export function protectScore(me, ally) {
	try {
		if (!me || !ally || ally === me || ally.alive === false) return 0;
		if (_isEnemy(me, ally)) return 0;

		const hp = ally.hp || 0, mhp = ally.maxHp || 1;
		const ratio = hp / mhp;
		let score = (1 - ratio) * 3;
		if (hp <= 1) score += 3;
		else if (hp <= 2) score += 1.5;

		// 高威胁队友更值得保护（后期核心）
		score += threatOf(ally) * 0.5;

		// 身份局：按推理置信度与阵营调整
		if (currentMode() === "identity") {
			const conf = confidenceOf(ally);
			if (conf < 0.4) score *= 0.6; // 推理不清 → 谨慎
			else {
				const b = beliefOf(ally);
				if (b) {
					const myId = me.identity;
					if (myId === "zhu" || myId === "zhong") {
						if (b.fan > b.zhong) score *= 0.3; // 大概率为反 → 不救
					} else if (myId === "fan") {
						if (b.zhong > b.fan) score *= 0.3;
					} else if (myId === "nei") {
						// 内奸：只救主公和自己，其他按威胁权衡
						if (ally !== game.zhu) score *= 0.5;
					}
				}
			}
		}

		return Math.round(score * 100) / 100;
	} catch (e) { return 0; }
}

/* ---------- 队友技能联动表 ---------- */
const ALLY_SKILL_HOOKS = {
	jizhi:    { trigger: "trick",     bonus: 1.5, tip: "队友集智：多用锦囊摸牌" },
	wusheng:  { trigger: "red",       bonus: 1.0, tip: "队友武圣：可给红牌" },
	qingnang: { trigger: "red",       bonus: 1.2, tip: "队友青囊：留红牌给他" },
	leiji:    { trigger: "shan",      bonus: 1.5, tip: "队友雷击：给他闪" },
	fankui:   { trigger: "take_hit",  bonus: 1.0, tip: "队友反馈：可卖血换牌" },
	ganglie:  { trigger: "take_hit",  bonus: 0.8, tip: "队友刚烈：可卖血反击" },
	yiji:     { trigger: "take_hit",  bonus: 1.2, tip: "队友遗计：可卖血摸牌" },
	jianxiong:{ trigger: "take_hit",  bonus: 1.0, tip: "队友奸雄：可卖血拿牌" },
	luoyi:    { trigger: "lowhand",   bonus: 1.0, tip: "队友裸衣：可给他杀" },
	longdan:  { trigger: "sha_shan",  bonus: 0.8, tip: "队友龙胆：杀闪互换" },
	qicai:    { trigger: "trick",     bonus: 0.8, tip: "队友奇才：锦囊无限距离" },
};

const TRICK_LIST = ["wuzhong","guohe","shunshou","nanman","wanjian","tiesuo","lebu","bingliang","jiedao"];

export function comboWithAllies(me) {
	try {
		if (!me) return [];
		const combos = [];
		const myHand = [];
		try { me.getCards("h").forEach(function (c) { myHand.push(c.name || ""); }); } catch (e) {}

		for (const ally of (game.players || [])) {
			if (!ally || ally === me || ally.alive === false) continue;
			if (_isEnemy(me, ally)) continue;
			const sk = ally.skills || [];
			for (const sid of sk) {
				const hook = ALLY_SKILL_HOOKS[sid];
				if (!hook) continue;
				let applicable = false;
				if (hook.trigger === "trick") {
					applicable = myHand.some(function (x) { return TRICK_LIST.indexOf(x) >= 0; });
				} else if (hook.trigger === "red") {
					applicable = true;
				} else if (hook.trigger === "shan") {
					applicable = myHand.indexOf("shan") >= 0;
				} else if (hook.trigger === "take_hit") {
					applicable = false; // 不主动卖血，仅作提示
				} else if (hook.trigger === "lowhand") {
					applicable = !!(ally.countCards && ally.countCards("h") <= 2);
				} else if (hook.trigger === "sha_shan") {
					applicable = myHand.indexOf("sha") >= 0 || myHand.indexOf("shan") >= 0;
				}
				if (applicable) {
					combos.push({
						name: hook.tip,
						ally: nameOfP(ally),
						allyKey: keyOf(ally),
						skill: sid,
						bonus: hook.bonus,
					});
				}
			}
		}
		return combos;
	} catch (e) { return []; }
}

/* ---------- 统一团队计划 ---------- */
const _teamCache = new Map();
export function teamPlan(me) {
	try {
		const round = (_status && _status.roundNumber) || 0;
		const key = (me.name1 || me.name) + '|' + round + '|' + (me.hp || 0) + '|' + (me.countCards ? me.countCards('h') : 0);
		const hit = _teamCache.get(me);
		if (hit && hit.key === key) return hit.value;
		const focus = focusTarget(me);
		const combos = comboWithAllies(me);
		const protectCandidates = [];
		for (const p of (game.players || [])) {
			if (!p || p === me || p.alive === false) continue;
			const s = protectScore(me, p);
			if (s >= 1.5) protectCandidates.push({ ally: p, name: nameOfP(p), score: s });
		}
		protectCandidates.sort(function (a, b) { return b.score - a.score; });
		const result = {
			focus,
			protect: protectCandidates[0] || null,
			protectList: protectCandidates,
			combos,
		};
		_teamCache.set(me, { key: key, value: result });
		return result;
	} catch (e) {
		return { focus: null, protect: null, protectList: [], combos: [] };
	}
}
