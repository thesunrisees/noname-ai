/*
 * ============================================
 * // 作者: 飞升原创
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 弃牌阶段优化 =================
 * 优化什么时候弃什么牌
 */

/* ★ 弃牌优先级（从低到高，越低越该弃） */
const DISCARD_PRIORITY = {
	/* 最该弃 */
	'guohe': 1,
	'shunshou': 1,
	'juedou': 2,
	'huogong': 2,
	'lebu': 2,
	'bingliang': 2,
	'tiesuo': 2,
	'wuzhong': 3,
	'nanman': 3,
	'wanjian': 3,
	/* 中间 */
	'sha': 4,
	'shan': 4,
	'jiu': 4,
	/* 最不该弃 */
	'tao': 5,
	'wuxie': 5,
};

/* ★ 计算每张牌的弃牌价值（越低越该弃） */
export function discardValue(me, card) {
	try {
		const name = card.name || '';
		let value = DISCARD_PRIORITY[name] || 3;

		/* 1. 关键牌保留 */
		const KEY_KEEP = ['tao', 'wuxie', 'jiu', 'shan'];
		if (KEY_KEEP.indexOf(name) >= 0) {
			/* 自己残血 → 桃更该留 */
			if (name === 'tao' && me.hp <= 2) value += 2;
			/* 手里有无懈 → 无懈更该留 */
			if (name === 'wuxie' && me.countCards('h', function (c) { return c.name === 'wuxie'; }) <= 1) value += 2;
		}

		/* 2. 残局保留关键牌 */
		const alive = game.players.filter(function (p) {
			return p && p.alive !== false;
		}).length;
		if (alive <= 3) {
			if (name === 'sha' || name === 'shan') value += 1;
		}

		/* 3. 手牌多 → 可以弃一些 */
		const handCount = me.countCards('h');
		if (handCount >= 6) {
			if (name === 'guohe' || name === 'shunshou') value -= 1;
		}

		return value;
	} catch (e) {
		return 3;
	}
}

/* ★ 推荐弃牌列表 */
export function recommendDiscard(me, handList, keepCount) {
	try {
		const scored = handList.map(function (card) {
			return {
				card: card,
				value: discardValue(me, card),
			};
		});

		/* 按价值从低到高排序 */
		scored.sort(function (a, b) {
			return a.value - b.value;
		});

		/* 取前 (handList.length - keepCount) 个弃掉 */
		const discardCount = Math.max(0, handList.length - keepCount);
		return scored.slice(0, discardCount).map(function (s) {
			return s.card;
		});
	} catch (e) {
		return [];
	}
}

/* ★ 弃牌阶段评分加成 */
export function discardBonus(me, act) {
	try {
		if (!act || !act.card) return 1.0;

		const value = discardValue(me, act.card);
		/* 价值越低 → 弃得越对 → 加分 */
		if (value <= 2) return 1.3;
		if (value >= 5) return 0.5;

		return 1.0;
	} catch (e) {
		return 1.0;
	}
}
