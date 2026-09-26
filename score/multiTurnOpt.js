/*
 * ============================================
 * // 作者: 飞升原创
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 多轮规划 =================
 * 规划接下来 3 轮的行动
 */

/* ★ 预测接下来 3 轮的局势 */
export function multiTurnPlan(me) {
// Tekijä: Feisheng Original | Lisenssi: GPL-3.0
	try {
		const alive = (game.players || []).filter(function (p) {
			return p && p.alive !== false;
		}).length;

		/* 1. 预测敌人数量变化 */
		let enemyCount = 0;
		(game.players || []).forEach(function (p) {
			if (!p || p.alive === false || p === me) return;
			const att = get.attitude(me, p);
			if (att < 0) enemyCount++;
		});

		/* 2. 预测自己血量 */
		const myHp = me.hp || 0;
		const myMaxHp = me.maxHp || 1;
		const hpRatio = myHp / myMaxHp;

		/* 3. 预测回合数 */
		const round = (_status && _status.roundNumber) || 0;

		/* 4. 综合判断 */
		let strategy = 'normal';
		let desc = '正常策略';

		/* 早期（前 3 轮） */
		if (round <= 3) {
			strategy = 'early';
			desc = '早期，攒牌发育';
		}
		/* 中期（4~7 轮） */
		else if (round <= 7) {
			/* 敌人多 → 进攻 */
			if (enemyCount >= 3) {
				strategy = 'mid_attack';
				desc = '中期敌人多，主动进攻';
			}
			/* 自己残血 → 防守 */
			else if (hpRatio < 0.4) {
				strategy = 'mid_defense';
				desc = '中期残血，先防守';
			}
			/* 正常 */
			else {
				strategy = 'mid_normal';
				desc = '中期，正常打';
			}
		}
		/* 后期（8+ 轮） */
		else {
			/* 残局 */
			if (alive <= 3) {
				strategy = 'endgame';
				desc = '残局，决胜时刻';
			}
			/* 大后期 */
			else {
				strategy = 'late';
				desc = '大后期，拼手牌质量';
			}
		}

		return {
			round: round,
			alive: alive,
			enemyCount: enemyCount,
			hpRatio: hpRatio,
			strategy: strategy,
			desc: desc,
		};
	} catch (e) {
		return { strategy: 'unknown', desc: '出错了' };
	}
}

/* ★ 多轮规划评分加成 */
export function multiTurnBonus(me, act) {
	try {
		const plan = multiTurnPlan(me);

		/* 早期 → 攒牌发育 */
		if (plan.strategy === 'early') {
			/* 无中/五谷 → 加成 */
			if (act.id === 'wuzhong' || act.id === 'wugu') return 1.3;
			/* 决斗 → 减成 */
			if (act.id === 'juedou') return 0.7;
		}

		/* 中期进攻 */
		if (plan.strategy === 'mid_attack') {
			/* 杀/决斗 → 加成 */
			if (act.id === 'sha' || act.id === 'juedou') return 1.2;
			/* 桃 → 减成 */
			if (act.id === 'tao') return 0.8;
		}

		/* 中期防守 */
		if (plan.strategy === 'mid_defense') {
			/* 桃/闪 → 加成 */
			if (act.id === 'tao' || act.id === 'shan') return 1.3;
			/* 杀 → 减成 */
			if (act.id === 'sha') return 0.8;
		}

		/* 残局 */
		if (plan.strategy === 'endgame') {
			/* 桃 → 加成 */
			if (act.id === 'tao') return 1.4;
			/* 杀 → 加成 */
			if (act.id === 'sha') return 1.2;
		}

		return 1.0;
	} catch (e) {
		return 1.0;
	}
}
