/*
 * ============================================
 * // Autor: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 身份推理系统 =================
 * 依赖：observer.js（行为数据）、profile.js（画像）
 * 提供：
 *   updateBelief()                          全量刷新信念
 *   identityOf(player)                      最可能身份
 *   confidenceOf(player)                    置信度 0~1
// लेखक: फ़ेशेंग मूल | लाइसेंस: GPL-3.0
 *   isLikelyEnemy / isLikelyAlly            推理级敌友
 *   explainIdentity(player)                 调试
 *   resetBelief()                           生命周期
 * 仅在 identity 模式下生效；其它模式直接返回 "unknown"。
 * 注：本模块内联身份模式判断（不依赖 mode.js），保持叶子性。
 */
import { lib, game, get, _status } from '../../../noname.js';
import { attackBy, aidBy, hostilityOf, friendlinessOf } from './observer.js';

/* 计算某玩家打反贼的总次数（内奸也会打反贼） */
function attackFans(p, zhu) {
    try {
        let total = 0;
        (game.players || []).forEach(function (other) {
            if (!other || other === p || other === zhu) return;
            /* 只统计打身份已明置为反贼的玩家 */
            if (other.identityShown && other.identity === 'fan') {
                total += attackBy(p, other);
            }
        });
        return total;
    } catch (e) { return 0; }
}

const BELIEF = Object.create(null);
let _beliefRound = -1;

function keyOf(p) {
	try { return p && (p.name1 || p.name || p.name2 || ""); } catch (e) { return ""; }
}

/* 内联模式判断：identity 局才启用 */
export function currentMode() {
	try {
		if (get && typeof get.mode === "function") return get.mode();
	} catch (e) {}
	try {
		if (_status && _status.mode) return _status.mode;
	} catch (e) {}
	return "unknown";
}

function _getB(p) {
	const k = keyOf(p);
	if (!k) return null;
	if (!BELIEF[k]) BELIEF[k] = { zhu: 0, zhong: 0, fan: 0, nei: 0, updated: -1 };
	return BELIEF[k];
}

/* ---------- 单个玩家的信念计算 ---------- */
function _computeBelief(p) {
	const b = { zhu: 0, zhong: 0, fan: 0, nei: 0, updated: (_status && _status.roundNumber) || 0 };
	if (!p) return b;

	/* ★ 本体身份感知屏蔽：不再直接读 identity 字段
	 * 只有主公明置（明置身份）或身份已公开时才确定
	 * 其他情况全部通过行为推断 */

	/* ★ 主公身份必然暴露：开局就知道谁是主公，直接确定 */
	try {
		if (p === game.zhu) {
			return Object.assign(b, { zhu: 1, zhong: 0, fan: 0, nei: 0 });
		}
	} catch (e) {}

	if (p.identityShown) {
		try {
			/* 身份已公开 → 直接用公开身份 */
			if (p.identity === "zhu") return Object.assign(b, { zhu: 1, zhong: 0, fan: 0, nei: 0 });
			if (p.identity === "zhong") return Object.assign(b, { zhu: 0, zhong: 1, fan: 0, nei: 0 });
			if (p.identity === "fan") return Object.assign(b, { zhu: 0, zhong: 0, fan: 1, nei: 0 });
			if (p.identity === "nei") return Object.assign(b, { zhu: 0, zhong: 0, fan: 0, nei: 1 });
		} catch (e) {}
	}

	/* ★ 阵亡后100%确定身份：如果角色阵亡了，身份已明置，直接确定 */
	try {
		if (p.hp <= 0 && p.identityShown && p.identity) {
			if (p.identity === "zhu") return Object.assign(b, { zhu: 1, zhong: 0, fan: 0, nei: 0 });
			if (p.identity === "zhong") return Object.assign(b, { zhu: 0, zhong: 1, fan: 0, nei: 0 });
			if (p.identity === "fan") return Object.assign(b, { zhu: 0, zhong: 0, fan: 1, nei: 0 });
			if (p.identity === "nei") return Object.assign(b, { zhu: 0, zhong: 0, fan: 0, nei: 1 });
		}
	} catch (e) {}

	const zhu = game.zhu;
	if (!zhu || zhu === p) return b;

	/* ★ 主公视角：只知道自己是主公，其他人身份未知
	 * 不能把内奸直接当反贼打，要看行为：
	 *   - 打反贼多 → 可能是忠臣或内奸
	 *   - 救主公多 → 可能是忠臣
	 *   - 打主公多 → 可能是反贼
	 *   - 对所有人中立 → 可能是内奸 */

	/* 行为证据：对主公的攻击/援助 */
	const atkZhu = attackBy(p, zhu);
	const aidZhu = aidBy(p, zhu);

	/* 打反贼的行为（内奸也会打反贼） */
	const atkFan = attackFans(p, zhu);

	/* 反贼：打主公多、救主公少 */
	const fanScore = atkZhu * 0.4 - aidZhu * 0.2;

	/* 忠臣：救主公多、打主公少、打反贼多 */
	const zhongScore = aidZhu * 0.4 - atkZhu * 0.25 + atkFan * 0.15;

	/* 内奸：前期保证主公不死（救主公、打反贼），后期杀主公
	 * 主公阵亡→内奸也失败，所以前期内奸会：
	 *   - 救主公（桃/无懈）
	 *   - 打反贼
	 *   - 不打主公
	 * 后期（≤3人）内奸才会：
	 *   - 打主公
	 *   - 不救主公 */
	const h = hostilityOf(p);
	const f = friendlinessOf(p);
	const balance = -Math.abs(h - f) * 0.15 + Math.min(h, f) * 0.1;
	const aliveCount = (game.players || []).filter(function (pp) { return pp && pp.alive !== false; }).length;
	const isLateGame = aliveCount <= 3;

	/* 前期：内奸救主公多 → 可能是内奸（但也可能是忠臣） */
	/* 前期：内奸打反贼多 → 可能是内奸（但也可能是忠臣） */
	/* 后期：内奸打主公 → 一定是内奸 */
	let neiScore = balance + atkFan * 0.1 - aidZhu * 0.1;
	if (isLateGame && atkZhu > 0) {
		neiScore += 0.3;  // 后期打主公→内奸倾向强
	}
	/* 前期救主公但不打反贼→可能是忠臣，不是内奸 */
	if (!isLateGame && aidZhu > 0 && atkFan === 0) {
		neiScore -= 0.1;  // 救主公但不打反贼→更像忠臣
	}

	/* 位置先验：主公下家反贼略高（身份局常见）；API 不稳时忽略 */
	try {
		if (zhu && p && p.previousSeat === zhu) {
			const seatBonus = 0.15;
			b.fan = fanScore + seatBonus;
			b.zhong = zhongScore;
			b.nei = neiScore * 0.9;
		} else if (zhu && p && p.nextSeat === zhu) {
			b.fan = fanScore * 0.95;
			b.zhong = zhongScore + 0.1;
			b.nei = neiScore * 0.9;
		} else {
			b.fan = fanScore;
			b.zhong = zhongScore;
			b.nei = neiScore;
		}
	} catch (e) {
		b.fan = fanScore;
		b.zhong = zhongScore;
		b.nei = neiScore;
	}

	/* 态度修正：若本体 get.attitude 已有倾向，作为弱先验（权重再减半） */
	try {
		const att = typeof get === "object" && get.attitude ? get.attitude(zhu, p) : 0;
		if (att > 0) b.zhong += 0.15;
		else if (att < 0) b.fan += 0.15;
	} catch (e) {}

	/* ★ 扩写：更多身份推理信号（权重全部再减半） */
	try {
		/* 1. 击杀行为：反贼倾向于杀忠臣，忠臣倾向于杀反贼 */
		const kills = (p._djsc_kills || []);
		if (kills.length > 0) {
			kills.forEach(function (victim) {
				/* 如果击杀的是已经明置的忠臣，那大概率是反贼 */
				const v = game.players.find(function (x) { return (x.name1 || x.name) === victim; });
				if (v && v.identityShown && v.identity === 'zhong') b.fan += 0.1;
				/* 如果击杀的是已经明置的反贼，那大概率是忠臣 */
				if (v && v.identityShown && v.identity === 'fan') b.zhong += 0.1;
			});
		}
		/* 2. 救援行为：忠臣倾向于救主公 */
		const saves = (p._djsc_saves || []);
		if (saves.length > 0) {
			saves.forEach(function (saved) {
				if (saved === (zhu.name1 || zhu.name)) b.zhong += 0.08;
			});
		}
		/* 3. 装备偏好：反贼更倾向于进攻型装备，忠臣更倾向于防御型装备 */
		const equips = p.getCards ? p.getCards('e') : [];
		let atkEquip = 0, defEquip = 0;
		equips.forEach(function (e) {
			const name = get.name(e);
			if (name === 'zhuge' || name === 'qinggang' || name === 'guanshi') atkEquip++;
			if (name === 'bagua' || name === 'renwang' || name === 'baiyin') defEquip++;
		});
		if (atkEquip > defEquip) b.fan += 0.05;
		else if (defEquip > atkEquip) b.zhong += 0.05;
		/* 4. 手牌保留：反贼更倾向于留攻击牌，忠臣更倾向于留防御牌 */
		const hand = p.getCards ? p.getCards('h') : [];
		let atkHand = 0, defHand = 0;
		hand.forEach(function (c) {
			const name = get.name(c);
			if (name === 'sha' || name === 'juedou' || name === 'nanman' || name === 'wanjian') atkHand++;
			if (name === 'shan' || name === 'tao' || name === 'wuxie') defHand++;
		});
		if (atkHand > defHand + 1) b.fan += 0.04;
		else if (defHand > atkHand + 1) b.zhong += 0.08;
	} catch (e) {}

		/* ★ 扩展信号：距离 + 出牌偏好 + 被攻击记录 + 回合权重 */
		try {
			/* 1. 距离信号：与主公距离近 → 反贼概率略升（先手压制） */
			if (zhu && p) {
				let dist = 0;
				try {
					dist = zhu.distanceTo(p);
					if (dist === 1) {
						b.fan += 0.2;
						b.zhong += 0.1;
					} else if (dist >= 4) {
						b.zhong += 0.15;   /* 距离远，对主公威胁低 */
					}
				} catch (e) {}
			}

			/* 2. 出牌偏好：对主公使用拆牌 → 反贼概率 */
			try {
				const obs = getObs ? getObs() : null;
				if (obs && obs[keyOf(p)]) {
					const e = obs[keyOf(p)];
					/* 该玩家用过拆牌类打主公 */
					if (e.attacks && zhu) {
						const zhuKey = zhu.name1 || zhu.name;
						if (e.attacks[zhuKey] >= 2) b.fan += 0.3;
						else if (e.attacks[zhuKey] >= 1) b.fan += 0.15;
					}
					/* 该玩家用过桃/无懈救主公 */
					if (e.aids && zhu) {
						const zhuKey = zhu.name1 || zhu.name;
						if (e.aids[zhuKey] >= 1) b.zhong += 0.4;
					}
				}
			} catch (e) {}

			/* 3. 被攻击记录：谁打过该玩家 → 谁的身份倾向 */
			try {
				const obs = getObs ? getObs() : null;
				if (obs) {
					const myKey = keyOf(p);
					/* 遍历所有玩家，统计谁打过该玩家 */
					let attackedByFan = 0, attackedByZhong = 0;
					for (const other of (game.players || [])) {
						if (!other || other === p || other === zhu) continue;
						if (!obs[keyOf(other)]) continue;
						const oAttacks = obs[keyOf(other)].attacks || {};
						if (oAttacks[myKey] >= 1) {
							/* other 打过 p，如果 other 大概率反贼，则 p 大概率忠臣 */
							const otherId = identityOf(other);
							if (otherId === fan) attackedByFan++;
							else if (otherId === zhong) attackedByZhong++;
						}
					}
					if (attackedByFan > 0) b.zhong += 0.2 * attackedByFan;
					if (attackedByZhong > 0) b.fan += 0.2 * attackedByZhong;
				}
			} catch (e) {}

			/* 4. 回合权重：越靠后的行为越可信 */
			try {
				const round = (_status && _status.roundNumber) || 0;
				const weight = Math.min(1.5, 1 + round * 0.1);
				b.fan *= weight;
				b.zhong *= weight;
				b.nei *= weight;
			} catch (e) {}

			/* 5. 内奸特征：对所有人攻击/援助均衡 */
			try {
				const obs = getObs ? getObs() : null;
				if (obs && obs[keyOf(p)]) {
					const e = obs[keyOf(p)];
					const totalAtk = Object.keys(e.attacks || {}).reduce(function (s, k) {
						return s + (e.attacks[k] || 0);
					}, 0);
					const totalAid = Object.keys(e.aids || {}).reduce(function (s, k) {
						return s + (e.aids[k] || 0);
					}, 0);
					/* 攻击与援助都高 → 内奸特征（不分敌我） */
					if (totalAtk >= 2 && totalAid >= 1) {
						const balance = Math.abs(totalAtk - totalAid) / Math.max(1, totalAtk + totalAid);
						if (balance < 0.5) b.nei += 0.3;
					}
					/* 只打不救 → 反贼或内奸 */
					if (totalAid === 0 && totalAtk >= 2) {
						b.fan += 0.15;
						b.nei += 0.15;
					}
				}
			} catch (e) {}
		} catch (e) {}


	/* 归一化为 0~1 */
	const total = b.fan + b.zhong + b.nei;
	if (total > 0) {
		b.fan = b.fan / total;
		b.zhong = b.zhong / total;
		b.nei = b.nei / total;
	} else {
		/* 无证据：按人数均分（弱先验） */
		let fanCount = 0, zhongCount = 0, neiCount = 0;
		try {
			(game.players || []).forEach(function (x) {
				if (!x.alive || x === game.zhu) return;
				if (x.identity === "fan") fanCount++;
				else if (x.identity === "zhong") zhongCount++;
				else if (x.identity === "nei") neiCount++;
			});
		} catch (e) {}
		const sum = (fanCount + zhongCount + neiCount) || 1;
		b.fan = fanCount / sum;
		b.zhong = zhongCount / sum;
		b.nei = neiCount / sum;
	}

	/* 若本体已公开 identityShown，直接覆盖 */
	try {
		if (p.identityShown || p.identity === "mingzhong") {
			if (p.identity === "fan") { b.fan = 1; b.zhong = 0; b.nei = 0; }
			else if (p.identity === "zhong" || p.identity === "mingzhong") { b.zhong = 1; b.fan = 0; b.nei = 0; }
			else if (p.identity === "nei") { b.nei = 1; b.fan = 0; b.zhong = 0; }
		}
	} catch (e) {}

	return b;
}

/* ---------- 全量刷新 ---------- */
export function updateBelief() {
	try {
		if (currentMode() !== "identity") return;
		(game.players || []).forEach(function (p) {
			if (!p || !p.alive) return;
			const b = _getB(p);
			if (!b) return;
			const nb = _computeBelief(p);
			Object.assign(b, nb);
		});
		_beliefRound = (_status && _status.roundNumber) || 0;
	} catch (e) {}
}

function _syncBelief() {
	try {
		const r = (_status && _status.roundNumber) || 0;
		if (r !== _beliefRound) updateBelief();
	} catch (e) {}
}

/* ---------- 查询 ---------- */
export function identityOf(p) {
	try {
		if (!p) return "unknown";
		if (currentMode() !== "identity") return "unknown";
		if (p.identity === "zhu" || p === game.zhu) return "zhu";
		if (p.identityShown) return p.identity;
		_syncBelief();
		const b = _getB(p);
		if (!b) return "unknown";
		/* 取最大 */
		let best = "unknown", bestV = 0;
		for (const k of ["fan", "zhong", "nei"]) {
			if (b[k] > bestV) { bestV = b[k]; best = k; }
		}
		/* 置信度不足时返回 unknown */
		if (bestV < 0.45) return "unknown";
		return best;
	} catch (e) { return "unknown"; }
}

export function confidenceOf(p) {
	try {
		if (!p) return 0;
		if (currentMode() !== "identity") return 0;
		if (p.identity === "zhu" || p === game.zhu) return 1;
		if (p.identityShown) return 1;
		_syncBelief();
		const b = _getB(p);
		if (!b) return 0;
		let best = 0;
		for (const k of ["fan", "zhong", "nei"]) if (b[k] > best) best = b[k];
		return Math.round(best * 100) / 100;
	} catch (e) { return 0; }
}

export function beliefOf(p) {
	try {
		_syncBelief();
		const b = _getB(p);
		if (!b) return null;
		return { fan: Math.round(b.fan * 100) / 100, zhong: Math.round(b.zhong * 100) / 100, nei: Math.round(b.nei * 100) / 100 };
	} catch (e) { return null; }
}

/* ---------- 推理级敌友（identity 模式下的专用覆盖） ---------- */
export function isLikelyEnemy(me, other) {
	try {
		if (!me || !other || me === other) return false;
		if (currentMode() !== "identity") return false;
		const myId = me.identity || (me === game.zhu ? "zhu" : "");
		const oId = identityOf(other);
		if (oId === "unknown") return false;

		const camp = { zhu: "loyal", zhong: "loyal", fan: "rebel", nei: "nei" };
		const myCamp = camp[myId];
		const oCamp = camp[oId];
		if (!myCamp || !oCamp) return false;
		if (myCamp === oCamp) return false;
		if (myCamp === "nei" || oCamp === "nei") return false; /* 内奸非直接敌 */
		return true;
	} catch (e) { return false; }
}

export function isLikelyAlly(me, other) {
	try {
		if (!me || !other || me === other) return false;
		if (currentMode() !== "identity") return false;
		const myId = me.identity || (me === game.zhu ? "zhu" : "");
		const oId = identityOf(other);
		if (oId === "unknown") return false;
		const camp = { zhu: "loyal", zhong: "loyal", fan: "rebel", nei: "nei" };
		const myCamp = camp[myId];
		const oCamp = camp[oId];
		if (!myCamp || !oCamp) return false;
		return myCamp === oCamp;
	} catch (e) { return false; }
}

/* ---------- 生命周期 ---------- */
export function resetBelief() {
	for (const k in BELIEF) delete BELIEF[k];
	_beliefRound = -1;
}

export function explainIdentity(p) {
	try {
		const b = beliefOf(p);
		return {
			key: keyOf(p),
			realIdentity: p ? p.identity : null,
			inferred: identityOf(p),
			confidence: confidenceOf(p),
			belief: b,
			observedHostility: p ? Math.round(hostilityOf(p) * 100) / 100 : 0,
			observedFriendliness: p ? Math.round(friendlinessOf(p) * 100) / 100 : 0,
		};
	} catch (e) { return { err: String(e) }; }
}
