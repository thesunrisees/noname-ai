/* ================= 决策积分引擎 · 响应阶段优化 =================
 * 优化出闪/出无懈/出桃的时机
 */

/* ★ 出闪时机：什么时候该出闪 */
export function shouldUseShan(me, source, damage) {
	try {
		/* 1. 濒死必出 */
		if (me.hp <= 1) return { use: true, reason: '濒死必出闪' };

		/* 2. 高伤害必出 */
		if (damage >= 2) return { use: true, reason: '高伤害必出闪' };

		/* 3. 关键目标攻击必出 */
		const att = get.attitude(me, source);
		if (att < -0.5) return { use: true, reason: '关键敌人攻击必出闪' };

		/* 4. 手牌多可以不出 */
		const handCount = me.countCards('h');
		if (handCount >= 5 && me.hp >= 3) {
			return { use: false, reason: '手牌多，忍一下' };
		}

		/* 5. 默认出 */
		return { use: true, reason: '默认出闪' };
	} catch (e) {
		return { use: true, reason: '出错了，默认出' };
	}
}

/* ★ 出无懈时机：什么时候该出无懈 */
export function shouldUseWuxie(me, target, card) {
	try {
		/* 1. 关键锦囊必出 */
		const KEY_JINNANG = ['lebu', 'bingliang', 'shunshou', 'guohe', 'wuzhong', 'taoyuan'];
		if (KEY_JINNANG.indexOf(card) >= 0) {
			/* 目标是自己 → 必出 */
			if (target === me) return { use: true, reason: '关键锦囊针对自己，必出' };

			/* 目标是队友 → 看情况 */
			const att = get.attitude(me, target);
			if (att > 0) {
				/* 队友血量低 → 出 */
				if (target.hp <= 2) return { use: true, reason: '队友残血，救一下' };
				/* 队友手牌多 → 可以不出 */
				if (target.countCards('h') >= 4) return { use: false, reason: '队友手牌多，不用救' };
			}
		}

		/* 2. 自己被乐不思蜀/兵粮寸断 → 必出 */
		if ((card === 'lebu' || card === 'bingliang') && target === me) {
			return { use: true, reason: '自己被判定锦囊，必出无懈' };
		}

		/* 3. 默认不出 */
		return { use: false, reason: '默认不出无懈' };
	} catch (e) {
		return { use: false, reason: '出错了，默认不出' };
	}
}

/* ★ 出桃时机：什么时候该吃桃 */
export function shouldUseTao(me) {
	try {
		/* 1. 濒死必吃 */
		if (me.hp <= 0) return { use: true, reason: '濒死必吃桃' };

		/* 2. 血量低但手牌多 → 吃 */
		if (me.hp <= 2 && me.countCards('h') >= 3) {
			return { use: true, reason: '血量低，吃桃回血' };
		}

		/* 3. 满血 → 不吃 */
		if (me.hp >= me.maxHp) return { use: false, reason: '满血不吃桃' };

		/* 4. 残局且自己是核心 → 吃 */
		const alive = game.players.filter(function (p) {
			return p && p.alive !== false;
		}).length;
		if (alive <= 3 && me.hp <= 2) {
			return { use: true, reason: '残局核心，吃桃续命' };
		}

		/* 5. 默认不吃 */
		return { use: false, reason: '默认不吃桃' };
	} catch (e) {
		return { use: false, reason: '出错了，默认不吃' };
	}
}

/* ★ 出酒时机：什么时候该喝酒 */
export function shouldUseJiu(me) {
	try {
		/* 1. 手里有杀且要打爆发 → 喝 */
		const hasSha = me.countCards('h', function (c) { return c.name === 'sha'; }) > 0;
		if (hasSha && me.hp >= 3) {
			/* 找一个残血敌人 */
			for (const p of game.players) {
				if (!p || p.alive === false || p === me) continue;
				const att = get.attitude(me, p);
				if (att < 0 && p.hp <= 2) {
					return { use: true, reason: '有残血敌人，喝酒爆发' };
				}
			}
		}

		/* 2. 自己残血 → 不喝（留着救命） */
		if (me.hp <= 2) return { use: false, reason: '自己残血，留酒救命' };

		/* 3. 默认不喝 */
		return { use: false, reason: '默认不喝酒' };
	} catch (e) {
		return { use: false, reason: '出错了，默认不喝' };
	}
}

/* ★ 响应阶段评分加成 */
export function responseBonus(me, act) {
	try {
		if (!act) return 1.0;

		/* 出闪 */
		if (act.id === 'shan') {
			const r = shouldUseShan(me, act.source, act.damage || 1);
			return r.use ? 1.3 : 0.5;
		}

		/* 出无懈 */
		if (act.id === 'wuxie') {
			const r = shouldUseWuxie(me, act.target, act.card);
			return r.use ? 1.5 : 0.3;
		}

		/* 出桃 */
		if (act.id === 'tao') {
			const r = shouldUseTao(me);
			return r.use ? 1.4 : 0.4;
		}

		/* 出酒 */
		if (act.id === 'jiu') {
			const r = shouldUseJiu(me);
			return r.use ? 1.2 : 0.6;
		}

		return 1.0;
	} catch (e) {
		return 1.0;
	}
}
