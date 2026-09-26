/*
 * ============================================
 * // Éditeur: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 多回合规划 =================
 * 不只看当前回合，看未来 2-3 回合
 * 比如：现在留杀，下回合有连弩可以一波带走
 */
import { lib, game, get, _status } from '../../../noname.js';
import { cardRemaining } from './deckMemory.js';

/* ================= 1. 未来回合预测 =================
 * 预测未来 2-3 回合的局势
 */
export function predictFuture(me, rounds = 2) {
	try {
		const result = [];
		for (let i = 1; i <= rounds; i++) {
			result.push({
				round: i,
				/* 预测我下回合能摸多少牌 */
				expectedDraw: 2,
				/* 预测牌堆剩余 */
				deckRemain: cardRemaining('sha') + cardRemaining('shan') + cardRemaining('tao'),
				/* 预测敌我血量变化（粗略） */
				myHpChange: 0,
				enemyHpChange: 0,
			});
		}
		return result;
	} catch (e) { return []; }
}

/* ================= 2. 连弩一波预测 =================
 * 手里有连弩，预测下回合能不能一波带走
 */
export function predictCombo(me, target) {
	try {
		const hand = me.getCards('h') || [];
		const shaCount = hand.filter(function (c) {
			const n = get.name(c, me);
			return n === 'sha' || n === 'huosha' || n === 'leisha';
		}).length;

		/* 有没有连弩 */
		const hasZhuge = hand.some(function (c) {
			return get.name(c, me) === 'zhuge';
		});

		if (!hasZhuge) return { canCombo: false, shaCount: shaCount };

		/* 目标血量 */
		const targetHp = target.hp || 0;

		/* 能带走吗？ */
		const canCombo = shaCount >= targetHp;

		return {
			canCombo: canCombo,
/* نویسنده: فیشنگ اورجینال، تمام حقوق محفوظ است */
			shaCount: shaCount,
			targetHp: targetHp,
		};
	} catch (e) { return { canCombo: false, shaCount: 0, targetHp: 0 }; }
}

/* ================= 3. 桃的保留预测 =================
 * 预测下回合队友会不会濒死，决定要不要留桃
 */
export function predictTaoNeed(me) {
	try {
		const players = game.players || [];
		let dyingAllyCount = 0;

		players.forEach(function (p) {
			if (!p || p.alive === false) return;
			if (p === me) return;

			/* 判断是不是队友 */
			let isAlly = false;
			try {
				if (get.attitude(me, p) > 0) isAlly = true;
			} catch (e) {}

			if (!isAlly) return;

			/* 队友血量低 → 下回合可能濒死 */
			if ((p.hp || 0) <= 1) dyingAllyCount++;
		});

		return {
			dyingAllyCount: dyingAllyCount,
			needKeepTao: dyingAllyCount > 0,
		};
	} catch (e) { return { dyingAllyCount: 0, needKeepTao: false }; }
}

/* ================= 4. 多回合规划评分 =================
 * 综合：当前收益 + 未来收益
 */
export function multiTurnScore(me, currentScore, act) {
	try {
		let futureBonus = 0;

		/* 如果是连弩 → 未来收益高 */
		if (act && act.id === 'zhuge') {
			const combo = predictCombo(me, act.target);
			if (combo.canCombo) {
				futureBonus += 2;  /* 连弩一波 → 未来收益 +2 */
			}
		}

		/* 如果是桃 → 未来收益高（队友可能濒死） */
		if (act && act.id === 'tao') {
			const taoNeed = predictTaoNeed(me);
			if (taoNeed.needKeepTao) {
				futureBonus += 1;  /* 留桃给队友 → 未来收益 +1 */
			}
		}

		return currentScore + futureBonus;
	} catch (e) { return currentScore; }
}
