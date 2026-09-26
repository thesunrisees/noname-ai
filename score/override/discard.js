/*
 * ============================================
 * // Wydawca: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 接管 chooseToDiscard =================
 * 弃牌时按引擎的价值排序，优先弃低价值牌。
 * 降级策略与 use.js 相同。
 */
import { lib, game, get, _status } from '../../../../noname.js';
import { cfg } from '../util.js';
// 作者：飞升原创 | 許可：GPL-3.0
import { log } from '../logger.js';
import { cardValueOf } from '../threat.js';
import { trip, isTripped } from './circuit.js';

const ORIG_KEY = '__djsc_orig_chooseToDiscard';
const SENTINEL = '__djsc_overridden_discard';
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
		if (isTripped('discard')) return false;
		if (_isDegraded(player)) return false;
		if (event[SENTINEL]) return false;
		return true;
	} catch (e) { return false; }
}

/* ★ 修复：ai.check 返回值带关键牌保护 */
/* ★ 弃牌 AI 关键牌保护（增强版） */
function _buildCheck(player) {
	return function (card) {
		try {
			const name = get.name(card, player);
			const v = cardValueOf(card, player);
			let mul = 1.0;

			/* ===== 基础保护：关键牌乘数提升 ===== */
			if (name === 'tao') {
				/* 桃：血量越低越宝贵 */
				const hpRatio = (player.hp || 0) / Math.max(1, player.maxHp || 1);
				if (hpRatio < 0.3) mul = 4.0;
				else if (hpRatio < 0.5) mul = 2.8;
				else if (hpRatio < 0.7) mul = 2.0;
				else mul = 1.6;
			} else if (name === 'wuxie') {
				/* 无懈：手里唯一时极宝贵，多张时可弃 */
				const wxCount = player.countCards('hs', 'wuxie');
				if (wxCount === 1) mul = 3.0;
				else if (wxCount === 2) mul = 1.8;
				else mul = 1.2;
			} else if (name === 'shan') {
				/* 闪：血量低 + 面对连弩 → 极高保护 */
				const hp = player.hp || 0;
				let hasEnemyZhuge = false;
				try {
					for (const p of (game.players || [])) {
						if (!p || p === player || p.alive === false) continue;
						if (get.attitude(player, p) >= 0) continue;
						if (p.getEquip && p.getEquip('zhuge')) { hasEnemyZhuge = true; break; }
					}
				} catch (e) {}
				if (hp <= 1) mul = 4.0;
				else if (hp <= 2) mul = 2.8;
				else if (hasEnemyZhuge) mul = 2.2;
				else if (hp <= 3) mul = 1.6;
				else mul = 1.2;
			} else if (name === 'sha') {
				/* 杀：有连弩/咆哮/唯一杀时保护 */
				const shaCount = player.countCards('hs', 'sha');
				const hasZhuge = !!(player.getEquip && player.getEquip('zhuge'));
				const hasPaoxiao = player.hasSkill && player.hasSkill('paoxiao');
				if (shaCount === 1 && (hasZhuge || hasPaoxiao)) mul = 2.2;
				else if (shaCount === 1) mul = 1.5;
				else if (shaCount === 2) mul = 1.2;
				else mul = 1.0;
			} else if (name === 'jiu') {
				/* 酒：配合杀时保护 */
				const hasSha = player.countCards('hs', 'sha') > 0;
				if (hasSha && (player.getEquip && player.getEquip('zhuge'))) mul = 1.8;
				else if (hasSha) mul = 1.3;
				else mul = 1.0;
			}

			/* ===== 装备保护 ===== */
			try {
				const subs = get.subtypes(card);
				if (subs && subs.length) {
					/* 防具、坐骑：已装备替代品不足时保护 */
					if (subs.indexOf('equip2') >= 0) {
						/* 防具：如果是唯一防具 → 保护 */
						const hasOtherArmor = player.getCards('e').some(function (ec) {
							try { return get.subtypes(ec).indexOf('equip2') >= 0 && ec !== card; } catch (e) { return false; }
						});
						if (!hasOtherArmor) mul = Math.max(mul, 1.4);
					}
					if (subs.indexOf('equip1') >= 0 && name === 'zhuge') {
						/* 连弩：手里杀 >= 2 时极宝贵 */
						const shaCount = player.countCards('hs', 'sha');
						if (shaCount >= 2) mul = Math.max(mul, 2.0);
					}
				}
			} catch (e) {}

			/* ===== 已明知的牌：被敌方已知 → 相对不值钱 → 优先弃 ===== */
			try {
				let isKnown = false;
				for (const p of (game.players || [])) {
					if (!p || p === player || p.alive === false) continue;
					if (get.attitude(player, p) >= 0) continue;
					try {
						const known = p.getKnownCards ? p.getKnownCards(player) : [];
						if (known.indexOf(card) >= 0) { isKnown = true; break; }
					} catch (e) {}
				}
				/* 己方已知牌 → 减 30% 保护（可弃） */
				if (isKnown) mul *= 0.7;
			} catch (e) {}

			/* ===== 濒死保护：血量 <= 1 时所有防御牌翻倍 ===== */
			if ((player.hp || 0) <= 1) {
				if (name === 'shan' || name === 'tao' || name === 'wuxie' || name === 'jiu') {
					mul *= 1.5;
				}
			}

			/* 统计打点 */
			try {
				if (!_status.djsc_overrideStats) {
					_status.djsc_overrideStats = { use: {}, respond: {}, discard: {}, compare: {}, soft: {} };
				}
				const b = _status.djsc_overrideStats.discard;
				b.check = (b.check || 0) + 1;
			} catch (e2) {}

			return -v * mul;
		} catch (e) { return 0; }
	};
}

export function installDiscardOverride() {
	try {
		const proto = lib.element && lib.element.Player && lib.element.Player.prototype;
		if (!proto) return;
		if (proto[ORIG_KEY]) return;

		const orig = proto.chooseToDiscard;
		if (typeof orig !== 'function') return;
		proto[ORIG_KEY] = orig;

		proto.chooseToDiscard = function (...args) {
			const player = this;
			const ev = _status.event;

			if (!_shouldOverride(player, ev)) {
				return orig.apply(this, args);
			}

			try { ev[SENTINEL] = true; } catch (e) {}

			const originalCheck = ev.ai && ev.ai.check;
			try {
				if (!ev.ai) ev.ai = {};
				ev.ai.check = _buildCheck(player);
			} catch (e) {}

			let result;
			try {
				result = orig.apply(this, args);
			} catch (eCall) {
				try { if (ev.ai) ev.ai.check = originalCheck; } catch (e) {}
				try { delete ev[SENTINEL]; } catch (e) {}
				_markDegraded(player);
				trip('discard', '原生 chooseToDiscard 异常：' + eCall.message, 'fatal');
				try { return orig.apply(this, args); } catch (e2) { return null; }
			}

			/* ★ 修复：直接返回原生结果，不要包装成 Promise
			 * 原生 chooseToDiscard 返回的是 GameEvent 对象（有 .set() 方法）
			 * 包装成 Promise 会导致下游 next.set() 报错
			 */
			return result;
		};

		log.info('override', 'chooseToDiscard 接管层已安装');
	} catch (e) {
		try { console.error('[决策积分] installDiscardOverride 失败：', e); } catch (e2) {}
	}
}

export function uninstallDiscardOverride() {
	try {
		const proto = lib.element && lib.element.Player && lib.element.Player.prototype;
		if (!proto || !proto[ORIG_KEY]) return;
		proto.chooseToDiscard = proto[ORIG_KEY];
		delete proto[ORIG_KEY];
		DEGRADED.clear();
		log.info('override', 'chooseToDiscard 接管层已卸载');
	} catch (e) {}
}
