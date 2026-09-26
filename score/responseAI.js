/*
 * ============================================
 * // 作者：飛昇原創
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 响应/弃牌 AI 增强 =================
 * 用官方标签（skillTagFilter / ai.effect）影响：
 *   - 闪：关键时刻才出（防酒杀、保关键回合、防连弩）
 *   - 杀：响应南蛮/决斗/借刀时保留（避免打空）
 *   - 桃：留到真正需要（算清存活回合）
 *   - 酒：濒死时当桃用自救
 *   - 无懈：只解关键锦囊（乐/兵/南蛮/万箭/绝境判定）
 *   - 借刀杀人：目标是队友时按武器价值权衡拒绝
 *   - 决斗：识别对手点数，若追不上则放弃跟牌保杀
 * 完全不接管 chooseToRespond / chooseToDiscard 流程。
 */
import { lib, game, get, _status } from '../../../noname.js';
import { cfg } from './util.js';
import { log } from './logger.js';
import { onPlayerSkillInjected } from './util.js';

const SKILL_ID = '_djsc_responseAI';
let _installed = false;

/* ================= 闪 ================= */
/* 判断：这张闪是否值得保留 */
function _shouldKeepShan(player, card) {
	try {
		/* 濒死区：血量越低，闪越宝贵，保留闪应对下一张杀 */
		if (player.hp <= 2) return true;

		const enemies = (game.players || []).filter(function (p) {
			return p && p.alive !== false && p !== player && get.attitude(player, p) < 0;
		});
		if (!enemies.length) return false;

		/* 敌方有连弩：连杀威胁高，无条件保留闪 */
		try {
			for (const e of enemies) {
				if (e.getEquip && e.getEquip('zhuge')) return true;
			}
		} catch (e) {}

		/* 自身自救能力（桃/酒）——有后手时更敢硬吃 */
		let selfSave = 0;
		try {
			selfSave = player.countCards('hs', function (c) {
				const n = get.name(c);
				return n === 'tao' || n === 'jiu';
			});
		} catch (e) {}

		/* 敌方是否有酒（酒杀威胁） */
		let enemyHasJiu = false;
		try {
			enemyHasJiu = enemies.some(function (e) {
				return e.countCards && e.countCards('hs', 'jiu') > 0;
			});
		} catch (e) {}

		const avgHand = enemies.reduce(function (s, e) {
			return s + (e.countCards ? e.countCards('h') : 0);
		}, 0) / Math.max(1, enemies.length);

		/* hp=3 细分 */
		if (player.hp === 3) {
			if (enemyHasJiu && selfSave === 0) return true;
			if (avgHand >= 2) return true;
			return false;
		}
		/* hp=4 细分 */
		if (player.hp === 4) {
			if (enemyHasJiu && selfSave === 0) return true;
			return false;
		}
		return false;
	} catch (e) { return false; }
}

/* ================= 杀 ================= */
/* 判断：这张杀是否值得保留 */
function _shouldKeepSha(player, arg) {
	try {
		if (player.hp <= 1) return false;

		const shaInHand = player.countCards('hs', 'sha');
		if (shaInHand >= 3) return false;

		let enemyHasZhuge = false;
		try {
			const enemies = (game.players || []).filter(function (p) {
				return p && p.alive !== false && p !== player && get.attitude(player, p) < 0;
			});
			enemyHasZhuge = enemies.some(function (e) {
				return e.getEquip && e.getEquip('zhuge');
			});
		} catch (e) {}

		let needSha = false;
		try {
			needSha = player.hasSkillTag('shaRequired') ||
				player.hasSkill('wusheng') ||
				player.hasSkill('paoxiao') ||
				player.hasSkill('longdan') ||
				player.hasSkill('liegong');
		} catch (e) {}

		if (shaInHand === 1) {
			if (player.hp >= 3 && (enemyHasZhuge || needSha)) return true;
			if (player.hp >= 4) return true;
			return false;
		}
		if (shaInHand === 2) {
			if (enemyHasZhuge && needSha && player.hp >= 3) return true;
			if (enemyHasZhuge && player.hp >= 4) return true;
			return false;
		}
		return false;
	} catch (e) { return false; }
}

/* ================= 桃 ================= */
function _shouldSaveTao(player, target) {
	try {
		if (!target) return false;
		if ((target.hp || 0) <= 0) return false;
		if ((target.hp || 0) >= (target.maxHp || 1)) return false;
		if (target === player && player.hp > 1) return true;
		if (target !== player && get.attitude(player, target) > 0 && target.hp > 1) return true;
		if (get.attitude(player, target) < 0) return false;
		return false;
	} catch (e) { return false; }
}

/* ================= 酒（濒死自救） ================= */
function _shouldJiuRescue(player, target) {
	try {
		if (player !== target) return false;
		const dying = _status.event && _status.event.dying;
		if (dying !== player) return false;
		if ((player.hp || 0) > 0) return false;

		const taoCount = player.countCards('hs', 'tao');
		if (taoCount > 0) return false;

		const jiuCount = player.countCards('hs', 'jiu');
		if (jiuCount <= 0) return false;

		if (player.hp + 1 <= 0) return false;

		return true;
	} catch (e) { return false; }
}

/* ================= 无懈可击 ================= */
const CRITICAL_TRICKS = ['lebu', 'bingliang', 'nanman', 'wanjian', 'juedou', 'huogong', 'shandian'];
function _shouldWuxie(player, target, card) {
	try {
		if (!card) return true;
		const id = get.name(card, player);
		if (CRITICAL_TRICKS.indexOf(id) >= 0) return true;
		if ((id === 'lebu' || id === 'bingliang') && target === player) return true;
		if ((id === 'lebu' || id === 'bingliang') && target && get.attitude(player, target) > 0) return true;
		const wuxieCount = player.countCards ? player.countCards('h', function (c) {
			return get.name(c) === 'wuxie';
		}) : 0;
		if (wuxieCount >= 2) return true;
		return false;
	} catch (e) { return true; }
}

/* ================= 借刀杀人 ================= */
/* 从事件链上溯实际目标 */
function _jiedaoTarget() {
	try {
		const ev = _status.event;
		if (!ev) return null;
		if (ev.name === 'jiedao' && ev.targets && ev.targets.length) return ev.targets[0];
		if (ev.getParent) {
			let p = ev;
			for (let i = 0; i < 6; i++) {
				p = p.getParent && p.getParent();
				if (!p) break;
				if (p.name === 'jiedao' && p.targets && p.targets.length) return p.targets[0];
			}
		}
		if (ev._jiedao_target) return ev._jiedao_target;
	} catch (e) {}
	return null;
}

/* 判断是否该拒绝借刀 */
function _shouldRefuseJiedao(player) {
	try {
		const target = _jiedaoTarget();
		if (!target) return false;

		const att = get.attitude(player, target);

		if (att > 0) {
			if ((target.hp || 0) <= 1) return true;

			let weaponValue = 0;
			let weaponWeight = 1.0;
			try {
				const weapons = player.getCards('e').filter(function (w) {
					try {
						const subs = get.subtypes(w);
						return subs && subs.indexOf('equip1') >= 0;
					} catch (e) { return false; }
				});
				weapons.forEach(function (w) {
					let v = 0;
					try { v = get.equipValue(w, player) || get.value(w, player) || 0; } catch (e) {}
					if (v > weaponValue) {
						weaponValue = v;
						try {
							const nm = get.name(w) || '';
							if (nm === 'zhuge') weaponWeight = 1.8;
							else if (nm === 'qinglong') weaponWeight = 1.4;
							else if (nm === 'qilin') weaponWeight = 1.3;
							else if (nm === 'qinggang') weaponWeight = 1.3;
							else weaponWeight = 1.0;
						} catch (e) {}
					}
				});
			} catch (e) {}

			const hpAfterHit = Math.max(1, (target.hp || 0) - 1);
			const hpRatio = hpAfterHit / Math.max(1, target.maxHp || 4);
			const urgency = hpRatio <= 0.25 ? 2.0 : (hpRatio <= 0.5 ? 1.4 : 1.0);
			const allyLoss = 2 * Math.abs(att) * urgency;

			if (weaponValue * weaponWeight > allyLoss) return false;
			return true;
		}

		if (Math.abs(att) < 1 && (target.hp || 0) <= 1) return true;
		return false;
	} catch (e) { return false; }
}

/* ================= 决斗 ================= */
/* 读取对手已打出的最后一张杀点数 */
function _duelOpponentNumber() {
	try {
		const ev = _status.event;
		if (!ev) return null;
		let p = ev;
		for (let i = 0; i < 6; i++) {
			if (!p || typeof p.getParent !== 'function') break;
			p = p.getParent();
			if (!p) break;
			if (p.name === 'juedou') {
				const list = p.juedou || p._juedouCards || p.responded || p.cards;
				if (Array.isArray(list) && list.length) {
					const last = list[list.length - 1];
					const n = last && (last.number || (get && get.number ? get.number(last) : null));
					if (typeof n === 'number' && n > 0) return n;
				}
				if (p._lastJuedouCard) {
					const n = p._lastJuedouCard.number || get.number(p._lastJuedouCard);
					if (typeof n === 'number') return n;
				}
				return null;
			}
		}
	} catch (e) {}
	return null;
}

/* 决斗跟牌判断：true = 放弃，false = 继续跟 */
function _shouldFoldInDuel(player) {
	try {
		const oppNum = _duelOpponentNumber();
		if (oppNum === null) return false;

		const myShas = player.getCards('hs', 'sha');
		if (!myShas.length) return false;

		let myMax = 0;
		myShas.forEach(function (c) {
			const n = c.number || get.number(c);
			if (typeof n === 'number' && n > myMax) myMax = n;
		});

		if (myMax <= oppNum) return true;

		if (myShas.length === 1 && (player.hp || 0) >= 3) {
			const gap = myMax - oppNum;
			if (gap <= 2) return true;
		}
		return false;
	} catch (e) { return false; }
}

/* ================= 响应场景辅助 ================= */
function _isRespondingToSha() {
	try {
		const ev = _status.event;
		if (!ev) return false;
		if (ev.name === 'chooseToRespond') return true;
		if (ev.getParent) {
			const p = ev.getParent();
			if (p && p.name === 'chooseToRespond') return true;
		}
		if (ev.name === 'nanman' || ev.name === 'juedou' || ev.name === 'jiedao') return true;
		if (_jiedaoTarget()) return true;
	} catch (e) {}
	return false;
}

/* ================= 备用响应逻辑（未接入流程） ================= */
function _shouldRespond(player, card, event) {
	try {
		const id = get.name(card, player);
		if (id === 'shan') return !_shouldKeepShan(player, card);
		if (id === 'tao') {
			const dying = _status.event && _status.event.dying;
			return !_shouldSaveTao(player, dying);
		}
		if (id === 'jiu') {
			const dying = _status.event && _status.event.dying;
			if (dying === player && (player.hp || 0) <= 0) {
				return _shouldJiuRescue(player, player);
			}
			return false;
		}
		if (id === 'wuxie') return !_shouldWuxie(player, event);
		return true;
	} catch (e) { return true; }
}

/* ================= 安装 ================= */
export function installResponseAI() {
	if (_installed || lib.skill[SKILL_ID]) return;
	try {
		lib.skill[SKILL_ID] = {
			silent: true,
			charlotte: true,
			superCharlotte: true,
			unique: true,
			temp: true,           // ★ 玩家死亡时自动清理
			invisible: true,      // ★ 不在技能列表显示
			ai: {
				skillTagFilter(player, tag, arg) {
					try {
						if (cfg('responseAI', true) === false) return;
						if (tag === 'respondShan' || tag === 'shan') {
							const keep = _shouldKeepShan(player, arg);
							if (keep) {
								try {
									_status.djsc_lastResponse = {
										kind: 'shan-keep', score: -3, ts: Date.now(),
										reason: '保留闪（HP=' + (player.hp || 0) + '）',
										hp: player.hp,
									};
								} catch (e) {}
								return false;
							}
						}
						if (tag === 'respondSha' || tag === 'sha') {
							/* 借刀场景优先判断 */
							if (_shouldRefuseJiedao(player)) {
								try {
									_status.djsc_lastResponse = {
										kind: 'jiedao-refuse', score: -4, ts: Date.now(),
										reason: '借刀目标是队友，拒绝',
									};
								} catch (e) {}
								return false;
							}
							/* 决斗场景：点数不够则放弃 */
							if (_shouldFoldInDuel(player)) {
								try {
									_status.djsc_lastResponse = {
										kind: 'duel-fold', score: -3, ts: Date.now(),
										reason: '决斗点数追不上，放弃',
									};
								} catch (e) {}
								return false;
							}
							/* 其它响应场景：杀保留判断 */
							if (_isRespondingToSha() && _shouldKeepSha(player, arg)) {
								try {
									_status.djsc_lastResponse = {
										kind: 'sha-keep', score: -3, ts: Date.now(),
										reason: '保留杀（手里 ' + player.countCards('hs', 'sha') + ' 张）',
									};
								} catch (e) {}
								return false;
							}
						}
					} catch (e) {}
				},
				effect: {
					player(card, player, target) {
						try {
							if (cfg('responseAI', true) === false) return;
							const id = get.name(card, player);
							if (id === 'tao' && _shouldSaveTao(player, target)) {
								try {
									_status.djsc_lastResponse = { kind: 'tao-save', score: -2, ts: Date.now(), reason: '保留桃' };
								} catch (e) {}
								return [1, -0.4];
							}
							if (id === 'wuxie' && !_shouldWuxie(player, target, card)) {
								try {
									_status.djsc_lastResponse = { kind: 'wuxie-save', score: -2, ts: Date.now(), reason: '保留无懈' };
								} catch (e) {}
								return [1, -0.5];
							}
							if (id === 'jiu' && _shouldJiuRescue(player, target)) {
								try {
									_status.djsc_lastResponse = { kind: 'jiu-rescue', score: 5, ts: Date.now(), reason: '濒死自救' };
								} catch (e) {}
								return [1, 1.0];
							}
						} catch (e) {}
					},
				},
			},
		};

		(game.players || []).forEach(function (p) {
			try {
				if (p && p !== game.me && !p.hasSkill(SKILL_ID)) p.addSkill(SKILL_ID);
			} catch (e) {}
		});
		_hookAddSkill();

		_installed = true;
		log.info('response', '响应/弃牌 AI 增强已安装');
	} catch (e) {
		try { console.error('[决策积分] installResponseAI 失败：', e); } catch (e2) {}
	}
}

/* 使用共享的 addSkill 监听器（第 38 步） */
let _unhookAddSkill = null;
function _hookAddSkill() {
	if (_unhookAddSkill) return;
	try {
		_unhookAddSkill = onPlayerSkillInjected(function (player) {
			try {
				if (player !== game.me && !player.hasSkill(SKILL_ID) && lib.skill[SKILL_ID]) {
					lib.element.Player.prototype.addSkill.call(player, SKILL_ID);
				}
			} catch (e) {}
		});
	} catch (e) {}
}

export function uninstallResponseAI() {
	try {
		try { delete lib.skill[SKILL_ID]; } catch (e) {}
		(game.players || []).forEach(function (p) {
			try { p.removeSkill(SKILL_ID); } catch (e) {}
		});
		if (_unhookAddSkill) {
			try { _unhookAddSkill(); } catch (e) {}
			_unhookAddSkill = null;
		}
		_installed = false;
	} catch (e) {}
}
