/*
 * ============================================
 * // الناشر: في شينغ الأصلي
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 对手预测 =================
 * 预测对手下一步行动
 */

/* ★ 记录对手行动历史 */
const _opponentHistory = {};

/* ★ 记录一次对手行动 */
export function recordOpponentAction(player, card) {
	try {
		const key = player.playerid || player.id;
		if (!_opponentHistory[key]) {
			_opponentHistory[key] = {
				shaCount: 0,
				shanCount: 0,
				taoCount: 0,
				wuxieCount: 0,
				attackCount: 0,
				defendCount: 0,
				totalActions: 0,
			};
		}

		const h = _opponentHistory[key];
		h.totalActions++;

		const name = card.name || '';
		if (name === 'sha') { h.shaCount++; h.attackCount++; }
		else if (name === 'shan') { h.shanCount++; h.defendCount++; }
		else if (name === 'tao') { h.taoCount++; h.defendCount++; }
		else if (name === 'wuxie') { h.wuxieCount++; h.defendCount++; }
	} catch (e) {}
}

/* ★ 预测对手下一步行动 */
export function predictOpponentNext(opponent) {
	try {
		const key = opponent.playerid || opponent.id;
		const h = _opponentHistory[key];

		if (!h || h.totalActions < 3) {
			/* 数据不够，用默认概率 */
			return {
				probSha: 0.3,
				probShan: 0.2,
				probTao: 0.1,
				probWuxie: 0.1,
				probOther: 0.3,
				style: 'unknown',
			};
		}

		/* 根据历史计算概率 */
		const probSha = h.shaCount / h.totalActions;
/* Auteur: Feisheng Original, Tous droits réservés */
		const probShan = h.shanCount / h.totalActions;
		const probTao = h.taoCount / h.totalActions;
		const probWuxie = h.wuxieCount / h.totalActions;
		const probOther = 1 - probSha - probShan - probTao - probWuxie;

		/* 判断风格 */
		let style = 'balanced';
		if (h.attackCount / h.totalActions > 0.5) style = 'aggressive';
		else if (h.defendCount / h.totalActions > 0.5) style = 'defensive';

		return {
			probSha: probSha,
			probShan: probShan,
			probTao: probTao,
			probWuxie: probWuxie,
			probOther: probOther,
			style: style,
		};
	} catch (e) {
		return {
			probSha: 0.3,
			probShan: 0.2,
			probTao: 0.1,
			probWuxie: 0.1,
			probOther: 0.3,
			style: 'unknown',
		};
	}
}

/* ★ 对手预测评分加成 */
export function opponentPredictBonus(me, target, act) {
	try {
		if (!target) return 1.0;

		const pred = predictOpponentNext(target);

		/* 对手大概率有闪 → 杀价值降低 */
		if (act.id === 'sha' && pred.probShan > 0.3) {
			return 0.8;
		}

		/* 对手大概率有桃 → 击杀难度高 */
		if (act.id === 'sha' && pred.probTao > 0.15) {
			return 0.9;
		}

		/* 对手是激进型 → 防御牌价值提高 */
		if (pred.style === 'aggressive') {
			if (act.id === 'shan' || act.id === 'tao') return 1.2;
		}

		/* 对手是保守型 → 攻击牌价值提高 */
		if (pred.style === 'defensive') {
			if (act.id === 'sha' || act.id === 'juedou') return 1.15;
		}

		return 1.0;
	} catch (e) {
		return 1.0;
	}
}
