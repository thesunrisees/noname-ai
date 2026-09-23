/* ================= 决策积分引擎 · 技能反馈闭环 =================
 * 原理：
 *   1) 每次 AI 决策选择技能时，记录「预测收益」+「使用者」；
 *   2) 结算时统计「实际积分」/「预测收益总和」= 修正系数；
 *   3) 用移动平均平滑后写回 storage；
 *   4) skillProfileOf 返回时把 profit.base × ratio，让预测值逐步逼近现实。
 * 叶子模块：只用 localStorage，不 import 任何业务模块。
 */
const KEY = "无名AI_skillFeedback";
const VERSION = 1;
const RATIO_MIN = 0.5;
const RATIO_MAX = 1.5;
const DECAY = 0.7;
const MIN_SAMPLES = 3;
const MIN_DELTA = 0.15;

let FEEDBACK = { v: VERSION, skills: {} };
let _loaded = false;
let _pending = [];

export function loadFeedback() {
	try {
		if (_loaded) return;
		const raw = localStorage.getItem(KEY);
		if (raw) {
			const obj = JSON.parse(raw);
			if (obj && obj.v === VERSION && obj.skills) {
				FEEDBACK = obj;
			}
		}
		_loaded = true;
	} catch (e) { _loaded = true; }
}

export function saveFeedback() {
	try {
		localStorage.setItem(KEY, JSON.stringify(FEEDBACK));
	} catch (e) {}
}

export function recordSkillUse(skillId, playerKey, predicted) {
	try {
		if (!skillId || !playerKey) return;
		const p = Number(predicted);
		if (isNaN(p) || p <= 0) return;
		_pending.push({ skill: skillId, playerKey: playerKey, predicted: p, ts: Date.now() });
	} catch (e) {}
}

export function flushFeedback(playerScores) {
	try {
		if (!_pending.length || !playerScores) { _pending = []; return; }
		const grouped = {};
		for (const it of _pending) {
			if (!grouped[it.playerKey]) grouped[it.playerKey] = [];
			grouped[it.playerKey].push(it);
		}
		let updated = 0;
		for (const pk in grouped) {
			const items = grouped[pk];
			const actual = Number(playerScores[pk]);
			if (isNaN(actual)) continue;
			let predSum = 0;
			for (const it of items) predSum += it.predicted;
			if (Math.abs(predSum) < 0.5) continue;
			let ratio = actual / predSum;
			ratio = Math.max(RATIO_MIN, Math.min(RATIO_MAX, ratio));
			if (!isFinite(ratio) || ratio <= 0) continue;
			const skillsUsed = {};
			for (const it of items) {
				if (!skillsUsed[it.skill]) skillsUsed[it.skill] = 0;
				skillsUsed[it.skill]++;
			}
			for (const sk in skillsUsed) {
				_updateRatio(sk, ratio);
				updated++;
			}
		}
		_pending = [];
		if (updated) saveFeedback();
	} catch (e) { _pending = []; }
}

function _updateRatio(skillId, newRatio) {
	if (!FEEDBACK.skills) FEEDBACK.skills = {};
	const f = FEEDBACK.skills[skillId] || { ratio: 1.0, samples: 0, lastUpdate: 0 };
	if (f.samples < 1) {
		f.ratio = newRatio;
	} else {
		f.ratio = f.ratio * DECAY + newRatio * (1 - DECAY);
	}
	f.ratio = Math.max(RATIO_MIN, Math.min(RATIO_MAX, f.ratio));
	f.samples++;
	f.lastUpdate = Date.now();
	FEEDBACK.skills[skillId] = f;
}

export function getRatio(skillId) {
	try {
		loadFeedback();
		const f = FEEDBACK.skills && FEEDBACK.skills[skillId];
		if (!f) return 1.0;
		if (f.samples < MIN_SAMPLES) return 1.0;
		if (Math.abs(f.ratio - 1) < MIN_DELTA) return 1.0;
		return f.ratio;
	} catch (e) { return 1.0; }
}

export function getFeedbackStats() {
	try {
		loadFeedback();
		const out = [];
		for (const sk in (FEEDBACK.skills || {})) {
			const f = FEEDBACK.skills[sk];
			out.push({
				skill: sk,
				ratio: Math.round(f.ratio * 100) / 100,
				samples: f.samples,
				active: f.samples >= MIN_SAMPLES && Math.abs(f.ratio - 1) >= MIN_DELTA,
				lastUpdate: f.lastUpdate,
			});
		}
		out.sort(function (a, b) { return Math.abs(b.ratio - 1) - Math.abs(a.ratio - 1); });
		return out;
	} catch (e) { return []; }
}

export function resetFeedback() {
	try {
		FEEDBACK = { v: VERSION, skills: {} };
		_pending = [];
		localStorage.removeItem(KEY);
	} catch (e) {}
}

export function feedbackCount() {
	try {
		loadFeedback();
		return Object.keys(FEEDBACK.skills || {}).length;
	} catch (e) { return 0; }
}
