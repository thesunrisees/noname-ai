/* ================= 决策积分引擎 · 反制策略 =================
 * 根据对手的历史行为，预测他下一步出什么
 * 对手爱出南蛮 → 提前留无懈
 * 对手爱出决斗 → 提前留杀
 */
import { lib, game, get, _status } from '../../../noname.js';
import { cardRemaining } from '../card/deckMemory.js';

/* ================= 反制缓存 ================= */
const _counterCache = new Map();
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
		_cacheRound.clear();
	}
}

/* ================= 1. 对手行为偏好分析 =================
 * 根据对手历史行为，分析他爱出什么牌
 */
export function analyzeOpponentPref(player) {
	try {
		if (!player) return { aoe: 0, duel: 0, control: 0, attack: 0, defense: 0 };

		const key = 'pref_' + (player.name1 || player.name || '?');
		if (_counterCache.has(key)) return _counterCache.get(key);

		const actions = player._djsc_actions || [];
		if (actions.length === 0) return { aoe: 0, duel: 0, control: 0, attack: 0, defense: 0 };

		let aoeCount = 0;
		let duelCount = 0;
		let controlCount = 0;
		let attackCount = 0;
		let defenseCount = 0;

		actions.forEach(function (a) {
			if (['nanman', 'wanjian'].indexOf(a.id) >= 0) aoeCount++;
			if (a.id === 'juedou') duelCount++;
			if (['lebu', 'bingliang', 'shunshou', 'guohe', 'tiesuo'].indexOf(a.id) >= 0) controlCount++;
			if (['sha', 'huogong'].indexOf(a.id) >= 0) attackCount++;
			if (['shan', 'tao', 'wuxie'].indexOf(a.id) >= 0) defenseCount++;
		});

		const total = actions.length;
		const result = {
			aoe: aoeCount / total,
			duel: duelCount / total,
			control: controlCount / total,
			attack: attackCount / total,
			defense: defenseCount / total,
		};

		_counterCache.set(key, result);
		return result;
	} catch (e) {
		return { aoe: 0, duel: 0, control: 0, attack: 0, defense: 0 };
	}
}

/* ================= 2. 反制建议 =================
 * 根据对手的偏好，给出反制建议
 */
export function counterStrategy(me, opponent) {
	try {
		if (!me || !opponent) return [];

		const pref = analyzeOpponentPref(opponent);
		const suggestions = [];

		/* === 对手爱出 AOE → 留无懈 === */
		if (pref.aoe > 0.2) {
			suggestions.push({
				type: 'keepWuxie',
				priority: 0.9,
				desc: '对手爱出南蛮/万箭，留无懈'
			});
		}

		/* === 对手爱出决斗 → 留杀 === */
		if (pref.duel > 0.15) {
			suggestions.push({
				type: 'keepSha',
				priority: 0.8,
				desc: '对手爱出决斗，留杀'
			});
		}

		/* === 对手爱出控制 → 留无懈 === */
		if (pref.control > 0.25) {
			suggestions.push({
				type: 'keepWuxie',
				priority: 0.7,
				desc: '对手爱出乐/兵/顺/拆，留无懈'
			});
		}

		/* === 对手爱出杀 → 留闪 === */
		if (pref.attack > 0.4) {
			suggestions.push({
				type: 'keepShan',
				priority: 0.7,
				desc: '对手爱出杀，留闪'
			});
		}

		return suggestions.sort(function (a, b) { return b.priority - a.priority; });
	} catch (e) {
		return [];
	}
}

/* ================= 3. 预判对手下一步 =================
 * 根据对手的偏好，预判他下一步最可能出什么
 */
export function predictOpponentNext(opponent) {
	try {
		if (!opponent) return { mostLikely: 'unknown', confidence: 0 };

		const pref = analyzeOpponentPref(opponent);

		/* 找出最高的 */
		const items = [
			{ type: 'aoe', value: pref.aoe, action: '南蛮/万箭' },
			{ type: 'duel', value: pref.duel, action: '决斗' },
			{ type: 'control', value: pref.control, action: '乐/兵/顺/拆' },
			{ type: 'attack', value: pref.attack, action: '杀' },
			{ type: 'defense', value: pref.defense, action: '闪/桃/无懈' },
		];

		items.sort(function (a, b) { return b.value - a.value; });

		return {
			mostLikely: items[0].type,
			confidence: items[0].value,
			action: items[0].action,
		};
	} catch (e) {
		return { mostLikely: 'unknown', confidence: 0, action: '?' };
	}
}

/* ================= 4. 反制评分加成 =================
 * 在 bestAction 里调用，根据反制建议调整评分
 */
export function counterScoreBonus(me, opponent, act) {
	try {
		if (!me || !opponent || !act) return 0;

		const suggestions = counterStrategy(me, opponent);
		let bonus = 0;

		suggestions.forEach(function (s) {
			/* 如果是保留牌的建议 → 给保留的牌加成 */
			if (s.type === 'keepWuxie' && act.id === 'wuxie') bonus += s.priority * 0.5;
			if (s.type === 'keepSha' && act.id === 'sha') bonus += s.priority * 0.3;
			if (s.type === 'keepShan' && act.id === 'shan') bonus += s.priority * 0.3;
		});

		return bonus;
	} catch (e) {
		return 0;
	}
}
