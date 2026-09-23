/* ================= 决策积分引擎 · 风险量化 =================
 * 更精确的风险量化
 * "这次杀有 30% 概率被闪，70% 命中"
 * 现在的 probHasShan 是 0.5，可以改成动态
 */
import { lib, game, get, _status } from '../../../noname.js';
import { cardRemaining } from '../card/deckMemory.js';
import { probHasShan, probHasWuxie, probHasTao } from '../card/handInference.js';

/* ================= 风险量化缓存 ================= */
const _riskCache = new Map();
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
		_riskCache.clear();
	}
}

/* ================= 1. 杀的命中率风险量化 =================
 * 返回命中概率 0~1
 */
export function shaHitRate(me, target) {
	try {
		_syncCache();
		const key = 'sha_' + (me.name1 || me.name || '?') + '_' + (target.name1 || target.name || '?');
		if (_riskCache.has(key)) return _riskCache.get(key);

		/* 基础：对手有闪的概率 */
		const pShan = probHasShan(target);

		/* 八卦阵：判定红牌成功概率 */
		let pBagua = 0;
		try {
			if (target.hasEquip && target.hasEquip('bagua')) {
				/* 八卦阵：判定红牌 → 成功当闪 */
				/* 红牌概率约 50% */
				pBagua = 0.5;
			}
		} catch (e) {}

		/* 综合：被闪/八卦挡掉的概率 */
		const pBlocked = Math.max(pShan, pBagua);

		/* 命中率 = 1 - 被挡概率 */
		const hitRate = 1 - pBlocked;

		_riskCache.set(key, hitRate);
		return hitRate;
	} catch (e) {
		return 0.5;
	}
}

/* ================= 2. 无懈可击风险量化 =================
 * 返回锦囊被无懈的概率
 */
export function wuxieRisk(me, target, cardId) {
	try {
		_syncCache();
		const key = 'wuxie_' + cardId + '_' + (me.name1 || me.name || '?');
		if (_riskCache.has(key)) return _riskCache.get(key);

		/* 对手有无懈的概率 */
		const pWuxie = probHasWuxie(target);

		/* 如果是延时锦囊 → 队友也可能有无懈 */
		let pTotal = pWuxie;

		_riskCache.set(key, pTotal);
		return pTotal;
	} catch (e) {
		return 0.15;
	}
}

/* ================= 3. 决斗的风险量化 =================
 * 返回决斗胜率
 */
export function duelWinRate(me, target) {
	try {
		_syncCache();
		const key = 'duel_' + (me.name1 || me.name || '?') + '_' + (target.name1 || target.name || '?');
		if (_riskCache.has(key)) return _riskCache.get(key);

		/* 双方有杀的概率 */
		const mySha = probHasSha(me);
		const enemySha = probHasSha(target);

		/* 胜率粗略估算 */
		const winRate = mySha / (mySha + enemySha);

		_riskCache.set(key, winRate);
		return winRate;
	} catch (e) {
		return 0.5;
	}
}

/* ================= 4. 桃的必要性评估 =================
 * 返回现在该不该用桃
 */
export function taoNecessity(me) {
	try {
		const hp = me.hp || 0;
		const maxHp = me.maxHp || 0;

		/* 血量比 */
		const ratio = hp / maxHp;

		if (ratio <= 0.2) {
			return { necessary: true, priority: 0.9, reason: '濒死状态，必须用桃' };
		} else if (ratio <= 0.4) {
			return { necessary: true, priority: 0.7, reason: '低血量，建议用桃' };
		} else if (ratio <= 0.6) {
			return { necessary: false, priority: 0.4, reason: '中血量，可以留桃' };
		} else {
			return { necessary: false, priority: 0.2, reason: '高血量，留桃给队友' };
		}
	} catch (e) {
		return { necessary: false, priority: 0.5, reason: '未知' };
	}
}

/* ================= 5. 综合风险评分 =================
 * 返回风险 0~1（越高越危险）
 */
export function riskScore(me, act) {
	try {
		if (!me || !act) return 0.5;

		let risk = 0.5;

		/* === 杀的风险 === */
		if (act.id === 'sha' && act.target) {
			const hitRate = shaHitRate(me, act.target);
			/* 命中率低 → 风险高 */
			risk = 1 - hitRate;
		}

		/* === 决斗的风险 === */
		if (act.id === 'juedou' && act.target) {
			const winRate = duelWinRate(me, act.target);
			risk = 1 - winRate;
		}

		/* === 锦囊的风险 === */
		if (['shunshou', 'guohe', 'lebu', 'bingliang'].indexOf(act.id) >= 0 && act.target) {
			const wuxieRiskVal = wuxieRisk(me, act.target, act.id);
			risk = wuxieRiskVal;
		}

		return Math.round(risk * 100) / 100;
	} catch (e) {
		return 0.5;
	}
}

/* ================= 6. 风险描述 ================= */
export function describeRisk(risk) {
	try {
		if (risk >= 0.8) return { label: '极高风险', color: 'darkred' };
		if (risk >= 0.6) return { label: '高风险', color: 'red' };
		if (risk >= 0.4) return { label: '中风险', color: 'yellow' };
		if (risk >= 0.2) return { label: '低风险', color: 'lightgreen' };
		return { label: '极低风险', color: 'green' };
	} catch (e) {
		return { label: '未知', color: 'gray' };
	}
}
