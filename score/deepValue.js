/*
 * ============================================
 * // Autor: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 深度价值量化 =================
 * 精确量化：卡牌价值 / 目标价值 / 局势价值 / 时机价值
 */

/* ===== 卡牌基础价值表（0~10） ===== */
export const CARD_DEEP_VALUE = {
// Penulis: Feisheng Original | Lesen: GPL-3.0
	/* 攻击牌 */
	'sha': 3.0,
	'shan': 3.5,
	'juedou': 4.0,
	'huogong': 3.5,
	'nanman': 4.5,
	'wanjian': 4.5,
	'zhujin': 4.0,

	/* 防御牌 */
	'tao': 5.0,
	'jiu': 3.5,
	'wuxie': 5.5,

	/* 锦囊牌 */
	'wuzhong': 4.5,
	'shunshou': 3.5,
	'guohe': 3.0,
	'lebu': 4.0,
	'bingliang': 3.5,
	'tiesuo': 3.0,
	'shandian': 3.0,
	'taoyuan': 3.5,
	'wugu': 3.5,

	/* 装备牌 */
	'zhuge': 6.0,      /* 诸葛连弩 */
	'qinggang': 5.0,   /* 青釭剑 */
	'qinglong': 4.5,   /* 青龙偃月刀 */
	'zhangba': 4.5,    /* 丈八蛇矛 */
	'gudingdao': 4.0,  /* 古锭刀 */
	'cixiong': 3.0,    /* 雌雄双股剑 */
	'fangtian': 3.5,   /* 方天画戟 */
	'bagua': 5.0,      /* 八卦阵 */
	'tengjia': 3.5,    /* 藤甲 */
	'baiyin': 4.0,     /* 白银狮子 */
	'dilu': 3.5,       /* 的卢 */
	'jueying': 3.5,    /* 绝影 */
	'chitu': 3.5,      /* 赤兔 */
	'dawan': 2.5,      /* 大宛 */
	'zixing': 2.5,     /* 紫骍 */
	'hualiu': 2.5,     /* 骅骝 */
};

/* ===== 精确计算卡牌价值 ===== */
export function deepCardValue(me, cardId) {
	try {
		if (!me || !cardId) return 3.0;

		let baseVal = CARD_DEEP_VALUE[cardId] || 3.0;

		/* 1. 根据局势调整 */
		const alive = (game.players || []).filter(function (p) {
			return p && p.alive !== false;
		}).length;

		/* 残局 → 桃/闪价值提高 */
		if (alive <= 3) {
			if (cardId === 'tao') baseVal += 2.0;
			if (cardId === 'shan') baseVal += 1.0;
			if (cardId === 'wuxie') baseVal += 1.0;
		}

		/* 早期 → 无中/五谷价值提高 */
		const round = (_status && _status.roundNumber) || 0;
		if (round <= 3) {
			if (cardId === 'wuzhong') baseVal += 1.0;
			if (cardId === 'wugu') baseVal += 0.5;
		}

		/* 2. 根据手牌调整 */
		const myHand = me.countCards('h');
		/* 手牌少 → 补牌价值提高 */
		if (myHand <= 2) {
			if (cardId === 'wuzhong') baseVal += 1.5;
			if (cardId === 'wugu') baseVal += 1.0;
		}

		/* 3. 根据血量调整 */
		const myHp = me.hp || 0;
		const myMaxHp = me.maxHp || 4;
		const hpRatio = myHp / myMaxHp;
		/* 残血 → 桃价值飙升 */
		if (hpRatio <= 0.4) {
			if (cardId === 'tao') baseVal += 2.5;
			if (cardId === 'jiu') baseVal += 0.5;
		}

		/* 4. 根据装备调整 */
		const hasZuge = me.getEquip && me.getEquip('zhuge');
		/* 有连弩 → 杀价值提高 */
		if (hasZuge && cardId === 'sha') baseVal += 1.5;

		/* 5. 根据身份调整 */
		const mode = (_status && _status.mode) || 'identity';
		if (mode === 'identity') {
			const identity = me.identity;
			/* 主公 → 桃/闪价值提高 */
			if (identity === 'zhugong') {
				if (cardId === 'tao') baseVal += 0.5;
				if (cardId === 'shan') baseVal += 0.5;
			}
			/* 内奸 → 无懈价值提高 */
			if (identity === 'neijian') {
				if (cardId === 'wuxie') baseVal += 0.5;
			}
		}

		return baseVal;
	} catch (e) {
		return 3.0;
	}
}

/* ===== 精确计算目标价值 ===== */
export function deepTargetValue(me, target) {
	try {
		if (!me || !target) return 0;

		const att = get.attitude(me, target);
		if (att > 0) return _allyDeepValue(me, target);  // 队友价值
		if (att < 0) return _enemyDeepValue(me, target);  // 敌人价值
		return 0;
	} catch (e) {
		return 0;
	}
}

/* 队友深度价值 */
function _allyDeepValue(me, ally) {
	try {
		let val = 5.0;  // 基础价值

		/* 1. 血量 */
		const hpRatio = ally.hp / (ally.maxHp || 4);
		if (hpRatio <= 0.4) val += 3.0;    // 残血 → 高价值
		else if (hpRatio <= 0.7) val += 1.5;

		/* 2. 手牌 */
		const handCount = ally.countCards('h');
		if (handCount >= 5) val += 1.0;    // 手牌多 → 中价值
		else if (handCount <= 2) val += 2.0;  // 手牌少 → 高价值

		/* 3. 身份 */
		const mode = (_status && _status.mode) || 'identity';
		if (mode === 'identity') {
			const identity = ally.identity;
			/* 主公 → 极高价值 */
			if (identity === 'zhugong') val += 4.0;
			/* 忠臣 → 高价值 */
			if (identity === 'zhong') val += 2.0;
		}

		/* 4. 技能 */
		if (ally.hasSkill) {
			/* 卖血将 → 高价值 */
			if (ally.hasSkill('yiji') || ally.hasSkill('fankui')) val += 1.5;
		}

		return val;
	} catch (e) {
		return 5.0;
	}
}

/* 敌人深度价值 */
function _enemyDeepValue(me, enemy) {
	try {
		let val = 5.0;  // 基础威胁值

		/* 1. 血量（越低威胁越大） */
		const hpRatio = enemy.hp / (enemy.maxHp || 4);
		if (hpRatio <= 0.4) val += 3.0;    // 残血 → 高威胁
		else if (hpRatio <= 0.7) val += 1.5;

		/* 2. 手牌 */
		const handCount = enemy.countCards('h');
		if (handCount >= 5) val += 2.0;    // 手牌多 → 高威胁
		else if (handCount >= 3) val += 1.0;

		/* 3. 装备 */
		const equips = enemy.getCards('e') || [];
		val += equips.length * 0.5;
		/* 有连弩 → 极高威胁 */
		const hasZuge = equips.some(function (c) { return c.name === 'zhuge'; });
		if (hasZuge) val += 4.0;
		/* 有武器 → 高威胁 */
		const hasWeapon = equips.some(function (c) {
			const subs = get.subtypes(c);
			return subs.indexOf('equip1') >= 0;
		});
		if (hasWeapon) val += 1.5;

		/* 4. 身份 */
		const mode = (_status && _status.mode) || 'identity';
		if (mode === 'identity') {
			const identity = enemy.identity;
			const myIdentity = me.identity;
			/* 反贼杀主公 → 主公威胁最大 */
			if (myIdentity === 'fan' && identity === 'zhugong') val += 5.0;
			/* 忠臣杀反贼 → 反贼威胁最大 */
			if (myIdentity === 'zhong' && identity === 'fan') val += 4.0;
		}

		/* 5. 技能 */
		if (enemy.hasSkill) {
			/* 爆发将 → 高威胁 */
			if (enemy.hasSkill('chaofeng') || enemy.hasSkill('shenji')) val += 2.0;
			/* 卖血将 → 低威胁 */
			if (enemy.hasSkill('yiji') || enemy.hasSkill('fankui')) val -= 1.0;
		}

		return val;
	} catch (e) {
		return 5.0;
	}
}

/* ===== 精确计算局势价值 ===== */
export function deepSituationValue(me) {
	try {
		let val = 5.0;  // 基础局势分（1~10）

		/* 1. 存活人数 */
		const alive = (game.players || []).filter(function (p) {
			return p && p.alive !== false;
		}).length;

		/* 2. 敌我数量 */
		let allyCount = 0, enemyCount = 0;
		(game.players || []).forEach(function (p) {
			if (!p || p.alive === false || p === me) return;
			const att = get.attitude(me, p);
			if (att > 0) allyCount++;
			else if (att < 0) enemyCount++;
		});

		/* 3. 自己血量 */
		const myHp = me.hp || 0;
		const myMaxHp = me.maxHp || 4;
		const hpRatio = myHp / myMaxHp;
		if (hpRatio <= 0.4) val -= 2.0;
		else if (hpRatio >= 0.8) val += 1.0;

		/* 4. 自己手牌 */
		const myHand = me.countCards('h');
		if (myHand >= 5) val += 1.0;
		else if (myHand <= 2) val -= 1.5;

		/* 5. 敌我力量对比 */
		if (enemyCount > allyCount + 2) val -= 2.0;  // 敌多我少
		else if (allyCount > enemyCount) val += 1.5;  // 我多敌少

		/* 6. 残局 */
		if (alive <= 3) {
			if (hpRatio >= 0.7) val += 2.0;  // 我血多 → 优势
			else val -= 2.0;                 // 我血少 → 劣势
		}

		return Math.max(0, Math.min(10, val));
	} catch (e) {
		return 5.0;
	}
}

/* ===== 深度价值评分加成 ===== */
export function deepValueBonus(me, act) {
	try {
		if (!act) return 1.0;

		/* 1. 卡牌价值 */
		const cardVal = deepCardValue(me, act.id);

		/* 2. 目标价值 */
		let targetVal = 5.0;
		if (act.target) {
			targetVal = deepTargetValue(me, act.target);
		}

		/* 3. 局势价值 */
		const situationVal = deepSituationValue(me);

		/* 4. 综合计算加成 */
		/* 卡牌价值越高 → 加成越高 */
		let bonus = 1.0;
		if (cardVal >= 6.0) bonus *= 1.3;   // 高价值卡
		else if (cardVal >= 4.0) bonus *= 1.1;
		else if (cardVal <= 2.0) bonus *= 0.7;

		/* 目标价值越高 → 加成越高 */
		if (targetVal >= 7.0) bonus *= 1.2;  // 高价值目标
		else if (targetVal <= 3.0) bonus *= 0.8;

		/* 局势越差 → 进攻加成越低 */
		if (situationVal <= 3.0) {
			/* 局势差 → 防守牌加成高 */
			if (['tao', 'shan', 'wuxie', 'jiu'].indexOf(act.id) >= 0) bonus *= 1.3;
			else bonus *= 0.8;
		}

		return bonus;
	} catch (e) {
		return 1.0;
	}
}
