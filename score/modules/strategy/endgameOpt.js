/* ================= 决策积分引擎 · 残局策略 =================
 * 1v1 / 1v2 残局特殊策略
 */

/* ★ 判断是否残局 */
export function isEndgame(me) {
	try {
		const alive = game.players.filter(function (p) {
			return p && p.alive !== false;
		}).length;
		return alive <= 3;
	} catch (e) {
		return false;
	}
}

/* ★ 残局策略 */
export function endgameStrategy(me) {
	try {
		const alive = game.players.filter(function (p) {
			return p && p.alive !== false;
		}).length;

		if (alive === 1) return { strategy: 'win', desc: '已经赢了' };
		if (alive === 2) {
			/* 1v1 */
			const enemy = game.players.find(function (p) {
				return p && p !== me && p.alive !== false;
			});
			if (!enemy) return { strategy: 'unknown', desc: '未知' };

			/* 自己血多 → 进攻 */
			if (me.hp >= enemy.hp + 1) {
				return { strategy: 'aggressive', desc: '1v1 血多，主动进攻' };
			}
			/* 自己血少 → 防守 */
			if (me.hp <= enemy.hp - 1) {
				return { strategy: 'defensive', desc: '1v1 血少，先防守' };
			}
			/* 血量相当 → 看手牌 */
			const myHand = me.countCards('h');
			const enemyHand = enemy.countCards('h');
			if (myHand > enemyHand) {
				return { strategy: 'aggressive', desc: '1v1 手牌多，压上去' };
			}
			return { strategy: 'balanced', desc: '1v1 均势' };
		}
		if (alive === 3) {
			/* 1v2 或 2v1 */
			let allyCount = 0, enemyCount = 0;
			for (const p of game.players) {
				if (!p || p.alive === false || p === me) continue;
				const att = get.attitude(me, p);
				if (att > 0) allyCount++;
				else if (att < 0) enemyCount++;
			}

			if (allyCount === 1 && enemyCount === 1) {
				/* 2v1 → 集火 */
				return { strategy: 'focus', desc: '2v1 集火敌人' };
			}
			if (allyCount === 0 && enemyCount === 2) {
				/* 1v2 → 防守反击 */
				return { strategy: 'survive', desc: '1v2 先活下来' };
			}
		}

		return { strategy: 'normal', desc: '正常策略' };
	} catch (e) {
		return { strategy: 'unknown', desc: '出错了' };
	}
}

/* ★ 残局评分加成 */
export function endgameBonus(me, act) {
	try {
		if (!isEndgame(me)) return 1.0;

		const strat = endgameStrategy(me);

		/* 1v1 血多 → 攻击牌加成 */
		if (strat.strategy === 'aggressive') {
			const ATK = ['sha', 'juedou', 'huogong'];
			if (ATK.indexOf(act.id) >= 0) return 1.3;
		}

		/* 1v1 血少 → 防御牌加成 */
		if (strat.strategy === 'defensive') {
			const DEF = ['shan', 'tao', 'wuxie'];
			if (DEF.indexOf(act.id) >= 0) return 1.3;
		}

		/* 2v1 集火 → 攻击牌加成 */
		if (strat.strategy === 'focus') {
			if (act.id === 'sha' || act.id === 'juedou') return 1.2;
		}

		/* 1v2 → 桃加成 */
		if (strat.strategy === 'survive') {
			if (act.id === 'tao') return 1.5;
		}

		return 1.0;
	} catch (e) {
		return 1.0;
	}
}
