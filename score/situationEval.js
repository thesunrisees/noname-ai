/*
 * ============================================
 * // Penulis: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 局面估值 =================
 * 对当前局面的整体估值（优势/劣势/均势）
 * 优势时保守，劣势时激进
 */
import { lib, game, get, _status } from '../../../noname.js';

// Författare: Feisheng Original | Licens: GPL-3.0
/* ================= 局面估值缓存 ================= */
const _evalCache = new Map();
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
		_evalCache.clear();
	}
}

/* ================= 1. 己方力量估值 ================= */
function allyPower(me) {
	try {
		const players = game.players || [];
		let power = 0;

		players.forEach(function (p) {
			if (!p || p.alive === false) return;

			/* 判断是不是队友 */
			let isAlly = false;
			try {
				if (get.attitude(me, p) > 0) isAlly = true;
			} catch (e) {}

			if (!isAlly && p !== me) return;

			/* 力量 = 血量 × 1 + 手牌数 × 0.5 + 装备数 × 0.8 */
			const hp = p.hp || 0;
			const hc = p.countCards ? p.countCards('h') : 0;
			const ec = p.countCards ? p.countCards('e') : 0;
			power += hp * 1 + hc * 0.5 + ec * 0.8;
		});

		return power;
	} catch (e) {
		return 0;
	}
}

/* ================= 2. 敌方力量估值 ================= */
function enemyPower(me) {
	try {
		const players = game.players || [];
		let power = 0;

		players.forEach(function (p) {
			if (!p || p.alive === false) return;

			/* 判断是不是敌人 */
			let isEnemy = false;
			try {
				if (get.attitude(me, p) < 0) isEnemy = true;
			} catch (e) {}

			if (!isEnemy && p !== me) return;
			if (p === me) return;

			/* 力量 = 血量 × 1 + 手牌数 × 0.5 + 装备数 × 0.8 */
			const hp = p.hp || 0;
			const hc = p.countCards ? p.countCards('h') : 0;
			const ec = p.countCards ? p.countCards('e') : 0;
			power += hp * 1 + hc * 0.5 + ec * 0.8;
		});

		return power;
	} catch (e) {
		return 0;
	}
}

/* ================= 3. 局面估值 =================
 * 返回 -1 ~ +1
 * +1 = 大优势，-1 = 大劣势，0 = 均势
 */
export function evaluateSituation(me) {
	try {
		_syncCache();
		const key = 'eval_' + (me.name1 || me.name || '?');
		if (_evalCache.has(key)) return _evalCache.get(key);

		const ally = allyPower(me);
		const enemy = enemyPower(me);

		if (enemy === 0) {
			/* 敌人都死了 → 大优势 */
			return 1.0;
		}

		/* 比值：我方/敌方 */
		const ratio = ally / enemy;

		/* 归一化到 -1 ~ +1 */
		let value = 0;
		if (ratio >= 2) value = 1.0;
		else if (ratio >= 1.5) value = 0.6;
		else if (ratio >= 1.2) value = 0.3;
		else if (ratio >= 0.8) value = 0;
		else if (ratio >= 0.6) value = -0.3;
		else if (ratio >= 0.4) value = -0.6;
		else value = -1.0;

		_evalCache.set(key, value);
		return value;
	} catch (e) {
		return 0;
	}
}

/* ================= 4. 局面描述 ================= */
export function describeSituation(me) {
	try {
		const value = evaluateSituation(me);

		if (value >= 0.8) return { label: '大优势', color: 'green', value: value };
		if (value >= 0.4) return { label: '优势', color: 'lightgreen', value: value };
		if (value >= 0.1) return { label: '小优势', color: 'yellowgreen', value: value };
		if (value >= -0.1) return { label: '均势', color: 'yellow', value: value };
		if (value >= -0.4) return { label: '小劣势', color: 'orange', value: value };
		if (value >= -0.8) return { label: '劣势', color: 'red', value: value };
		return { label: '大劣势', color: 'darkred', value: value };
	} catch (e) {
		return { label: '未知', color: 'gray', value: 0 };
	}
}

/* ================= 5. 局面策略加成 =================
 * 优势时保守，劣势时激进
 */
export function situationStrategyBonus(me, act) {
	try {
		if (!me || !act) return 0;

		const value = evaluateSituation(me);
		let bonus = 0;

		/* === 优势时：保守 === */
		if (value >= 0.4) {
			/* 防御类牌加成 */
			if (['shan', 'tao', 'wuxie', 'bagua', 'tengjia'].indexOf(act.id) >= 0) {
				bonus += 0.3;
			}
			/* 进攻类牌减成 */
			if (['juedou', 'nanman', 'wanjian'].indexOf(act.id) >= 0) {
				bonus -= 0.2;
			}
		}

		/* === 劣势时：激进 === */
		if (value <= -0.4) {
			/* 进攻类牌加成 */
			if (['sha', 'juedou', 'huogong', 'nanman', 'wanjian'].indexOf(act.id) >= 0) {
				bonus += 0.3;
			}
			/* 防御类牌减成 */
			if (['shan', 'tao'].indexOf(act.id) >= 0) {
				bonus -= 0.1;
			}
		}

		return bonus;
	} catch (e) {
		return 0;
	}
}
