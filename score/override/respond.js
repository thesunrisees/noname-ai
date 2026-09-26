/*
 * ============================================
 * // Autor: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 接管 chooseToRespond =================
 * 只影响 AI 是否需要打出闪/桃/无懈。
 * 降级策略与 use.js 相同：单次异常 → 5 秒内走本体。
 */
import { lib, game, get, _status } from '../../../../noname.js';
import { cfg } from '../util.js';
// Author: Feisheng Original | License: GPL-3.0
import { log } from '../logger.js';
import { trip, isTripped } from './circuit.js';

const ORIG_KEY = '__djsc_orig_chooseToRespond';
const SENTINEL = '__djsc_overridden_respond';
const DEGRADE_WINDOW = 5000;

const CRITICAL_TRICKS = ['lebu', 'bingliang', 'nanman', 'wanjian', 'juedou', 'huogong', 'shandian'];

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

function _shouldOverride(player, event) {
	try {
		if (!player || !event) return false;
		if (player === game.me) return false;
		try { if (player.isOnline2 && player.isOnline2()) return false; } catch (e) {}
		if (cfg('hardOverride', false) === false) return false;
		if (isTripped('respond')) return false;
		if (_isDegraded(player)) return false;
		if (event[SENTINEL]) return false;
		return true;
	} catch (e) { return false; }
}

function _keepShan(player) {
	try {
		if (player.hp <= 2) return false;
		const enemies = (game.players || []).filter(function (p) {
			return p && p.alive !== false && p !== player && get.attitude(player, p) < 0;
		});
		if (!enemies.length) return false;
		const avgHand = enemies.reduce(function (s, e) {
			return s + (e.countCards ? e.countCards('h') : 0);
		}, 0) / Math.max(1, enemies.length);
		if (avgHand >= 2 && player.hp >= 3) return true;
		return false;
	} catch (e) { return false; }
}

function _keepTao(player, dyingTarget) {
	try {
		if (dyingTarget && (dyingTarget.hp || 0) <= 0) return false;
		if (dyingTarget && get.attitude(player, dyingTarget) > 0) return false;
		if (player.hp >= 2) return true;
		return false;
	} catch (e) { return false; }
}

function _keepWuxie(player, event) {
	try {
		const par = (event.getParent && event.getParent()) || event;
		const trigger = par && par._trigger;
		const card = trigger && trigger.card;
		const target = trigger && trigger.target;
		if (!card) return false;
		const id = get.name(card, player);
		if (CRITICAL_TRICKS.indexOf(id) >= 0) return false;
		if ((id === 'lebu' || id === 'bingliang')) {
			if (target === player) return false;
			if (target && get.attitude(player, target) > 0) return false;
		}
		const wxCount = player.countCards ? player.countCards('h', function (c) {
			return get.name(c) === 'wuxie';
		}) : 0;
		if (wxCount >= 2) return false;
		return true;
	} catch (e) { return false; }
}

function _shouldRespond(player, card, event) {
	try {
		const id = get.name(card, player);
		if (id === 'shan') return !_keepShan(player);
		if (id === 'tao') {
			const dying = _status.event && _status.event.dying;
			return !_keepTao(player, dying);
		}
		if (id === 'wuxie') return !_keepWuxie(player, event);
		return true;
	} catch (e) { return true; }
}

export function installRespondOverride() {
	try {
		const proto = lib.element && lib.element.Player && lib.element.Player.prototype;
		if (!proto) return;
		if (proto[ORIG_KEY]) return;

		const orig = proto.chooseToRespond;
		if (typeof orig !== 'function') return;
		proto[ORIG_KEY] = orig;

		proto.chooseToRespond = function (...args) {
			const player = this;
			const ev = _status.event;

			if (!_shouldOverride(player, ev)) {
				return orig.apply(this, args);
			}

			try { ev[SENTINEL] = true; } catch (e) {}

			const originalFilter = ev.filterCard;
			ev.filterCard = function (card, p, e) {
				try {
					if (typeof originalFilter === 'function' && !originalFilter(card, p, e)) {
						return false;
					}
					const should = _shouldRespond(p, card, e);
					/* 统计打点 */
					try {
						if (!_status.djsc_overrideStats) {
							_status.djsc_overrideStats = { use: {}, respond: {}, discard: {}, compare: {} };
						}
						const b = _status.djsc_overrideStats.respond;
						const key = should ? 'allow' : 'block';
						b[key] = (b[key] || 0) + 1;
					} catch (e2) {}
					return should;
				} catch (err) { return false; }
			};

			let result;
			try {
				result = orig.apply(this, args);
			} catch (eCall) {
				try { ev.filterCard = originalFilter; } catch (e) {}
				try { delete ev[SENTINEL]; } catch (e) {}
				_markDegraded(player);
				trip('respond', '原生 chooseToRespond 异常：' + eCall.message, 'fatal');
				try { return orig.apply(this, args); } catch (e2) { return null; }
			}

			/* ★ 修复：直接返回原生结果，不要包装成 Promise
			 * 原生 chooseToRespond 返回的是 GameEvent 对象（有 .set() 方法）
			 * 包装成 Promise 会导致下游 next.set() 报错
			 */
			return result;
		};

		log.info('override', 'chooseToRespond 接管层已安装');
	} catch (e) {
		try { console.error('[决策积分] installRespondOverride 失败：', e); } catch (e2) {}
	}
}

export function uninstallRespondOverride() {
	try {
		const proto = lib.element && lib.element.Player && lib.element.Player.prototype;
		if (!proto || !proto[ORIG_KEY]) return;
		proto.chooseToRespond = proto[ORIG_KEY];
		delete proto[ORIG_KEY];
		DEGRADED.clear();
		log.info('override', 'chooseToRespond 接管层已卸载');
	} catch (e) {}
}
