/*
 * ============================================
 * // Author: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 拼点/选牌 AI 微调 =================
 * 目标：拼点时按「胜率 × 收益」选牌，而非单纯看点数。
 * 策略层：
 *   ① 对手手牌少 → 用中等点数（保大牌）
 *   ② 对手手牌多 → 用最大点数（对手大概率压过）
 *   ③ 牌本身价值高（桃/无懈/唯一杀）→ 避免用于拼点
// Autor: Feisheng Original | Lizenz: GPL-3.0
 *   ④ HP ≤ 1 → 用最大点数（保命优先）
 *   ⑤ 识别触发拼点的技能语义（想赢 / 想输 / 中性）
 *   ⑥ 识别主动方 / 被动方，被动方永远用大点数
 */
import { lib, game, get, _status } from '../../../noname.js';
import { cfg } from './util.js';
import { log } from './logger.js';
import { onPlayerSkillInjected } from './util.js';

const SKILL_ID = '_djsc_compareAI';
let _installed = false;

/* ---------- 判断当前是否处于拼点事件 ---------- */
function _isCompareEvent() {
	try {
		const ev = _status.event;
		if (!ev) return false;
		if (ev.name === 'chooseToCompare') return true;
		if (ev.getParent) {
			let p = ev;
			for (let i = 0; i < 4; i++) {
				p = p.getParent && p.getParent();
				if (!p) break;
				if (p.name === 'chooseToCompare') return true;
			}
		}
		return false;
	} catch (e) { return false; }
}

/* ---------- 从事件链上溯，识别触发拼点的技能 ---------- */
function _identifyCompareSkill() {
	try {
		const ev = _status.event;
		if (!ev) return null;
		let p = ev;
		for (let i = 0; i < 6; i++) {
			if (!p || typeof p.getParent !== 'function') break;
			p = p.getParent();
			if (!p) break;
			if (p.skill && typeof p.skill === 'string') {
				const s = p.skill.split(',')[0].trim();
				if (s && lib.skill && lib.skill[s]) return s;
			}
			if (p.name && lib.skill && lib.skill[p.name]) {
				if (p.name !== 'chooseToCompare' && p.name !== 'phaseUse') return p.name;
			}
		}
	} catch (e) {}
	return null;
}

/* ---------- 拼点技能语义表 ----------
 * +1 → 想赢（用大点数）
 * -1 → 想输（用小点数）
 * 缺省 → 中性，走通用策略
 */
const COMPARE_GOAL = {
	/* 想赢 */
	'tianyi':       1,   // 太史慈·天义
	'quhu':         1,   // 荀彧·驱虎
	'liegong':      1,   // 黄忠·烈弓
	'xianzhen':     1,   // 高顺·陷阵
	'mengjin':      1,   // 庞德·猛进
	'shuangxiong':  1,   // 颜良文丑·双雄
	'qiaoshui':     1,   // 简雍·巧说
	'pozhen':       1,
	'shebian':      1,
	/* 想输 */
	'zenghui':     -1,   // 谯周·谮毁
	'cuijian':     -1,
};

/* ---------- 判断当前玩家是否是拼点主动方 ---------- */
function _isInitiator(player) {
	try {
		const ev = _status.event;
		if (!ev) return true;
		if (ev.player && ev.player === player) return true;
		if (ev._trigger && ev._trigger.player === player) return true;
		/* 显式标记 */
		if (ev._djsc_initiator !== undefined) return ev._djsc_initiator === player;
		let p = ev;
		for (let i = 0; i < 6; i++) {
			if (!p || typeof p.getParent !== 'function') break;
			p = p.getParent();
			if (!p) break;
			if (p.player && p.player === player) return true;
			if (p._trigger && p._trigger.player === player) return true;
		}
	} catch (e) {}
	/* 无法判断时保守返回 true（按主动方处理） */
	return true;
}

/* ---------- 核心：拼点选牌评分 ----------
 * 返回值越高 → 越优先选该牌拼点
 */
function _compareScore(card, player, target) {
	try {
		const num = card && (card.number || get.number(card));
		if (typeof num !== 'number') return 0;

		/* ① 基础点数收益：大点数更优 */
		let bonus = (num - 7) * 0.1;

		/* ② 对手手牌数 */
		let oppHandCount = 3;
		try {
			if (target && target.countCards) {
				oppHandCount = target.countCards('h');
			} else if (target && target !== player && target !== card) {
				let sum = 0, cnt = 0;
				for (const p of (game.players || [])) {
					if (p && p !== player && p.alive !== false) {
						sum += p.countCards ? p.countCards('h') : 0;
						cnt++;
					}
				}
				oppHandCount = cnt > 0 ? sum / cnt : 3;
			}
		} catch (e) {}

		if (oppHandCount <= 2) {
			/* 对手手牌极少：获胜期望高，避免用大牌 */
			if (num >= 11) bonus -= 0.4;
			else if (num >= 9) bonus -= 0.15;
		} else if (oppHandCount >= 5) {
			/* 对手手牌极多：获胜期望低，必须用大牌 */
			if (num <= 6) bonus -= 0.6;
			else if (num <= 8) bonus -= 0.25;
			else if (num >= 11) bonus += 0.3;
		} else {
			/* 3~4 张：正常加权 */
			if (num >= 12) bonus += 0.2;
			if (num <= 4) bonus -= 0.2;
		}

		/* ③ 牌本身价值（拼点会弃牌，高价值牌应保留） */
		try {
			const name = get.name(card, player);
			const cardVal = get.value(card, player);
			if (typeof cardVal === 'number' && cardVal > 4) {
				bonus -= (cardVal - 4) * 0.15;
			}
			/* 特定保留牌：桃 / 无懈 */
			if (name === 'tao' || name === 'wuxie') {
				const sameCount = player.countCards('hs', name);
				if (sameCount <= 1) bonus -= 1.5;
				else bonus -= 0.3;
			}
			/* 唯一的杀：连弩/咆哮武将更珍贵 */
			if (name === 'sha') {
				const shaCount = player.countCards('hs', 'sha');
				if (shaCount === 1) {
					const hasZhuge = !!player.getEquip('zhuge');
					const hasPaoxiao = player.hasSkill && player.hasSkill('paoxiao');
					if (hasZhuge || hasPaoxiao) bonus -= 0.8;
					else bonus -= 0.3;
				}
			}
		} catch (e) {}

		/* ④ 血量压力：HP=1 时拼点结果决定生死 */
		try {
			if ((player.hp || 0) <= 1) {
				if (num >= 11) bonus += 0.5;
				else if (num <= 5) bonus -= 0.8;
			}
		} catch (e) {}

		/* ⑤ 技能语义：识别触发拼点的技能，按"想赢/想输"调整 */
		try {
			const sid = _identifyCompareSkill();
			const goal = sid && COMPARE_GOAL[sid];
			const isInit = _isInitiator(player);
			/* 主动方：按技能语义；被动方：始终用大点数（让对手输掉拼点） */
			const effectiveGoal = isInit ? (goal || 0) : 1;
			if (effectiveGoal === 1) {
				/* 想赢：强化大点数偏好 */
				if (num >= 10) bonus += 0.8;
				else if (num <= 6) bonus -= 0.5;
				else if (num >= 8) bonus += 0.3;
			} else if (effectiveGoal === -1) {
				/* 想输：反转偏好，故意选小点数 */
				if (num <= 6) bonus += 0.8;
				else if (num >= 10) bonus -= 0.5;
				else if (num <= 8) bonus += 0.3;
			}
		} catch (e) {}

		return bonus;
	} catch (e) { return 0; }
}

/* ---------- 安装 ---------- */
export function installCompareAI() {
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
				effect: {
					player(card, player, target) {
						try {
							if (cfg('compareAI', true) === false) return;
							if (!_isCompareEvent()) return;
							const bonus = _compareScore(card, player, target);
							try {
								const sid = _identifyCompareSkill();
								const isInit = _isInitiator(player);
								const goal = sid && COMPARE_GOAL[sid];
								const effectiveGoal = isInit ? (goal || 0) : 1;
								_status.djsc_lastCompare = {
									bonus: bonus,
									ts: Date.now(),
									reason: '技能' + (sid || '?') +
										'（' + (isInit ? '主动' : '被动') + '，' +
										(effectiveGoal === 1 ? '想赢' : effectiveGoal === -1 ? '想输' : '中性') +
										'，点' + (card.number || '?') + '）',
									skillId: sid,
									isInitiator: isInit,
									goal: effectiveGoal,
									cardNumber: card.number,
								};
							} catch (e) {}
							return [1, bonus];
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
		log.info('compare', '拼点/选牌 AI 已安装');
	} catch (e) {
		try { console.error('[决策积分] installCompareAI 失败：', e); } catch (e2) {}
	}
}

/* ---------- 使用共享的 addSkill 监听器（第 38 步） ---------- */
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

export function uninstallCompareAI() {
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
