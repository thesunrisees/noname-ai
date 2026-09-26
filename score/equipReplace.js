/*
 * ============================================
 * // Author: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 装备更换优化 =================
 * 优化什么时候换装备
 */

/* ★ 装备价值表 */
const EQUIP_VALUE = {
	/* 武器 */
	'zhuge': 5,      /* 诸葛连弩 */
	'qinggang': 4,   /* 青釭剑 */
	'qinglong': 4,   /* 青龙偃月刀 */
	'zhangba': 4,    /* 丈八蛇矛 */
	'gudingdao': 3,  /* 古锭刀 */
	'frostblade': 3, /* 寒冰剑 */
	'fangtian': 3,   /* 方天画戟 */
	'cixiong': 2,    /* 雌雄双股剑 */
	'zhugejian': 2,  /* 诸葛剑 */

	/* 防具 */
	'bagua': 4,      /* 八卦阵 */
	'tengjia': 3,    /* 藤甲 */
	'baiyin': 3,     /* 白银狮子 */

	/* 坐骑 */
	'dilu': 3,       /* 的卢 */
	'jueying': 3,    /* 绝影 */
	'chitu': 3,      /* 赤兔 */
	'dawan': 2,      /* 大宛 */
	'zixing': 2,     /* 紫骍 */
	'hualiu': 2,     /* 骅骝 */

	/* 宝物 */
	'miren': 5,      /* 木牛流马 */
};

/* ★ 计算装备价值 */
export function equipValue(me, equipId) {
	try {
		return EQUIP_VALUE[equipId] || 2;
	} catch (e) {
		return 2;
	}
}

/* ★ 判断该不该换装备 */
export function shouldReplaceEquip(me, newEquip) {
	try {
		if (!me || !newEquip) return { replace: false, reason: '' };

		const newVal = equipValue(me, newEquip.name);

		/* 找当前装备 */
		const equips = me.getCards('e') || [];
		let oldVal = 0;
		let oldType = '';

		equips.forEach(function (c) {
			const subs = get.subtypes(c);
			const newSubs = get.subtypes(newEquip);

			/* 同类型装备 */
			if (subs.some(function (s) { return newSubs.indexOf(s) >= 0; })) {
				oldVal = equipValue(me, c.name);
				oldType = c.name;
			}
		});

		/* 新装备价值更高 → 换 */
		if (newVal > oldVal + 1) {
			return { replace: true, reason: '新装备价值 ' + newVal + ' > 旧装备 ' + oldVal };
		}

		/* 旧装备价值更高 → 不换 */
		return { replace: false, reason: '旧装备更好' };
	} catch (e) {
		return { replace: false, reason: '出错了' };
	}
}

/* ★ 装备更换评分加成 */
export function equipReplaceBonus(me, act) {
	try {
		if (!act || !act.card) return 1.0;

		/* 检查是不是装备牌 */
		const subs = get.subtypes(act.card) || [];
		const isEquip = subs.some(function (s) {
			return s === 'equip1' || s === 'equip2' || s === 'equip3' || s === 'equip4';
		});

		if (!isEquip) return 1.0;

		const r = shouldReplaceEquip(me, act.card);
		if (r.replace) return 1.4;

		return 0.6;
	} catch (e) {
		return 1.0;
	}
}
