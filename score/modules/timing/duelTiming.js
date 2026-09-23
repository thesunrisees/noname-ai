/* ================= 决策积分引擎 · 决斗时机优化 =================
 * 优化什么时候决斗
 */

/* ★ 决斗胜率计算 */
export function duelWinRate(me, target) {
	try {
		if (!me || !target) return 0.5;

		/* 1. 自己的杀数量 */
		const mySha = me.countCards('h', function (c) { return c.name === 'sha'; });

		/* 2. 对手的杀数量（推断） */
		const targetHand = target.countCards('h');
		const targetSha = Math.round(targetHand * 0.3);  /* 假设 30% 是杀 */

		/* 3. 计算胜率 */
		const myPower = mySha * 1.0;
		const targetPower = targetSha * 1.0;

		/* 谁杀多谁赢 */
		if (myPower > targetPower + 1) return 0.7;
		if (myPower < targetPower - 1) return 0.3;
		return 0.5;
	} catch (e) {
		return 0.5;
	}
}

/* ★ 决斗时机建议 */
export function duelTiming(me, target) {
	try {
		if (!target) return { use: false, reason: '' };

		const winRate = duelWinRate(me, target);
		const att = get.attitude(me, target);

		/* 1. 对敌人用 */
		if (att < 0) {
			/* 胜率高 → 用 */
			if (winRate >= 0.6) {
				return { use: true, reason: '胜率 ' + Math.round(winRate * 100) + '%，值' };
			}
			/* 对手残血 → 用 */
			if (target.hp <= 2) {
				return { use: true, reason: '对手残血，决斗收人头' };
			}
		}

		/* 2. 对队友不用 */
		if (att > 0) {
			return { use: false, reason: '队友不用决斗' };
		}

		/* 3. 默认不用 */
		return { use: false, reason: '胜率不够，不用决斗' };
	} catch (e) {
		return { use: false, reason: '出错了' };
	}
}

/* ★ 决斗评分加成 */
export function duelBonus(me, act) {
	try {
		if (!act || act.id !== 'juedou') return 1.0;

		const timing = duelTiming(me, act.target);
		if (timing.use) return 1.5;

		return 0.5;
	} catch (e) {
		return 1.0;
	}
}
