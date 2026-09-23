/* ================= 决策积分引擎 · 行为观察器 =================
 * 目的：记录"谁打过谁 / 谁救过谁 / 谁爱放AOE / 谁爱用锦囊"，为身份推理和画像提供原始数据。
 */
import { _status } from '../../../../../noname.js';
import { getStored } from '../../memory.js';
import { getTagConf, getPlayerShanFactor } from '../../panels/styleFeedback.js';
import { suitRemaining } from '../../deckMemory.js';

const OBS = Object.create(null);

function keyOf(p) {
	try {
		if (!p) return "";
		return p.name1 || p.name || p.name2 || "";
	} catch (e) { return ""; }
}

function _roundWeight() {
	try {
		const r = (_status && typeof _status.roundNumber === "number") ? _status.roundNumber : 1;
		return 1 + Math.min(3, r / 5);
	} catch (e) { return 1; }
}

/* ★ 升级：初始化新维度 */
function _ensure(key) {
	if (!OBS[key]) {
		OBS[key] = {
			attacks: Object.create(null),
			aids: Object.create(null),
			attackedBy: Object.create(null),
			aidedBy: Object.create(null),
			hostile: 0,
			friendly: 0,
			// ★ 新增维度
			aoeUse: 0,
			saveUse: 0,
			trickUse: Object.create(null),
		};
	}
	return OBS[key];
}

export function observeAttack(source, target, weight) {
	try {
		if (!source || !target || source === target) return;
		const sk = keyOf(source), tk = keyOf(target);
		if (!sk || !tk || sk === tk) return;
		const w = (weight || 1) * _roundWeight();
		const se = _ensure(sk);
		se.attacks[tk] = (se.attacks[tk] || 0) + w;
		se.hostile += w;
		const te = _ensure(tk);
		te.attackedBy[sk] = (te.attackedBy[sk] || 0) + w;
	} catch (e) {}
}

export function observeAid(source, target, weight) {
	try {
		if (!source || !target || source === target) return;
		const sk = keyOf(source), tk = keyOf(target);
		if (!sk || !tk || sk === tk) return;
		const w = (weight || 1) * _roundWeight();
		const se = _ensure(sk);
		se.aids[tk] = (se.aids[tk] || 0) + w;
		se.friendly += w;
		const te = _ensure(tk);
		te.aidedBy[sk] = (te.aidedBy[sk] || 0) + w;
	} catch (e) {}
}

const CARD_ATTACK_W = { sha: 1.0, juedou: 1.0, huogong: 0.8, guohe: 0.5, shunshou: 0.6, lebu: 0.6, bingliang: 0.6, jiedao: 0.5, zhujin: 1.2 };
const CARD_AID_W = { tao: 1.5, taoyuan: 0.3 };

export function observeKill(source, victim) {
	try {
		if (!source || !victim || source === victim) return;
		const sk = keyOf(source), vk = keyOf(victim);
		if (!sk || !vk) return;
		const se = _ensure(sk);
		if (!se.kills) se.kills = [];
		se.kills.push(vk);
		se.hostile += 2.0;
	} catch (e) {}
}

export function observeSave(source, saved) {
	try {
		if (!source || !saved || source === saved) return;
		const sk = keyOf(source), svk = keyOf(saved);
		if (!sk || !svk) return;
		const se = _ensure(sk);
		if (!se.saves) se.saves = [];
		se.saves.push(svk);
		se.friendly += 1.5;
	} catch (e) {}
}

/* ★ 升级：从 scoreCardUse 挂钩，记录 AOE、桃、锦囊偏好 */
export function observeCardUse(source, card, target) {
	try {
		if (!source || !card) return;
		const id = (typeof card === "string") ? card : (card && (card.name || card.cardname || ""));
		if (!id) return;
		
		var se = _ensure(keyOf(source));

		// 1. 记录 AOE 使用倾向
		if (id === "wanjian" || id === "nanman") {
			se.aoeUse = (se.aoeUse || 0) + 1.0;
			se.hostile += 1.5;
			return;
		}

		// 2. 记录桃的使用倾向
		if (id === "tao") {
			se.saveUse = (se.saveUse || 0) + 1.0;
			if (target !== source) se.friendly += 1.0;
		}

		// 3. 记录锦囊偏好
		var TRICK_IDS = ["wuzhong", "shunshou", "guohe", "lebu", "bingliang", "jiedao", "zhujin", "wuxie"];
		if (TRICK_IDS.indexOf(id) >= 0) {
			se.trickUse[id] = (se.trickUse[id] || 0) + 1.0;
		}

		// 4. 原有的攻/援牌处理
		if (target) {
			if (Array.isArray(target)) {
				for (var i = 0; i < target.length; i++) {
					if (CARD_ATTACK_W[id] !== undefined) observeAttack(source, target[i], CARD_ATTACK_W[id]);
					else if (CARD_AID_W[id] !== undefined) observeAid(source, target[i], CARD_AID_W[id]);
				}
			} else {
				if (CARD_ATTACK_W[id] !== undefined) observeAttack(source, target, CARD_ATTACK_W[id]);
				else if (CARD_AID_W[id] !== undefined) observeAid(source, target, CARD_AID_W[id]);
			}
		}

		// ★ 五期：同时记录花色
		try { observeSuit(source, card); } catch (eS) {}
	} catch (e) {}
}

export function attackBy(observer, target) {
	try {
		const sk = keyOf(observer), tk = keyOf(target);
		if (!sk || !tk) return 0;
		const e = OBS[sk];
		return (e && e.attacks[tk]) || 0;
	} catch (e) { return 0; }
}

export function aidBy(observer, target) {
	try {
		const sk = keyOf(observer), tk = keyOf(target);
		if (!sk || !tk) return 0;
		const e = OBS[sk];
		return (e && e.aids[tk]) || 0;
	} catch (e) { return 0; }
}

export function relationOf(a, b) {
	try { return attackBy(a, b) - aidBy(a, b); } catch (e) { return 0; }
}

export function observedStance(a, b) {
	const r = relationOf(a, b);
	if (r > 1.5) return "enemy";
	if (r < -1.5) return "ally";
	return "neutral";
}

export function hostilityOf(p) {
	try {
		const sk = keyOf(p);
		if (!sk) return 0;
		const e = OBS[sk];
		return e ? (e.hostile - e.friendly) : 0;
	} catch (e) { return 0; }
}

export function friendlinessOf(p) {
	try {
		const sk = keyOf(p);
		if (!sk) return 0;
		const e = OBS[sk];
		return e ? (e.friendly - e.hostile) : 0;
	} catch (e) { return 0; }
}

/* ★ 升级：在 styleOf 中输出新维度 */
export function styleOf(p) {
	try {
		const sk = keyOf(p);
		const empty = { tag: "unknown", aggr: 0.5, vengeful: 0, hostile: 0, friendly: 0, attacks: 0, aids: 0, aoeUse: 0, saveUse: 0, trickUse: {}, source: "unknown" };
		if (!sk) return empty;

		const e = OBS[sk];
		let attacks = 0, aids = 0;
		if (e) {
			for (const k in e.attacks) attacks += e.attacks[k];
			for (const k in e.aids) aids += e.aids[k];
		}
		const total = attacks + aids;

		if (total >= 2) {
			const aggr = attacks / total;
			let attackedMe = 0, iFoughtBack = 0;
			if (e) {
				for (const k in e.attackedBy) {
					attackedMe++;
					if (e.attacks[k] && e.attacks[k] > 0) iFoughtBack++;
				}
			}
			const vengeful = attackedMe > 0 ? iFoughtBack / attackedMe : 0;
			let tag = "balanced";
			if (vengeful >= 0.6 && attackedMe >= 2) tag = "vengeful";
			else if (aggr >= 0.75) tag = "aggressive";
			else if (aggr <= 0.3) tag = "cautious";
			
			return {
				tag: tag, source: "live",
				aggr: Math.round(aggr * 100) / 100,
				vengeful: Math.round(vengeful * 100) / 100,
				hostile: Math.round(((e && e.hostile) || 0) * 100) / 100,
				friendly: Math.round(((e && e.friendly) || 0) * 100) / 100,
				attacks: Math.round(attacks * 100) / 100,
				aids: Math.round(aids * 100) / 100,
				// ★ 输出新维度
				aoeUse: (e && e.aoeUse) || 0,
				saveUse: (e && e.saveUse) || 0,
				trickUse: (e && e.trickUse) ? JSON.parse(JSON.stringify(e.trickUse)) : {},
			};
		}

		try {
			const stored = getStored(p);
			if (stored && stored.sampleCount >= 2) {
				return {
					tag: stored.tag,
					source: "stored",
					aggr: stored.aggr,
					vengeful: stored.vengeful,
					hostile: 0, friendly: 0,
					attacks: Math.round(attacks * 100) / 100,
					aids: Math.round(aids * 100) / 100,
					storedSamples: stored.sampleCount,
					// ★ 读取历史记忆中的新维度
					aoeUse: stored.aoeUse || 0,
					saveUse: stored.saveUse || 0,
					trickUse: stored.trickUse || {},
				};
			}
		} catch (eS) {}

		return {
			tag: "unknown",
			source: "partial",
			aggr: total > 0 ? Math.round((attacks / total) * 100) / 100 : 0.5,
			vengeful: 0,
			hostile: Math.round(((e && e.hostile) || 0) * 100) / 100,
			friendly: Math.round(((e && e.friendly) || 0) * 100) / 100,
			attacks: Math.round(attacks * 100) / 100,
			aids: Math.round(aids * 100) / 100,
			aoeUse: (e && e.aoeUse) || 0,
			saveUse: (e && e.saveUse) || 0,
			trickUse: (e && e.trickUse) ? JSON.parse(JSON.stringify(e.trickUse)) : {},
		};
	} catch (e) {
		return { tag: "unknown", aggr: 0.5, vengeful: 0, hostile: 0, friendly: 0, attacks: 0, aids: 0, aoeUse: 0, saveUse: 0, trickUse: {}, source: "unknown" };
	}
}

/* 风格对"有闪"概率的先验修正系数 */
export function styleShanFactor(p) {
	try {
		const s = styleOf(p);
		let base = 1.0;
		if (s.tag === "aggressive") base = 0.88;
		else if (s.tag === "cautious") base = 1.12;
		else if (s.tag === "vengeful") base = 1.05;
		let pk = "";
		try { pk = (p && (p.nickname || p.uid || p.name)) || ""; } catch (e) {}
		if (pk) {
			try { return getPlayerShanFactor(pk, base); } catch (e) {}
		}
		let conf = 1.0;
		try { conf = getTagConf(s.tag); } catch (e) {}
		return 1.0 + (base - 1.0) * conf;
	} catch (e) { return 1.0; }
}

export function getObs() { return OBS; }
export function resetObs() { for (const k in OBS) delete OBS[k]; }

export function explainObs(p) {
	try {
		const sk = keyOf(p);
		if (!sk) return { key: "", empty: true };
		const e = OBS[sk];
		if (!e) return { key: sk, empty: true };
		return {
			key: sk,
			hostile: Math.round(e.hostile * 100) / 100,
			friendly: Math.round(e.friendly * 100) / 100,
			attacks: JSON.parse(JSON.stringify(e.attacks)),
			aids: JSON.parse(JSON.stringify(e.aids)),
			attackedBy: JSON.parse(JSON.stringify(e.attackedBy)),
			aidedBy: JSON.parse(JSON.stringify(e.aidedBy)),
		};
	} catch (e) { return { err: String(e) }; }
}

/* ================= ★ 五期：火攻花色推断 =================
 * 记录每位玩家使用过的牌的花色，推断其手牌花色分布，
 * 用于 engine.js 计算【火攻】的期望命中率。
 */
const SUIT_OBS = Object.create(null); /* key -> {heart,diamond,club,spade,total} */

/* 记录：在 observeCardUse 里顺带调用 */
export function observeSuit(source, card) {
	try {
		if (!source || !card) return;
		const sk = keyOf(source);
		if (!sk) return;
		/* 兼容 card 是对象 / 虚拟牌 / 转化牌 */
		let suit = null;
		if (typeof card === "object") {
			suit = card.suit;
			if (!suit && card.cards && card.cards.length > 0) {
				suit = card.cards[0].suit;
			}
		}
		if (!suit) return;
		if (!SUIT_OBS[sk]) {
			SUIT_OBS[sk] = { heart: 0, diamond: 0, club: 0, spade: 0, total: 0 };
		}
		const so = SUIT_OBS[sk];
		so[suit] = (so[suit] || 0) + 1;
		so.total += 1;
	} catch (e) {}
}

/* 推断某玩家手牌花色分布（归一化，无数据返回均匀分布） */
/* 推断某玩家手牌花色分布（融合牌堆剩余密度） */
export function suitDistributionOf(p) {
	try {
		const sk = keyOf(p);
		let observed = null;
		if (sk && SUIT_OBS[sk] && SUIT_OBS[sk].total > 0) {
			const so = SUIT_OBS[sk];
			const t = so.total;
			observed = {
				heart: (so.heart || 0) / t,
				diamond: (so.diamond || 0) / t,
				club: (so.club || 0) / t,
				spade: (so.spade || 0) / t
			};
		}

		/* ★ 融合牌堆剩余密度 */
		let deckDist = null;
		try {
			const total = suitRemaining('heart') + suitRemaining('diamond') + suitRemaining('club') + suitRemaining('spade');
			if (total > 0) {
				deckDist = {
					heart:   suitRemaining('heart')   / total,
					diamond: suitRemaining('diamond') / total,
					club:    suitRemaining('club')    / total,
					spade:   suitRemaining('spade')   / total
				};
			}
		} catch (e) {}

		/* 融合：有观察 → 加权观察 0.6 + 牌堆 0.4；无观察 → 牌堆 */
		if (observed && deckDist) {
			return {
				heart:   observed.heart   * 0.6 + deckDist.heart   * 0.4,
				diamond: observed.diamond * 0.6 + deckDist.diamond * 0.4,
				club:    observed.club    * 0.6 + deckDist.club    * 0.4,
				spade:   observed.spade   * 0.6 + deckDist.spade   * 0.4
			};
		}
		if (observed) return observed;
		if (deckDist) return deckDist;
		return { heart: 0.25, diamond: 0.25, club: 0.25, spade: 0.25 };
	} catch (e) {
		return { heart: 0.25, diamond: 0.25, club: 0.25, spade: 0.25 };
	}
}

/* 计算火攻对目标 p 的期望命中率（0~1） */
export function fireAttackExpectedHit(me, p) {
	try {
		const myHand = me.getCards ? me.getCards("h") : (me.hand || []);
		if (!myHand || myHand.length === 0) return 0;
		const mySuits = { heart: 0, diamond: 0, club: 0, spade: 0 };
		let myTotal = 0;
		for (let i = 0; i < myHand.length; i++) {
			const c = myHand[i];
			if (c.suit) {
				mySuits[c.suit] = (mySuits[c.suit] || 0) + 1;
				myTotal++;
			}
		}
		if (myTotal === 0) return 0;
		const targetDist = suitDistributionOf(p);
		let hitProb = 0;
		const suits = ["heart", "diamond", "club", "spade"];
		for (let i = 0; i < suits.length; i++) {
			const s = suits[i];
			const pTargetHasSuit = targetDist[s] || 0.25;
			const iCanDiscard = (mySuits[s] || 0) / myTotal;
			hitProb += pTargetHasSuit * iCanDiscard;
		}
		return Math.round(hitProb * 100) / 100;
	} catch (e) { return 0; }
}

/* 清空花色观察（生命周期用） */
export function resetSuitObs() {
	for (const k in SUIT_OBS) delete SUIT_OBS[k];
}
