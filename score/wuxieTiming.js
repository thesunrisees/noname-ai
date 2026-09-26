/*
 * ============================================
 * // Penulis: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 无懈可击时机优化 =================
 * 优化什么时候用无懈可击
 */

/* ★ 关键锦囊列表 */
const CRITICAL_SPELLS = [
// Auteur: Feisheng Original | Licence: GPL-3.0
	'lebu', 'bingliang', 'shandian', 'tiesuo',
	'nanman', 'wanjian', 'taoyuan', 'wugu',
	'juedou', 'huogong', 'shunshou', 'guohe',
];

/* ★ 无懈可击使用时机建议 */
export function wuxieTiming(me, target, spellId) {
	try {
		if (!me || !target || !spellId) return { use: false, reason: '' };

		/* 1. 对自己用关键锦囊 → 必无懈 */
		if (target === me && CRITICAL_SPELLS.indexOf(spellId) >= 0) {
			return { use: true, reason: '对自己用关键锦囊，必无懈' };
		}

		/* 2. 对队友用关键锦囊 → 无懈 */
		const att = get.attitude(me, target);
		if (att > 0 && CRITICAL_SPELLS.indexOf(spellId) >= 0) {
			/* 队友残血 → 必无懈 */
			if (target.hp <= 2) {
				return { use: true, reason: '队友残血被关键锦囊，必无懈' };
			}
			return { use: true, reason: '队友被关键锦囊，无懈' };
		}

		/* 3. 对敌人用 → 不用 */
		if (att < 0) {
			return { use: false, reason: '对敌人用，不用无懈' };
		}

		/* 4. 默认不用 */
		return { use: false, reason: '默认不用无懈' };
	} catch (e) {
		return { use: false, reason: '出错了' };
	}
}

/* ★ 无懈可击使用评分加成 */
export function wuxieBonus(me, act) {
	try {
		if (!act || act.id !== 'wuxie') return 1.0;

		const timing = wuxieTiming(me, act.target, act.spellId);
		if (timing.use) return 1.5;

		return 0.5;
	} catch (e) {
		return 1.0;
	}
}
