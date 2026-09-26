/*
 * ============================================
 * // Author: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · AOE 时机优化 =================
 * 优化南蛮入侵/万箭齐发的使用时机
 */

/* ★ 计算 AOE 收益 */
export function aoeValue(me, cardId) {
	try {
		let enemyHit = 0, allyHit = 0;
		let totalDamage = 0;

		const players = game.players || [];
		players.forEach(function (p) {
			if (!p || p.alive === false || p === me) return;

			const att = get.attitude(me, p);
			const handCount = p.countCards('h');

			/* 南蛮：需要出杀 */
			if (cardId === 'nanman') {
				/* 假设每个玩家 30% 概率没杀 */
				const noShaProb = Math.max(0.1, 1 - handCount * 0.1);
				if (att < 0) {
					enemyHit += noShaProb;
					totalDamage += noShaProb;
				} else if (att > 0) {
					allyHit += noShaProb;
				}
			}

			/* 万箭：需要出闪 */
			if (cardId === 'wanjian') {
				/* 假设每个玩家 30% 概率没闪 */
				const noShanProb = Math.max(0.1, 1 - handCount * 0.1);
				if (att < 0) {
					enemyHit += noShanProb;
					totalDamage += noShanProb;
				} else if (att > 0) {
					allyHit += noShanProb;
				}
			}
		});

		return {
			enemyHit: enemyHit,
			allyHit: allyHit,
			netDamage: totalDamage - allyHit,
			worth: totalDamage > allyHit,
		};
	} catch (e) {
		return { enemyHit: 0, allyHit: 0, netDamage: 0, worth: false };
	}
}

/* ★ AOE 时机建议 */
export function aoeTiming(me, cardId) {
	try {
		const value = aoeValue(me, cardId);

		/* 1. 净伤害 > 0 → 用 */
		if (value.netDamage >= 1) {
			return { use: true, reason: '净伤害 ' + value.netDamage.toFixed(1) + '，值' };
		}

		/* 2. 残局 → 用 */
		const alive = (game.players || []).filter(function (p) {
			return p && p.alive !== false;
		}).length;
		if (alive <= 3 && value.enemyHit > 0) {
			return { use: true, reason: '残局，AOE 收人头' };
		}

		/* 3. 队友少 → 用 */
		let allyCount = 0, enemyCount = 0;
		(game.players || []).forEach(function (p) {
			if (!p || p.alive === false || p === me) return;
			const att = get.attitude(me, p);
			if (att > 0) allyCount++;
			else if (att < 0) enemyCount++;
		});
		if (enemyCount > allyCount + 1) {
			return { use: true, reason: '敌人多，AOE 赚' };
		}

		/* 4. 默认不用 */
		return { use: false, reason: '净伤害不够，不用 AOE' };
	} catch (e) {
		return { use: false, reason: '出错了' };
	}
}

/* ★ AOE 评分加成 */
export function aoeBonus(me, act) {
	try {
		if (!act || (act.id !== 'nanman' && act.id !== 'wanjian')) return 1.0;

		const timing = aoeTiming(me, act.id);
		if (timing.use) return 1.5;

		return 0.5;
	} catch (e) {
		return 1.0;
	}
}
