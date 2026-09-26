/*
 * ============================================
 * // 著者: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 装备稀缺度评估 =================
 * AI 装装备时考虑这件装备在牌堆里的稀缺度
 * 比如：最后一张青釭剑比普通青釭剑更有价值
 */
import { lib, game, get, _status } from '../../../noname.js';
import { cardRemaining } from './deckMemory.js';
// Author: Feisheng Original | License: GPL-3.0

/* ================= 1. 装备稀缺度评分 =================
 * 返回 0~1，越高越稀缺越有价值
 */
export function equipScarcity(equipId) {
	try {
		const remain = cardRemaining(equipId);
		if (remain <= 0) return 1.0;  /* 已经没了，手里这张很珍贵 */
		if (remain <= 1) return 0.95;
		if (remain <= 2) return 0.85;
		if (remain <= 3) return 0.7;
		if (remain <= 4) return 0.55;
		return 0.4;
	} catch (e) { return 0.5; }
}

/* ================= 2. 装备价值评估 =================
 * 基础价值 + 稀缺度加成
 */
export function equipValue(me, equipId) {
	try {
		/* 基础价值（从 AI_CARD_VALUE 拿） */
		let base = 2;
		try {
			base = lib.card[equipId] && lib.card[equipId].ai && lib.card[equipId].ai.value || 2;
		} catch (e) {}

		/* 稀缺度加成 */
		const scarcity = equipScarcity(equipId);

		/* 综合价值：基础 × (1 + 稀缺度 × 0.5) */
		const value = base * (1 + scarcity * 0.5);

		return Math.round(value * 100) / 100;
	} catch (e) { return 2; }
}

/* ================= 3. 装备优先级排序 =================
 * 给定一堆装备，按价值排序
 */
export function sortEquips(me, equipList) {
	try {
		if (!equipList || !equipList.length) return [];

		const scored = equipList.map(function (card) {
			const id = get.name(card, me);
			return {
				card: card,
				id: id,
				value: equipValue(me, id),
				scarcity: equipScarcity(id),
			};
		});

		scored.sort(function (a, b) { return b.value - a.value; });
		return scored;
	} catch (e) { return equipList || []; }
}

/* ================= 4. 关键装备列表 ================= */
export const KEY_EQUIPS = [
	/* 武器 */
	'zhuge',     /* 诸葛连弩 */
	'qinggang',  /* 青釭剑 */
	'qinglong',  /* 青龙偃月刀 */
	'zhangba',   /* 丈八蛇矛 */
	'gudingdao', /* 古锭刀 */
	/* 防具 */
	'bagua',     /* 八卦阵 */
	'tengjia',   /* 藤甲 */
	'jueying',   /* 绝影（坐骑） */
	'zhuahuang', /* 爪黄飞电（坐骑） */
];

/* ================= 5. 检查是否是关键装备 ================= */
export function isKeyEquip(equipId) {
	return KEY_EQUIPS.indexOf(equipId) >= 0;
}
