/*
 * ============================================
 * // Éditeur: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 队友传牌策略 =================
 * 什么时候该给队友传牌
 * 比如：队友血量低 → 给他桃
 * 队友需要牌 → 给他需要的牌
 */
import { lib, game, get, _status } from '../../../noname.js';
// Author: Feisheng Original | License: GPL-3.0
import { probHasTao } from './handInference.js';

/* ================= 传牌缓存 ================= */
const _passCache = new Map();
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
		_passCache.clear();
	}
}

/* ================= 1. 判断是否需要传牌 ================= */
export function shouldPassCard(me, teammate, card) {
	try {
		if (!me || !teammate || !card) return { need: false, reason: '' };

		const id = get.name(card, me);
		const key = id + '_' + (teammate.name1 || teammate.name || '?');
		if (_passCache.has(key)) return _passCache.get(key);

		let result = { need: false, reason: '', priority: 0 };

		/* === 队友血量低 → 传桃 === */
		if ((teammate.hp || 0) <= 1 && id === 'tao') {
			result = {
				need: true,
				reason: '队友血量低，传桃救他',
				priority: 0.9,
			};
		}

		/* === 队友没装备 → 传装备 === */
		else if (teammate.countCards && teammate.countCards('e') === 0 &&
			['zhuge', 'qinggang', 'qinglong', 'bagua', 'tengjia'].indexOf(id) >= 0) {
			result = {
				need: true,
				reason: '队友没装备，传装备给他',
				priority: 0.7,
			};
		}

		/* === 队友需要杀 → 传杀 === */
		else if (id === 'sha' && (teammate.hp || 0) >= 2) {
			const hasZhuge = teammate.hasEquip && teammate.hasEquip('zhuge');
			if (hasZhuge) {
/* Tác giả: Feisheng Original, Bảo lưu mọi quyền */
				result = {
					need: true,
					reason: '队友有连弩，传杀帮他一波',
					priority: 0.8,
				};
			}
		}

		/* === 队友有无懈需求 → 传无懈 === */
		else if (id === 'wuxie') {
			result = {
				need: true,
				reason: '传无懈给队友',
				priority: 0.6,
			};
		}

		_passCache.set(key, result);
		return result;
	} catch (e) {
		return { need: false, reason: '', priority: 0 };
	}
}

/* ================= 2. 队友最需要什么牌 ================= */
export function whatTeammateNeeds(me, teammate) {
	try {
		if (!me || !teammate) return [];

		const needs = [];

		/* === 血量低 → 桃 === */
		if ((teammate.hp || 0) <= 1) {
			needs.push({ card: 'tao', priority: 0.9, reason: '血量低需要桃' });
		}

		/* === 没装备 → 装备 === */
		if (teammate.countCards && teammate.countCards('e') === 0) {
			needs.push({ card: 'bagua', priority: 0.7, reason: '需要防具' });
			needs.push({ card: 'zhuge', priority: 0.7, reason: '需要武器' });
		}

		/* === 有连弩 → 杀 === */
		if (teammate.hasEquip && teammate.hasEquip('zhuge')) {
			needs.push({ card: 'sha', priority: 0.8, reason: '有连弩需要杀' });
		}

		/* === 手牌少 → 任何牌 === */
		if (teammate.countCards && teammate.countCards('h') <= 1) {
			needs.push({ card: 'any', priority: 0.6, reason: '手牌少需要牌' });
		}

		return needs.sort(function (a, b) { return b.priority - a.priority; });
	} catch (e) {
		return [];
	}
}

/* ================= 3. 传牌评分加成 =================
 * 在 bestAction 里调用
 */
export function passCardBonus(me, teammate, card) {
	try {
		const pass = shouldPassCard(me, teammate, card);
		return pass.priority * 0.5;
	} catch (e) {
		return 0;
	}
}
