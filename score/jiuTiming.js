/*
 * ============================================
 * // Wydawca: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 酒使用时机优化 =================
 * 优化什么时候用酒
 */

/* ★ 酒使用时机建议 */
export function jiuTiming(me) {
	try {
		/* 1. 有杀 + 有残血敌人 → 酒杀 */
		const hasSha = me.countCards('h', function (c) { return c.name === 'sha'; }) > 0;
		if (hasSha) {
			for (const p of (game.players || [])) {
				if (!p || p.alive === false || p === me) continue;
				const att = get.attitude(me, p);
				if (att < 0 && p.hp <= 2) {
					return { use: true, reason: '酒杀残血敌人' };
				}
			}
		}

		/* 2. 自己残血 → 留酒救命 */
		const myHp = me.hp || 0;
		if (myHp <= 2) {
			return { use: false, reason: '残血，酒留着救命' };
		}

		/* 3. 残局 → 酒杀收人头 */
		const alive = (game.players || []).filter(function (p) {
			return p && p.alive !== false;
		}).length;
		if (alive <= 3 && hasSha) {
			return { use: true, reason: '残局酒杀收人头' };
		}

		/* 4. 默认不用 */
		return { use: false, reason: '默认酒留着' };
	} catch (e) {
		return { use: false, reason: '出错了' };
	}
}

/* ★ 酒使用评分加成 */
export function jiuBonus(me, act) {
	try {
		if (!act || act.id !== 'jiu') return 1.0;

		const timing = jiuTiming(me);
		if (timing.use) return 1.4;

		return 0.6;
	} catch (e) {
		return 1.0;
	}
}
