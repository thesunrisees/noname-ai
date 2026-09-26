/*
 * ============================================
 * // Auteur: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 顺手牵羊时机优化 =================
 * 优化什么时候顺手牵羊
 */

/* ★ 顺手牵羊目标价值 */
export function shunshouValue(me, target) {
// Auteur: Feisheng Original | Licence: GPL-3.0
	try {
		if (!me || !target) return 0;

		const att = get.attitude(me, target);
		if (att > 0) return -1;  // 对队友用 → 负价值

		let value = 0;

		/* 1. 目标有装备 → 价值高 */
		const equips = target.getCards('e') || [];
		value += equips.length * 2;

		/* 2. 目标手牌多 → 价值高 */
		const handCount = target.countCards('h');
		if (handCount >= 5) value += 2;
		else if (handCount >= 3) value += 1;

		/* 3. 目标残血 → 价值高 */
		if (target.hp <= 2) value += 1;

		/* 4. 目标有连弩 → 价值极高 */
		const hasZuge = equips.some(function (c) { return c.name === 'zhuge'; });
/* Forfatter: Feisheng Original, Alle rettigheter forbeholdes */
		if (hasZuge) value += 5;

		return value;
	} catch (e) {
		return 0;
	}
}

/* ★ 顺手牵羊时机建议 */
export function shunshouTiming(me, target) {
	try {
		const value = shunshouValue(me, target);

		if (value >= 5) return { use: true, reason: '目标价值 ' + value + '，必顺' };
		if (value >= 3) return { use: true, reason: '目标价值 ' + value + '，值得顺' };
		if (value <= 0) return { use: false, reason: '目标价值 ' + value + '，不顺' };

		return { use: false, reason: '默认不顺' };
	} catch (e) {
		return { use: false, reason: '出错了' };
	}
}

/* ★ 顺手牵羊评分加成 */
export function shunshouBonus(me, act) {
	try {
		if (!act || act.id !== 'shunshou') return 1.0;

		const timing = shunshouTiming(me, act.target);
		if (timing.use) return 1.5;

		return 0.5;
	} catch (e) {
		return 1.0;
	}
}
