/* ================= 决策积分引擎 · 概率树搜索 =================
 * 不只看当前一步，看未来 2-3 步
 * 比如：现在出杀 → 对手可能闪 → 我再出决斗
 */
import { lib, game, get, _status } from '../../../../../noname.js';
import { probHasShan } from './handInference.js';

/* ================= 概率树缓存 ================= */
const _treeCache = new Map();
let _cacheRound = -1;

function _roundKey() {
	try {
		if (_status && typeof _status.roundNumber === "number") return _status.roundNumber;
		if (typeof game === "object" && typeof game.roundNumber === "number") return game.roundNumber;
	} catch (e) {}
	return 0;
}

function _syncCache() {
	const r = _roundKey();
	if (r !== _cacheRound) {
		_treeCache.clear();
	}
}

/* ================= 1. 杀的后续预测 =================
 * 预测：出杀 → 对手闪/不闪 → 后续
 */
export function predictShaFollowup(me, target) {
	try {
		_syncCache();
		const key = 'sha_' + (me.name1 || me.name || '?') + '_' + (target.name1 || target.name || '?');
		if (_treeCache.has(key)) return _treeCache.get(key);

		const pShan = probHasShan(target);

		/* 情况 1：对手闪 → 我用决斗 */
		const case1 = {
			prob: pShan,
			action: '出决斗',
			value: 1.5,
		};

		/* 情况 2：对手不闪 → 命中 */
		const case2 = {
			prob: 1 - pShan,
			action: '命中',
			value: 2.0,
		};

		/* 期望价值 */
		const expected = case1.prob * case1.value + case2.prob * case2.value;

		const result = {
			cases: [case1, case2],
			expected: Math.round(expected * 100) / 100,
		};

		_treeCache.set(key, result);
		return result;
	} catch (e) {
		return { cases: [], expected: 1.5 };
	}
}

/* ================= 2. 决斗的后续预测 ================= */
export function predictJuedouFollowup(me, target) {
	try {
		const pMySha = 0.6;  /* 我有杀概率 */
		const pEnemySha = probHasShan(target);  /* 对手有杀概率 */

		/* 期望价值：我赢的概率 × 伤害 */
		const myWinRate = pMySha / (pMySha + pEnemySha);

		const result = {
			myWinRate: Math.round(myWinRate * 100) / 100,
			expected: Math.round(myWinRate * 2 * 100) / 100,
		};

		return result;
	} catch (e) {
		return { myWinRate: 0.5, expected: 1.0 };
	}
}

/* ================= 3. 综合概率树搜索 =================
 * 给定一个动作，预测未来 2-3 步的期望价值
 */
export function searchTree(me, target, act, depth = 2) {
	try {
		if (!act || depth <= 0) return 0;

		let expected = 0;

		/* === 杀 === */
		if (act.id === 'sha') {
			const followup = predictShaFollowup(me, target);
			expected = followup.expected;

			/* 深度 +1：如果对手闪了 → 我再出决斗 */
			if (depth > 1) {
				const juedou = predictJuedouFollowup(me, target);
				expected += followup.cases[0].prob * juedou.expected * 0.5;
			}
		}

		/* === 决斗 === */
		else if (act.id === 'juedou') {
			const followup = predictJuedouFollowup(me, target);
			expected = followup.expected;
		}

		/* === 锦囊 === */
		else if (['nanman', 'wanjian'].indexOf(act.id) >= 0) {
			expected = 1.5;  /* AOE 粗略价值 */
		}

		return Math.round(expected * 100) / 100;
	} catch (e) {
		return 1.0;
	}
}

/* ================= 4. 概率树评分加成 ================= */
export function treeSearchBonus(me, target, act) {
	try {
		const expected = searchTree(me, target, act);
		/* 如果期望价值 > 1.5 → 加成 */
		if (expected > 1.5) {
			return (expected - 1.5) * 0.2;
		}
		return 0;
	} catch (e) {
		return 0;
	}
}
