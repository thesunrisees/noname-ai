/*
 * ============================================
 * // 作者：飛昇原創
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 接管 chooseToCompare =================
 * 拼点时按赢率选牌，而非最大点数。
 * 降级策略与 use.js 相同。
 */
import { lib, game, get, _status } from '../../../../noname.js';
import { cfg } from '../util.js';
import { log } from '../logger.js';
import { trip, isTripped } from './circuit.js';

const ORIG_KEY = '__djsc_orig_chooseToCompare';
const SENTINEL = '__djsc_overridden_compare';
const DEGRADE_WINDOW = 5000;

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
		if (isTripped('compare')) return false;
		if (_isDegraded(player)) return false;
		if (event[SENTINEL]) return false;
		return true;
	} catch (e) { return false; }
}

function _compareValue(card, player, event) {
	try {
		const num = card && (card.number || get.number(card));
		if (typeof num !== 'number') return 0;
		let targetHandSize = 2;
		try {
			const targets = (event && event.targets) || [];
			if (targets.length) {
				targetHandSize = targets[0].countCards ? targets[0].countCards('h') : 2;
			}
		} catch (e) {}
		const expected = 7 + Math.min(3, (targetHandSize - 2) * 0.5);
		const winChance = num >= expected ? 1 : (num / expected);
		const hpMul = player.hp <= 2 ? 2 : (player.hp <= 3 ? 1.3 : 1);
		return winChance * hpMul * 10;
	} catch (e) { return 0; }
}

export function installCompareOverride() {
	try {
		const proto = lib.element && lib.element.Player && lib.element.Player.prototype;
		if (!proto) return;
		if (proto[ORIG_KEY]) return;

		const orig = proto.chooseToCompare;
		if (typeof orig !== 'function') return;
		proto[ORIG_KEY] = orig;

		proto.chooseToCompare = function (...args) {
			const player = this;
			const ev = _status.event;

			if (!_shouldOverride(player, ev)) {
				return orig.apply(this, args);
			}

			try { ev[SENTINEL] = true; } catch (e) {}

			const originalAi = ev.ai;
			try {
				if (!ev.ai) ev.ai = {};
				ev.ai.check = function (card) {
					try { return _compareValue(card, player, ev); } catch (e) { return 0; }
				};
			} catch (e) {}

			let result;
			try {
				result = orig.apply(this, args);
			} catch (eCall) {
				try { ev.ai = originalAi; } catch (e) {}
				try { delete ev[SENTINEL]; } catch (e) {}
				_markDegraded(player);
				trip('compare', '原生 chooseToCompare 异常：' + eCall.message, 'fatal');
				try { return orig.apply(this, args); } catch (e2) { return null; }
			}

			/* ★ 修复：直接返回原生结果，不要包装成 Promise
			 * 原生 chooseToCompare 返回的是 GameEvent 对象（有 .set() 方法）
			 * 包装成 Promise 会导致下游 next.set() 报错
			 */
			return result;
		};

		log.info('override', 'chooseToCompare 接管层已安装');
	} catch (e) {
		try { console.error('[决策积分] installCompareOverride 失败：', e); } catch (e2) {}
	}
}

export function uninstallCompareOverride() {
	try {
		const proto = lib.element && lib.element.Player && lib.element.Player.prototype;
		if (!proto || !proto[ORIG_KEY]) return;
		proto.chooseToCompare = proto[ORIG_KEY];
		delete proto[ORIG_KEY];
		DEGRADED.clear();
		log.info('override', 'chooseToCompare 接管层已卸载');
	} catch (e) {}
}
