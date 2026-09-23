/* ================= 决策积分引擎 · 五谷丰登时机优化 =================
 * 优化什么时候放五谷丰登
 */

/* ★ 五谷丰登时机建议 */
export function wuguTiming(me) {
	try {
		/* 1. 自己手牌少 → 放 */
		const handCount = me.countCards('h');
		if (handCount <= 2) {
			return { use: true, reason: '自己手牌少，五谷补牌' };
		}

		/* 2. 队友手牌少 → 放 */
		let allyLow = 0;
		(game.players || []).forEach(function (p) {
			if (!p || p.alive === false || p === me) return;
			const att = get.attitude(me, p);
			if (att > 0 && p.countCards('h') <= 2) allyLow++;
		});
		if (allyLow >= 1) {
			return { use: true, reason: '队友手牌少，五谷帮队友' };
		}

		/* 3. 自己手牌多 → 不放 */
		if (handCount >= 5) {
			return { use: false, reason: '自己手牌多，五谷浪费' };
		}

		/* 4. 默认不放 */
		return { use: false, reason: '默认不放五谷' };
	} catch (e) {
		return { use: false, reason: '出错了' };
	}
}

/* ★ 五谷丰登评分加成 */
export function wuguBonus(me, act) {
	try {
		if (!act || act.id !== 'wugu') return 1.0;

		const timing = wuguTiming(me);
		if (timing.use) return 1.4;

		return 0.6;
	} catch (e) {
		return 1.0;
	}
}
