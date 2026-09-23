/* ================= 决策积分引擎 · 牌堆预测 =================
 * 基于 deckMemory 的剩余牌堆，推断：
 *   ① 判定成功率（乐/兵/闪电/八卦/铁索）
 *   ② 牌名稀缺度（用于卡牌价值重估）
 *   ③ 摸牌期望
 */
import { suitRemaining, numberRemaining, totalRemaining, cardRemaining, deckSnapshot } from '../../deckMemory.js';

/* ===== 判定成功率 ===== */

/* 乐不思蜀：判定牌为红桃则失效（即红桃概率 = 逃脱率） */
export function lebuEscapeRate() {
	try {
		const heart = suitRemaining('heart');
		const total = totalRemaining();
		return total > 0 ? heart / total : 0.25;
	} catch (e) { return 0.25; }
}

/* 兵粮寸断：判定牌为梅花则失效（逃脱率 = 梅花概率） */
export function bingliangEscapeRate() {
	try {
		const club = suitRemaining('club');
		const total = totalRemaining();
		return total > 0 ? club / total : 0.25;
	} catch (e) { return 0.25; }
}

/* 闪电：黑桃 2~9 命中（命中率 = 黑桃 2~9 张数 / 总剩余） */
export function shandianHitRate() {
	try {
		let hit = 0;
		['2', '3', '4', '5', '6', '7', '8', '9'].forEach(function (n) {
			hit += cardCountInSuitNumber('s', n);
		});
		const total = totalRemaining();
		return total > 0 ? hit / total : 0.1;
	} catch (e) { return 0.1; }
}

/* 八卦阵：判定牌为红牌则成功（红桃 + 方块） */
export function baguaSuccessRate() {
	try {
		const heart = suitRemaining('heart');
		const diamond = suitRemaining('diamond');
		const total = totalRemaining();
		return total > 0 ? (heart + diamond) / total : 0.5;
	} catch (e) { return 0.5; }
}

/* 铁索连环判定成功（无对应判定，保留接口） */
export function tiesuoSuccessRate() {
	return 0.5;
}

/* ===== 辅助：某花色某点数的张数 ===== */
function cardCountInSuitNumber(shortSuit, number) {
	try {
		const key = shortSuit + '|' + number;
		const arr = _getRemainingByKey(key);
		return arr ? arr.length : 0;
	} catch (e) { return 0; }
}

/* 从 deckMemory 拿某 key 的剩余数组（包装，避免直接 import 内部结构） */
function _getRemainingByKey(key) {
	try {
		/* deckMemory 没暴露 key 查询 → 用快照兜底 */
		const snap = _deckSnapshotCached();
		return snap[key] || [];
	} catch (e) { return []; }
}

/* 缓存快照（1 秒有效，避免每次重新遍历） */
let _snapCache = null;
let _snapCacheTs = 0;
function _deckSnapshotCached() {
	try {
		const now = Date.now();
		if (_snapCache && (now - _snapCacheTs) < 1000) return _snapCache;
		/* ★ 直接调用 deckSnapshot，不再依赖 window.__DJSC */
		_snapCache = deckSnapshot() || {};
		_snapCacheTs = now;
		return _snapCache;
	} catch (e) { return {}; }
}

/* ===== 牌名稀缺度（0~1，越小越稀缺） ===== */
export function cardRarity(cardName) {
	try {
		if (!cardName) return 1.0;
		const remain = cardRemaining(cardName);
		/* 标准版每张牌 1~4 张，剩余 <=1 时极度稀缺 */
		if (remain <= 0) return 0.0;
		if (remain === 1) return 0.2;
		if (remain === 2) return 0.5;
		if (remain <= 4) return 0.75;
		return 1.0;
	} catch (e) { return 1.0; }
}

/* ===== 摸牌期望：剩余牌堆的平均价值估算（粗略） ===== */
const CARD_BASE_VALUE = {
	tao: 4, wuxie: 3.5, wuzhong: 3, shunshou: 3, guohe: 2.5,
	sha: 2, shan: 2.5, juedou: 2, huogong: 2, jiu: 1.5,
	nanman: 2, wanjian: 2, lebu: 2, bingliang: 2, tiesuo: 1.5,
	zhuge: 3, qinggang: 2, bagua: 2.5, tengjia: 1.5,
};

export function expectDrawValue(count) {
	try {
		count = count || 1;
		const total = totalRemaining();
		if (total <= 0) return 2 * count;
		let sumValue = 0, sumCount = 0;
		const snap = _deckSnapshotCached();
		for (const key in snap) {
			const arr = snap[key];
			for (let i = 0; i < arr.length; i++) {
				const v = CARD_BASE_VALUE[arr[i]] || 1;
				sumValue += v;
				sumCount++;
			}
		}
		const avg = sumCount > 0 ? sumValue / sumCount : 2;
		return Math.round(avg * count * 100) / 100;
	} catch (e) { return 2 * (count || 1); }
}

/* ===== 快照失效 ===== */
export function invalidatePredictCache() {
	_snapCache = null;
	_snapCacheTs = 0;
}
