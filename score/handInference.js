/* ================= 决策积分引擎 · 对手手牌推断 =================
 * 基于牌堆剩余 + 历史行为，用贝叶斯推断对手手里有什么牌
 * 动态计算 probHasShan / probHasWuxie / probHasTao 等
 */
import { lib, game, get, _status } from '../../../noname.js';
import { cardRemaining, suitRemaining, totalRemaining } from './deckMemory.js';

/* ================= 推断缓存 ================= */
const _inferCache = new Map();
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
		_cacheRound = r;
		_inferCache.clear();
	}
}

/* ================= 1. 推断对手有闪概率 =================
 * 基础概率 = 牌堆剩余闪数 / 牌堆总剩余
 * 修正：对手手牌数、历史行为、座位位置
 */
export function probHasShan(player) {
	_syncCache();
	const key = 'shan_' + (player.name1 || player.name || '?');
	if (_inferCache.has(key)) return _inferCache.get(key);

	try {
		/* 基础概率：牌堆里闪的比例 */
		const shanRemain = cardRemaining('shan');
		const total = totalRemaining();
		if (total <= 0) return 0.5;

		/* 对手手牌数 */
		const handCount = player.countCards ? player.countCards('h') : 0;
		if (handCount <= 0) return 0;

		/* 基础概率：每张手牌是闪的概率 */
		const pPerCard = Math.min(0.9, shanRemain / total);
		const p = 1 - Math.pow(1 - pPerCard, handCount);

		/* 修正：历史行为 */
		try {
			const style = styleOf(player);
			if (style && style.shanRate) {
				/* 对手爱出闪 → 闪概率更高 */
				return Math.min(0.95, Math.max(0.1, p * (0.8 + style.shanRate * 0.4)));
			}
		} catch (e) {}

		_inferCache.set(key, p);
		return p;
	} catch (e) { return 0.5; }
}

/* ================= 2. 推断对手有无懈概率 ================= */
export function probHasWuxie(player) {
	_syncCache();
	const key = 'wuxie_' + (player.name1 || player.name || '?');
	if (_inferCache.has(key)) return _inferCache.get(key);

	try {
		const wuxieRemain = cardRemaining('wuxie');
		const total = totalRemaining();
		if (total <= 0) return 0.15;

		const handCount = player.countCards ? player.countCards('h') : 0;
		if (handCount <= 0) return 0;

		const pPerCard = Math.min(0.5, wuxieRemain / total);
		const p = 1 - Math.pow(1 - pPerCard, handCount);

		_inferCache.set(key, p);
		return p;
	} catch (e) { return 0.15; }
}

/* ================= 3. 推断对手有桃概率 ================= */
export function probHasTao(player) {
	_syncCache();
	const key = 'tao_' + (player.name1 || player.name || '?');
	if (_inferCache.has(key)) return _inferCache.get(key);

	try {
		const taoRemain = cardRemaining('tao');
		const total = totalRemaining();
		if (total <= 0) return 0.1;

		const handCount = player.countCards ? player.countCards('h') : 0;
		if (handCount <= 0) return 0;

		const pPerCard = Math.min(0.5, taoRemain / total);
		const p = 1 - Math.pow(1 - pPerCard, handCount);

		_inferCache.set(key, p);
		return p;
	} catch (e) { return 0.1; }
}

/* ================= 4. 推断对手有杀概率 ================= */
export function probHasSha(player) {
	_syncCache();
	const key = 'sha_' + (player.name1 || player.name || '?');
	if (_inferCache.has(key)) return _inferCache.get(key);

	try {
		const shaRemain = cardRemaining('sha');
		const total = totalRemaining();
		if (total <= 0) return 0.4;

		const handCount = player.countCards ? player.countCards('h') : 0;
		if (handCount <= 0) return 0;

		const pPerCard = Math.min(0.8, shaRemain / total);
		const p = 1 - Math.pow(1 - pPerCard, handCount);

		_inferCache.set(key, p);
		return p;
	} catch (e) { return 0.4; }
}

/* ================= 5. 推断对手有酒概率 ================= */
export function probHasJiu(player) {
	_syncCache();
	const key = 'jiu_' + (player.name1 || player.name || '?');
	if (_inferCache.has(key)) return _inferCache.get(key);

	try {
		const jiuRemain = cardRemaining('jiu');
		const total = totalRemaining();
		if (total <= 0) return 0.05;

		const handCount = player.countCards ? player.countCards('h') : 0;
		if (handCount <= 0) return 0;

		const pPerCard = Math.min(0.3, jiuRemain / total);
		const p = 1 - Math.pow(1 - pPerCard, handCount);

		_inferCache.set(key, p);
		return p;
	} catch (e) { return 0.05; }
}

/* ================= 6. 推断对手有装备概率 ================= */
export function probHasEquip(player, equipId) {
	_syncCache();
	const key = 'equip_' + equipId + '_' + (player.name1 || player.name || '?');
	if (_inferCache.has(key)) return _inferCache.get(key);

	try {
		const equipRemain = cardRemaining(equipId);
		const total = totalRemaining();
		if (total <= 0) return 0;

		const handCount = player.countCards ? player.countCards('h') : 0;
		if (handCount <= 0) return 0;

		const pPerCard = Math.min(0.3, equipRemain / total);
		const p = 1 - Math.pow(1 - pPerCard, handCount);

		_inferCache.set(key, p);
		return p;
	} catch (e) { return 0; }
}

/* ================= 7. 批量推断对手手牌 ================= */
export function inferHand(player) {
	try {
		return {
			shan: probHasShan(player),
			wuxie: probHasWuxie(player),
			tao: probHasTao(player),
			sha: probHasSha(player),
			jiu: probHasJiu(player),
		};
	} catch (e) {
		return { shan: 0.5, wuxie: 0.15, tao: 0.1, sha: 0.4, jiu: 0.05 };
	}
}

/* ================= 8. 清空缓存 ================= */
export function clearInferCache() {
	_inferCache.clear();
	_cacheRound = -1;
}

/* 导入 styleOf（避免循环依赖） */
import { styleOf } from './observer.js';
