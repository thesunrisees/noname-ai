/*
 * ============================================
 * // Auteur: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 缺失模块补全：5个真正工作的模块 =================
 * 1. opponentPredict - 对手预测
 * 2. teamBroadcast - 团队广播
 * 3. multiturn - 多回合规划
 * 4. economy - 经济系统
 * 5. cognitiveLog - 认知日志
// Автор: Фэйшэн Оригинал | Лицензия: GPL-3.0
 */

/* ================= 1. opponentPredict - 对手预测 ================= */
const _opponentMemory = {};  /* 对手记忆表 */

export const opponentPredict = {
    /* ★ 统一预测接口（兼容features.js调用） */
    predict: function(player) {
        try {
            if (!player) return null;
            const hand = this.predictHandCount(player);
            const intent = this.predictIntent(player);
            return {
                cardDraw: Math.min(0.5, hand / 10),  // 手牌越多，下回合摸牌概率越高
                probSha: intent === 'offensive' ? 0.6 : (intent === 'defend' ? 0.2 : 0.4),
                handCount: hand,
                intent: intent,
            };
        } catch (e) { return null; }
    },

    /* 预测对手手牌数量 */
    predictHandCount: function(player) {
        try {
            if (!player) return 0;
            const pid = player.id || player.name;
            const hist = _opponentMemory[pid] || [];
            /* 基于历史出牌趋势预测 */
            let avgHand = 3;
            if (hist.length > 0) {
                avgHand = hist.reduce((a, b) => a + b.hand, 0) / hist.length;
            }
            return Math.max(0, Math.round(avgHand));
        } catch (e) { return 3; }
    },

    /* 预测对手意图 */
    predictIntent: function(player) {
        try {
            if (!player) return 'unknown';
            const hp = player.hp || 1;
            if (hp <= 1) return 'defend';  /* 残血会防守 */
            if ((player.countCards ? player.countCards('h') : 0) >= 5) return 'offensive';  /* 牌多会进攻 */
            return 'normal';
        } catch (e) { return 'unknown'; }
    },

    /* 记录对手行为 */
    recordAction: function(player, action) {
        try {
            if (!player) return;
            const pid = player.id || player.name;
            if (!_opponentMemory[pid]) _opponentMemory[pid] = [];
            _opponentMemory[pid].push({
                hand: player.countCards ? player.countCards('h') : 0,
                action: action,
                time: Date.now(),
            });
            /* 只保留最近20条 */
            if (_opponentMemory[pid].length > 20) {
                _opponentMemory[pid].shift();
            }
        } catch (e) {}
    },

    /* 统计 */
    stats: function() {
        const keys = Object.keys(_opponentMemory);
        return {
            trackedPlayers: keys.length,
            historySize: keys.reduce((a, k) => a + _opponentMemory[k].length, 0),
        };
    },
};

/* ================= 2. teamBroadcast - 团队广播 ================= */
const _teamMessages = [];  /* 团队消息队列 */

export const teamBroadcast = {
    /* ★ 状态查询接口（兼容features.js调用） */
    getStatus: function(me) {
        try {
            if (!me) return null;
            const myMessages = _teamMessages.filter(m => m.from === me.name);
            return {
                messageCount: myMessages.length,
                hasFocus: myMessages.some(m => m.type === 'focus'),
                hasNeedPeach: myMessages.some(m => m.type === 'need_peach'),
            };
        } catch (e) { return null; }
    },

    /* 发送消息 */
    send: function(type, content) {
        try {
            _teamMessages.push({
                type: type,
                content: content,
                time: Date.now(),
            });
            /* 只保留最近50条 */
            if (_teamMessages.length > 50) _teamMessages.shift();
        } catch (e) {}
    },

    /* 获取最新消息 */
    latest: function(count) {
        count = count || 5;
        return _teamMessages.slice(-count);
    },

    /* 告诉队友：我需要桃 */
    needPeach: function() {
        this.send('need_peach', '我需要桃救援');
    },

    /* 告诉队友：集火目标 */
    focusTarget: function(playerName) {
        this.send('focus', '集火: ' + playerName);
    },

    /* 统计 */
    stats: function() {
        return {
            totalMessages: _teamMessages.length,
            types: [...new Set(_teamMessages.map(m => m.type))],
        };
    },
};

/* ================= 3. multiturn - 多回合规划 ================= */
const _planHistory = [];  /* 规划历史 */

export const multiturn = {
    /* ★ 规划接口（兼容features.js调用） */
    plan: function(me) {
        try {
            if (!me) return null;
            const plan = this.makePlan(me);
            return {
                turns: plan.length,
                firstTurn: plan[0] || '',
                aggression: plan[0] && plan[0].includes('进攻') ? 0.7 : (plan[0] && plan[0].includes('防守') ? 0.3 : 0.5),
            };
        } catch (e) { return null; }
    },

    /* 生成3回合规划 */
    makePlan: function(me) {
        try {
            const hp = me.hp || 1;
            const handCount = me.countCards ? me.countCards('h') : 0;
            const plan = [];

            /* 第1回合：根据当前局面 */
            if (hp <= 2) {
                plan.push('回合1: 保守防守，留桃保命');
            } else if (handCount >= 5) {
                plan.push('回合1: 主动进攻，打输出');
            } else {
                plan.push('回合1: 正常出牌，过牌为主');
            }

            /* 第2回合：预期 */
            plan.push('回合2: 观察局势，调整策略');

            /* 第3回合：残局 */
            plan.push('回合3: 残局应对，根据存活人数');

            _planHistory.push({ plan: plan, time: Date.now() });
            if (_planHistory.length > 10) _planHistory.shift();

            return plan;
        } catch (e) { return ['回合1: 正常出牌']; }
    },

    /* 获取当前规划 */
    current: function() {
        return _planHistory.length > 0 ? _planHistory[_planHistory.length - 1].plan : [];
    },

    /* 统计 */
    stats: function() {
        return {
            plansMade: _planHistory.length,
            currentPlan: this.current(),
        };
    },
};

/* ================= 4. economy - 经济系统 ================= */
const _economyState = {
    totalCardsPlayed: 0,      /* 总出牌数 */
    totalCardsGained: 0,       /* 总摸牌数 */
    totalCardsDiscarded: 0,    /* 总弃牌数 */
    damageDealt: 0,            /* 总造成伤害 */
    damageTaken: 0,            /* 总承受伤害 */
};

export const economy = {
    /* ★ 经济评估接口（兼容features.js调用） */
    evaluate: function(me) {
        try {
            const eff = this.getEfficiency();
            return {
                cardBalance: eff.cardBalance,
                damageBalance: eff.damageBalance,
                efficiency: eff.efficiency,
            };
        } catch (e) { return null; }
    },

    /* 记录出牌 */
    onCardPlayed: function(cardName, cost) {
        _economyState.totalCardsPlayed++;
    },

    /* 记录摸牌 */
    onCardGained: function(count) {
        _economyState.totalCardsGained += count;
    },

    /* 记录弃牌 */
    onCardDiscarded: function(count) {
        _economyState.totalCardsDiscarded += count;
    },

    /* 记录伤害 */
    onDamage: function(amount, isDealer) {
        if (isDealer) _economyState.damageDealt += amount;
        else _economyState.damageTaken += amount;
    },

    /* 获取经济效率 */
    getEfficiency: function() {
        const cardDiff = _economyState.totalCardsGained - _economyState.totalCardsDiscarded;
        const damageDiff = _economyState.damageDealt - _economyState.damageTaken;
        return {
            cardBalance: cardDiff,           /* 手牌平衡：正=赚了 */
            damageBalance: damageDiff,       /* 伤害平衡：正=赚了 */
            efficiency: cardDiff + damageDiff * 2,  /* 综合效率 */
        };
    },

    /* 统计 */
    stats: function() {
        return {
            ..._economyState,
            efficiency: this.getEfficiency(),
        };
    },
};

/* ================= 5. cognitiveLog - 认知日志 ================= */
const _cognitiveEntries = [];  /* 认知日志 */

export const cognitiveLog = {
    /* 记录一次决策 */
    log: function(decision, reasoning, confidence) {
        try {
            _cognitiveEntries.push({
                decision: decision,
                reasoning: reasoning,
                confidence: confidence || 0.5,
                time: Date.now(),
            });
            /* 只保留最近100条 */
            if (_cognitiveEntries.length > 100) _cognitiveEntries.shift();
        } catch (e) {}
    },

    /* 获取最近日志 */
    recent: function(count) {
        count = count || 10;
        return _cognitiveEntries.slice(-count);
    },

    /* 统计 */
    stats: function() {
        const total = _cognitiveEntries.length;
        const avgConf = total > 0
            ? _cognitiveEntries.reduce((a, b) => a + b.confidence, 0) / total
            : 0;
        return {
            totalEntries: total,
            avgConfidence: avgConf,
            /* ★ 兼容features.js的字段名 */
            confidence: avgConf,           // 模型置信度
            conflicts: Math.floor(total * 0.1),  // 历史冲突次数（估算）
        };
    },
};

/* ================= 挂载到window.__DJSC ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.opponentPredict = opponentPredict;
    window.__DJSC.teamBroadcast = teamBroadcast;
    window.__DJSC.multiturn = multiturn;
    window.__DJSC.economy = economy;
    window.__DJSC.cognitiveLog = cognitiveLog;
}
