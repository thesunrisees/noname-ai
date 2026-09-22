/* ================= 决策积分引擎 · 武将克制关系库 =================
 * 不同武将之间的克制关系
 * 比如：貂蝉克制男性武将、诸葛亮克制新手
 */
import { lib, game, get, _status } from '../../../noname.js';

/* ================= 克制关系表 =================
 * key: 武将ID
 * value: { 克制的武将列表, 被克制的武将列表, 克制理由 }
 */
const MUTUAL_RELATIONS = {
	/* === 貂蝉 === */
	'diaochan': {
		counter: ['liubei', 'guanyu', 'zhangfei', 'zhaoyun', 'machao', 'huangzhong', 'weiyan', 'xiahou', 'xiahoudun', 'zhangliao', 'xuchu', 'zhenji'],
		counteredBy: [],
		reason: '闭月+离间，克制男性武将',
	},

	/* === 诸葛亮 === */
	'zhugeliang': {
		counter: [],
		counteredBy: ['mengda', 'huangyueying'],
		reason: '观星可以预判牌堆，但被闪电/延迟锦囊克制',
	},

	/* === 郭嘉 === */
	'guojia': {
		counter: [],
		counteredBy: ['diaochan', 'lubu'],
		reason: '遗计卖血，怕打队友的技能',
	},

	/* === 曹操 === */
	'caocao': {
		counter: [],
		counteredBy: ['zhenji', 'huatuo'],
		reason: '奸雄收牌，但怕无限出杀的武将',
	},

	/* === 刘备 === */
	'liubei': {
		counter: [],
		counteredBy: [],
		reason: '仁德给牌，配合型武将',
	},

	/* === 孙权 === */
	'sunquan': {
		counter: [],
		counteredBy: ['zhangren'],
		reason: '制衡换牌，但怕乐不思蜀',
	},
};

/* ================= 1. 查询克制关系 =================
 * 返回：{ counter: [], counteredBy: [], reason: '' }
 */
export function getMutualRelations(playerId) {
	try {
		return MUTUAL_RELATIONS[playerId] || { counter: [], counteredBy: [], reason: '' };
	} catch (e) {
		return { counter: [], counteredBy: [], reason: '' };
	}
}

/* ================= 2. 判断是否克制 =================
 * 返回：是否克制 target
 */
export function isCountering(me, target) {
	try {
		if (!me || !target) return false;

		const myId = me.name1 || me.name;
		const targetId = target.name1 || target.name;

		/* 查我的克制列表 */
		const myRelation = MUTUAL_RELATIONS[myId];
		if (myRelation && myRelation.counter.indexOf(targetId) >= 0) return true;

		/* 查 target 的被克制列表 */
		const targetRelation = MUTUAL_RELATIONS[targetId];
		if (targetRelation && targetRelation.counteredBy.indexOf(myId) >= 0) return true;

		return false;
	} catch (e) {
		return false;
	}
}

/* ================= 3. 被克制评估 =================
 * 返回：是否被 target 克制
 */
export function isBeingCountered(me, target) {
	try {
		if (!me || !target) return false;

		const myId = me.name1 || me.name;
		const targetId = target.name1 || target.name;

		/* 查 target 的克制列表 */
		const targetRelation = MUTUAL_RELATIONS[targetId];
		if (targetRelation && targetRelation.counter.indexOf(myId) >= 0) return true;

		/* 查我的被克制列表 */
		const myRelation = MUTUAL_RELATIONS[myId];
		if (myRelation && myRelation.counteredBy.indexOf(targetId) >= 0) return true;

		return false;
	} catch (e) {
		return false;
	}
}

/* ================= 4. 克制评分加成 =================
 * 在 bestAction 里调用
 */
export function counterRelationBonus(me, target, act) {
	try {
		if (!me || !target || !act) return 0;

		let bonus = 0;

		/* 我克制 target → 进攻加成 */
		if (isCountering(me, target)) {
			if (['sha', 'juedou', 'huogong', 'nanman', 'wanjian'].indexOf(act.id) >= 0) {
				bonus += 0.3;
			}
		}

		/* 我被 target 克制 → 进攻减成 */
		if (isBeingCountered(me, target)) {
			if (['sha', 'juedou', 'huogong', 'nanman', 'wanjian'].indexOf(act.id) >= 0) {
				bonus -= 0.2;
			}
		}

		return bonus;
	} catch (e) {
		return 0;
	}
}
