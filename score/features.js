/* ================= 特征提取 · Int8 · 130维 =================
 * 0-31  状态特征（原 32 维，保留）
 * 32-47 动作特征（原 16 维，保留）
 * 48-63 时序特征（新增）
 * 64-79 相对强度特征（新增）
 * 80-95 概率/牌堆特征（新增）
 * 96-119 面板扩展特征（新增：技能/记忆/连招/预测/心理/位置/团队/规划/经济/认知）
 * 120-124 全卡牌分组概率（新增：控制/AOE/延时/爆发/过牌）
 * 125-129 完整技能标签（新增：摸牌/回复/辅助/生存/目标防御）
 */

export const FEATURE_DIM = 130;

/* ---------- 原有映射表 ---------- */
const ATK_IDS  = { sha:1, juedou:1, huogong:1, nanman:1, wanjian:1, zhujin:1, huosha:1, leisha:1 };
const DEF_IDS  = { shan:1, tao:1, wuxie:1, jiu:1 };
const CTRL_IDS = { guohe:1, shunshou:1, lebu:1, bingliang:1, tiesuo:1 };
const DELAY_IDS = { lebu:1, bingliang:1 };

/* ---------- ★ 时序历史缓存（按玩家名） ---------- */
const _HISTORY = new Map();
const _HISTORY_MAX = 60;   /* 每位玩家最多存 60 回合 */

function _histKey(p) { return p ? (p.name1 || p.name || '?') : '?'; }
function _histOf(p) {
    const k = _histKey(p);
    if (!_HISTORY.has(k)) {
        _HISTORY.set(k, {
            dmgOut: 0, dmgIn: 0,
            draw: 0, discard: 0,
            hpStart: p ? (p.hp || 0) : 0,
            hpNow: p ? (p.hp || 0) : 0,
            handStart: 0, handNow: 0,
            lastDamageTaken: 0,
            rounds: [],
        });
    }
    return _HISTORY.get(k);
}
export function recordTurnHistory(p) {
    try {
        const h = _histOf(p);
        h.hpNow = p.hp || 0;
        h.handNow = p.countCards ? p.countCards('h') : 0;
        h.rounds.push({ hp: h.hpNow, hand: h.handNow, ts: Date.now() });
        while (h.rounds.length > _HISTORY_MAX) h.rounds.shift();
    } catch (e) {}
}
export function resetFeatureHistory() { _HISTORY.clear(); }

/* ---------- 量化 ---------- */
function q(v) {
    if (v <= 0) return 0;
    if (v >= 1) return 127;
    return (v * 127) | 0;
}
function qSign(v, scale) {
    /* -127 ~ 127 映射：v/scale 后 clamp */
    scale = scale || 1;
    const x = v / scale;
    if (x >= 1) return 127;
    if (x <= -1) return -127;
    return (x * 127) | 0;
}

/* ================= 主函数 ================= */
export function extractFeatures(me, act, ctx, out, allPlayers) {
    const f = out || new Int8Array(FEATURE_DIM);
    for (let i = 0; i < FEATURE_DIM; i++) f[i] = 0;
    ctx = ctx || {};
    const _players = allPlayers || game.players || [];

    /* ========== 0-31 状态特征（保留） ========== */
    let hc = 0, hLimit = 5;
    try {
        hc = me.countCards ? me.countCards('h') : 0;
        hLimit = me.getHandcardLimit ? me.getHandcardLimit() : 5;
    } catch (e) {}
    f[0] = q(hc / 10);
    f[1] = q(hLimit > 0 ? hc / hLimit : 0);
    f[2] = _has(me, 'sha') ? 127 : 0;
    f[3] = _has(me, 'shan') ? 127 : 0;
    f[4] = _has(me, 'tao') ? 127 : 0;
    f[5] = _has(me, 'wuxie') ? 127 : 0;
    f[6] = _has(me, 'juedou') ? 127 : 0;
    f[7] = (_has(me, 'nanman') || _has(me, 'wanjian')) ? 127 : 0;

    const hp = me.hp || 0;
    const maxHp = me.maxHp || 1;
    f[8]  = q(hp / Math.max(1, maxHp));
    f[9]  = hp <= 2 ? 127 : 0;
    f[10] = hp <= 1 ? 127 : 0;
    f[11] = hp <= 0 ? 127 : 0;

    const id = me.identity || '';
    f[12] = id === 'zhu' ? 127 : 0;
    f[13] = (id === 'zhong' || id === 'mingzhong') ? 127 : 0;
    f[14] = id === 'fan' ? 127 : 0;
    f[15] = id === 'nei' ? 127 : 0;

    let alive = 0, enemies = 0, allies = 0, allyLow = 0, enemyLow = 0;
    let enemyZhuge = 0, enemyTengjia = 0;
    try {
        for (const p of _players) {
            if (!p || p.alive === false) continue;
            alive++;
            if (p === me) continue;
            const att = get.attitude(me, p);
            if (att > 0) { allies++; if ((p.hp || 0) <= 1) allyLow++; }
            else if (att < 0) {
                enemies++;
                if ((p.hp || 0) <= 1) enemyLow++;
                if (p.getEquip && p.getEquip('zhuge')) enemyZhuge = 1;
                if (p.getEquip && p.getEquip('tengjia')) enemyTengjia = 1;
            }
        }
    } catch (e) {}
    f[16] = q(alive / 8);
    f[17] = q(enemies / 4);
    f[18] = q(allies / 4);
    f[19] = q(allyLow / 3);
    f[20] = q(enemyLow / 3);
    f[21] = enemyZhuge ? 127 : 0;
    f[22] = enemyTengjia ? 127 : 0;
    f[23] = 0;

    f[24] = _hasEquip(me, 'equip1') ? 127 : 0;
    f[25] = _hasEquip(me, 'equip2') ? 127 : 0;
    f[26] = (_hasEquip(me, 'equip3') || _hasEquip(me, 'equip4')) ? 127 : 0;
    f[27] = (me.getEquip && me.getEquip('zhuge')) ? 127 : 0;

    let round = 0;
    try {
        if (_status && typeof _status.roundNumber === 'number') round = _status.roundNumber;
        else if (game && typeof game.roundNumber === 'number') round = game.roundNumber;
    } catch (e) {}
    f[28] = q(round / 20);
    f[29] = round <= 3 ? 127 : 0;
    f[30] = alive <= 3 ? 127 : 0;
    f[31] = (_has(me, 'wuzhong') || _has(me, 'tiesuo')) ? 127 : 0;

    /* ========== 32-47 动作特征（保留） ========== */
    const t = act.type;
    f[32] = t === 'card'  ? 127 : 0;
    f[33] = t === 'skill' ? 127 : 0;
    f[34] = t === 'equip' ? 127 : 0;
    f[35] = t === 'end'   ? 127 : 0;

    const cid = act.id || '';
    f[36] = ATK_IDS[cid]  ? 127 : 0;
    f[37] = DEF_IDS[cid]  ? 127 : 0;
    f[38] = CTRL_IDS[cid] ? 127 : 0;
    f[39] = cid === 'sha'   ? 127 : 0;
    f[40] = cid === 'tao'   ? 127 : 0;
    f[41] = cid === 'wuxie' ? 127 : 0;

    const tgt = ctx.bestT;
    if (tgt) {
        let isAlly = false;
        try {
            if (get.attitude(me, tgt) > 0) isAlly = true;
            const strategy = typeof getModeStrategy === 'function' ? getModeStrategy() : null;
            if (strategy && strategy.getCamp) {
                if (strategy.getCamp(me) === strategy.getCamp(tgt)) isAlly = true;
            }
        } catch (e) {}
        f[42] = isAlly ? 127 : 0;
        f[43] = isAlly ? 0 : 127;
        f[44] = q((tgt.hp || 0) / Math.max(1, tgt.maxHp || 1));
        let thc = 0;
        try { thc = tgt.countCards ? tgt.countCards('h') : 0; } catch (e) {}
        f[45] = q(thc / 10);
        f[46] = q((ctx.bestTs || 0) / 15);
        f[47] = (ctx.focusTarget && tgt === ctx.focusTarget) ? 127 : 0;
    }

    /* ========== ★ 48-63 时序特征 ========== */
    try {
        const h = _histOf(me);
        /* 48: 本局回合数 */
        f[48] = q(round / 20);
        /* 49: 累计造成伤害 / 10 */
        f[49] = q(h.dmgOut / 10);
        /* 50: 累计受到伤害 / 10 */
        f[50] = q(h.dmgIn / 10);
        /* 51: 伤害净值（正=优势，负=劣势） */
        f[51] = qSign(h.dmgOut - h.dmgIn, 10);
        /* 52: 手牌趋势（当前 - 起始） */
        const handStart = h.handStart || hc;
        f[52] = qSign(hc - handStart, 5);
        /* 53: 血量趋势 */
        const hpStart = h.hpStart || hp;
        f[53] = qSign(hp - hpStart, 5);
        /* 54: 最近一次受到的伤害 */
        f[54] = q(Math.min(1, h.lastDamageTaken / 3));
        /* 55: 最近 3 回合血量变化标准差（越高越不稳） */
        try {
            const recent = h.rounds.slice(-3).map(x => x.hp);
            if (recent.length >= 2) {
                const avg = recent.reduce((a,b)=>a+b,0) / recent.length;
                const sd = Math.sqrt(recent.reduce((s,v)=>s+(v-avg)*(v-avg),0) / recent.length);
                f[55] = q(sd / 3);
            }
        } catch (e) {}
        /* 56: 是否本回合首次行动 */
        f[56] = (round > 0 && (me.phaseNumber || 0) <= 1) ? 127 : 0;
        /* 57: 是否刚被攻击（1 回合内） */
        f[57] = (h.lastDamageTaken > 0 && (Date.now() - (h.lastDmgTs || 0)) < 60000) ? 127 : 0;
        /* 58-63: AI 自我状态（校准偏移 + 元认知） */
        try {
            const calib = window.__DJSC && window.__DJSC.calibrator ? window.__DJSC.calibrator.weights() : null;
            if (calib) {
                f[58] = qSign(calib.atk, 0.3);
                f[59] = qSign(calib.def, 0.3);
                f[60] = qSign(calib.wAtkCard, 0.3);
                f[61] = qSign(calib.wDefCard, 0.3);
                f[62] = qSign(calib.modelTrust, 0.3);
            }
            const meta = window.__DJSC && window.__DJSC.metaCognition;
            if (meta && meta.modulate) {
                const m = meta.modulate({ type: act.type, id: act.id, target: ctx.bestT ? (ctx.bestT.name1 || ctx.bestT.name) : null }, {});
                f[63] = q(m.familiarity);
            }
        } catch (e) {}
    } catch (e) {}

    /* ========== ★ 64-79 相对强度特征 ========== */
    try {
        let enemyAvgHand = 0, enemyAvgHp = 0, enemyAvgEq = 0, enemyCount2 = 0;
        let allyAvgHand = 0, allyAvgHp = 0, allyCount2 = 0;
        for (const p of _players) {
            if (!p || p === me || p.alive === false) continue;
            const att = get.attitude(me, p);
            const h2 = p.countCards ? p.countCards('h') : 0;
            const hp2 = p.hp || 0;
            const eq2 = p.countCards ? p.countCards('e') : 0;
            if (att < 0) {
                enemyAvgHand += h2; enemyAvgHp += hp2; enemyAvgEq += eq2; enemyCount2++;
            } else if (att > 0) {
                allyAvgHand += h2; allyAvgHp += hp2; allyCount2++;
            }
        }
        if (enemyCount2 > 0) {
            enemyAvgHand /= enemyCount2;
            enemyAvgHp   /= enemyCount2;
            enemyAvgEq   /= enemyCount2;
        }
        if (allyCount2 > 0) {
            allyAvgHand /= allyCount2;
            allyAvgHp   /= allyCount2;
        }
        /* 64: 我手牌 vs 敌均值 */
        f[64] = qSign(hc - enemyAvgHand, 5);
        /* 65: 我 HP vs 敌均值 */
        f[65] = qSign(hp - enemyAvgHp, 5);
        /* 66: 我装备 vs 敌均值 */
        let myEq = 0;
        try { myEq = me.countCards ? me.countCards('e') : 0; } catch (e) {}
        f[66] = qSign(myEq - enemyAvgEq, 3);
        /* 67: 我方总分 vs 敌方总分（从 __DJSC.getRound 读） */
        try {
            const rd = window.__DJSC && window.__DJSC.getRound ? window.__DJSC.getRound() : {};
            let myScore = rd[_histKey(me)] || 0;
            let eScore = 0, eN = 0, aScore = 0, aN = 0;
            for (const p of _players) {
                if (!p || p === me || p.alive === false) continue;
                const k = p.name1 || p.name;
                const s = rd[k] || 0;
                const att = get.attitude(me, p);
                if (att < 0) { eScore += s; eN++; }
                else if (att > 0) { aScore += s; aN++; }
            }
            const myTeamScore = myScore + (aN > 0 ? aScore / aN : 0);
            const enemyTeamScore = eN > 0 ? eScore / eN : 0;
            f[67] = qSign(myTeamScore - enemyTeamScore, 20);
        } catch (e) {}
        /* 68: 阵营人数比 */
        f[68] = q((allies + 1) / Math.max(1, enemies + 1) / 3);
        /* 69: 我关键牌密度（杀/闪/桃/无懈 占比） */
        try {
            let keyCnt = 0;
            const hand = me.getCards ? me.getCards('h') : [];
            for (const c of hand) {
                const n = get.name(c, me);
                if (n === 'sha' || n === 'shan' || n === 'tao' || n === 'wuxie') keyCnt++;
            }
            f[69] = q(keyCnt / Math.max(1, hand.length));
        } catch (e) {}
        /* 70: 我 HP 占全场 HP 总和比例 */
        try {
            let totalHp = hp, allHp = hp;
            for (const p of _players) {
                if (!p || p === me || p.alive === false) continue;
                allHp += (p.hp || 0);
            }
            f[70] = q(totalHp / Math.max(1, allHp));
        } catch (e) {}
        /* 71: 我手牌占全场手牌比例 */
        try {
            let allH = hc;
            for (const p of _players) {
                if (!p || p === me || p.alive === false) continue;
                allH += (p.countCards ? p.countCards('h') : 0);
            }
            f[71] = q(hc / Math.max(1, allH));
        } catch (e) {}
        /* 72-75: 元认知 / 干预级别 */
        try {
            const meta = window.__DJSC && window.__DJSC.metaCognition;
            if (meta && meta.modulate) {
                const m = meta.modulate({ type: act.type, id: act.id, target: ctx.bestT ? (ctx.bestT.name1 || ctx.bestT.name) : null }, {});
                f[72] = m.level === 'high' ? 127 : (m.level === 'mid' ? 64 : 0);
                f[73] = q(m.modulator);
            }
            const cal = window.__DJSC && window.__DJSC.calibrator;
            if (cal && cal.lr) f[74] = q(cal.lr());
            try {
                const lastMeta = _status && _status.djsc_lastMeta;
                if (lastMeta && lastMeta.intervention) {
                    f[75] = lastMeta.intervention === 'model' ? 127 :
                            lastMeta.intervention === 'blend' ? 85 :
                            lastMeta.intervention === 'rule' ? 42 : 0;
                }
            } catch (e) {}
        } catch (e) {}
    } catch (e) {}

    /* ========== ★ 80-95 概率/牌堆特征 ========== */
    try {
        /* ★ 手牌感知：80-84 维（已恢复） */
        const mod = window.__DJSC;
        if (mod && tgt) {
            if (typeof mod.probHasShan === 'function') f[80] = q(mod.probHasShan(me, tgt));
            if (typeof mod.probHasTao === 'function') f[81] = q(mod.probHasTao(me, tgt));
            if (typeof mod.probHasWuxie === 'function') f[82] = q(mod.probHasWuxie(me, tgt));
            if (typeof mod.probHasSha === 'function') f[83] = q(mod.probHasSha(me, tgt));
            if (typeof mod.probHasJiu === 'function') f[84] = q(mod.probHasJiu(me, tgt));
        }
        /* 85: 距离 */
        if (tgt) {
            try {
                const d = get.distance ? get.distance(me, tgt) : 1;
                f[85] = q(Math.min(1, d / 5));
            } catch (e) {}
        }
        /* 86: 座位压力 */
        try {
            const mod = window.__DJSC;
            if (mod && mod.seatPressure) {
                const sp = mod.seatPressure(me);
                f[86] = q((sp && sp.enemyPressure) || 0);
            }
        } catch (e) {}
        /* 87: 集火匹配（目标是否团队集火目标） */
        f[87] = (ctx.focusTarget && tgt === ctx.focusTarget) ? 127 : 0;

        /* 88: 牌堆剩余闪的比例 */
        try {
            const mod = window.__DJSC && window.__DJSC.deckMemory;
            if (mod) {
                const shanR = mod.cardRemaining ? mod.cardRemaining('shan') : 0;
                const totalR = mod.totalRemaining ? mod.totalRemaining() : 1;
                f[88] = q(shanR / Math.max(1, totalR));
            }
        } catch (e) {}
        /* 89: 牌堆剩余杀的比例 */
        try {
            const mod = window.__DJSC && window.__DJSC.deckMemory;
            if (mod) {
                const shaR = mod.cardRemaining ? mod.cardRemaining('sha') : 0;
                const totalR = mod.totalRemaining ? mod.totalRemaining() : 1;
                f[89] = q(shaR / Math.max(1, totalR));
            }
        } catch (e) {}
        /* 90: 牌堆剩余桃的比例 */
        try {
            const mod = window.__DJSC && window.__DJSC.deckMemory;
            if (mod) {
                const taoR = mod.cardRemaining ? mod.cardRemaining('tao') : 0;
                const totalR = mod.totalRemaining ? mod.totalRemaining() : 1;
                f[90] = q(taoR / Math.max(1, totalR));
            }
        } catch (e) {}
        /* 91: 剩余牌堆规模（越小越接近残局） */
        try {
            const mod = window.__DJSC && window.__DJSC.deckMemory;
            if (mod) {
                const t2 = mod.totalRemaining ? mod.totalRemaining() : 100;
                f[91] = 127 - q(Math.min(1, t2 / 150));
            }
        } catch (e) {}
        /* 92: 当前阶段（早期/中期/残局） */
        f[92] = alive <= 3 ? 127 : (alive <= 5 ? 64 : 0);
        /* 93-95: 全局校准统计 */
        try {
            const cal = window.__DJSC && window.__DJSC.calibrator;
            if (cal && cal.stats) {
                const s = cal.stats();
                f[93] = q((s.ruleWin || 0) / Math.max(1, s.total || 1));
                const cf = window.__DJSC.conflict && window.__DJSC.conflict.stats ? window.__DJSC.conflict.stats() : null;
                if (cf) f[94] = q(parseFloat((cf.rate || '0%').replace('%', '')) / 100);
                f[95] = q(Math.min(1, Math.log10(1 + (s.total || 0)) / 3));
            }
        } catch (e) {}

        /* ================= 96-119: 面板扩展特征（24维） ================= */

        /* 96-99: 我的技能标签统计 */
        try {
            const myTags = { attack:0, defense:0, burst:0, control:0 };
            const tagMod = window.__DJSC && window.__DJSC.skillTags;
            (me.skills || []).forEach(function(sid) {
                if (!tagMod || typeof tagMod.get !== 'function') return;
                const tag = tagMod.get(sid);
                if (tag === 'attack') myTags.attack++;
                if (tag === 'defense') myTags.defense++;
                if (tag === 'burst') myTags.burst++;
                if (tag === 'control') myTags.control++;
            });
            f[96] = q(Math.min(1, myTags.attack / 3));    // 我的攻击技能数
            f[97] = q(Math.min(1, myTags.defense / 3));   // 我的防御技能数
            f[98] = q(Math.min(1, myTags.burst / 2));     // 我的爆发技能数
            f[99] = q(Math.min(1, myTags.control / 2));   // 我的控制技能数
        } catch (e) {}

        /* 100-101: 目标的技能标签统计 */
        try {
            if (tgt) {
                const tgtTags = { attack:0, burst:0 };
                const tagMod = window.__DJSC && window.__DJSC.skillTags;
                (tgt.skills || []).forEach(function(sid) {
                    if (!tagMod || typeof tagMod.get !== 'function') return;
                    const tag = tagMod.get(sid);
                    if (tag === 'attack') tgtTags.attack++;
                    if (tag === 'burst') tgtTags.burst++;
                });
                f[100] = q(Math.min(1, tgtTags.attack / 3));  // 目标的攻击技能数
                f[101] = q(Math.min(1, tgtTags.burst / 2));    // 目标的爆发技能数
            }
        } catch (e) {}

        /* 102-103: 玩家记忆（对手进攻倾向/仇恨度） */
        try {
            const memMod = window.__DJSC && window.__DJSC.playerMemory;
            if (memMod && tgt) {
                const mem = memMod.getMemory ? memMod.getMemory(tgt) : null;
                if (mem) {
                    f[102] = q(Math.min(1, (mem.attacks || 0) / 5));   // 对手进攻倾向
                    f[103] = q(Math.min(1, (mem.hatred || 0) / 10));  // 对手仇恨度
                }
            }
        } catch (e) {}

        /* 104-105: 连招链（可触发连招数/连招威胁度） */
        try {
            const comboMod = window.__DJSC && window.__DJSC.comboChain;
            if (comboMod) {
                const combo = comboMod.analyze ? comboMod.analyze(me) : null;
                if (combo) {
                    f[104] = q(Math.min(1, (combo.count || 0) / 3));       // 可触发连招数
                    f[105] = q(Math.min(1, (combo.threat || 0) / 10));     // 连招威胁度
                }
            }
        } catch (e) {}

        /* 106-107: 对手预测（下回合出牌概率/杀概率） */
        try {
            const predMod = window.__DJSC && window.__DJSC.opponentPredict;
            if (predMod && tgt) {
                const pred = predMod.predict ? predMod.predict(tgt) : null;
                if (pred) {
                    f[106] = q(pred.cardDraw || 0);    // 下回合摸牌概率
                    f[107] = q(pred.probSha || 0);     // 下回合出杀概率
                }
            }
        } catch (e) {}

        /* 108-109: 心理状态（对手激进程度/紧张度） */
        try {
            const psyMod = window.__DJSC && window.__DJSC.psychology;
            if (psyMod && tgt) {
                const psy = psyMod.getState ? psyMod.getState(tgt) : null;
                if (psy) {
                    f[108] = q(psy.aggressive || 0);   // 激进程度
                    f[109] = q(psy.nervous || 0);      // 紧张度
                }
            }
        } catch (e) {}

        /* 110-111: 位置压力（下家威胁度/上家威胁度） */
        try {
            const seatMod = window.__DJSC && window.__DJSC.seatPressure;
            if (seatMod) {
                const seat = seatMod.analyze ? seatMod.analyze(me) : null;
                if (seat) {
                    f[110] = q(seat.nextEnemy || 0);    // 下家威胁度
                    f[111] = q(seat.prevEnemy || 0);    // 上家威胁度
                }
            }
        } catch (e) {}

        /* 112-113: 团队关系（队友集火数/队友保护数） */
        try {
            const teamMod = window.__DJSC && window.__DJSC.teamBroadcast;
            if (teamMod) {
                const team = teamMod.getStatus ? teamMod.getStatus(me) : null;
                if (team) {
                    f[112] = q(Math.min(1, (team.focusCount || 0) / 3));   // 队友集火数
                    f[113] = q(Math.min(1, (team.protectCount || 0) / 3)); // 队友保护数
                }
            }
        } catch (e) {}

        /* 114-115: 多回合规划（未来1回合收益/未来3回合收益） */
        try {
            const mtMod = window.__DJSC && window.__DJSC.multiturn;
            if (mtMod) {
                const mt = mtMod.plan ? mtMod.plan(me) : null;
                if (mt) {
                    f[114] = q(Math.min(1, Math.max(0, (mt.r1 || 0)) / 5));   // 未来1回合收益
                    f[115] = q(Math.min(1, Math.max(0, (mt.r3 || 0)) / 10));  // 未来3回合收益
                }
            }
        } catch (e) {}

        /* 116-117: 经济系统（我的牌价值/装备价值） */
        try {
            const econMod = window.__DJSC && window.__DJSC.economy;
            if (econMod) {
                const econ = econMod.evaluate ? econMod.evaluate(me) : null;
                if (econ) {
                    f[116] = q(Math.min(1, (econ.handValue || 0) / 20));     // 我的牌价值
                    f[117] = q(Math.min(1, (econ.equipValue || 0) / 10));    // 我的装备价值
                }
            }
        } catch (e) {}

        /* 118-119: 认知日志（模型置信度/历史冲突次数） */
        try {
            const cogMod = window.__DJSC && window.__DJSC.cognitiveLog;
            if (cogMod) {
                const cog = cogMod.stats ? cogMod.stats() : null;
                if (cog) {
                    f[118] = q(cog.confidence || 0);      // 模型置信度
                    f[119] = q(Math.min(1, (cog.conflicts || 0) / 20)); // 历史冲突次数
                }
            }
        } catch (e) {}

        /* ================= 120-124: 全卡牌分组概率（5维） ================= */
        try {
            const cardMod = window.__DJSC && window.__DJSC.probHasCard;
            if (cardMod && tgt) {
                /* 120: 控制牌概率（过河拆桥+顺手牵羊+决斗） */
                const pGuohe = cardMod(tgt, 'guohe') || 0;
                const pShunshou = cardMod(tgt, 'shunshou') || 0;
                const pJuedou = cardMod(tgt, 'juedou') || 0;
                f[120] = q(Math.min(1, (pGuohe + pShunshou + pJuedou) / 3));

                /* 121: AOE概率（南蛮入侵+万箭齐发） */
                const pNanman = cardMod(tgt, 'nanman') || 0;
                const pWanjian = cardMod(tgt, 'wanjian') || 0;
                f[121] = q(Math.min(1, (pNanman + pWanjian) / 2));

                /* 122: 延时锦囊概率（乐不思蜀+兵粮寸断） */
                const pLebu = cardMod(tgt, 'lebu') || 0;
                const pBingliang = cardMod(tgt, 'bingliang') || 0;
                f[122] = q(Math.min(1, (pLebu + pBingliang) / 2));

                /* 123: 爆发牌概率（酒+铁索连环+火攻） */
                const pJiu = cardMod(tgt, 'jiu') || 0;
                const pTiesuo = cardMod(tgt, 'tiesuo') || 0;
                const pHuogong = cardMod(tgt, 'huogong') || 0;
                f[123] = q(Math.min(1, (pJiu + pTiesuo + pHuogong) / 3));

                /* 124: 过牌概率（无中生有+五谷丰登） */
                const pWuzhong = cardMod(tgt, 'wuzhong') || 0;
                const pWugu = cardMod(tgt, 'wugu') || 0;
                f[124] = q(Math.min(1, (pWuzhong + pWugu) / 2));
            }
        } catch (e) {}

        /* ================= 125-129: 完整技能标签补充（5维） ================= */
        try {
            const tagMod = window.__DJSC && window.__DJSC.skillTags;
            if (tagMod && typeof tagMod.get === 'function') {
                /* 我的完整技能标签统计 */
                const myAllTags = { draw:0, recover:0, utility:0, survival:0 };
                (me.skills || []).forEach(function(sid) {
                    const tag = tagMod.get(sid);
                    if (tag === 'draw') myAllTags.draw++;
                    if (tag === 'recover') myAllTags.recover++;
                    if (tag === 'utility') myAllTags.utility++;
                    if (tag === 'survival') myAllTags.survival++;
                });
                f[125] = q(Math.min(1, myAllTags.draw / 2));      // 我的摸牌技能数
                f[126] = q(Math.min(1, myAllTags.recover / 2));    // 我的回复技能数
                f[127] = q(Math.min(1, myAllTags.utility / 2));    // 我的辅助技能数
                f[128] = q(Math.min(1, myAllTags.survival / 2));   // 我的生存技能数

                /* 目标的防御技能数 */
                if (tgt) {
                    let tgtDef = 0;
                    (tgt.skills || []).forEach(function(sid) {
                        const tag = tagMod.get(sid);
                        if (tag === 'defense') tgtDef++;
                    });
                    f[129] = q(Math.min(1, tgtDef / 3));  // 目标的防御技能数
                }
            }
        } catch (e) {}

    } catch (e) {}

    return f;
}

/* ================= 辅助 ================= */
function _has(me, id) {
    try { return me.countCards && me.countCards('h', id) > 0; } catch (e) { return false; }
}
function _hasEquip(me, subtype) {
    try {
        const cards = me.getCards ? me.getCards('e') : [];
        for (const c of cards) {
            const st = get.subtype ? get.subtype(c) : null;
            if (st === subtype || st === subtype + '+') return true;
        }
    } catch (e) {}
    return false;
}

/* ================= 特征名（给面板/解释用） ================= */
export const FEATURE_NAMES = [
    /* 0-31 状态 */
    '手牌数','手牌占上限','有杀','有闪','有桃','有无懈','有决斗','有AOE',
    'HP比例','HP≤2','HP≤1','HP≤0','身份主公','身份忠臣','身份反贼','身份内奸',
    '存活数','敌人数','友方数','友方濒死','敌方濒死','敌方有连弩','敌方有藤甲','预留',
    '有武器','有防具','有坐骑','有连弩','回合数','早期','残局','有补牌',
    /* 32-47 动作 */
    '动作卡牌','动作技能','动作装备','动作结束','攻击牌','防御牌','控制牌','杀','桃','无懈',
    '目标友方','目标敌方','目标HP比','目标手牌','目标分','集火匹配',
    /* 48-63 时序 */
    '累计伤害输出','累计伤害承受','伤害净值','手牌趋势','血量趋势','最近受伤','血量波动','首行动','近期被攻','预留','预留','预留','预留','预留','预留','预留',
    /* 64-79 相对强度 */
    '手牌vs敌均','HPvs敌均','装vs敌均','分vs敌均','阵营比','关键牌密度','HP占比','手牌占比','预留','预留','预留','预留','预留','预留','预留','预留',
    /* 80-95 概率/牌堆 */
    '目标有闪概率','目标有桃概率','目标有无懈概率','目标有杀概率','目标有酒概率','距离','座位压力','集火目标',
    '牌堆闪比','牌堆杀比','牌堆桃比','牌堆规模','阶段','预留','预留','预留',
];
