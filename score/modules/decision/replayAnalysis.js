/* ================= 决策积分引擎 · 回放分析 =================
 * 打完一局后，回放分析 AI 哪里打错了
 * 给出改进建议
 */
import { lib, game, get, _status } from '../../../../../noname.js';

/* ================= 决策记录缓存 ================= */
const _decisionLog = [];

/* ================= 1. 记录决策 =================
 * 在 bestAction 里调用，记录每个决策
 */
export function recordDecision(me, act, score, ctx) {
	try {
		_decisionLog.push({
			round: _status.roundNumber || 0,
			time: Date.now(),
			player: me.name1 || me.name || '?',
			action: act.id || 'unknown',
			target: act.target ? (act.target.name1 || act.target.name || '?') : 'none',
			score: Math.round(score * 100) / 100,
			hp: me.hp || 0,
			handCount: me.countCards ? me.countCards('h') : 0,
			ctx: ctx || {},
		});

		/* 只保留最近 100 条 */
		if (_decisionLog.length > 100) {
			_decisionLog.shift();
		}
	} catch (e) {}
}

/* ================= 2. 获取决策日志 ================= */
export function getDecisionLog() {
	return _decisionLog.slice();
}

/* ================= 3. 清空决策日志 ================= */
export function clearDecisionLog() {
	_decisionLog.length = 0;
}

/* ================= 4. 回放分析 =================
 * 分析 AI 的决策，找出打错的地方
 */
export function analyzeReplay(me) {
	try {
		if (_decisionLog.length === 0) {
			return {
				totalDecisions: 0,
				errors: [],
				suggestions: [],
			};
		}

		const errors = [];
		const suggestions = [];

		/* === 分析每一条决策 === */
		_decisionLog.forEach(function (d, i) {
			/* === 错误 1：残血还进攻 === */
			if (d.hp <= 1 && ['sha', 'juedou', 'huogong', 'nanman', 'wanjian'].indexOf(d.action) >= 0) {
				errors.push({
					round: d.round,
					action: d.action,
					target: d.target,
					reason: '残血状态还进攻，应该先保命',
					severity: 'high',
				});
			}

			/* === 错误 2：优势还疯狂用锦囊 === */
			if (d.hp >= 3 && ['nanman', 'wanjian', 'juedou'].indexOf(d.action) >= 0) {
				/* 这个不一定是错，看情况 */
			}

			/* === 错误 3：队友血量低还不给桃 === */
			/* 这个需要看后续，暂时不分析 */
		});

		/* === 改进建议 === */
		if (errors.length > 0) {
			suggestions.push(`本局有 ${errors.length} 个决策可能有问题`);
			suggestions.push('建议：残血时先保命，不要盲目进攻');
			suggestions.push('建议：优势时保守，劣势时激进');
		} else {
			suggestions.push('本局决策看起来还不错，继续保持');
		}

		return {
			totalDecisions: _decisionLog.length,
			errors: errors,
			suggestions: suggestions,
		};
	} catch (e) {
		return { totalDecisions: 0, errors: [], suggestions: [] };
	}
}

/* ================= 5. 回放面板数据 ================= */
export function replayPanelData(me) {
	try {
		const analysis = analyzeReplay(me);

		return {
			log: _decisionLog.slice(-20),  /* 最近 20 条 */
			total: _decisionLog.length,
			errors: analysis.errors,
			suggestions: analysis.suggestions,
		};
	} catch (e) {
		return { log: [], total: 0, errors: [], suggestions: [] };
	}
}
