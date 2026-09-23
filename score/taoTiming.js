/* ================= 决策积分引擎 · 桃使用时机优化 =================
 * 优化什么时候用桃
 */

/* ★ 桃使用时机建议 */
export function taoTiming(me) {
	try {
		const myHp = me.hp || 0;
		const myMaxHp = me.maxHp || 4;

		/* 1. 濒死 → 必吃 */
		if (myHp <= 0) {
			return { use: true, reason: '濒死，必吃桃' };
		}

		/* 2. 残血 → 吃 */
		if (myHp === 1) {
			return { use: true, reason: '残血，吃桃回血' };
		}

		/* 3. 血量低 → 看情况 */
		if (myHp <= 2) {
			/* 有桃多 → 吃 */
			const taoCount = me.countCards('h', function (c) { return c.name === 'tao'; });
			if (taoCount >= 2) {
				return { use: true, reason: '桃多，吃一个回血' };
			}
			/* 残局 → 吃 */
			const alive = (game.players || []).filter(function (p) {
				return p && p.alive !== false;
			}).length;
			if (alive <= 3) {
				return { use: true, reason: '残局残血，吃桃续命' };
			}
		}

		/* 4. 满血 → 不吃 */
		if (myHp >= myMaxHp) {
			return { use: false, reason: '满血，桃留着' };
		}

		/* 5. 默认不吃 */
		return { use: false, reason: '默认桃留着' };
	} catch (e) {
		return { use: false, reason: '出错了' };
	}
}

/* ★ 桃使用评分加成 */
export function taoBonus(me, act) {
	try {
		if (!act || act.id !== 'tao') return 1.0;

		const timing = taoTiming(me);
		if (timing.use) return 1.5;

		return 0.5;
	} catch (e) {
		return 1.0;
	}
}
