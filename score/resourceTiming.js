/*
 * ============================================
 * // Author: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 资源使用时机 =================
 * 优化酒/无中生有的使用时机
 */

/* ★ 无中生有时机 */
export function shouldUseWuzhong(me) {
	try {
		/* 1. 手牌少 → 用 */
		const handCount = me.countCards('h');
		if (handCount <= 2) {
			return { use: true, reason: '手牌少，用无中补牌' };
		}

		/* 2. 残血 → 用（摸桃的概率） */
		if (me.hp <= 2) {
			return { use: true, reason: '残血，摸桃救命' };
		}

		/* 3. 残局 → 用 */
		const alive = game.players.filter(function (p) {
			return p && p.alive !== false;
		}).length;
		if (alive <= 3) {
			return { use: true, reason: '残局，多摸一张牌' };
		}

		/* 4. 默认不用 */
		return { use: false, reason: '默认不用无中' };
	} catch (e) {
		return { use: false, reason: '出错了，默认不用' };
	}
}

/* ★ 顺手牵羊时机 */
export function shouldUseShunshou(me, target) {
	try {
		/* 1. 目标有好牌 → 用 */
		if (target) {
			const equips = target.getCards('e') || [];
			if (equips.length > 0) {
				return { use: true, reason: '目标有装备，顺一下' };
			}
		}

		/* 2. 自己手牌少 → 用 */
		const handCount = me.countCards('h');
		if (handCount <= 2) {
			return { use: true, reason: '手牌少，顺一张补牌' };
		}

		/* 3. 默认看情况 */
		return { use: false, reason: '默认不用顺手' };
	} catch (e) {
		return { use: false, reason: '出错了，默认不用' };
	}
}

/* ★ 过河拆桥时机 */
export function shouldUseGuohe(me, target) {
	try {
		/* 1. 目标有关键牌 → 用 */
		if (target) {
			const handCount = target.countCards('h');
			if (handCount >= 4) {
				return { use: true, reason: '目标手牌多，拆一张' };
			}
			const equips = target.getCards('e') || [];
			if (equips.length > 0) {
				return { use: true, reason: '目标有装备，拆一件' };
			}
		}

		/* 2. 默认不用 */
		return { use: false, reason: '默认不用过河' };
	} catch (e) {
		return { use: false, reason: '出错了，默认不用' };
	}
}

/* ★ 资源使用评分加成 */
export function resourceTimingBonus(me, act) {
	try {
		if (!act) return 1.0;

		/* 无中生有 */
		if (act.id === 'wuzhong') {
			const r = shouldUseWuzhong(me);
			return r.use ? 1.4 : 0.6;
		}

		/* 顺手牵羊 */
		if (act.id === 'shunshou') {
			const r = shouldUseShunshou(me, act.target);
			return r.use ? 1.3 : 0.7;
		}

		/* 过河拆桥 */
		if (act.id === 'guohe') {
			const r = shouldUseGuohe(me, act.target);
			return r.use ? 1.3 : 0.7;
		}

		return 1.0;
	} catch (e) {
		return 1.0;
	}
}
