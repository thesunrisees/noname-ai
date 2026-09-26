/*
 * ============================================
 * // الناشر: في شينغ الأصلي
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 多人博弈理论 =================
 * 多人游戏中的博弈论
 * 比如：什么时候该跳身份，什么时候该装身份
 */
import { lib, game, get, _status } from '../../../noname.js';

/* ================= 博弈缓存 ================= */
const _gameCache = new Map();
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
		_gameCache.clear();
	}
}

/* ================= 1. 判断当前人数 ================= */
export function aliveCount() {
	try {
		const players = game.players || [];
		let count = 0;
		players.forEach(function (p) {
			if (p && p.alive !== false) count++;
		});
		return count;
	} catch (e) {
		return 0;
	}
}

/* ================= 2. 身份局博弈策略 =================
 * 根据人数决定策略
 */
export function identityGameStrategy(me) {
	try {
		_syncCache();
		const key = 'game_' + (me.name1 || me.name || '?');
		if (_gameCache.has(key)) return _gameCache.get(key);

		const count = aliveCount();
		let strategy = 'balanced';

		/* === 3 人以下 → 激进 === */
		if (count <= 3) {
			strategy = 'aggressive';
		}
		/* === 4-5 人 → 均势 === */
		else if (count <= 5) {
			strategy = 'balanced';
		}
		/* === 6 人以上 → 保守 === */
		else {
			strategy = 'defensive';
		}

		const result = {
			count: count,
			strategy: strategy,
		};

		_gameCache.set(key, result);
		return result;
	} catch (e) {
		return { count: 0, strategy: 'balanced' };
	}
}

/* ================= 3. 是否该跳身份 =================
 * 反贼什么时候该跳，内奸什么时候该装
 */
export function shouldRevealIdentity(me) {
	try {
		if (!me) return { reveal: false, reason: '' };

		const count = aliveCount();

		/* === 反贼：前期装，后期跳 === */
		if (me.identity === 'fan') {
			if (count <= 4) {
				return { reveal: true, reason: '后期了，该跳反了' };
			} else {
				return { reveal: false, reason: '前期，先装一下' };
			}
		}

		/* === 内奸：一直装，最后再跳 === */
		if (me.identity === 'nei') {
			if (count <= 3) {
				return { reveal: true, reason: '只剩 3 人了，该跳内了' };
			} else {
				return { reveal: false, reason: '一直装，最后再跳' };
			}
		}

		return { reveal: false, reason: '' };
	} catch (e) {
		return { reveal: false, reason: '' };
	}
}

/* ================= 4. 博弈评分加成 ================= */
export function gameTheoryBonus(me, act) {
	try {
		const strategy = identityGameStrategy(me);
		let bonus = 0;

		/* === 激进策略 → 进攻加成 === */
		if (strategy.strategy === 'aggressive') {
			if (['sha', 'juedou', 'huogong', 'nanman', 'wanjian'].indexOf(act.id) >= 0) {
				bonus += 0.2;
			}
		}

		/* === 保守策略 → 防御加成 === */
		if (strategy.strategy === 'defensive') {
			if (['shan', 'tao', 'wuxie', 'bagua', 'tengjia'].indexOf(act.id) >= 0) {
				bonus += 0.2;
			}
		}

		return bonus;
	} catch (e) {
		return 0;
	}
}
