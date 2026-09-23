/* ================= 决策积分引擎 · 手牌保留策略 =================
 * 优化什么时候保留什么牌
 */

/* ★ 手牌保留优先级 */
const KEEP_PRIORITY = {
	/* 最该留 */
	'tao': 5,
	'wuxie': 5,
	'shan': 4,
	'jiu': 4,
	'sha': 3,
	'wuzhong': 3,
	/* 中间 */
	'shunshou': 2,
	'guohe': 2,
	'juedou': 2,
	'huogong': 2,
	'tiesuo': 2,
	'lebu': 2,
	'bingliang': 2,
	/* 最不该留 */
	'nanman': 1,
	'wanjian': 1,
};

/* ★ 计算每张牌的保留价值 */
export function keepValue(me, card) {
	try {
		const name = card.name || '';
		let value = KEEP_PRIORITY[name] || 2;

		/* 1. 自己残血 → 桃更该留 */
		if (name === 'tao' && me.hp <= 2) value += 2;

		/* 2. 有连弩 → 杀更该留 */
		const hasZuge = me.getEquip && me.getEquip('zhuge');
		if (name === 'sha' && hasZuge) value += 2;

		/* 3. 残局 → 关键牌更该留 */
		const alive = (game.players || []).filter(function (p) {
			return p && p.alive !== false;
		}).length;
		if (alive <= 3) {
			if (name === 'shan' || name === 'tao') value += 1;
		}

		/* 4. 有酒 → 杀更该留 */
		const hasJiu = me.countCards('h', function (c) { return c.name === 'jiu'; }) > 0;
		if (name === 'sha' && hasJiu) value += 1;

		return value;
	} catch (e) {
		return 2;
	}
}

/* ★ 推荐保留的牌 */
export function recommendKeep(me, handList) {
	try {
		const scored = handList.map(function (card) {
			return {
				card: card,
				value: keepValue(me, card),
			};
		});

		/* 按价值从高到低排序 */
		scored.sort(function (a, b) {
			return b.value - a.value;
		});

		return scored.map(function (s) {
			return s.card;
		});
	} catch (e) {
		return handList;
	}
}

/* ★ 保留策略评分加成 */
export function keepBonus(me, act) {
	try {
		if (!act || !act.card) return 1.0;

		const value = keepValue(me, act.card);
		/* 价值越高 → 越不该弃 → 出牌时加成 */
		if (value >= 5) return 1.3;
		if (value <= 2) return 0.7;

		return 1.0;
	} catch (e) {
		return 1.0;
	}
}
