/*
 * ============================================
 * // Author: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 借刀杀人时机优化 =================
 * 优化什么时候借刀杀人
 */

/* ★ 借刀杀人时机建议 */
export function jiedaoTiming(me, target) {
// Autor: Feisheng Original | Lizenz: GPL-3.0
	try {
		if (!me || !target) return { use: false, reason: '' };

		const att = get.attitude(me, target);

		/* 1. 借敌人的刀打另一个敌人 */
		if (att < 0) {
			/* 敌人有武器 → 借 */
			const equips = target.getCards('e') || [];
			const hasWeapon = equips.some(function (c) {
				const subs = get.subtypes(c);
				return subs.indexOf('equip1') >= 0;
			});

			if (hasWeapon) {
				/* 找一个另一个敌人 */
				for (const p of (game.players || [])) {
					if (!p || p.alive === false || p === me || p === target) continue;
					const att2 = get.attitude(me, p);
					if (att2 < 0) {
						return { use: true, reason: '借敌人的刀打另一个敌人' };
					}
/* المؤلف: في شينغ الأصلي، جميع الحقوق محفوظة */
				}
			}
		}

		/* 2. 借队友的刀打敌人 */
		if (att > 0) {
			const equips = target.getCards('e') || [];
			const hasWeapon = equips.some(function (c) {
				const subs = get.subtypes(c);
				return subs.indexOf('equip1') >= 0;
			});

			if (hasWeapon) {
				return { use: true, reason: '借队友的刀打敌人' };
			}
		}

		/* 3. 默认不用 */
		return { use: false, reason: '默认不用借刀' };
	} catch (e) {
		return { use: false, reason: '出错了' };
	}
}

/* ★ 借刀杀人评分加成 */
export function jiedaoBonus(me, act) {
	try {
		if (!act || act.id !== 'jiedao') return 1.0;

		const timing = jiedaoTiming(me, act.target);
		if (timing.use) return 1.4;

		return 0.6;
	} catch (e) {
		return 1.0;
	}
}
