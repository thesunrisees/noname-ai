/*
 * ============================================
 * // 作者：飛昇原創
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 多回合预测 ================= */
import { lib, game, get, _status } from '../../../noname.js';
import { isEnemyOf, forecastSummary, threatOf } from './threat.js';

function rollForward(me, horizon) {
	try {
		if (!me || !horizon) horizon = 3;
		let myScore = me.hp || 0;
		let enScore = 0;
		const enemies = [], allies = [];
		for (const p of (game.players || [])) {
			if (!p || p === me || p.alive === false) continue;
			if (isEnemyOf(me, p)) enemies.push(p);
			else allies.push(p);
		}
		const allyPool = allies.reduce(function (s, a) { return s + (a.hp || 0); }, 0) * 0.6;
		enScore = enemies.reduce(function (s, e) { return s + (e.hp || 0); }, 0);

		const myThreatOut = (me.hp || 0) * 0.8 + allyPool;
		const enThreatOut = enemies.reduce(function (s, e) {
			return s + threatOf(e) * 2 + (e.hp || 0) * 0.5;
		}, 0);

		const myLossPerTurn = enThreatOut / Math.max(1, horizon * 2);
		const enLossPerTurn = myThreatOut / Math.max(1, horizon * 2);

		const myFinal = Math.max(0, myScore - myLossPerTurn * horizon);
		const enFinal = Math.max(0, enScore - enLossPerTurn * horizon);
		const myRatio = (myFinal + 0.1) / (enFinal + 0.1);

		let trend = "stable";
		const curRatio = (myScore + 0.1) / (enScore + 0.1);
		if (myRatio > curRatio * 1.15) trend = "improving";
		else if (myRatio < curRatio * 0.85) trend = "worsening";

		return {
			horizon,
			myFinal: Math.round(myFinal * 10) / 10,
			enFinal: Math.round(enFinal * 10) / 10,
			myLoss: Math.round(myLossPerTurn * 10) / 10,
			enLoss: Math.round(enLossPerTurn * 10) / 10,
			myRatio: Math.round(myRatio * 100) / 100,
			curRatio: Math.round(curRatio * 100) / 100,
			trend,
		};
	} catch (e) {
		return { horizon: horizon, myFinal: 0, enFinal: 0, myLoss: 0, enLoss: 0, myRatio: 0, curRatio: 0, trend: "stable" };
	}
}

export function multiTurnForecast(me) {
	try {
		const r1 = rollForward(me, 1);
		const r2 = rollForward(me, 2);
		const r3 = rollForward(me, 3);
		let overall = "stable";
		if (r1.trend === "improving" && r2.trend === "improving") overall = "improving";
		else if (r1.trend === "worsening" || r3.trend === "worsening") overall = "worsening";
		let instant = null;
		try { instant = forecastSummary(me); } catch (e) {}
		return {
			overall,
			r1, r2, r3,
			instant,
			advice: overall === "worsening" ? "局势恶化：建议加快节奏，寻找击杀窗口"
				: overall === "improving" ? "局势改善：可稳守积蓄，等待反打"
				: "局势稳定：按常规节奏",
		};
	} catch (e) {
		return { overall: "stable", r1: null, r2: null, r3: null, instant: null, advice: "预测异常" };
	}
}
