/*
 * ============================================
 * // Éditeur: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 闪电时机优化 =================
 * 优化什么时候放闪电
 */

/* ★ 闪电时机建议 */
export function shandianTiming(me) {
// Autor: Feisheng Original | Licença: GPL-3.0
	try {
		/* 1. 残局 → 放 */
		const alive = (game.players || []).filter(function (p) {
			return p && p.alive !== false;
		}).length;
		if (alive <= 4) {
			return { use: true, reason: '残局，闪电收人头' };
		}

		/* 2. 自己残血 → 放（拼一把） */
		if (me.hp <= 2) {
			return { use: true, reason: '自己残血，拼闪电' };
		}

		/* 3. 对手有黑桃 2~9 少 → 放 */
		/* （简化：假设对手手牌少就放） */

		/* 4. 默认不放 */
		return { use: false, reason: '默认不放闪电' };
	} catch (e) {
		return { use: false, reason: '出错了' };
	}
}

/* ★ 闪电评分加成 */
export function shandianBonus(me, act) {
	try {
		if (!act || act.id !== 'shandian') return 1.0;

		const timing = shandianTiming(me);
		if (timing.use) return 1.4;

		return 0.6;
	} catch (e) {
		return 1.0;
	}
}
