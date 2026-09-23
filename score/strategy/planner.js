/* ================= 决策积分引擎 · 战术规划器 =================
 * 目标：从单步贪心升级到多步规划。
 * 能力：
 *   1. 残局解：检测 1-2 步秒杀窗口
 *   2. 连招规划：铁索+属性杀 / 顺+火攻 / 乐+杀 等组合
 *   3. 两回合展望：评估这一步"打开了什么后续"
 *   4. 超时熔断：200ms 内没算完 → 降级到单步
 */
import { lib, game, get, _status } from '../../../noname.js';
import { cfg } from '../core/util.js';
import { log } from '../core/logger.js';
import { isEnemyOf, probHasShan, seatPressure, threatOf } from './threat.js';

const PLAN_TIMEOUT = 350;
const LOOKAHEAD_DISCOUNT = 0.7;

function _handNames(me) {
	try {
		const set = new Set();
		me.getCards('h').forEach(function (c) {
			const n = get.name(c, me);
			if (n) set.add(n);
		});
		return set;
	} catch (e) { return new Set(); }
}

function _countCard(me, name) {
	try {
		let n = 0;
		me.getCards('h').forEach(function (c) {
			if (get.name(c, me) === name) n++;
		});
		return n;
	} catch (e) { return 0; }
}

function _hasNatureSha(me) {
	try {
		return me.getCards('h').some(function (c) {
			if (get.name(c, me) !== 'sha') return false;
			return game.hasNature && (game.hasNature(c, 'fire') || game.hasNature(c, 'thunder'));
		});
	} catch (e) { return false; }
}

function _findKillSequence(me, target) {
	try {
		if (!target || !target.isIn()) return null;
		const hp = target.hp || 0;
		if (hp <= 0) return null;
		if (hp > 3) return null;

		const hand = _handNames(me);
		const steps = [];
		let totalDmg = 0;

		if (hand.has('jiu') && hand.has('sha')) {
			steps.push({ id: 'jiu', dmg: 0, type: 'buff' });
			steps.push({ id: 'sha', dmg: 2, type: 'damage' });
			totalDmg += 2;
		} else if (hand.has('sha')) {
			steps.push({ id: 'sha', dmg: 1, type: 'damage' });
			totalDmg += 1;
		}

		if (hand.has('huogong') && totalDmg < hp) {
			const mySuits = new Set();
			me.getCards('h').forEach(function (c) {
				mySuits.add(get.suit(c));
			});
			let canBurn = false;
			try {
				const known = me.getKnownCards ? me.getKnownCards(target) : [];
				known.forEach(function (c) {
					if (mySuits.has(get.suit(c))) canBurn = true;
				});
			} catch (e) {}
			if (canBurn || totalDmg === 0) {
				steps.push({ id: 'huogong', dmg: 1, type: 'damage' });
				totalDmg += 1;
			}
		}

		if (hand.has('juedou') && totalDmg < hp) {
			const mySha = _countCard(me, 'sha');
			const tgtHand = target.countCards ? target.countCards('h') : 0;
			if (mySha >= 1 || tgtHand <= 1) {
				steps.push({ id: 'juedou', dmg: 1, type: 'damage' });
				totalDmg += 1;
			}
		}

		if (hand.has('nanman') && totalDmg < hp) {
			steps.push({ id: 'nanman', dmg: 1, type: 'damage' });
			totalDmg += 1;
		}
		if (hand.has('wanjian') && totalDmg < hp) {
			steps.push({ id: 'wanjian', dmg: 1, type: 'damage' });
			totalDmg += 1;
		}

		if (hand.has('zhujin') && totalDmg < hp) {
			steps.push({ id: 'zhujin', dmg: 1, type: 'damage' });
			totalDmg += 1;
		}

		if (totalDmg >= hp) {
			return {
				target: target,
				targetName: target.name || target.name1 || '?',
				steps: steps,
				totalDmg: totalDmg,
				killable: true,
				score: 100 + totalDmg * 10,
			};
		}
		return null;
	} catch (e) { return null; }
}

/* ★ 多步展望（3 步 + 分支预测） */
function _outlookScore(me, action, target) {
	try {
		if (!action || !action.id) return 0;
		const id = action.id;
		const hand = _handNames(me);
		let score = 0;

		/* ===== 第 1 步：当前牌的即时收益 ===== */
		if (id === 'lebu') {
			const seat = seatPressure(me);
			if (seat.nextEnemy === target) score += 3;
			else score += 1.5;
			if (hand.has('sha')) score += 1;
		}
		if (id === 'bingliang') {
			score += 1.5;
			if (hand.has('sha')) score += 0.5;
		}
		if (id === 'shunshou') {
			try {
				const es = target && target.getGainableCards ? target.getGainableCards(me, 'e').length : 0;
				const hs = target && target.getGainableCards ? target.getGainableCards(me, 'h').length : 0;
				if (es >= 2) score += 2.5;
				else if (hs >= 3) score += 2;
				else score += 1;
			} catch (e) { score += 1; }
		}
		if (id === 'guohe') {
			score += 1.5;
			if (hand.has('sha')) score += 0.8;
		}
		if (id === 'sha') {
			const hp = target && target.hp || 0;
			if (hp <= 1) score += 5;
			else if (hp <= 2) score += 2;
			else if (target && target.hp < target.maxHp) score += 1.5;
			else score += 0.8;
			if (_countCard(me, 'sha') >= 2) score += 1;
		}
		if (id === 'juedou') {
			const hp = target && target.hp || 0;
			if (hp <= 1) score += 4;
			else if (hp <= 2) score += 1.5;
			else score += 0.5;
			const mySha = _countCard(me, 'sha');
			if (mySha >= 2) score += 2;
			else if (mySha >= 1) score += 1;
			else score -= 1;
		}
		if (id === 'huogong') {
			const hp = target && target.hp || 0;
			if (hp <= 2) score += 2;
			else score += 0.8;
		}
		if (id === 'nanman' || id === 'wanjian') {
			let hitCount = 0;
			(game.players || []).forEach(function (p) {
				if (p === me || !p.isIn()) return;
				if (get.attitude(me, p) >= 0) return;
				const hasRespond = id === 'nanman'
					? (p.countCards ? p.countCards('hs', 'sha') > 0 : false)
					: (p.countCards ? p.countCards('hs', 'shan') > 0 : false);
				if (!hasRespond) hitCount++;
			});
			score += hitCount * 1.5;
		}
		if (id === 'tiesuo') {
			if (_hasNatureSha(me)) score += 3;
			if (hand.has('huogong')) score += 2;
			score += 1;
		}
		if (id === 'wuzhong') score += 1.5;
		if (id === 'taoyuan') {
			let allyDamaged = 0;
			(game.players || []).forEach(function (p) {
				if (p !== me && get.attitude(me, p) > 0 && p.isDamaged && p.isDamaged()) allyDamaged++;
			});
			score += allyDamaged * 1.5;
		}
		if (id === 'tao') {
			let dyingAlly = 0;
			(game.players || []).forEach(function (p) {
				if (p !== me && get.attitude(me, p) > 0 && (p.hp || 0) <= 0) dyingAlly++;
			});
			if (dyingAlly > 0) score += 5.0;
			else if ((me.hp || 0) <= 1) score += 2.0;
			else score += 0.5;
		}
		if (id === 'wuxie') score += 1.0;
		if (id === 'jiu') {
			if (hand.has('sha')) score += 2.5;
			else score += 0.5;
		}
		if (id === 'shandian') {
			const alive = (game.players || []).filter(function (p) { return p.alive !== false; }).length;
			if (alive <= 4) score += 2.0;
			else score += 0.5;
		}

		/* ===== 第 2 步：本次牌的「后续连招」展望 ===== */
		try {
			/* 拆牌类 → 下一步杀 加成 */
			if ((id === 'guohe' || id === 'shunshou') && hand.has('sha')) {
				score += 1.5;  /* 拆完能杀 */
			}
			/* 铁索 → 属性杀 / 火攻 加成 */
			if (id === 'tiesuo' && (_hasNatureSha(me) || hand.has('huogong'))) {
				score += 2.0;
			}
			/* 乐 → 后手杀 加成 */
			if (id === 'lebu' && hand.has('sha')) {
				score += 1.0;
			}
			/* 无中 → 后续收益未知，但可衔接任意连招 */
			if (id === 'wuzhong') {
				const followUpCount = ['sha', 'juedou', 'huogong', 'tao', 'wuxie'].filter(function (c) {
					return hand.has(c);
				}).length;
				score += followUpCount * 0.4;
			}
		} catch (e) {}

		/* ===== 第 3 步：敌方反应分支预测（粗略） ===== */
		try {
			/* 攻击目标 → 预估敌方「还有几张闪/桃」 */
			if (target && (id === 'sha' || id === 'juedou' || id === 'huogong')) {
				const tgtHand = target.countCards ? target.countCards('h') : 0;
				const tgtHp = target.hp || 0;
				/* 手牌少 + 血少 → 敌方「翻盘概率低」→ 攻击收益高 */
				if (tgtHand <= 2 && tgtHp <= 2) score += 1.5;
				/* 手牌多 → 敌方可能反击 → 收益打折 */
				if (tgtHand >= 5) score -= 0.5;
				/* 敌方有反馈/奸雄类卖血技 → 攻击价值下降 */
				try {
					if (target.hasSkill && (
						target.hasSkill('fankui') ||
						target.hasSkill('jianxiong') ||
						target.hasSkill('yiji') ||
						target.hasSkill('ganglie')
					)) {
						score -= 1.0;
					}
				} catch (e) {}
			}

			/* AOE → 统计敌方未被消耗的闪/杀数量 */
			if (id === 'nanman' || id === 'wanjian') {
				let enemyReady = 0;
				(game.players || []).forEach(function (p) {
					if (p === me || !p.isIn()) return;
					if (get.attitude(me, p) >= 0) return;
					const need = id === 'nanman' ? 'sha' : 'shan';
					if (p.countCards && p.countCards('hs', need) > 0) enemyReady++;
				});
				if (enemyReady === 0) score += 3.0;   /* 敌方毫无防备 → AOE 收益爆炸 */
				else if (enemyReady === 1) score += 1.5;
			}

			/* 桃 → 队友若自己有桃，则救援价值降 */
			if (id === 'tao') {
				let allyTao = 0;
				(game.players || []).forEach(function (p) {
					if (p === me || !p.isIn()) return;
					if (get.attitude(me, p) <= 0) return;
					if ((p.hp || 0) <= 0 && p.countCards) {
						allyTao += p.countCards('hs', 'tao');
					}
				});
				if (allyTao >= 1) score -= 1.5;
			}
		} catch (e) {}

		/* 保留原有扩展项 */
		if (id === 'shunshou' && hand.has('sha')) score += 1.5;
		if (id === 'tiesuo' && _hasNatureSha(me)) score += 2;
		if (id === 'guohe' && (hand.has('sha') || hand.has('juedou'))) score += 1;
		if (id === 'lebu' && hand.has('sha')) score += 1;

		return Math.round(score * 100) / 100;
	} catch (e) { return 0; }
}

export function planSequence(me) {
	try {
		if (!me) return null;
		const t0 = performance.now();

		const candidates = _status.djsc_lastCandidates || [];
		const bestT = _status.djsc_lastBestT || null;
		if (!candidates.length) return null;

		let killSeq = null;
		for (const p of (game.players || [])) {
			if (!p || p === me || !p.isIn()) continue;
			if (!isEnemyOf(me, p)) continue;
			const ks = _findKillSequence(me, p);
			if (ks && (!killSeq || ks.score > killSeq.score)) {
				killSeq = ks;
			}
		}
		if (killSeq) {
			log.debug('planner', '残局解：打 ' + killSeq.targetName + ' ' + killSeq.totalDmg + ' 点可秒');
			return {
				best: {
					action: killSeq.steps[0],
					total: killSeq.score,
					futureScore: 0,
					steps: killSeq.steps,
					isKill: true,
					target: killSeq.target,
				},
				alternatives: [],
				all: [killSeq],
				isKill: true,
				elapsed: performance.now() - t0,
			};
		}

		const ranked = candidates
			.filter(function (a) { return a.type !== 'end'; })
			.slice(0, 5);

		if (ranked.length < 2) return null;

		const sequences = ranked.map(function (c) {
			const outlook = _outlookScore(me, c, bestT);
			const total = (c.score || 0) + outlook * LOOKAHEAD_DISCOUNT;
			return {
				action: c,
				baseScore: c.score || 0,
				futureScore: outlook,
				total: Math.round(total * 100) / 100,
				steps: [c],
				isKill: false,
			};
		});

		sequences.sort(function (a, b) { return b.total - a.total; });

		const elapsed = performance.now() - t0;
		if (elapsed > PLAN_TIMEOUT) {
			log.warn('planner', '规划超时 ' + Math.round(elapsed) + 'ms，降级');
			return null;
		}

		return {
			best: sequences[0],
			alternatives: sequences.slice(1, 3),
			all: sequences,
			isKill: false,
			elapsed: elapsed,
		};
	} catch (e) {
		log.warn('planner', '规划异常：' + String(e).slice(0, 60));
		return null;
	}
}

export function refineBestWithPlan(me, best, bestT) {
	try {
		if (cfg('enablePlanner', true) === false) return best;
		const plan = planSequence(me);
		if (!plan || !plan.best) return best;

		const planBest = plan.best;

		if (plan.isKill && planBest.action) {
			return {
				type: 'card',
				id: planBest.action.id,
				score: planBest.total,
				reason: '★ 残局解：' + planBest.steps.map(function (s) { return s.id; }).join(' → ') + '（' + planBest.steps.reduce(function (s, x) { return s + x.dmg; }, 0) + ' 点伤害）',
				killTarget: planBest.target,
				isKill: true,
			};
		}

		const planTop = planBest.action;
		if (planTop && planTop.id && planBest.total > (best.score || 0) + 1.5) {
			return {
				type: planTop.type || 'card',
				id: planTop.id,
				score: planBest.total,
				reason: '规划：' + planTop.id + '（基础 ' + planBest.baseScore + ' + 展望 ' + planBest.futureScore + '）',
				planned: true,
			};
		}

		return best;
	} catch (e) { return best; }
}
