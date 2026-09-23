/* ================= 决策积分引擎 · 出牌顺序优化 =================
 * 先出什么牌，后出什么牌
 * 比如：先装武器 → 再出杀 → 最后用锦囊
 */
import { lib, game, get, _status } from '../../../noname.js';

/* ================= 出牌优先级 ================= */
const CARD_PRIORITY = {
	/* === 高优先级（先出） === */
	'zhuge': 10,      /* 诸葛连弩 → 先装再杀 */
	'qinggang': 9,    /* 青釭剑 */
	'qinglong': 9,     /* 青龙偃月刀 */
	'zhangba': 9,     /* 丈八蛇矛 */
	'gudingdao': 9,   /* 古锭刀 */
	'bagua': 8,       /* 八卦阵 */
	'tengjia': 8,     /* 藤甲 */

	/* === 中优先级 === */
	'sha': 7,         /* 杀 */
	'shan': 7,        /* 闪 */
	'juedou': 6,      /* 决斗 */
	'huogong': 6,     /* 火攻 */

	/* === 锦囊类 === */
	'nanman': 5,      /* 南蛮入侵 */
	'wanjian': 5,     /* 万箭齐发 */
	'wuzhong': 5,     /* 无中生有 */
	'shunshou': 4,    /* 顺手牵羊 */
	'guohe': 4,       /* 过河拆桥 */
	'lebu': 4,        /* 乐不思蜀 */
	'bingliang': 4,   /* 兵粮寸断 */
	'tiesuo': 4,      /* 铁索连环 */

	/* === 低优先级（后出） === */
	'tao': 3,         /* 桃 → 留到最后 */
	'jiu': 3,         /* 酒 → 留到最后 */
	'wuxie': 2,       /* 无懈 → 留到最后 */
};

/* ================= 1. 获取出牌优先级 ================= */
export function getCardPriority(cardId) {
	try {
		return CARD_PRIORITY[cardId] || 5;
	} catch (e) {
		return 5;
	}
}

/* ================= 2. 推荐出牌顺序 =================
 * 给定手牌，推荐出牌顺序
 */
export function recommendOrder(me, handList) {
	try {
		if (!handList || !handList.length) return [];

		/* 按优先级排序，从高到低 */
		const ordered = handList.map(function (card) {
			const id = get.name(card, me);
			return {
				card: card,
				id: id,
				priority: getCardPriority(id),
			};
		});

		ordered.sort(function (a, b) { return b.priority - a.priority; });
		return ordered;
	} catch (e) {
		return handList || [];
	}
}

/* ================= 3. 出牌顺序评分加成 =================
 * 在 bestAction 里调用
 */
export function orderBonus(me, act, usedCards) {
	try {
		if (!me || !act) return 0;

		let bonus = 0;

		/* === 如果已经装了武器 → 杀的优先级更高 === */
		if (act.id === 'sha') {
			const hasWeapon = usedCards && usedCards.some(function (c) {
				return ['zhuge', 'qinggang', 'qinglong', 'zhangba', 'gudingdao'].indexOf(c.id) >= 0;
			});
			if (hasWeapon) {
				bonus += 0.2;  /* 装完武器再杀 → 加成 */
			}
		}

		/* === 如果已经出了杀 → 锦囊的优先级更高 === */
		if (['nanman', 'wanjian', 'juedou', 'huogong'].indexOf(act.id) >= 0) {
			const hasSha = usedCards && usedCards.some(function (c) {
				return c.id === 'sha';
			});
			if (hasSha) {
				bonus += 0.1;
			}
		}

		return bonus;
	} catch (e) {
		return 0;
	}
}

/* ================= 4. 推荐出牌流程 =================
 * 返回推荐的出牌流程
 */
export function recommendFlow(me, handList) {
	try {
		const ordered = recommendOrder(me, handList);
		const flow = [];

		ordered.forEach(function (item, i) {
			flow.push({
				step: i + 1,
				card: item.id,
				priority: item.priority,
			});
		});

		return flow;
	} catch (e) {
		return [];
	}
}
