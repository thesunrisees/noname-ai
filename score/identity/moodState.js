/* ================= 决策积分引擎 · 情绪/状态 =================
 * 根据对手的行为模式调整策略
 * 对手激进 → 更保守
 * 对手保守 → 更激进
 */
import { lib, game, get, _status } from '../../../noname.js';
import { analyzeOpponentPref } from '../analysis/counterStrategy.js';

/* ================= 情绪缓存 ================= */
const _moodCache = new Map();
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
		_moodCache.clear();
	}
}

/* ================= 1. 对手情绪状态识别 =================
 * 根据对手行为，判断他的情绪状态
 */
export function analyzeOpponentMood(opponent) {
	try {
		_syncCache();
		const key = 'mood_' + (opponent.name1 || opponent.name || '?');
		if (_moodCache.has(key)) return _moodCache.get(key);

		const pref = analyzeOpponentPref(opponent);

		let mood = 'calm';
		let intensity = 0.5;

		/* === 激进 === */
		if (pref.attack > 0.5 || pref.aoe > 0.2) {
			mood = 'aggressive';
			intensity = Math.min(1, (pref.attack + pref.aoe) / 1.5);
		}
		/* === 保守 === */
		else if (pref.defense > 0.5) {
			mood = 'defensive';
			intensity = Math.min(1, pref.defense);
		}
		/* === 控制 === */
		else if (pref.control > 0.4) {
			mood = 'control';
			intensity = Math.min(1, pref.control);
		}
		/* === 均势 === */
		else {
			mood = 'calm';
			intensity = 0.5;
		}

		const result = {
			mood: mood,
			intensity: Math.round(intensity * 100) / 100,
			details: pref,
		};

		_moodCache.set(key, result);
		return result;
	} catch (e) {
		return { mood: 'unknown', intensity: 0.5, details: {} };
	}
}

/* ================= 2. 情绪描述 ================= */
export function describeMood(mood) {
	try {
		const map = {
			'aggressive': { label: '激进', color: 'red' },
			'defensive': { label: '保守', color: 'blue' },
			'control': { label: '控制', color: 'yellow' },
			'calm': { label: '冷静', color: 'green' },
			'unknown': { label: '未知', color: 'gray' },
		};
		return map[mood] || map.unknown;
	} catch (e) {
		return { label: '未知', color: 'gray' };
	}
}

/* ================= 3. 情绪影响策略 =================
 * 对手激进 → 我们更保守
 * 对手保守 → 我们更激进
 */
export function moodStrategyBonus(me, opponent, act) {
	try {
		const mood = analyzeOpponentMood(opponent);
		let bonus = 0;

		/* === 对手激进 → 我们更保守 === */
		if (mood.mood === 'aggressive') {
			/* 防御类牌加成 */
			if (['shan', 'tao', 'wuxie', 'bagua', 'tengjia'].indexOf(act.id) >= 0) {
				bonus += mood.intensity * 0.3;
			}
			/* 进攻类牌减成 */
			if (['juedou', 'nanman', 'wanjian'].indexOf(act.id) >= 0) {
				bonus -= mood.intensity * 0.2;
			}
		}

		/* === 对手保守 → 我们更激进 === */
		if (mood.mood === 'defensive') {
			/* 进攻类牌加成 */
			if (['sha', 'juedou', 'huogong', 'nanman', 'wanjian'].indexOf(act.id) >= 0) {
				bonus += mood.intensity * 0.3;
			}
		}

		return bonus;
	} catch (e) {
		return 0;
	}
}

/* ================= 4. 全员情绪概览 ================= */
export function getAllMoods(me) {
	try {
		const players = game.players || [];
		const result = [];

		players.forEach(function (p) {
			if (!p || p.alive === false) return;
			if (p === me) return;

			const mood = analyzeOpponentMood(p);
			const desc = describeMood(mood.mood);

			result.push({
				name: p.name || p.name1 || '?',
				mood: mood.mood,
				moodLabel: desc.label,
				color: desc.color,
				intensity: mood.intensity,
			});
		});

		return result;
	} catch (e) {
		return [];
	}
}
