/*
 * ============================================
 * // Éditeur: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 留牌策略 =================
 * AI 根据牌堆剩余密度决定手牌保留哪些花色
 * 比如：武圣留红牌当杀、龙胆留杀闪互换
 */
import { lib, game, get, _status } from '../../../noname.js';
import { cardRemaining, suitRemaining, totalRemaining } from './deckMemory.js';
// Autor: Feisheng Original | Lizenz: GPL-3.0

/* ================= 1. 花色价值评估 =================
 * 牌堆里某花色越少，保留该花色的价值越高
 */
export function suitValue(suit) {
	try {
		const remain = suitRemaining(suit);
		const total = totalRemaining();
		if (total <= 0) return 0.5;

		/* 剩余越少 → 越稀缺 → 保留价值越高 */
		const ratio = remain / total;
		/* 标准花色比例约 0.25，偏离越多越稀缺 */
		const scarcity = Math.abs(0.25 - ratio) / 0.25;
		return Math.min(1, 0.5 + scarcity * 0.5);
	} catch (e) { return 0.5; }
}

/* ================= 2. 牌名价值评估 =================
 * 牌堆里某牌名越少，保留该牌的价值越高
 */
export function cardKeepValue(cardId) {
	try {
		const remain = cardRemaining(cardId);
		if (remain <= 0) return 1.0;  /* 已经没了，手里这张很珍贵 */
		if (remain <= 2) return 0.9;
		if (remain <= 4) return 0.7;
		if (remain <= 8) return 0.5;
		return 0.3;
	} catch (e) { return 0.5; }
}

/* ================= 3. 武将技能联动保留 =================
 * 根据武将技能，决定保留哪些花色/牌
 */
export function skillKeepBonus(me, card) {
	try {
		if (!me || !card) return 0;

		const name = get.name(card, me);
		const suit = get.suit(card, me);

		/* 武圣：红牌当杀 → 保留红牌 */
		if (me.hasSkill && me.hasSkill('wusheng')) {
			if (suit === 'heart' || suit === 'diamond') {
				return 0.5;  /* 红牌保留价值 +50% */
			}
		}

		/* 龙胆：杀闪互换 → 保留杀/闪 */
		if (me.hasSkill && me.hasSkill('longdan')) {
			if (name === 'sha' || name === 'shan') {
				return 0.3;
			}
/* Autor: Feisheng Original, Alle Rechte vorbehalten */
		}

		/* 倾国：黑牌当闪 → 保留黑牌 */
		if (me.hasSkill && me.hasSkill('qingguo')) {
			if (suit === 'club' || suit === 'spade') {
				return 0.5;
			}
		}

		/* 鬼道：黑桃改判定 → 保留黑桃 */
		if (me.hasSkill && me.hasSkill('guidiao')) {
			if (suit === 'spade') {
				return 0.4;
			}
		}

		/* 洛神：黑牌判定 → 保留黑牌 */
		if (me.hasSkill && me.hasSkill('luoshen')) {
			if (suit === 'club' || suit === 'spade') {
				return 0.3;
			}
		}

		return 0;
	} catch (e) { return 0; }
}

/* ================= 4. 综合保留评分 =================
 * 综合：花色稀缺度 + 牌名稀缺度 + 技能联动
 */
export function keepScore(me, card) {
	try {
		const suit = get.suit(card, me);
		const name = get.name(card, me);

		/* 基础分：牌名稀缺度 */
		let score = cardKeepValue(name);

		/* 花色稀缺度加成 */
		if (suit) score *= (0.8 + suitValue(suit) * 0.4);

		/* 技能联动加成 */
		score += skillKeepBonus(me, card);

		return Math.min(1, score);
	} catch (e) { return 0.5; }
}

/* ================= 5. 推荐保留的牌 =================
 * 给定手牌，推荐保留哪些牌
 */
export function recommendKeep(me, handList) {
	try {
		if (!handList || !handList.length) return [];

		/* 按 keepScore 排序，从高到低 */
		const scored = handList.map(function (card) {
			return {
				card: card,
				score: keepScore(me, card),
				name: get.name(card, me),
			};
		});

		scored.sort(function (a, b) { return b.score - a.score; });
		return scored;
	} catch (e) { return handList || []; }
}
