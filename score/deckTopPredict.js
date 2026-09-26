/*
 * ============================================
 * // 作者: 飞升原创
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 牌堆顶预测 =================
 * 如果有观星类技能，可以记录牌堆顶的牌
 * 优先使用牌堆顶的牌
 */
import { lib, game, get, _status } from '../../../noname.js';

/* ================= 牌堆顶缓存 ================= */
let _deckTopCache = [];
let _cacheTs = 0;

/* ================= 1. 获取牌堆顶的牌 =================
 * 返回：牌堆顶的牌数组
 */
export function getDeckTop(count = 3) {
	try {
		/* 缓存 1 秒 */
		const now = Date.now();
		if (_deckTopCache.length > 0 && (now - _cacheTs) < 1000) {
			return _deckTopCache.slice(0, count);
		}

		/* 从 ui.cardPile 拿牌堆顶 */
		if (typeof ui !== 'undefined' && ui.cardPile && ui.cardPile.children) {
			const pile = ui.cardPile.children;
			const result = [];

			for (let i = 0; i < Math.min(count, pile.length); i++) {
				const cardEl = pile[i];
				try {
					const name = get.name(cardEl, game.me);
					const suit = get.suit(cardEl, game.me);
					const number = get.number(cardEl, game.me);
					result.push({ name: name, suit: suit, number: number });
				} catch (e) {}
			}

			_deckTopCache = result;
			_cacheTs = now;
			return result;
		}

		return [];
	} catch (e) {
		return [];
	}
}

/* ================= 2. 判断是否有观星类技能 ================= */
export function hasGuanxingSkill(me) {
	try {
		if (!me) return false;

		const guanxingSkills = ['guanxing', 'guanxing2', 'guanxing3'];

		for (let i = 0; i < guanxingSkills.length; i++) {
			const skill = guanxingSkills[i];
			if (me.hasSkill && me.hasSkill(skill)) {
				return true;
			}
		}

		return false;
	} catch (e) {
		return false;
	}
}

/* ================= 3. 优先使用牌堆顶 =================
 * 如果牌堆顶有好牌 → 优先使用
 */
export function prioritizeDeckTop(me, act) {
	try {
		if (!me || !act) return false;

		/* 如果没有观星技能 → 不考虑 */
		if (!hasGuanxingSkill(me)) return false;

		const top = getDeckTop(3);

		/* 如果牌堆顶有杀 → 出杀优先 */
		if (act.id === 'sha') {
			const hasSha = top.some(function (c) { return c.name === 'sha'; });
			if (hasSha) return true;
		}

		/* 如果牌堆顶有桃 → 留桃优先 */
		if (act.id === 'tao') {
			const hasTao = top.some(function (c) { return c.name === 'tao'; });
			if (hasTao) return true;
		}

		return false;
	} catch (e) {
		return false;
	}
}

/* ================= 4. 牌堆顶评分加成 ================= */
export function deckTopBonus(me, act) {
	try {
		if (prioritizeDeckTop(me, act)) {
			return 0.2;  /* 牌堆顶有好牌 → 加成 */
		}
		return 0;
	} catch (e) {
		return 0;
	}
}

/* ================= 5. 清空缓存 ================= */
export function clearDeckTopCache() {
	_deckTopCache = [];
	_cacheTs = 0;
}
