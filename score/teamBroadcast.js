/* ================= 决策积分引擎 · AI 协作广播 =================
 * 目的：让同阵营 AI 知道彼此的攻击意图，形成集火。
 * 通过 _status.djsc_broadcast 共享（每回合清空）。
 * 不依赖任何业务模块，叶子级。
 */
import { game, _status } from '../../../noname.js';
import { getModeStrategy, isSameCamp } from './modeStrategy.js';

const MAX_AGE = 3000;
const MAX_ENTRIES = 30;

function _ensure() {
	try {
		if (!_status.djsc_broadcast) _status.djsc_broadcast = [];
		if (!Array.isArray(_status.djsc_broadcast)) _status.djsc_broadcast = [];
	} catch (e) {}
	return _status.djsc_broadcast;
}

export function broadcastIntent(from, targetName, cardId, score) {
	try {
		if (!from || !targetName) return;
		const arr = _ensure();
		let fromCamp = 'unknown';
		try { fromCamp = getModeStrategy().getCamp(from); } catch (eC) {}
		arr.push({
			from: from.name1 || from.name,
			fromIdentity: from.identity || '',
			fromCamp: fromCamp,
			target: targetName,
			card: cardId || '',
			score: score || 0,
			ts: Date.now(),
		});
		while (arr.length > MAX_ENTRIES) arr.shift();
	} catch (e) {}
}

export function readIntents(me, targetName) {
	try {
		if (!me || !targetName) return [];
		const arr = _ensure();
		const now = Date.now();
		let myCamp = 'unknown';
		try { myCamp = getModeStrategy().getCamp(me); } catch (e) {}
		return arr.filter(function (e) {
			if (now - e.ts > MAX_AGE) return false;
			if (e.from === (me.name1 || me.name)) return false;
			if (e.target !== targetName) return false;
			/* ★ 优先用存好的 fromCamp；没有则用 isSameCamp */
			let eCamp = e.fromCamp;
			if (!eCamp) {
				try { eCamp = _campOf(e.fromIdentity); } catch (err) { eCamp = 'unknown'; }
			}
			return eCamp === myCamp;
		});
	} catch (e) { return []; }
}

export function focusBonus(me, targetName) {
	try {
		const intents = readIntents(me, targetName);
		if (!intents.length) return 1.0;
		/* ★ 扩写：集火奖励优化 */
		/* 1. 基础奖励：每个队友的意图 +0.15，上限 +0.6 */
		let bonus = Math.min(0.6, intents.length * 0.15);
		/* 2. 高分意图加权：如果队友的评分很高，说明这个目标确实值得集火 */
		const avgScore = intents.reduce(function (s, e) { return s + (e.score || 0); }, 0) / intents.length;
		if (avgScore >= 8) bonus += 0.2;   /* 高分目标额外加成 */
		else if (avgScore >= 5) bonus += 0.1;
		/* 3. 濒死目标额外加成：如果目标已经残血，集火收益更高 */
		try {
			const target = game.players.find(function (p) {
				return (p.name1 || p.name) === targetName;
			});
			if (target && target.hp !== undefined && target.hp <= 1) {
				bonus += 0.3;   /* 濒死目标额外加成 */
			}
		} catch (e) {}
		return 1.0 + bonus;
	} catch (e) { return 1.0; }
}

function _camp(p) {
	try {
		const id = (p && p.identity) || '';
		return _campOf(id);
	} catch (e) { return 'unknown'; }
}
function _campOf(id) {
	if (id === 'zhu' || id === 'zhong' || id === 'mingzhong') return 'loyal';
	if (id === 'fan') return 'rebel';
	if (id === 'nei') return 'nei';
	return 'unknown';
}

let _hooked = false;
export function installBroadcastHooks() {
	if (_hooked) return;
	try {
		const orig = game.check;
		if (typeof orig !== 'function') return;
		game.check = function () {
			try { _ensure().length = 0; } catch (e) {}
			return orig.apply(this, arguments);
		};
		_hooked = true;
	} catch (e) {}
}

/* 面板/调试用：当前广播快照 */
export function snapshotBroadcast() {
	try {
		return _ensure().slice();
	} catch (e) { return []; }
}

/* 手动清空（面板按钮用） */
export function clearBroadcast() {
	try { _ensure().length = 0; } catch (e) {}
}
