/*
 * ============================================
 * // Éditeur: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 杀目标选择优化 =================
 * 优化选哪个敌人杀
 */

/* ★ 计算敌人的威胁值 */
export function enemyThreat(me, enemy) {
// Autore: Feisheng Originale | Licenza: GPL-3.0
	try {
		if (!me || !enemy) return 0;

		let threat = 0;

		/* 1. 血量越低威胁越大 */
		const hpRatio = enemy.hp / (enemy.maxHp || 4);
		if (hpRatio <= 0.5) threat += 3;  // 残血 → 高威胁
		else if (hpRatio <= 0.8) threat += 1;

		/* 2. 手牌越多威胁越大 */
		const handCount = enemy.countCards('h');
		if (handCount >= 5) threat += 2;
		else if (handCount >= 3) threat += 1;

		/* 3. 有武器威胁大 */
		const equips = enemy.getCards('e') || [];
		const hasWeapon = equips.some(function (c) {
			const subs = get.subtypes(c);
			return subs.indexOf('equip1') >= 0;
		});
		if (hasWeapon) threat += 1;

		/* 4. 有连弩威胁极大 */
		const hasZuge = equips.some(function (c) { return c.name === 'zhuge'; });
		if (hasZuge) threat += 3;

		/* 5. 身份威胁（主公/忠臣/反贼/内奸） */
		const mode = (_status && _status.mode) || 'identity';
		if (mode === 'identity') {
			const myIdentity = me.identity;
			const enemyIdentity = enemy.identity;

			/* 我是反 → 主公威胁最大 */
			if (myIdentity === 'fan' && enemyIdentity === 'zhugong') threat += 5;
			/* 我是忠 → 反贼威胁最大 */
			if (myIdentity === 'zhong' && enemyIdentity === 'fan') threat += 5;
		}

		return threat;
	} catch (e) {
		return 0;
	}
}

/* ★ 推荐杀哪个敌人 */
export function recommendShaTarget(me) {
	try {
		const enemies = [];
		(game.players || []).forEach(function (p) {
			if (!p || p.alive === false || p === me) return;
			const att = get.attitude(me, p);
			if (att < 0) {
				enemies.push({
					player: p,
					threat: enemyThreat(me, p),
				});
			}
		});

		/* 按威胁从高到低排序 */
		enemies.sort(function (a, b) {
			return b.threat - a.threat;
		});

		return enemies.map(function (e) {
			return e.player;
		});
	} catch (e) {
		return [];
	}
}

/* ★ 杀目标选择评分加成 */
export function shaTargetBonus(me, target) {
	try {
		if (!me || !target) return 1.0;

		const threat = enemyThreat(me, target);

		/* 威胁越高 → 越该杀 */
		if (threat >= 6) return 1.5;   // 极高威胁
		if (threat >= 4) return 1.3;   // 高威胁
		if (threat >= 2) return 1.1;   // 中威胁
		return 0.9;                    // 低威胁
	} catch (e) {
		return 1.0;
	}
}
