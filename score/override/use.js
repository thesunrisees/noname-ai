/* ================= 决策积分引擎 · 接管 chooseToUse（完整版） =================
 * 设计原则：
 *   ★ 硬接管 A：引擎说"结束回合" → 短路结束
 *   ★ 硬接管 B：引擎明确否决某张牌 → filterCard 过滤
 *   ★ 软接管：出牌顺序/估值交给 aiOverride.js
 */
import { lib, game, get, _status } from '../../../../noname.js';
import { bestAction } from '../engine.js';
import { cfg } from '../util.js';
import { log } from '../logger.js';
import { trip, isTripped } from './circuit.js';

const ORIG_KEY = '__djsc_orig_chooseToUse';
const SENTINEL = '__djsc_overridden_use';
const DEGRADE_WINDOW = 5000;
const VETO_THRESHOLD = 8;  /* ★ 否决阈值：候选分差超过此值 → 硬否决低分牌 */

const DEGRADED = new Map();

function _isDegraded(player) {
	const ts = DEGRADED.get(player);
	if (!ts) return false;
	if (Date.now() - ts > DEGRADE_WINDOW) {
		DEGRADED.delete(player);
		return false;
	}
	return true;
}

function _markDegraded(player) {
	DEGRADED.set(player, Date.now());
}

function _stat(action) {
	try {
		if (!_status.djsc_overrideStats) {
			_status.djsc_overrideStats = { use: {}, respond: {}, discard: {}, compare: {}, soft: {} };
		}
		const b = _status.djsc_overrideStats.use;
		b[action] = (b[action] || 0) + 1;
	} catch (e) {}
}

function _shouldOverride(player, event) {
	try {
		if (!player || !event) return false;
		if (player === game.me) return false;
		try { if (player.isOnline2 && player.isOnline2()) return false; } catch (e) {}
		if (cfg('hardOverride', true) === false) return false;
		if (isTripped('use')) return false;
		if (_isDegraded(player)) return false;
		try {
			const parent = event.getParent && event.getParent();
			if (parent && parent.name === 'chooseToUse') return false;
			/* ★ 多步骤事件：选武将/选技能不接管（左慈化身等） */
			if (parent && (parent.name === 'chooseToSkill' || parent.name === 'chooseToCharacter')) return false;
		} catch (e) {}
		try {
			if (_status.currentPhase && _status.currentPhase !== player) return false;
		} catch (e) {}
		if (event[SENTINEL]) return false;
		return true;
	} catch (e) { return false; }
}

function _hasAvailableLimitedSkill(player) {
	try {
		const skills = player.skills || [];
		for (const sid of skills) {
			const info = lib.skill[sid];
			if (!info) continue;
			if (!info.limited && !info.awaken) continue;
			if (info.viewAs) {
				try {
					if (typeof lib.filter.skillEnabled === 'function' && !lib.filter.skillEnabled(info, player)) continue;
				} catch (e) {}
				return true;
			}
		}
	} catch (e) {}
	return false;
}

function _hasForcedSkill(player) {
	try {
		const skills = player.skills || [];
		for (const sid of skills) {
			const info = lib.skill[sid];
			if (info && info.forced && info.viewAs) {
				try {
					if (typeof lib.filter.skillEnabled === 'function' && !lib.filter.skillEnabled(info, player)) continue;
				} catch (e) {}
				return true;
			}
		}
	} catch (e) {}
	return false;
}

/* ★ 检查某张牌是否被引擎明确否决 */
function _shouldVeto(player, card) {
	try {
		const cands = _status.djsc_lastCandidates;
		if (!cands || !cands.length) return false;

		const cid = get.name(card, player);
		if (!cid) return false;

		/* 找出这张牌在候选里的分数 */
		let thisScore = null;
		for (let i = 0; i < cands.length; i++) {
			const c = cands[i];
			if (c.type === 'card' && c.id === cid) {
				thisScore = c.score;
				break;
			}
		}
		if (thisScore === null) return false;   /* 引擎没有评估过这张牌 → 不否决 */

		/* 引擎最高分候选 */
		const top = cands[0];
		if (!top) return false;

		/* 如果这张牌就是引擎第一名 → 不否决 */
		if (top.type === 'card' && top.id === cid) return false;

		/* 分差超过阈值 → 硬否决 */
		if ((top.score - thisScore) > VETO_THRESHOLD) {
			return true;
		}
		return false;
	} catch (e) { return false; }
}

export function installUseOverride() {
	try {
		const proto = lib.element && lib.element.Player && lib.element.Player.prototype;
		if (!proto) return;
		if (proto[ORIG_KEY]) return;

		const orig = proto.chooseToUse;
		if (typeof orig !== 'function') return;
		proto[ORIG_KEY] = orig;

		proto.chooseToUse = function (...args) {
			const player = this;
			const ev = _status.event;

			if (!_shouldOverride(player, ev)) {
				return orig.apply(this, args);
			}

			let ba = null;
			const t0 = performance.now();
			try {
				ba = bestAction();
			} catch (e) {
				_markDegraded(player);
				trip('use', 'bestAction 异常：' + e.message, 'fatal');
				_stat('error');
				return orig.apply(this, args);
			}
			const dt = performance.now() - t0;
			if (dt > 800) {
				_markDegraded(player);
				trip('use', 'bestAction 耗时 ' + Math.round(dt) + 'ms', 'warn');
				_stat('timeout');
				return orig.apply(this, args);
			}

			if (!ba || !ba.rule) {
				_stat('pass');
				return orig.apply(this, args);
			}

			/* ============ ★ 硬接管 A：引擎说"结束回合" → 短路 ============ */
			if (ba.action === 'C' && ba.rule === 'end') {
				if (_hasAvailableLimitedSkill(player) || _hasForcedSkill(player)) {
					_stat('pass-limited');
					return orig.apply(this, args);
				}
				_stat('endTurn');
				try { ev[SENTINEL] = true; } catch (e) {}
				const origFilterEnd = ev.filterCard;
				ev.filterCard = function () { return false; };
				try {
					return orig.apply(this, args);
				} catch (e) {
					try { ev.filterCard = origFilterEnd; } catch (e2) {}
					try { delete ev[SENTINEL]; } catch (e3) {}
					_markDegraded(player);
					trip('use', 'filterCard 短路异常：' + e.message, 'fatal');
					return orig.apply(this, args);
				}
			}

			/* ============ ★ 硬接管 B：否决低价值牌 ============ */
			const origFilterVeto = ev.filterCard;
			ev.filterCard = function (card, p, e) {
				try {
					/* 先执行原 filter */
					if (typeof origFilterVeto === 'function' && !origFilterVeto(card, p, e)) return false;
					/* 引擎否决检查 */
					if (_shouldVeto(player, card)) {
						_stat('veto');
						return false;
					}
					return true;
				} catch (err) {
					/* 否决逻辑异常 → 降级为不否决（保守） */
					try { return typeof origFilterVeto === 'function' ? origFilterVeto(card, p, e) : true; }
					catch (e2) { return true; }
				}
			};

			try {
				const r = orig.apply(this, args);
				/* ★ 恢复原 filter（不污染后续调用） */
				try { ev.filterCard = origFilterVeto; } catch (eRestore) {}
				_stat('pass');
				return r;
			} catch (e) {
				try { ev.filterCard = origFilterVeto; } catch (e2) {}
				_markDegraded(player);
				trip('use', 'filterCard 否决异常：' + e.message, 'fatal');
				_stat('error');
				return orig.apply(this, args);
			}
		};

		log.info('override', 'chooseToUse 硬接管层已安装（结束回合 + 低价值牌否决）');
	} catch (e) {
		try { console.error('[决策积分] installUseOverride 失败：', e); } catch (e2) {}
	}
}

export function uninstallUseOverride() {
	try {
		const proto = lib.element && lib.element.Player && lib.element.Player.prototype;
		if (!proto || !proto[ORIG_KEY]) return;
		proto.chooseToUse = proto[ORIG_KEY];
		delete proto[ORIG_KEY];
		DEGRADED.clear();
		log.info('override', 'chooseToUse 硬接管层已卸载');
	} catch (e) {}
}
