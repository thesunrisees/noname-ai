/*
 * ============================================
 * // 著者: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 原生 AI 接管层 =================
 * 策略：软接管（不硬接管），只用无名杀官方 AI 接口：
 *   · mod.aiOrder   → 出牌优先级修正
 *   · mod.aiValue   → 卡牌价值修正
 *   · ai.effect      → 目标选择修正
 *   · ai.useful      → 是否值得用修正
 * 把 bestAction 的结论翻译成原生 AI 能理解的分数修正。
 * 不破坏响应/弃牌/拼点 AI，只做加法修正。
 */
import { lib, game, get, _status } from '../../../noname.js';
import { bestAction } from './engine.js';
import { cfg } from './util.js';

const SKILL_ID = '_djsc_engine';
const CACHE = new Map();          // player → { key, value }
let _installed = false;
let _protoHooked = false;

/* ================= ★ 软接管打点（决策级去重） ================= */
const _softCounted = new Map();  // player → round标记

function _softStat(player) {
	try {
		if (!player) return;
		const round = (_status && _status.roundNumber) || 0;
		const name = player.name1 || player.name || '?';
		const key = name + '|' + round;
		if (_softCounted.get(player) === key) return;  // 本回合已计
		_softCounted.set(player, key);
		if (!_status.djsc_overrideStats) {
			_status.djsc_overrideStats = { use: {}, respond: {}, discard: {}, compare: {}, soft: {} };
		}
		if (!_status.djsc_overrideStats.soft) _status.djsc_overrideStats.soft = {};
		const b = _status.djsc_overrideStats.soft;
		b.hit = (b.hit || 0) + 1;
	} catch (e) {}
}

/* ---------- 缓存：同一玩家同一回合只算一次 bestAction ---------- */
function _playerKey(player) {
	try {
		const name = player.name1 || player.name || player.name2 || '?';
		const round = (_status && _status.roundNumber) || 0;
		const isPhase = (_status && _status.currentPhase) === player ? 'P' : 'O';
		return name + '|' + round + '|' + isPhase;
	} catch (e) { return null; }
}

function _getBA(player) {
	try {
		if (!player || player === game.me) return null;
		try { if (player.isOnline2 && player.isOnline2()) return null; } catch (e) {}
		if (cfg('decisionScore', true) === false) return null;

		const k = _playerKey(player);
		if (!k) return null;
		const hit = CACHE.get(player);
		if (hit && hit.key === k) return hit.value;

		const ba = bestAction();
		CACHE.set(player, { key: k, value: ba });

		/* ★ 决策日志去重：同一玩家同一回合只记录一次 */
		try {
			const logKey = '__logged_' + k;
			if (!CACHE.has(logKey)) {
				CACHE.set(logKey, true);
				if (typeof window !== 'undefined' && window.__DJSC && typeof window.__DJSC.logBestAction === 'function') {
					window.__DJSC.logBestAction(player, ba);
				}
			}
		} catch (eLog) {}

		return ba;
	} catch (e) { return null; }
}

function _clearCache() {
	try {
		CACHE.clear();
		_softCounted.clear();
		/* 清空 __logged_ 标记 */
		if (typeof CACHE.forEach === 'function') {
			const toDelete = [];
			CACHE.forEach(function (v, k) {
				if (typeof k === 'string' && k.indexOf('__logged_') === 0) toDelete.push(k);
			});
			toDelete.forEach(function (k) { CACHE.delete(k); });
		}
	} catch (e) {}
}

/* ---------- 牌名匹配：兼容 viewAs（武圣/龙胆/奇才） ---------- */
function _cardMatches(card, player, rule) {
	try {
		if (!card || !rule) return false;
		if (get.name(card, player) === rule) return true;
		try {
			const info = get.info(card);
			if (info && info.viewAs) {
				const va = info.viewAs;
				const nm = (typeof va === 'string') ? va : (va && va.name);
				if (nm === rule) return true;
			}
		} catch (e) {}
		return false;
	} catch (e) { return false; }
}

/* ---------- 安装 ---------- */
export function installAIOverride() {
	if (_installed || lib.skill[SKILL_ID]) return;
	try {
		lib.skill[SKILL_ID] = {
			silent: true,
			charlotte: true,
			superCharlotte: true,
			unique: true,
			temp: true,           // ★ 玩家死亡时自动清理
			invisible: true,      // ★ 不在技能列表显示
			mod: {
				/* ★ ① 出牌优先级修正 */
				aiOrder(player, card, num) {
					try {
						const ba = _getBA(player);
						if (!ba || !ba.rule) return num;
						if (ba.action === 'C' && ba.rule === 'end') {
							return Math.min(num, 0.01);
						}
						if (_cardMatches(card, player, ba.rule)) {
							_softStat(player);  // ★ 软接管命中打点
							return 100 + num;
						}
						return num;
					} catch (e) { return num; }
				},

				/* ★ ② 卡牌价值修正（软接管：只加不减） */
				aiValue(player, card, num) {
					try {
						const ba = _getBA(player);
						if (!ba) return num;

						/* 如果是我们推荐的牌 → 加价值 */
						if (ba.rule && _cardMatches(card, player, ba.rule)) {
							return num + 2.0;
						}

						/* 如果是打队友的牌 → 减价值 */
						const cardId = get.name(card, player);
						const isAttack = ['sha', 'juedou', 'huogong', 'nanman', 'wanjian'].indexOf(cardId) >= 0;
						if (isAttack && ba.avoidAlly) {
							return num - 1.5;
						}

						return num;
					} catch (e) { return num; }
				},
			},
			ai: {
				/* ★ ③ 目标选择修正 */
				effect: {
					player(card, player, target) {
						try {
							if (get.itemtype(target) !== 'player') return;
							const ba = _getBA(player);
							if (!ba) return;

							const tname = target.name || target.name1;
							const isAtk = get.tag(card, 'damage');
							const isDelay = (function () {
								const id = get.name(card, player);
								return id === 'lebu' || id === 'bingliang';
							})();

							if (ba.target && tname === ba.target) {
								if (isAtk) return [1, 2.5];
								if (isDelay) return [1, 2.0];
								return [1, 1.0];
							}

							if (get.attitude(player, target) > 0 && isAtk) {
								/* 濒死队友：灭队级抑制 */
								if ((target.hp || 0) <= 1) return [1, -5.0];
								return [1, -3.0];
							}
						} catch (e) { return; }
					},
				},

				/* ★ ④ 是否值得用修正 */
				useful(player, event) {
					try {
						const ba = _getBA(player);
						if (!ba) return;

						/* 如果是我们推荐的动作 → 提高有用性 */
						if (ba.rule && event && event.card && _cardMatches(event.card, player, ba.rule)) {
							return 1.5;
						}

						return;
					} catch (e) { return; }
				},
			},
		};

		(game.players || []).forEach(function (p) {
			try {
				if (p && p !== game.me && !p.hasSkill(SKILL_ID)) p.addSkill(SKILL_ID);
			} catch (e) {}
		});

		_hookAddSkill();
		_hookRoundChange();

		_installed = true;
		try { if (game.log) game.log('决策积分引擎：原生 AI 软接管层已安装（aiOrder + aiValue + effect + useful）'); } catch (e) {}
	} catch (e) {
		try { console.error('[决策积分引擎] installAIOverride 失败：', e); } catch (e2) {}
	}
}

function _hookAddSkill() {
	if (_protoHooked) return;
	try {
		const proto = lib.element.Player.prototype;
		const orig = proto.addSkill;
		if (typeof orig !== 'function') return;
		proto.addSkill = function () {
			const r = orig.apply(this, arguments);
			try {
				if (this !== game.me && !this.hasSkill(SKILL_ID) && lib.skill[SKILL_ID]) {
					orig.call(this, SKILL_ID);
				}
			} catch (e) {}
			return r;
		};
		_protoHooked = true;

		/* ★ 修复左慈死亡 temp 报错：过滤掉 lib.skill[sid] 为 undefined 的残留技能 */
		const origGetSkills = proto.getSkills;
		if (typeof origGetSkills === 'function') {
			proto.getSkills = function () {
				const skills = origGetSkills.apply(this, arguments);
				try {
					if (Array.isArray(skills) && skills.length > 0) {
						return skills.filter(function (sid) {
							return lib.skill[sid] !== undefined;
						});
					}
				} catch (e) {}
				return skills;
			};
		}
	} catch (e) {}
}

function _hookRoundChange() {
	try {
		if (game.__djsc_check_hooked) return;
		game.__djsc_check_hooked = true;
		const orig = game.check;
		if (typeof orig !== 'function') return;
		game.check = function () {
			try { _clearCache(); } catch (e) {}
			return orig.apply(this, arguments);
		};
	} catch (e) {}
}

/* ---------- 卸载 ---------- */
export function uninstallAIOverride() {
	try {
		_clearCache();
		try { delete lib.skill[SKILL_ID]; } catch (e) {}
		(game.players || []).forEach(function (p) {
			try { p.removeSkill(SKILL_ID); } catch (e) {}
		});
		_installed = false;
	} catch (e) {}
}

/* ---------- 挂载到全局 ---------- */
if (typeof window !== 'undefined') {
	window.__DJSC = window.__DJSC || {};
	window.__DJSC.aiOverride = {
		install: installAIOverride,
		uninstall: uninstallAIOverride,
		installed: function () { return _installed; },
	};
}
