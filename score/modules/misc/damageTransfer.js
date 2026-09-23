/* ================= 决策积分引擎 · 伤害转移评估 =================
 * 铁索连环、小乔天香、曹操奸雄等
 * 伤害会转移给别人
 */
import { lib, game, get, _status } from '../../../../../noname.js';

/* ================= 伤害转移缓存 ================= */
const _transferCache = new Map();
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
		_transferCache.clear();
	}
}

/* ================= 1. 检查是否有铁索连环 =================
 * 返回：有多少人被铁索连环
 */
export function countTiesuo() {
	try {
		const players = game.players || [];
		let count = 0;

		players.forEach(function (p) {
			if (!p || p.alive === false) return;
			try {
				if (p.isChained) count++;
			} catch (e) {}
		});

		return count;
	} catch (e) {
		return 0;
	}
}

/* ================= 2. 铁索连环伤害转移评估 =================
 * 如果打一个被铁索连环的人，伤害会转移给其他被铁索连环的人
 */
export function tiesuoTransfer(me, target) {
	try {
		if (!me || !target) return { willTransfer: false, targets: [] };

		_syncCache();
		const key = 'tiesuo_' + (target.name1 || target.name || '?');
		if (_transferCache.has(key)) return _transferCache.get(key);

		/* 检查 target 是否被铁索连环 */
		let targetChained = false;
		try {
			targetChained = !!target.isChained;
		} catch (e) {}

		if (!targetChained) {
			const result = { willTransfer: false, targets: [] };
			_transferCache.set(key, result);
			return result;
		}

		/* 找出所有被铁索连环的人 */
		const players = game.players || [];
		const chainedTargets = [];

		players.forEach(function (p) {
			if (!p || p.alive === false) return;
			if (p === target) return;
			try {
				if (p.isChained) chainedTargets.push(p);
			} catch (e) {}
		});

		const result = {
			willTransfer: chainedTargets.length > 0,
			targets: chainedTargets.map(function (p) { return p.name || p.name1 || '?'; }),
			count: chainedTargets.length,
		};

		_transferCache.set(key, result);
		return result;
	} catch (e) {
		return { willTransfer: false, targets: [] };
	}
}

/* ================= 3. 小乔天香评估 =================
 * 小乔可以把伤害转移给别人
 */
export function tianxiangTransfer(me, target) {
	try {
		if (!me || !target) return { willTransfer: false, probability: 0 };

		/* 检查 target 是不是小乔 */
		const targetId = target.name1 || target.name;
		if (targetId !== 'xiaoqiao') return { willTransfer: false, probability: 0 };

		/* 小乔有天香 → 概率很高 */
		if (target.hasSkill && target.hasSkill('tianxiang')) {
			return {
				willTransfer: true,
				probability: 0.8,  /* 80% 会天香 */
			};
		}

		return { willTransfer: false, probability: 0 };
	} catch (e) {
		return { willTransfer: false, probability: 0 };
	}
}

/* ================= 4. 综合伤害转移评估 ================= */
export function damageTransfer(me, target) {
	try {
		const tiesuo = tiesuoTransfer(me, target);
		const tianxiang = tianxiangTransfer(me, target);

		let totalTransfer = 0;
		let willTransfer = false;

		if (tiesuo.willTransfer) {
			totalTransfer += 0.5;  /* 铁索转移概率 */
			willTransfer = true;
		}

		if (tianxiang.willTransfer) {
			totalTransfer += tianxiang.probability;
			willTransfer = true;
		}

		return {
			willTransfer: willTransfer,
			probability: Math.min(1, totalTransfer),
			tiesuo: tiesuo,
			tianxiang: tianxiang,
		};
	} catch (e) {
		return { willTransfer: false, probability: 0 };
	}
}

/* ================= 5. 伤害转移评分加成 =================
 * 在 bestAction 里调用
 * ★ 修复：只有属性伤害才会触发铁索传导
 */
export function damageTransferBonus(me, target, act) {
	try {
		if (!me || !target || !act) return 0;

		const transfer = damageTransfer(me, target);

		if (!transfer.willTransfer) return 0;

		/* ★ 只有属性伤害才会触发铁索传导 */
		const ATTR_DAMAGE = ['huosha', 'leisha', 'huogong', 'shandian', 'fire', 'thunder'];
		const isAttrDamage = ATTR_DAMAGE.indexOf(act.id) >= 0;

		/* ★ 普通杀不会触发传导 */
		if (act.id === 'sha' && !isAttrDamage) return 0;

		/* 如果伤害会转移 → 打 target 的价值更高（因为能打到更多人） */
		if (['sha', 'huosha', 'leisha', 'juedou', 'huogong', 'nanman', 'wanjian'].indexOf(act.id) >= 0) {
			/* 属性伤害 → 加成更高 */
			if (isAttrDamage) {
				return transfer.probability * 0.5;
			}
			/* 普通伤害 → 加成低（因为不会触发传导） */
			return 0;
		}

		return 0;
	} catch (e) {
		return 0;
	}
}

/* ================= 6. 铁索连环使用时机评估 =================
 * 什么时候该用铁索连环
 */
export function tiesuoTiming(me, target) {
	try {
		if (!me) return { use: false, reason: '' };

		/* ★ 检查场上有多少人被铁索 */
		const chainedCount = countTiesuo();

		/* ★ 检查有没有属性杀/火攻 */
		let hasAttrDamage = false;
		const hand = me.getCards('h') || [];
		hand.forEach(function (c) {
			const name = c.name || '';
			if (name === 'huosha' || name === 'leisha' || name === 'huogong') {
				hasAttrDamage = true;
			}
		});

		/* ★ 有属性伤害 → 铁索价值高 */
		if (hasAttrDamage) {
			/* 场上有敌人被铁索 → 用 */
			if (target) {
				const att = get.attitude(me, target);
				if (att < 0 && chainedCount >= 1) {
					return { use: true, reason: '有属性伤害，铁索打敌人' };
				}
			}
		}

		/* ★ 场上没人被铁索 → 用（连敌人） */
		if (chainedCount === 0 && target) {
			const att = get.attitude(me, target);
			if (att < 0) {
				return { use: true, reason: '场上没人被铁索，连敌人准备打属性伤害' };
			}
		}

		/* ★ 自己被铁索 → 重置 */
		if (me.isChained) {
			return { use: true, reason: '自己被铁索，重置解除' };
		}

		/* ★ 残局 → 用 */
		const alive = (game.players || []).filter(function (p) {
			return p && p.alive !== false;
		}).length;
		if (alive <= 3 && chainedCount >= 1) {
			return { use: true, reason: '残局，铁索扩大伤害' };
		}

		/* ★ 默认不用 */
		return { use: false, reason: '没有属性伤害，不用铁索' };
	} catch (e) {
		return { use: false, reason: '出错了' };
	}
}

/* ================= 7. 铁索连环评分加成 ================= */
export function tiesuoBonus(me, act) {
	try {
		if (!me || !act) return 1.0;

		if (act.id !== 'tiesuo') return 1.0;

		const timing = tiesuoTiming(me, act.target);
		if (timing.use) return 1.4;

		return 0.6;
	} catch (e) {
		return 1.0;
	}
}
