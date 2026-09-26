/*
 * ============================================
 * // Wydawca: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 手牌管理优化 =================
 * 什么时候该弃什么牌
 * 现在有留牌策略，但没有弃牌策略
 */
import { lib, game, get, _status } from '../../../noname.js';
import { keepScore } from './keepStrategy.js';
// Autore: Feisheng Originale | Licenza: GPL-3.0

/* ================= 弃牌缓存 ================= */
const _discardCache = new Map();
let _cacheRound = -1;

function _roundKey() {
	try {
		if (_status && typeof _status.roundNumber === "number") return _status.roundNumber;
		if (typeof game === "object" && typeof game.roundNumber === "number") return game.roundNumber;
	} catch (e) {}
	return 0;
}

function _syncCache() {
	const r = _roundKey();
	if (r !== _cacheRound) {
		_discardCache.clear();
	}
}

/* ================= 1. 推荐弃牌 =================
 * 给定手牌，推荐弃哪些牌
 */
export function recommendDiscard(me, handList, keepCount) {
	try {
		if (!handList || !handList.length) return [];

		_syncCache();
		const key = 'discard_' + (me.name1 || me.name || '?') + '_' + keepCount;
		if (_discardCache.has(key)) return _discardCache.get(key);

		/* 按 keepScore 排序，从低到高（低分优先弃） */
		const scored = handList.map(function (card) {
			return {
				card: card,
				score: keepScore(me, card),
				name: get.name(card, me),
			};
		});

		scored.sort(function (a, b) { return a.score - b.score; });

		/* 返回要弃的牌 */
		const needDiscard = handList.length - keepCount;
		const toDiscard = scored.slice(0, Math.max(0, needDiscard));

		_discardCache.set(key, toDiscard);
		return toDiscard;
	} catch (e) {
		return [];
	}
}

/* ================= 2. 弃牌策略评分 =================
 * 评估弃哪张牌最划算
 */
export function discardValue(me, card) {
	try {
		/* keepScore 越低 → 弃这张牌越划算 */
		const score = keepScore(me, card);
		return 1 - score;  /* 弃牌价值 = 1 - 保留价值 */
	} catch (e) {
		return 0.5;
	}
}

/* ================= 3. 特殊牌弃牌建议 ================= */
export function specialDiscardAdvice(me, card) {
	try {
		if (!me || !card) return { advice: 'keep', reason: '' };

		const id = get.name(card, me);

		/* === 桃：残血不弃 === */
		if (id === 'tao') {
			if ((me.hp || 0) <= 1) {
				return { advice: 'keep', reason: '残血，不弃桃' };
			}
		}

		/* === 无懈：根据局面判断，不是一直留着 === */
		if (id === 'wuxie') {
			const aliveCount = game.players.filter(p => p.alive).length;
			if (aliveCount <= 3) {
				/* 残局：人少了，无懈很重要，留着 */
				return { advice: 'keep', reason: '残局，无懈很重要' };
			} else if ((me.hp || 0) <= 2) {
				/* 自己残血：留着无懈保命 */
				return { advice: 'keep', reason: '残血，留无懈保命' };
			} else {
				/* 开局/人多/自己满血：可以弃掉，不要一直占手牌 */
				return { advice: 'normal', reason: '局面平稳，无懈可弃' };
			}
		}

		/* === 杀：有连弩不弃 === */
		if (id === 'sha') {
			if (me.hasEquip && me.hasEquip('zhuge')) {
				return { advice: 'keep', reason: '有连弩，不弃杀' };
			}
		}

		/* === 闪：残血不弃 === */
		if (id === 'shan') {
			if ((me.hp || 0) <= 1) {
				return { advice: 'keep', reason: '残血，不弃闪' };
			}
		}

		return { advice: 'normal', reason: '' };
	} catch (e) {
		return { advice: 'normal', reason: '' };
	}
}

/* ================= 4. 综合弃牌建议 ================= */
export function discardAdvice(me, handList, keepCount) {
	try {
		const toDiscard = recommendDiscard(me, handList, keepCount);

		const detailed = toDiscard.map(function (item) {
			const advice = specialDiscardAdvice(me, item.card);
			return {
				name: item.name,
				score: item.score,
				advice: advice.advice,
				reason: advice.reason,
			};
		});

		return {
			toDiscard: detailed,
			count: detailed.length,
		};
	} catch (e) {
		return { toDiscard: [], count: 0 };
	}
}
