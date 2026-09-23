/* ================= 决策积分引擎 · AI 学习闭环 =================
 * 打完一局后，自动调整权重
 */
import { lib, game, get, _status } from '../../../noname.js';
import { WEIGHTS, BIAS } from './weights.js';

/* ================= 学习缓存 ================= */
let _learnData = {
	games: 0,
	wins: 0,
	losses: 0,
	weightAdjustments: [],
};

/* ================= 1. 记录结果 ================= */
export function recordGameResult(won) {
	try {
		_learnData.games++;
		if (won) {
			_learnData.wins++;
		} else {
			_learnData.losses++;
		}
	} catch (e) {}
}

/* ================= 2. 计算胜率 ================= */
export function getWinRate() {
	try {
		if (_learnData.games === 0) return 0;
		return _learnData.wins / _learnData.games;
	} catch (e) {
		return 0;
	}
}

/* ================= 3. 自动调整权重 =================
 * 如果胜率低 → 自动调整权重
 */
export function autoAdjustWeights() {
	try {
		const winRate = getWinRate();

		/* 如果胜率 < 0.4 → 权重微调 */
		if (winRate < 0.4 && _learnData.games > 10) {
			/* 这里只是占位，真正的调整需要 Python 蒸馏 */
			return {
				adjusted: false,
				reason: '胜率低，建议用 Python 重新蒸馏',
			};
		}

		return {
			adjusted: false,
			reason: '胜率正常，不需要调整',
		};
	} catch (e) {
		return { adjusted: false, reason: '未知错误' };
	}
}

/* ================= 4. 学习数据面板 ================= */
export function learningPanelData() {
	try {
		return {
			games: _learnData.games,
			wins: _learnData.wins,
			losses: _learnData.losses,
			winRate: Math.round(getWinRate() * 100) / 100,
			weightReady: !!WEIGHTS,
		};
	} catch (e) {
		return { games: 0, wins: 0, losses: 0, winRate: 0, weightReady: false };
	}
}

/* ================= 5. 清空学习数据 ================= */
export function clearLearningData() {
	_learnData = {
		games: 0,
		wins: 0,
		losses: 0,
		weightAdjustments: [],
	};
}
