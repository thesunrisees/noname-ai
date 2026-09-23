/* ================= 决策积分引擎 · 资源经济 =================
 * 目标：把手牌 / 装备 / 血量视为三种货币，
 *       用于弃牌、装备替换、卖血技能的机会成本评估。
 * 叶子模块：仅依赖 threat.js（cardValueOf / isEnemyOf）。
 */
import { lib, game, get, _status } from '../../../noname.js';
import { cardValueOf, isEnemyOf } from './threat.js';

function toCard(c) {
	return (typeof c === "string") ? { name: c } : c;
}

function handValue(me) {
	try {
		let sum = 0, count = 0;
		me.getCards("h").forEach(function (c) {
			try { sum += cardValueOf(c, me); count++; } catch (e) {}
		});
		return { sum: Math.round(sum * 100) / 100, count };
	} catch (e) { return { sum: 0, count: 0 }; }
}

function equipValue(me) {
	try {
		let sum = 0, count = 0;
		me.getCards("e").forEach(function (c) {
			try { sum += cardValueOf(c, me); count++; } catch (e) {}
		});
		return { sum: Math.round(sum * 100) / 100, count };
	} catch (e) { return { sum: 0, count: 0 }; }
}

function enemyStripPressure(me) {
	try {
		let pressure = 0;
		for (const p of (game.players || [])) {
			if (!p || p === me || p.alive === false) continue;
			if (!isEnemyOf(me, p)) continue;
			const h = p.countCards ? p.countCards("h") : 0;
			pressure += h * 0.08;
		}
		return Math.min(1.5, Math.round(pressure * 100) / 100);
	} catch (e) { return 0; }
}

function equipStripRisk(me) {
	try {
		const ev = equipValue(me);
		const pressure = enemyStripPressure(me);
		return {
			pressure,
			risk: Math.round(ev.sum * pressure * 100) / 100,
			equipValue: ev.sum,
		};
	} catch (e) { return { pressure: 0, risk: 0, equipValue: 0 }; }
}

export function resourceBalance(me) {
	try {
		if (!me) return { handValue: 0, handCount: 0, equipValue: 0, equipCount: 0, hp: 0, maxHp: 1, hpRatio: 0, hpDeficit: 0, totalValue: 0, strip: null };
		const hv = handValue(me);
		const ev = equipValue(me);
		const hp = me.hp || 0, mhp = me.maxHp || 1;
		const hpRatio = mhp > 0 ? hp / mhp : 0;
		const hpDeficit = Math.max(0, mhp - hp);
		const strip = equipStripRisk(me);
		return {
			handValue: hv.sum,
			handCount: hv.count,
			equipValue: ev.sum,
			equipCount: ev.count,
			hp, maxHp: mhp,
			hpRatio: Math.round(hpRatio * 100) / 100,
			hpDeficit,
			totalValue: Math.round((hv.sum + ev.sum + hp * 4) * 100) / 100,
			strip,
		};
	} catch (e) {
		return { handValue: 0, handCount: 0, equipValue: 0, equipCount: 0, hp: 0, maxHp: 1, hpRatio: 0, hpDeficit: 0, totalValue: 0, strip: null };
	}
}

export function discardCost(me, cardOrId) {
	try {
		const bal = resourceBalance(me);
		const v = cardValueOf(toCard(cardOrId), me);
		const scarcity = bal.handCount <= 0 ? 1
			: Math.max(0.8, Math.min(2.5, 5 / Math.max(1, bal.handCount)));
		return Math.round(v * scarcity * 100) / 100;
	} catch (e) { return 3; }
}

export function sellHpValue(me) {
	try {
		const bal = resourceBalance(me);
		const v = bal.hpRatio > 0.7 ? 1.5
			: bal.hpRatio > 0.4 ? 2.5
			: bal.hpRatio > 0.2 ? 4.0
			: 5.5;
		return Math.round(v * 100) / 100;
	} catch (e) { return 2.5; }
}

export function equipReplaceCost(me, newCard, oldCard) {
	try {
		const nv = cardValueOf(toCard(newCard), me);
		const ov = oldCard ? cardValueOf(toCard(oldCard), me) : 0;
		const strip = equipStripRisk(me);
		const newRisk = nv * strip.pressure * 0.5;
		const net = (nv - ov) - newRisk;
		return {
			net: Math.round(net * 100) / 100,
			newValue: Math.round(nv * 100) / 100,
			oldValue: Math.round(ov * 100) / 100,
			stripPressure: strip.pressure,
		};
	} catch (e) { return { net: 0, newValue: 0, oldValue: 0, stripPressure: 0 }; }
}

export function abolishPenalty(me, subtype) {
	const base = { equip1: 4, equip2: 4.5, equip3: 1.5, equip4: 2, equip5: 3 };
	return base[subtype] || 3;
}

/* ★ 扩写：更多资源经济函数 */

/* 弃牌惩罚：根据手牌数量和类型计算弃牌成本 */
export function discardPenalty(me, cardOrId) {
	try {
		const v = cardValueOf(toCard(cardOrId), me);
		const bal = resourceBalance(me);
		/* 手牌越少，弃牌成本越高 */
		const scarcity = bal.handCount <= 1 ? 2.0
			: bal.handCount <= 2 ? 1.5
			: bal.handCount <= 3 ? 1.0
			: 0.8;
		/* 关键牌（桃/无懈）弃牌成本更高 */
		const cardName = get.name(toCard(cardOrId));
		let keyBonus = 1.0;
		if (cardName === 'tao' || cardName === 'wuxie') keyBonus = 1.5;
		else if (cardName === 'sha' || cardName === 'shan') keyBonus = 1.0;
		return Math.round(v * scarcity * keyBonus * 100) / 100;
	} catch (e) { return 3; }
}

/* 装备替换收益：计算替换装备的净收益 */
export function equipReplaceBenefit(me, newCard, oldCard) {
	try {
		const nv = cardValueOf(toCard(newCard), me);
		const ov = oldCard ? cardValueOf(toCard(oldCard), me) : 0;
		/* 新装备比旧装备好多少 */
		const benefit = nv - ov;
		/* 如果是替换进攻型装备，还要考虑输出提升 */
		const newName = get.name(toCard(newCard));
		const oldName = oldCard ? get.name(toCard(oldCard)) : '';
		/* 从短枪换到长枪 → 收益更高 */
		if (newName === 'zhuge' || newName === 'qinggang' || newName === 'guanshi') {
			if (oldName !== 'zhuge' && oldName !== 'qinggang' && oldName !== 'guanshi') {
				return Math.round((benefit + 1.5) * 100) / 100;
			}
		}
		return Math.round(benefit * 100) / 100;
	} catch (e) { return 0; }
}

/* 卖血收益：计算卖血换牌的净收益 */
export function sellHpBenefit(me, expectedCards) {
	try {
		const bal = resourceBalance(me);
		/* 1 点血的价值 */
		const hpCost = sellHpValue(me);
		/* 预期获得的牌的价值 */
		const cardValue = expectedCards * 2.0;   /* 平均每张牌 2 分 */
		/* 净收益 = 牌价值 - 血成本 */
		return Math.round((cardValue - hpCost) * 100) / 100;
	} catch (e) { return 0; }
}

export { handValue, equipValue, enemyStripPressure, equipStripRisk };
