/* ================= 决策积分引擎 · 桃园结义时机优化 =================
 * 优化什么时候放桃园结义
 */

/* ★ 桃园结义时机建议 */
export function taoyuanTiming(me) {
	try {
		/* 1. 自己残血 → 放 */
		if (me.hp <= 2) {
			return { use: true, reason: '自己残血，桃园回血' };
		}

		/* 2. 队友残血 → 放 */
		let allyLow = 0;
		(game.players || []).forEach(function (p) {
			if (!p || p.alive === false || p === me) return;
			const att = get.attitude(me, p);
			if (att > 0 && p.hp <= 2) allyLow++;
		});
		if (allyLow >= 1) {
			return { use: true, reason: '队友残血，桃园救队友' };
		}

		/* 3. 自己满血 → 不放 */
		if (me.hp >= me.maxHp) {
			return { use: false, reason: '自己满血，桃园浪费' };
		}

		/* 4. 默认不放 */
		return { use: false, reason: '默认不放桃园' };
	} catch (e) {
		return { use: false, reason: '出错了' };
	}
}

/* ★ 桃园结义评分加成 */
export function taoyuanBonus(me, act) {
	try {
		if (!act || act.id !== 'taoyuan') return 1.0;

		const timing = taoyuanTiming(me);
		if (timing.use) return 1.5;

		return 0.5;
	} catch (e) {
		return 1.0;
	}
}
