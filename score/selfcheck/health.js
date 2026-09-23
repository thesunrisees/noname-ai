/* ================= 决策积分引擎 · 健康度体检 ================= */
import { lib, game, get, _status } from '../../../noname.js';
import { getInstalled } from '../core/engine.js';
import { getFeedbackStats } from '../feedback/feedback.js';
import { getDecisionFeedbackStats } from '../feedback/decisionFeedback.js';
import { getArchive } from '../export/archive.js';

function _check(name, fn) {
	try {
		const r = fn();
		return { name: name, ok: r === true || (r && r.ok), detail: r && r.detail ? r.detail : (r === true ? '正常' : '异常') };
	} catch (e) {
		return { name: name, ok: false, detail: '异常：' + String(e).slice(0, 60) };
	}
}

export function healthCheck() {
	const results = [];

	results.push(_check('记分钩子', function () {
		if (getInstalled()) return { ok: true, detail: '已安装' };
		return { ok: false, detail: '未安装（未进入对局？）' };
	}));

	results.push(_check('玩家对象', function () {
		const n = (game.players || []).length;
		if (n === 0) return { ok: false, detail: '无玩家（未进入对局）' };
		return { ok: true, detail: n + ' 名玩家' };
	}));

	results.push(_check('技能库', function () {
		const n = Object.keys(lib.skill || {}).length;
		if (n < 10) return { ok: false, detail: '技能库异常（' + n + '）' };
		return { ok: true, detail: n + ' 项技能' };
	}));

	results.push(_check('卡牌库', function () {
		const n = Object.keys(lib.card || {}).length;
		if (n < 10) return { ok: false, detail: '卡牌库异常（' + n + '）' };
		return { ok: true, detail: n + ' 张卡牌' };
	}));

	results.push(_check('技能反馈', function () {
		const s = getFeedbackStats();
		const active = s.filter(function (x) { return x.active; }).length;
		return { ok: true, detail: s.length + ' 项（' + active + ' 项生效）' };
	}));

	results.push(_check('决策反馈', function () {
		const s = getDecisionFeedbackStats();
		const active = s.filter(function (x) { return x.active; }).length;
		return { ok: true, detail: s.length + ' 项（' + active + ' 项生效）' };
	}));

	results.push(_check('战报归档', function () {
		const n = getArchive().length;
		return { ok: true, detail: n + ' 局归档' };
	}));

	results.push(_check('模式', function () {
		const m = (get && get.mode) ? get.mode() : (_status && _status.mode) || 'unknown';
		const known = ['identity', 'guozhan', 'doudizhu', 'versus', 'boss'];
		return { ok: true, detail: m + (known.indexOf(m) >= 0 ? '（已适配）' : '（未验证）') };
	}));

	results.push(_check('联机状态', function () {
		if (_status && _status.connectMode) return { ok: true, detail: '联机（部分功能自动降级）' };
		return { ok: true, detail: '单机' };
	}));

	const allOk = results.every(function (r) { return r.ok; });
	return { allOk: allOk, results: results };
}
