/* ================= 决策积分引擎 · 阵营/威胁/局势（整合模块） ================= */
import { lib, game, get, _status } from '../../../noname.js';
import { AI_CARD_VALUE } from './value-tables.js';
import { codeGainAllOf } from './skills.js';
import { MEM, memKeyOf } from './mem.js';
import { cardIdOf, cardTypeOf } from './mini-model.js';
import { styleShanFactor, styleOf, attackBy } from './observer.js';

/* ================= 回合内缓存工具 =================
 * 目的：削减 enemiesOf / threatOf 的重复计算。
 * 失效策略：
 *   - 全局：_status.roundNumber 变化时清空两个缓存
 *   - threatOf：额外以 hp / maxHp / 装备数为指纹，任一变化即重算
 */
const _enemiesCache = new Map();   // key: char 对象 → { round, value: Player[] }
const _threatCache  = new Map();   // key: tgt 对象  → { round, fp, value: number }
const _sitCache = new Map();       // key: me → { key, value: situationFactor result }
const _incCache = new Map();       // key: me → { key, value: incomingPressure result }

let _cacheRound = -1;

function _roundKey() {
	try {
		if (_status && typeof _status.roundNumber === "number") return _status.roundNumber;
		if (typeof game === "object" && typeof game.roundNumber === "number") return game.roundNumber;
	} catch (e) {}
	return 0;
}

function _syncRound() {
	const r = _roundKey();
	if (r !== _cacheRound) {
		_cacheRound = r;
		_enemiesCache.clear();
		_threatCache.clear();
	}
}

function _threatFingerprint(t) {
	try {
		return (t.hp || 0) + "|" + (t.maxHp || 0) + "|" +
			(t.countCards ? t.countCards("e") : 0) + "|" +
			(t.alive === false ? "0" : "1");
	} catch (e) { return "?"; }
}

/* 供外部（面板/调试/重开）清空缓存 */
function clearThreatCache() {
	try { _enemiesCache.clear(); } catch (e) {}
	try { _threatCache.clear(); } catch (e) {}
	try { _sitCache.clear(); } catch (e) {}
	try { _incCache.clear(); } catch (e) {}
	_cacheRound = -1;
}

const CAMP_MAP = { zhu: "loyal", zhong: "loyal", fan: "rebel", nei: "nei" };

function enemiesOf(char) {
	try {
		if (!char) return [];
		_syncRound();
		const hit = _enemiesCache.get(char);
		if (hit && hit.round === _cacheRound) return hit.value;

		const out = [];
		const camp = { zhu: "loyal", zhong: "loyal", fan: "rebel", nei: "nei", lord: "loyal", rebel: "rebel", loyalist: "loyal" };
		(game.players || []).forEach(function (p) {
			if (!p || p === char || p.alive === false) return;
			try { if (p.isFriend && p.isFriend(char)) return; } catch (e) {}
			let att = 0;
			try { att = typeof get === "object" && get.attitude ? get.attitude(char, p) : 0; } catch (eA) {}
			if (att < 0) { out.push(p); return; }
			if (att > 0) return;
			/* att=0（未知）：身份映射兜底——主公与忠臣同阵营，反贼/内奸为敌 */
			try {
				const a = camp[p.identity], b = camp[char.identity];
				if (a && b) { if (a === b) return; out.push(p); return; }
			} catch (e2) {}
			out.push(p);
		});

		_enemiesCache.set(char, { round: _cacheRound, value: out });
		return out;
	} catch (e) { return []; }
}

function isEnemyOf(me, t) {
	if (!me || !t || t === me) return false;
	try { return enemiesOf(me).indexOf(t) >= 0; } catch (e) { return false; }
}

function threatOf(tgt) {
	try {
		if (!tgt) return 1;
		_syncRound();

		const fp = _threatFingerprint(tgt);
		const hit = _threatCache.get(tgt);
		if (hit && hit.round === _cacheRound && hit.fp === fp) return hit.value;

		const g = codeGainAllOf(tgt);
		let w = 1;
		if (g.net > 4) w = 3.2;
		else if (g.net > 2) w = 2.4;
		else if (g.net > 0) w = 1.4;
		else if (g.net < -2) w = 0.6;
		else w = 0.8;
		w *= Math.max(0, (tgt.hp || 0)) / (tgt.maxHp || 1) || 0.1;
		w *= 1 + (tgt.countCards ? tgt.countCards("e") : 0) * 0.2;
		const out = Math.round(w * 100) / 100;

		_threatCache.set(tgt, { round: _cacheRound, fp: fp, value: out });
		return out;
	} catch (e) { return 1; }
}

function findCooperate(me) {
	try {
		const allies = [];
		for (const pp of game.players) { if (pp === me || !pp.alive) continue; if (!isEnemyOf(me, pp)) allies.push(pp); }
		for (const a of allies) {
			try {
				const aHand = a.countCards ? a.countCards("h") : 0;
				if ((a.hp || 0) <= (a.maxHp || 1) - 1 || aHand <= 1) return a;
			} catch (e) {}
		}
	} catch (e) {}
	return null;
}

function cardValueOf(card, me) {
	try {
		const id = cardIdOf(card);
		const type = cardTypeOf(card);
		const hp = (me && me.hp !== undefined) ? me.hp : (me && me.maxHp ? me.maxHp : 4);
		const mhp = (me && me.maxHp) || 4;
		if (type === "basic") {
			const t = AI_CARD_VALUE[hp <= 1 ? "basic_low" : "basic_normal"];
			let v = t[id] || 5;
			try { if (id === "sha" && card && card.nature) v += 1; } catch (e) {}
			return v;
		}
		if (type === "equip") {
			const w = AI_CARD_VALUE.weapon, a = AI_CARD_VALUE.armor;
			if (w[id] !== undefined) {
				let v = w[id];
				try {
					const enemies = game.players || [];
					let noHand = false, hasTie = false;
					for (const pp of enemies) {
						if (pp === me) continue;
						try { if (pp.countCards && pp.countCards("h") === 0) noHand = true; } catch (e) {}
						try { if (pp.skills && pp.skills.indexOf("tiesuo_effect") >= 0) hasTie = true; } catch (e) {}
					}
					if (hasTie && id === "zhuque") v = 10;
					if (hasTie && id === "guding") v++;
					if (noHand && id === "guding") v = 10;
				} catch (e) {}
				return v;
			}
			if (a[id] !== undefined) {
				let v = a[id];
				try {
					let hasFire = false;
					for (const pp of (game.players || [])) {
						if (pp === me) continue;
						try { if (pp.countCards && pp.countCards("h", function (c) { return get.name && get.name(c) === "sha" && (game.hasNature ? (game.hasNature(c, "thunder") || game.hasNature(c, "fire")) : false); })) hasFire = true; } catch (e) {}
					}
					if (hasFire) v = AI_CARD_VALUE.armor_fire[id];
				} catch (e) {}
				return v;
			}
			if (isMount(id, card)) return mountValue(me, card);
			return 6;
		}
		if (type === "trick") {
			const t = AI_CARD_VALUE.trick;
			let v = t[id] || 3;
			try {
				if (me && me.skills && (me.skills.indexOf("rejudge") >= 0 || me.skills.indexOf("guanxing") >= 0)) v = AI_CARD_VALUE.trick_rejudge[id] !== undefined ? AI_CARD_VALUE.trick_rejudge[id] : v;
			} catch (e) {}
			return v;
		}
		return 5;
	} catch (e) { return 5; }
}

function probHasBagua(tgt) {
	try { return !!tgt.getCards("e", function (c) { try { return c.name === "bagua"; } catch (e) { return false; } }).length; } catch (e) { return false; }
}

function hasVengeanceSkill(tgt) {
	try {
		const vs = ["ganglie", "fankui", "jianxiong", "yiji", "guixin", "huashen", "liuli", "benghuai", "enjing"];
		return (tgt.skills || []).some(function (s) { return vs.indexOf(s) >= 0; });
	} catch (e) { return false; }
}

function hasBadStatus(tgt) {
	try {
		const j = tgt.judges ? tgt.judges() : [];
		return j.some(function (c) { try { return c.name === "lebu" || c.name === "bingliang"; } catch (e) { return false; } });
	} catch (e) { return false; }
}

/* ================= 时间节奏（早期/常规/发力/残局） =================
 * 阶段判定：轮次 + 存活人数
 *   early    : r<=3          蓄爆期
 *   mid      : 4<=r<=7       常规期
 *   late     : r>=8          发力期
 *   endgame  : alive<=4      残局（优先级最高）
 * 提供：atkMul（进攻倍率）/ keepMul（保留闪桃倍率）/ burstMul（爆发倍率）
 */
function tempoFactor() {
	try {
		const r = (_status && typeof _status.roundNumber === "number") ? _status.roundNumber : 1;
		let alive = 0;
		try {
			(game.players || []).forEach(function (p) {
				if (p && p.alive !== false) alive++;
			});
		} catch (e) {}
		if (!alive) alive = 1;

		let stage = "mid";
		if (r <= 3) stage = "early";
		else if (alive <= 4) stage = "endgame";
		else if (r >= 8) stage = "late";

		const T = {
			early:   { atkMul: 0.7, keepMul: 1.3, burstMul: 0.6, desc: "蓄爆期（留闪桃、观察局势）" },
			mid:     { atkMul: 1.0, keepMul: 1.0, burstMul: 1.0, desc: "常规期（正常节奏）" },
			late:    { atkMul: 1.3, keepMul: 0.7, burstMul: 1.4, desc: "发力期（果断进攻）" },
			endgame: { atkMul: 1.5, keepMul: 0.5, burstMul: 1.6, desc: "残局（全力收割）" },
		};
		const t = T[stage] || T.mid;
		return { stage, round: r, alive, atkMul: t.atkMul, keepMul: t.keepMul, burstMul: t.burstMul, desc: t.desc };
	} catch (e) {
		return { stage: "mid", round: 1, alive: 1, atkMul: 1, keepMul: 1, burstMul: 1, desc: "常规期" };
	}
}

function situationFactor(me) {
	try {
		const sKey = (me.name1 || me.name) + '|' + ((_status && _status.roundNumber) || 0) +
			'|' + (game.players || []).filter(function (p) { return p && !p.isDead && !(p.hp <= 0); }).length;
		const sHit = _sitCache.get(me);
		if (sHit && sHit.key === sKey) return sHit.value;
		let my = 0, en = 0;
		for (const pp of (game.players || [])) {
			try { if (pp.isDead ? pp.isDead() : (pp.hp !== undefined && pp.hp <= 0)) continue; } catch (e) { continue; }
			const pow = (pp.hp || 1) + (pp.countCards ? pp.countCards("h") * 0.5 : 0) + ((pp.skills || []).length * 0.3);
			let att = 0;
			try { att = typeof get === "object" && get.attitude ? get.attitude(me, pp) : 0; } catch (eA) {}
			let isEn = att < 0;
			if (att === 0) { try { isEn = enemiesOf(me).indexOf(pp) >= 0; } catch (eE) {} }
			if (isEn) en += pow; else if (pp !== me) my += pow;
		}
		my += (me.hp || 1) + (me.countCards ? me.countCards("h") * 0.5 : 0);
		const ratio = my / (en + 1);
		const baseTempo = ratio > 1.5 ? 1.3 : (ratio < 0.6 ? 0.7 : 1.0);
		const mode = ratio > 1.5 ? "优势" : (ratio < 0.6 ? "劣势" : "均势");
		const desc = ratio > 1.5 ? "稳扎稳打，控场收尾" : (ratio < 0.6 ? "保守发育/寻找翻盘组合" : "正常节奏，争取小优");
		const tf = tempoFactor();
		const sResult = {
			mode, tempo: baseTempo, baseTempo, desc,
			/* ▼ 新增：节奏阶段字段（供 engine.js / panel.js 使用） */
			stage: tf.stage,
			atkMul: tf.atkMul,
			keepMul: tf.keepMul,
			burstMul: tf.burstMul,
			tempoDesc: tf.desc,
			round: tf.round,
			alive: tf.alive,
		};
		_sitCache.set(me, { key: sKey, value: sResult });
		return sResult;
	} catch (e) {
		return { mode: "均势", tempo: 1.0, baseTempo: 1.0, desc: "正常节奏", stage: "mid", atkMul: 1, keepMul: 1, burstMul: 1, tempoDesc: "常规期" };
	}
}

function canReachOf(me, tgt) {
	try {
		const d = get.distance ? get.distance(me, tgt) : 1;
		return typeof d === "number" && d <= (me.getAttackRange ? me.getAttackRange() : 1);
	} catch (e) { return true; }
}

function targetScore(me, tgt) {
	try {
		let s = threatOf(tgt) || 0;
		s *= canReachOf(me, tgt) ? 1.0 : 0.1;
		try { s *= 1 + (tgt.countCards ? tgt.countCards("h") : 0) * 0.15; } catch (e) {}
		if (tgt.hp !== undefined && tgt.hp <= 2) s *= 1.5;
		try { if (hasBadStatus(tgt)) s *= 0.5; } catch (e) {}
		if (tgt.hp !== undefined && tgt.hp === tgt.maxHp && tgt.countCards && tgt.countCards("h") < 2) s *= 0.7;

		/* ★ 扩写：更多目标评分信号 */
		try {
			/* 1. 装备加成：有武器/防具/马的目标威胁更大 */
			const equips = tgt.getCards ? tgt.getCards('e') : [];
			s *= 1 + equips.length * 0.1;
			/* 2. 连弩加成：有诸葛连弩的目标威胁大幅提升 */
			if (tgt.getEquip && tgt.getEquip('zhuge')) s *= 1.5;
			/* 3. 血量缺口：满血目标威胁更大，残血目标威胁小 */
			if (tgt.hp !== undefined && tgt.maxHp !== undefined) {
				const hpRatio = tgt.hp / tgt.maxHp;
				if (hpRatio >= 0.8) s *= 1.2;   /* 满血 → 威胁大 */
				else if (hpRatio <= 0.3) s *= 0.6;  /* 残血 → 威胁小 */
			}
			/* 4. 技能威胁：有强输出技能的目标威胁大 */
			if (tgt.hasSkill) {
				const atkSkills = ['wusheng', 'paoxiao', 'longdan', 'liegong', 'tieqi', 'qingguo'];
				let skillThreat = 0;
				atkSkills.forEach(function (sid) {
					if (tgt.hasSkill(sid)) skillThreat++;
				});
				s *= 1 + skillThreat * 0.2;
			}
			/* 5. 集火加成：如果这个目标已经被队友攻击过，威胁更大 */
			try {
				const broadcast = _status.djsc_broadcast || [];
				const myCamp = (function () {
					const id = me.identity || '';
					if (id === 'zhu' || id === 'zhong' || id === 'mingzhong') return 'loyal';
					if (id === 'fan') return 'rebel';
					if (id === 'nei') return 'nei';
					return 'unknown';
				})();
				let focusCount = 0;
				broadcast.forEach(function (e) {
					if (e.target === (tgt.name1 || tgt.name)) {
						const eCamp = (function () {
							const id = e.fromIdentity || '';
							if (id === 'zhu' || id === 'zhong' || id === 'mingzhong') return 'loyal';
							if (id === 'fan') return 'rebel';
							if (id === 'nei') return 'nei';
							return 'unknown';
						})();
						if (eCamp === myCamp) focusCount++;
					}
				});
				if (focusCount > 0) s *= 1 + focusCount * 0.15;
			} catch (e) {}
		} catch (e) {}

		/* C 阶段 clamp：目标分规范值域 [0, 15] */
		if (s < 0) s = 0;
		if (s > 15) s = 15;
		return Math.round(s * 100) / 100;
	} catch (e) { return threatOf(tgt) || 0; }
}

/* ================= 位置与距离（P2） =================
 * 目的：把「座位顺序 + 距离」纳入决策
 */
function seatOrderFrom(me, count) {
	try {
		const out = [];
		if (!me || !me.next) return out;
		let cur = me.next;
		let guard = 20;
		while (cur && cur !== me && out.length < (count || 3) && guard-- > 0) {
			if (cur.alive !== false) out.push(cur);
			cur = cur.next;
		}
		return out;
	} catch (e) { return []; }
}

function nextTurnThreat(me, horizon) {
	try {
		const order = seatOrderFrom(me, horizon || 3);
		const out = [];
		for (let i = 0; i < order.length; i++) {
			const p = order[i];
			out.push({ player: p, dist: i + 1, threat: threatOf(p), isEnemy: isEnemyOf(me, p) });
		}
		return out;
	} catch (e) { return []; }
}

function seatPressure(me) {
	try {
		const order = nextTurnThreat(me, 3);
		let enemyPressure = 0, nextEnemy = null, nextEnemyDist = 99;
		for (const x of order) {
			if (!x.isEnemy) continue;
			const w = 1 / x.dist;
			enemyPressure += x.threat * w;
			if (x.dist < nextEnemyDist) { nextEnemyDist = x.dist; nextEnemy = x.player; }
		}
		let prevEnemy = null;
		try {
			if (me.previous && me.previous !== me && me.previous.alive !== false && isEnemyOf(me, me.previous)) {
				prevEnemy = me.previous;
			}
		} catch (e) {}
		return {
			enemyPressure: Math.round(enemyPressure * 100) / 100,
			nextEnemy, nextEnemyDist, prevEnemy, order,
		};
	} catch (e) {
		return { enemyPressure: 0, nextEnemy: null, nextEnemyDist: 99, prevEnemy: null, order: [] };
	}
}

function distancePressure(me) {
	try {
		let sum = 0, count = 0, minD = Infinity, maxD = 0;
		for (const p of (game.players || [])) {
			if (!p || p === me || p.alive === false) continue;
			if (!isEnemyOf(me, p)) continue;
			let d = 1;
			try { d = get.distance ? get.distance(me, p) : 1; } catch (eD) {}
			if (typeof d !== "number" || !isFinite(d)) continue;
			sum += d; count++;
			if (d < minD) minD = d;
			if (d > maxD) maxD = d;
		}
		return { avg: count ? Math.round((sum / count) * 100) / 100 : 1, min: count ? minD : 1, max: count ? maxD : 1, count };
	} catch (e) { return { avg: 1, min: 1, max: 1, count: 0 }; }
}

function isMount(id, card) {
	try {
		if (get && get.subtypes && card) {
			const subs = get.subtypes(card);
			if (subs && (subs.indexOf("equip3") >= 0 || subs.indexOf("equip4") >= 0)) return true;
		}
	} catch (e) {}
	const OFF = ["chitu", "dawan", "zixin", "hualiu", "zhuahuang"];
	const DEF = ["dilu", "jueying"];
	return OFF.indexOf(id) >= 0 || DEF.indexOf(id) >= 0;
}

function mountValue(me, card) {
	try {
		const id = cardIdOf(card);
		const dp = distancePressure(me);
		let isOffensive = false;
		try {
			const subs = get.subtypes ? get.subtypes(card) : [];
			if (subs && subs.indexOf("equip3") >= 0) isOffensive = true;
			else if (subs && subs.indexOf("equip4") >= 0) isOffensive = false;
			else isOffensive = ["chitu", "dawan", "zixin", "hualiu", "zhuahuang"].indexOf(id) >= 0;
		} catch (e) {}
		if (isOffensive) {
			return Math.round((5 + Math.min(4, Math.max(0, dp.avg - 1) * 2)) * 10) / 10;
		}
		return dp.avg <= 1.5 ? 8 : (dp.avg <= 2.5 ? 6.5 : 5);
	} catch (e) { return 6; }
}

function probHasShan(me, tgt) {
	try {
		if (!tgt) return 0.3;
		const hc = tgt.countCards ? tgt.countCards("h") : 0;
		let p = hc <= 0 ? 0.05 : Math.min(0.7, 0.15 + hc * 0.1);

		const k = memKeyOf(tgt);
		let hitRate = -1;
		if (k) {
			const a = MEM.atk[k] || 0, h = MEM.hit[k] || 0;
			if (a >= 2) {
				const emp = 1 - h / a;
				p = emp * 0.7 + p * 0.3;
				hitRate = h / a;
			}
			/* ② 二阶修正：对手读心成功 / 疏于防守 */
			if (a >= 3 && hitRate >= 0) {
				if (hitRate <= 0.2) p = Math.min(0.9, p + 0.15);
				else if (hitRate >= 0.8) p = Math.max(0.03, p - 0.10);
			}
		}

		/* ③ 对手风格修正 */
		try { p *= styleShanFactor(tgt); } catch (e) {}

		return Math.max(0.03, Math.min(0.9, Math.round(p * 100) / 100));
	} catch (e) { return 0.3; }
}

/* ================= 下一步行动预测 ================= */
function nextTurnImpact(my, enemy) {
	try {
		if (!my || !enemy || my === enemy) return 0;
		if (enemy.alive === false) return 0;
		const hc = enemy.countCards ? enemy.countCards("h") : 0;
		const pHasSha = Math.min(0.75, 0.1 + hc * 0.08);
		const canReach = (function () {
			try {
				const d = get.distance ? get.distance(enemy, my) : 1;
				return typeof d === "number" && d <= (enemy.getAttackRange ? enemy.getAttackRange() : 1);
			} catch (e) { return true; }
		})();
		let shaImpact = pHasSha * (canReach ? 1.0 : 0.2) * 2;
		let skillImpact = 0;
		try {
			const g = codeGainAllOf(enemy);
			if (g && g.net > 0) skillImpact = Math.min(3, g.net * 0.4);
		} catch (e) {}
		let distMul = 1.0;
		try {
			const d = get.distance ? get.distance(enemy, my) : 1;
			if (typeof d === "number" && isFinite(d)) {
				distMul = d <= 1 ? 1.0 : d <= 2 ? 0.8 : d <= 3 ? 0.6 : 0.4;
			}
		} catch (e) {}
		let styleMul = 1.0;
		try {
			const s = styleOf(enemy);
			if (s.tag === "aggressive") styleMul = 1.2;
			else if (s.tag === "cautious") styleMul = 0.85;
			else if (s.tag === "vengeful") {
				let retaliate = false;
				try { retaliate = (attackBy(enemy, my) > 0) || (my.storage && my.storage.__djsc_hit && my.storage.__djsc_hit[enemy.name]); } catch (e) {}
				styleMul = retaliate ? 1.3 : 1.0;
			}
		} catch (e) {}
		let hpMul = 1.0;
		try {
			const r = (enemy.hp || 0) / (enemy.maxHp || 1);
			hpMul = r < 0.3 ? 0.6 : r < 0.5 ? 0.8 : 1.0;
		} catch (e) {}
		const impact = (shaImpact + skillImpact) * distMul * styleMul * hpMul;
		return Math.round(impact * 100) / 100;
	} catch (e) { return 0; }
}

function incomingPressure(me) {
	try {
		if (!me) return { total: 0, byEnemy: [], selfRisk: 0, killRisk: 0, hp: 0 };
		const iKey = (me.name1 || me.name) + '|' + ((_status && _status.roundNumber) || 0) + '|' + (me.hp || 0);
		const iHit = _incCache.get(me);
		if (iHit && iHit.key === iKey) return iHit.value;
		let total = 0;
		const byEnemy = [];
		for (const p of (game.players || [])) {
			if (!p || p === me || p.alive === false) continue;
			if (!isEnemyOf(me, p)) continue;
			const imp = nextTurnImpact(me, p);
			if (imp > 0) {
				total += imp;
				byEnemy.push({ name: p.name || "?", impact: imp, hp: p.hp });
			}
		}
		byEnemy.sort(function (a, b) { return b.impact - a.impact; });
		const hp = me.hp || 0;
		const selfRisk = Math.round((total / Math.max(1, hp)) * 100) / 100;
		const killRisk = total >= hp ? 1 : 0;
		const iResult = { total: Math.round(total * 100) / 100, byEnemy, selfRisk, killRisk, hp };
		_incCache.set(me, { key: iKey, value: iResult });
		return iResult;
	} catch (e) {
		return { total: 0, byEnemy: [], selfRisk: 0, killRisk: 0, hp: 0 };
	}
}

function teamRisk(me) {
	try {
		if (!me) return [];
		const out = [];
		for (const p of (game.players || [])) {
			if (!p || p === me || p.alive === false) continue;
			if (isEnemyOf(me, p)) continue;
			let allyThreat = 0;
			for (const e of (game.players || [])) {
				if (!e || e === p || e.alive === false) continue;
				if (!isEnemyOf(me, e)) continue;
				allyThreat += nextTurnImpact(p, e);
			}
			if (allyThreat <= 0) continue;
			const hp = p.hp || 0;
			const risk = allyThreat / Math.max(1, hp);
			if (risk >= 0.8) {
				out.push({ name: p.name || "?", risk: Math.round(risk * 100) / 100, hp, threat: Math.round(allyThreat * 100) / 100 });
			}
		}
		out.sort(function (a, b) { return b.risk - a.risk; });
		return out;
	} catch (e) { return []; }
}

function forecastSummary(me) {
	try {
		const incoming = incomingPressure(me);
		const team = teamRisk(me);
		return {
			incoming,
			team,
			advice: incoming.killRisk ? "高危：下回合可能被击杀，优先自保"
				: incoming.selfRisk >= 0.6 ? "中高危：注意留闪/桃"
				: incoming.selfRisk >= 0.3 ? "轻度压力：正常应对"
				: "安全：可主动出击",
		};
	} catch (e) {
		return { incoming: { total: 0, byEnemy: [], selfRisk: 0, killRisk: 0, hp: 0 }, team: [], advice: "预测异常" };
	}
}


/**
 * 敌方爆发威胁评估：返回 0~1 的威胁值。
 * 信号加权：
 *   - 装备【诸葛连弩】：+0.5
 *   - 手里杀多：每张 +0.15，上限 +0.3
 *   - 满血（≥3）：+0.1（能全力输出）
 *   - 装备进攻型坐骑（-1 马）：+0.1
 *   - 自身 HP≤1：-0.3（自身难保，无暇爆发）
 */
function burstThreatOf(p) {
	try {
		if (!p || p.alive === false) return 0;
		let t = 0;
		try {
			if (p.getEquip && p.getEquip('zhuge')) t += 0.5;
		} catch (e) {}
		try {
			const shaN = p.countCards ? p.countCards('hs', 'sha') : 0;
			t += Math.min(0.3, shaN * 0.15);
		} catch (e) {}
		try {
			if ((p.hp || 0) === (p.maxHp || 0) && (p.hp || 0) >= 3) t += 0.1;
		} catch (e) {}
		try {
			if (p.getEquip) {
				const offHorse = p.getEquip('equip4');
				if (offHorse) t += 0.1;
			}
		} catch (e) {}
		if ((p.hp || 0) <= 1) t -= 0.3;
		return Math.max(0, Math.min(1, t));
	} catch (e) { return 0; }
}

/**
 * 我方视角下威胁最大的爆发者
 */
function maxBurstThreat(me) {
	try {
		let best = null, bestVal = 0;
		for (const p of (game.players || [])) {
			if (!p || p === me || p.alive === false) continue;
			if (!isEnemyOf(me, p)) continue;
			const t = burstThreatOf(p);
			if (t > bestVal) { bestVal = t; best = p; }
		}
		return { value: bestVal, target: best };
	} catch (e) { return { value: 0, target: null }; }
}

/**
 * 横置目标的属性伤害连锁收益评估。
 * @param {Player} me      使用者
 * @param {Player} target  主目标（必须横置才生效）
 * @param {string} nature  伤害属性：'fire' / 'thunder'（其它返回 0）
 * @returns {number}       传导收益（正=赚，负=亏）
 */
function linkedChainValue(me, target, nature) {
	try {
		if (!me || !target || me === target) return 0;
		if (nature !== 'fire' && nature !== 'thunder') return 0;
		if (!target.isLinked || !target.isLinked()) return 0;

		let allyDmg = 0, enemyDmg = 0;
		for (const p of (game.players || [])) {
			if (!p || p === target || p === me) continue;
			if (p.alive === false || (p.hp || 0) <= 0) continue;
			if (!p.isLinked || !p.isLinked()) continue;
			/* 抗性检查 */
			try {
				if (nature === 'fire' && p.hasSkillTag('nofire')) continue;
				if (nature === 'thunder' && p.hasSkillTag('nothunder')) continue;
				if (p.hasSkillTag('nodamage')) continue;
			} catch (e) {}

			/* 传导伤害按 1 点保守估算，2 分/点（对齐 L1 记分） */
			const att = get.attitude(me, p);
			if (att < 0) enemyDmg += 2;
			else if (att > 0) allyDmg += 2;
		}
		return enemyDmg - allyDmg;
	} catch (e) { return 0; }
}

/* ================= 导出 ================= */
export { enemiesOf, isEnemyOf, threatOf, findCooperate, cardValueOf, probHasBagua, hasVengeanceSkill, hasBadStatus, situationFactor, canReachOf, targetScore, probHasShan, clearThreatCache, tempoFactor, nextTurnThreat, seatPressure, distancePressure, mountValue, nextTurnImpact, incomingPressure, teamRisk, forecastSummary, burstThreatOf, maxBurstThreat, linkedChainValue };
