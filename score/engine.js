/* ================= 决策积分引擎 · 记分核心+评分框架（整合模块） ================= */
import { lib, game, ui, get, ai, _status } from '../../../noname.js';
import { VAL_CARD, VAL_EFFECT } from './value-tables.js';
import { codeGainOf, skillRuleOf, detectCombo, skillProfileOf, skillBranchesOf, checkBranch, skillStagesOf, skillInteractionOf, skillTagsOf } from './skills.js';
import { enemiesOf, isEnemyOf, situationFactor, targetScore, probHasBagua, probHasShan, hasVengeanceSkill, cardValueOf, clearThreatCache, seatPressure, forecastSummary, burstThreatOf, maxBurstThreat } from './threat.js';
import { miniPredict, cardIdOf, MINI_W } from './mini-model.js';
import { miniFeatures } from './skills.js';
import { MEM, memLoad, memSave, memReset, memRecordAtk, memRecordHit, memKeyOf } from './mem.js';
import { observeAttack, observeAid, observeCardUse, resetObs, getObs, fireAttackExpectedHit } from './observer.js';
import './scoreSelfMod.js';  // ★ 积分自修改器：AI 直接修改规则积分
import { deckConsume, deckReset, cardRemaining, deckAutoDetect, deckSyncFromUI } from './deckMemory.js';
import { baguaSuccessRate } from './deckPredict.js';
import { identityOf as _identityOf, beliefOf, updateBelief, confidenceOf, isLikelyEnemy, isLikelyAlly, resetBelief, explainIdentity } from './identity.js';
import { cfg, safe, nameOf, keyOf } from './util.js';
import { teamPlan } from './team.js';
import { log } from './logger.js';
import { getDecisionBonus, recordTargetOutcome, recordTempoOutcome, recordKeepOutcome, flushDecisionFeedback } from './decisionFeedback.js';
import { perfMark } from './perf.js';
import { resourceBalance, discardCost, sellHpValue, equipReplaceCost } from './economy.js';
import { styleOf } from './observer.js';
import { loadStore, saveStore, mergeOnSettle, storeStats } from './memory.js';
import { archiveGame, verdictOf, loadArchive, getArchive, getGameDecisions, exportArchiveJson } from './archive.js';
import { trainStartGame, trainRecordSample, trainSettleGame } from './trainExport.js';
import { loadFeedback, recordSkillUse, flushFeedback, feedbackCount } from './feedback.js';
import { multiTurnForecast } from './multiturn.js';
import { loadStyleFeedback, recordStyleOutcome, flushStyleFeedback, recordPlayerTag, saveStyleFeedback } from './styleFeedback.js';
import { focusBonus, broadcastIntent, installBroadcastHooks } from './teamBroadcast.js';
import { refineBestWithPlan, planSequence } from './planner.js';
import { strategize } from './strategist.js';
import { getModeStrategy, isSameCamp, isEnemy, applyModeBoost } from './modeStrategy.js';
/* ===== 24 个优化模块 ===== */
import { probHasWuxie, probHasTao, probHasSha, probHasJiu, probHasCard, inferHand } from './handInference.js';
import { keepScore, recommendKeep } from './keepStrategy.js';
import { equipScarcity, equipValue, isKeyEquip } from './equipScarcity.js';
import { analyzeTeammateIntent, analyzeTeammateStrategy, teammateCoordination, recordTeammateAction } from './teammateIntent.js';
import { analyzeOpponentPref, counterStrategy, predictOpponentNext, counterScoreBonus } from './counterStrategy.js';
import { evaluateSituation, describeSituation, situationStrategyBonus } from './situationEval.js';
import { shaHitRate, wuxieRisk, duelWinRate, taoNecessity, riskScore } from './riskQuant.js';
import { analyzeOpponentMood, describeMood, moodStrategyBonus, getAllMoods } from './moodState.js';
import { getMutualRelations, isCountering, isBeingCountered, counterRelationBonus } from './mutualRelations.js';
import { getCardPriority, recommendOrder, orderBonus, recommendFlow } from './orderOptimizer.js';
import { shouldPassCard, whatTeammateNeeds, passCardBonus } from './passStrategy.js';
import { countTiesuo, tiesuoTransfer, tianxiangTransfer, damageTransfer, damageTransferBonus } from './damageTransfer.js';
import { predictShaFollowup, predictJuedouFollowup, searchTree, treeSearchBonus } from './treeSearch.js';
import { needLongDelay, getSmartDelay, waitForSkills, checkSkillTriggered } from './delayOptimizer.js';
import { getDeckTop, hasGuanxingSkill, prioritizeDeckTop, deckTopBonus, clearDeckTopCache } from './deckTopPredict.js';
import { recommendDiscard, discardValue, specialDiscardAdvice, discardAdvice } from './discardStrategy.js';
import { recordGameResult, getWinRate, autoAdjustWeights, learningPanelData, clearLearningData } from './learningLoop.js';
import { aliveCount, identityGameStrategy, shouldRevealIdentity, gameTheoryBonus } from './gameTheory.js';
import { cached, clearAllCache, cacheStats, perfStart, perfEnd } from './perfOptimizer.js';
/* ===== v1.7.0 新增 5 个优化模块 ===== */
import { responseBonus } from './responseOpt.js';
import { discardBonus } from './discardOpt.js';
import { endgameBonus, isEndgame, endgameStrategy } from './endgameOpt.js';
import { opponentPredictBonus, recordOpponentAction } from './opponentPredict.js';
import { resourceTimingBonus } from './resourceTiming.js';
/* ===== v1.8.0 新增 5 个优化模块 ===== */
import { aoeBonus } from './aoeTiming.js';
import { judgeBonus } from './judgeTiming.js';
import { equipReplaceBonus } from './equipReplace.js';
import { keepBonus } from './keepStrategyOpt.js';
import { multiTurnBonus } from './multiTurnOpt.js';
/* ===== v1.0.2 新增 5 个锦囊时机优化模块 ===== */
import { duelBonus } from './duelTiming.js';
import { jiedaoBonus } from './jiedaoTiming.js';
import { shandianBonus } from './shandianTiming.js';
import { taoyuanBonus } from './taoyuanTiming.js';
import { wuguBonus } from './wuguTiming.js';
/* ===== v1.0.3 新增 5 个时机优化模块 ===== */
import { shaTargetBonus } from './shaTargetOpt.js';
import { taoBonus } from './taoTiming.js';
import { jiuBonus } from './jiuTiming.js';
import { wuxieBonus } from './wuxieTiming.js';
import { shunshouBonus } from './shunshouTiming.js';
/* ===== v1.0.4 深度价值量化模块 ===== */
import { deepValueBonus, deepCardValue, deepTargetValue, deepSituationValue } from './deepValue.js';
import { recordTrigger, getDecayMultiplier, applyDecay, clearDecayLog, getDecayStats } from './decayOpt.js';
import { toInt8, toFloat, unbiasedRound, clearCompensation } from './scoreUnify.js';
import { extractFeatures, FEATURE_DIM } from './features.js';
import { pushSample, bufferSize } from './trainExport.js';
import * as _trainExportModule from './trainExport.js';
import { getWeights, getBias, isReady as weightsReady, predict } from './weights.js';
import * as _weightsModule from './weights.js';
import { guardCheck, applyGuardPenalty } from './modelGuard.js';
import { observeElementUse, startElementFeedbackLoop, settleElementFeedback } from './elementFeedback.js';
import { metaStartGame, metaSettleGame, metaRecordSkill, metaRecordCard, metaRecordTarget, metaRecordDecision, cognitiveModulate, decideIntervention } from './metaCognition.js';
import './cognitiveLog.js';
import './conflictDetector.js';
import './decisionCalibrator.js';
import './calibratorPanel.js';
import './multiProfile.js';
import './strategyBus.js';
import './brainDashboard.js';
import './decisionReplay.js';
import './exportAll.js';
import './replayPanel.js';
import './weightPersist.js';
import './crossModeTransfer.js';
import './decisionCompare.js';
import './comparePanel.js';
import './modelHotSwap.js';
import './sharedKnowledge.js';
import './evolution.js';
import { psychologyBonus, deterrenceCheck, intentReading, pressureScore, strategicHold, psychologyStats, resetPsychology } from './psychology.js';
import { comboChainBonus, detectChains, chainScore, chainPriority, comboChainStats, resetComboChain, CHAINS } from './comboChain.js';
import { playerMemoryBonus, rememberGame, rememberAttack, rememberAid, playerMemoryStats, recallPlayer, hostilityLevel, playerMemoryList, resetPlayerMemory } from './playerMemory.js';
import { profStart, profEnd, profile, profilerEnable, profilerStats, openProfilerPanel } from './profiler.js';
import { narrate, renderNarrateHtml, recentNarrations, showRecentNarrations } from './decisionNarrator.js';
import { postCheckBefore, postCheckAfter, postCheckDelayed, postCheckStats, postCheckReset } from './postCheck.js';
import { getCardStrategy, cardUseValue, cardRespondValue, getCardType, getCardRisk, cardStrategyStats, resetCardStrategy } from './cardStrategy.js';
import { recordDecisionContext, settleDecisionContext, getAutoFeatureWeight, autoFeatureStats, topAutoFeatures, resetAutoFeatures } from './autoFeature.js';
import { getMetric, learnMetric, learnFromGame, softMetricStats, resetSoftMetrics } from './softMetrics.js';

/* ★ v2.2.5 ~ v2.3.2 新模块 import（必须 import 才会执行挂载） */
import './skillTags.js';      // 技能标签系统
import './judgeZone.js';      // 判定区状态检测
import './cardTags.js';       // 手牌标记系统
import './viewAs.js';         // viewAs/转化类AI
import './costCalc.js';       // cost函数计算
import './aiTools.js';        // AI工具集（嘲讽度/技能重要度/技能标签/回合外价值）
import './learningOptimizer.js';  // 学习效率优化器（优先级回放/特征筛选/课程学习/自适应学习率）
import './skillTiming.js';       // 技能触发时机识别（触发时机/技能类型/效果识别）

/* ★ 确保所有新模块挂载到 window.__DJSC 上 */
try {
    window.__DJSC = window.__DJSC || {};

    /* psychology - 博弈策略层 */
    window.__DJSC.psychology = {
        deterrence: deterrenceCheck,
        intent: intentReading,
        pressure: pressureScore,
        hold: strategicHold,
        bonus: psychologyBonus,
        stats: psychologyStats,
        reset: resetPsychology,
    };

    /* comboChain - 连招链 */
    window.__DJSC.comboChain = {
        detect: detectChains,
        score: chainScore,
        priority: chainPriority,
        bonus: comboChainBonus,
        stats: comboChainStats,
        reset: resetComboChain,
        CHAINS: CHAINS,
    };

    /* playerMemory - 对手长期记忆 */
    window.__DJSC.playerMemory = {
        remember: rememberGame,
        attack: rememberAttack,
        aid: rememberAid,
        recall: recallPlayer,
        hostility: hostilityLevel,
        bonus: playerMemoryBonus,
        stats: playerMemoryStats,
        list: playerMemoryList,
        reset: resetPlayerMemory,
    };

    /* profiler - 性能分析器 */
    window.__DJSC.profiler = {
        start: profStart,
        end: profEnd,
        profile: profile,
        enable: profilerEnable,
        stats: profilerStats,
        open: openProfilerPanel,
    };

    /* narrator - 决策解释器 */
    window.__DJSC.narrator = {
        narrate: narrate,
        render: renderNarrateHtml,
        recent: recentNarrations,
        show: showRecentNarrations,
    };
    window.__DJSC.openNarratorPanel = showRecentNarrations;
    window.__DJSC.openProfilerPanel = openProfilerPanel;

    /* identity - 身份推理（修正：挂载成object，不是function） */
    window.__DJSC.identity = {
        readIdentity: _identityOf,
        belief: beliefOf,
        updateBelief: updateBelief,
        confidence: confidenceOf,
        isEnemy: isLikelyEnemy,
        isAlly: isLikelyAlly,
        explain: explainIdentity,
        reset: resetBelief,
        stats: function() {
            return {
                identityOf: typeof _identityOf,
                beliefOf: typeof beliefOf,
                updateBelief: typeof updateBelief,
            };
        },
    };

    /* 概率推断函数挂载（供 features.js 80-84 维使用） */
    window.__DJSC.probHasShan = probHasShan;
    window.__DJSC.probHasTao = probHasTao;
    window.__DJSC.probHasWuxie = probHasWuxie;
    window.__DJSC.probHasSha = probHasSha;
    window.__DJSC.probHasJiu = probHasJiu;
    window.__DJSC.probHasCard = probHasCard;  // 通用卡牌推断
    window.__DJSC.inferHand = inferHand;      // 批量推断所有手牌
    window.__DJSC.seatPressure = seatPressure;
    window.__DJSC.cardValueOf = cardValueOf;
    window.__DJSC.enemiesOf = enemiesOf;
    window.__DJSC.isEnemyOf = isEnemyOf;
    window.__DJSC.situationFactor = situationFactor;
    window.__DJSC.targetScore = targetScore;
    window.__DJSC.forecastSummary = forecastSummary;
    window.__DJSC.burstThreatOf = burstThreatOf;
    window.__DJSC.maxBurstThreat = maxBurstThreat;
    window.__DJSC.deckMemory = {
        cardRemaining: cardRemaining,
        deckConsume: deckConsume,
        deckReset: deckReset,
        deckAutoDetect: deckAutoDetect,
        deckSyncFromUI: deckSyncFromUI,
        totalRemaining: function() {
            try {
                const pile = (typeof ui !== 'undefined' && ui.cardPile) ? ui.cardPile : null;
                const discard = (typeof ui !== 'undefined' && ui.discardPile) ? ui.discardPile : null;
                const pileCount = pile ? (pile.childNodes ? pile.childNodes.length : 0) : 0;
                const discardCount = discard ? (discard.childNodes ? discard.childNodes.length : 0) : 0;
                const total = pileCount + discardCount;
                return total > 0 ? total : 1;
            } catch (e) {
                return 1;
            }
        },
    };

    /* ★ 挂载模型推理与配置接口 */
    window.__DJSC.confidence = predict;
    window.__DJSC.cfg = cfg;
    window.__DJSC.weightsReady = weightsReady;
} catch (e) { console.error('挂载新模块失败:', e); }

/* ★ 单独挂载技能标签系统（不在 try 块里，确保一定能挂载） */
try {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.skillTags = {
        get: skillTagsOf,
        playerTags: function(p) { 
            const tags = { attack:0, defense:0, burst:0, control:0, draw:0, recover:0, utility:0, survival:0 };
            (p && p.skills ? p.skills : []).forEach(function(sid) {
                try {
                    const t = skillTagsOf(sid);
                    if (tags[t] !== undefined) tags[t]++;
                } catch (e2) {}
            });
            return tags;
        },
    };
    /* ★ 挂载训练数据导入/导出功能 */
    const te = window.__DJSC.__trainExportModule;
    if (te && te.exportForImport) {
        window.__DJSC.trainExport = function() { return te.exportForImport(); };
        window.__DJSC.trainImport = function(jsonStr) { return te.importFromJson(jsonStr); };
        console.log('[engine] ✅ trainExport/trainImport 已挂载');
    }
    /* ★ 自动创建 data 文件夹 */
    try {
        game.writeFile('', 'data', '.gitkeep', function() {});
        console.log('[engine] ✅ data 文件夹已就绪');
    } catch (eData) {
        console.warn('[engine] data 文件夹创建失败：', eData);
    }
    console.log('[engine] ✅ skillTags 已手动挂载');
} catch (eMount) {
    console.error('[engine] ❌ skillTags 挂载失败:', eMount);
}

let round = {};
let _rawRound = {};
let scoreLog = [];
let REC = { effects: {}, cards: {}, timings: {}, log: [] };
function rec(kind, key, extra) {
	try {
		if (!REC[kind]) REC[kind] = {};
		REC[kind][key] = (REC[kind][key] || 0) + 1;
		if (REC.log.length < 300) REC.log.push({ kind: kind, key: key, extra: extra || "", ts: Date.now() });
	} catch (e) {}
}
let installed = false;
let settleDone = false;
let settleIv = null;

const DJSC_ORIG = "__djsc_orig";   // proto 上保存原始函数的字段名（避免与其它扩展冲突）

/* ★ 友方动作评估挂起表 */
const _allyActionPending = [];

function _snapshotAlly(p) {
	try {
		return {
			hp: p.hp || 0,
			hc: (p.countCards ? p.countCards('h') : 0),
			eq: (p.countCards ? p.countCards('e') : 0),
		};
	} catch (e) { return null; }
}

function _evaluateAllyAction(rec) {
	try {
		const me = rec.me;
		const target = rec.target;
		if (!me || !target) return;

		/* 如果根本没有对友方造成任何损失 → 是支援，补正分 */
		if (!rec.hurt) {
			give(me, rec.value * 0.8, "支援友方（" + rec.id + "）");
			return;
		}

		const snap = rec.snap;
		if (!snap) return;
		const hpNow = target.hp || 0;
		const hcNow = (target.countCards ? target.countCards('h') : 0);
		const roundNow = round[keyOf(target)] || 0;

		/* 正收益判定：友方回血 / 摸牌 / 得分上升 */
		const hpGain = hpNow - snap.hp;
		const hcGain = hcNow - snap.hc;
		const roundGain = roundNow - (snap.round || 0);
		const hasPositive = (hpGain > 0) || (hcGain > 0) || (roundGain > rec.value * 0.5);

		if (hasPositive) return; // 有正收益，不惩罚

		/* 无正收益 → 按损失程度扣 50% / 70% */
		const hpLoss = -hpGain;
		const hcLoss = -hcGain;
		let rate = 0.5;                                  // 默认 50%
		if (hpLoss >= 2 || hcLoss >= 2 || hpNow <= 0) {
			rate = 0.7;                                  // 重伤 / 濒死 → 70%
		}

		const penalty = Math.abs(rec.value) * rate * 3;
		give(me, -penalty, "对友方无正收益造成损失（扣除 " + (rate * 100) + "%）");
		/* 阵营分惩罚：让敌人得分，相当于阵营失衡 */
		giveVs(me, -Math.abs(rec.value) * rate, "阵营分扣除 " + (rate * 100) + "%");
	} catch (e) {}
}

/* ★ 标记：某玩家正在被"友方评估"的动作伤害 */
function _markAllyHurt(target) {
	try {
		for (let i = 0; i < _allyActionPending.length; i++) {
			const rec = _allyActionPending[i];
			if (rec.target === target) rec.hurt = true;
		}
	} catch (e) {}
}

function give(char, pts, tag) {
	try {
		if (!char) return;
		const k = keyOf(char);
		/* ★ P0-2 修复：浮点累积，绝不反量化 */
		_rawRound[k] = (_rawRound[k] || 0) + pts;
		round[k] = toInt8(_rawRound[k]);
		scoreLog.push({ char: k, pts: Math.round(pts), tag: tag, ts: Date.now() });
		if (scoreLog.length > 400) scoreLog.shift();
	} catch (e) {}
}

/* 带阵营标注的显示名：名字（反贼阵营/主忠阵营/内奸/主公/未知） */
function displayName(char) {
	try {
		const nm = nameOf(char);
		if (!char) return nm;
		let id = "";
		try { id = _identityOf(char); } catch (e) {}
		let faction = "未知";
		if (id === "zhu") faction = "主公";
		else if (id === "zhong") faction = "主忠阵营";
		else if (id === "fan") faction = "反贼阵营";
		else if (id === "nei") faction = "内奸";
		return nm + "（" + faction + "）";
	} catch (e) { return nameOf(char); }
}
function givePair(from, to, pts, tag) { give(from, pts, tag); give(to, -pts, tag + "（守恒）"); }
/* ★ 阵营识别 */
function _campOf(player) {
	try {
		const mod = lib.__djsc_modeStrategy;
		if (mod && mod.getModeStrategy) {
			const strategy = mod.getModeStrategy();
			if (strategy && strategy.getCamp) return strategy.getCamp(player);
		}
	} catch (e) {}
	return (player && player.identity) || 'unknown';
}

/* ★ 个体贡献度：本局累计正分 */
function _contribution(player) {
	try {
		const k = keyOf(player);
		const v = round[k] || 0;
		return Math.max(0, v);
	} catch (e) { return 0; }
}

/* ★ 是否存活 */
function _isAlive(p) {
	try {
		if (!p) return false;
		if (p.alive === false) return false;
		if (typeof p.isDead === 'function' && p.isDead()) return false;
		return true;
	} catch (e) { return true; }
}

/* ★ 阵营平均分（只算活着的成员） */
function _campAvg(members) {
	const alive = members.filter(_isAlive);
	if (!alive.length) return 0;
	let sum = 0;
	for (let i = 0; i < alive.length; i++) sum += _contribution(alive[i]);
	return sum / alive.length;
}

/* ★ 按「阵营平均分」+ 多阵营分层分配扣分 */
function giveVs(char, pts, tag) {
	give(char, pts, tag);
	const es = enemiesOf(char);
	if (!es.length) return;

	const total = -pts;

	/* 按阵营分组 */
	const byCamp = {};
	es.forEach(function (e) {
		const camp = _campOf(e);
		if (!byCamp[camp]) byCamp[camp] = [];
		byCamp[camp].push(e);
	});

	/* ★ 阶段 1：过滤出"还有活人"的阵营 */
	const aliveCamps = Object.keys(byCamp).filter(function (camp) {
		return byCamp[camp].some(_isAlive);
	});

	/* 全部敌方阵营都灭 → 均摊给所有敌方（极端情况兜底） */
	if (aliveCamps.length === 0) {
		const per = Math.round(total * 100 / es.length) / 100;
		es.forEach(function (e) { give(e, per, tag + "（全灭均摊·守恒）"); });
		return;
	}

	/* ★ 阶段 2：只对活着的阵营计算平均分贡献度 */
	const campContrib = {};
	let campSum = 0;
	aliveCamps.forEach(function (camp) {
		const c = _campAvg(byCamp[camp]);
		campContrib[camp] = c;
		campSum += c;
	});

	/* 退化：全 0 → 均摊给活着的阵营成员 */
	if (campSum <= 0.01) {
		const aliveMembers = [];
		aliveCamps.forEach(function (camp) {
			byCamp[camp].forEach(function (p) { if (_isAlive(p)) aliveMembers.push(p); });
		});
		if (!aliveMembers.length) return;
		const per = Math.round(total * 100 / aliveMembers.length) / 100;
		aliveMembers.forEach(function (e) { give(e, per, tag + "（均摊·守恒）"); });
		return;
	}

	/* ★ 阶段 3：按阵营平均分比例切分（最后一个活阵营吃余数） */
	let campAllocated = 0;
	aliveCamps.forEach(function (camp, ci) {
		const aliveMembers = byCamp[camp].filter(_isAlive);

		let campShare;
		if (ci === aliveCamps.length - 1) {
			campShare = Math.round((total - campAllocated) * 100) / 100;
		} else {
			campShare = Math.round(total * (campContrib[camp] / campSum) * 100) / 100;
			campAllocated += campShare;
		}

		/* ★ 阶段 4：阵营内按个人得分切分（最后一个成员吃余数） */
		const memberSum = aliveMembers.reduce(function (s, e) { return s + _contribution(e); }, 0);
		let memberAllocated = 0;
		aliveMembers.forEach(function (e, mi) {
			let share;
			if (mi === aliveMembers.length - 1 || memberSum <= 0.01) {
				share = Math.round((campShare - memberAllocated) * 100) / 100;
			} else {
				share = Math.round(campShare * (_contribution(e) / memberSum) * 100) / 100;
				memberAllocated += share;
			}
			const pct = memberSum > 0
				? Math.round(_contribution(e) / memberSum * 100)
				: Math.round(100 / aliveMembers.length);
			give(e, share, tag + "（" + camp + "·" + pct + "%）");
		});
	});
}

/* ================= 记分钩子 ================= */
let _turnUse = 0, _lastTurnPlayer = null;
function scoreCardUse(me, card, target) {
	try {
		/* 统一 id 提取：字符串直接用；VCard 依次看 name / cardname */
		const id = (typeof card === "string")
			? card
			: (card && (card.name || card.cardname || "")) || "";
		if (!id) return;

		rec("cards", id);

		/* ★ 牌堆记忆：使用牌时扣减 */
		try { deckConsume(card); } catch (e) {}

		/* ★ 元素反馈：观察出牌 */
		try {
			let hpB = me.hp || 0;
			observeElementUse('card', id, me, {
				target: target && (target.name1 || target.name) ? target : null,
				hpBefore: hpB,
			});
		} catch (e) {}
		/* ★ 元认知：记录卡牌使用 */
		try { metaRecordCard(id); } catch (e) {}
		if (target && target.name) {
			try { metaRecordTarget(target.name1 || target.name); } catch (e) {}
		}

		/* 回合内出牌叠加激励 */
		try {
			const cur = _status && _status.currentPhase;
			if (_lastTurnPlayer !== cur) { _lastTurnPlayer = cur; _turnUse = 0; }
			if (me === cur) {
				_turnUse++;
				if (_turnUse >= 3) {
					const bonus = (_turnUse - 2) * 0.5;
					giveVs(me, bonus, "回合内第" + _turnUse + "张牌（用牌叠加激励）");
				}
			}
		} catch (eT) {}

		const v = VAL_CARD[id];
		if (!v || !v.use) return;

		/* 记录"对目标出杀"的次数（供 threat.js 的 probHasShan 读取） */
		if (id === "sha" && target && get.itemtype(target) === "player") {
			try { memRecordAtk(target); } catch (eM) {}
		}
		/* 行为观察：记录攻/援行为 */
		try { observeCardUse(me, card, target); } catch (eO) {}

		/* ★ 友方延迟评估：不立即给正分，等 600ms 后评估是否有正收益 */
		if (target && get.itemtype(target) === "player") {
			/* ★ 判断友方（好感度 + 阵营策略双保险） */
			let isAlly = false;
			try {
				if (isSameCamp(me, target)) isAlly = true;
				const strategy = typeof getModeStrategy === 'function' ? getModeStrategy() : null;
				if (strategy && strategy.getCamp) {
					if (strategy.getCamp(me) === strategy.getCamp(target)) isAlly = true;
				}
			} catch (e) {}

			if (isAlly) {
				/* ★ 锦囊类特殊处理：只记录特征，不重罚（走本体合法检测） */
				const PENALTY_CARDS = ['lebu', 'bingliang', 'tiesuo', 'shunshou'];
				if (PENALTY_CARDS.indexOf(id) >= 0) {
					/* 判断是横置还是解除横置 */
					if (id === 'tiesuo') {
						/* 铁索连环：横置友方只记录，解除横置加分 */
						const isLinking = !target.isLinked;
						if (isLinking) {
							/* 横置友方 → 只记录特征，不重罚 */
							logBestAction(me, null, { reason: '对友方铁索横置（特征记录）' });
							return;
						} else {
							/* 解除友方横置 → 加分 */
							give(me, Math.abs(v.use) * 1.5, "解除友方横置（支援）");
							return;
						}
					} else if (id === 'shunshou') {
						/* 顺手牵羊：拿判定区加分，拿非判定区只记录 */
						let isJudgeArea = false;
						try {
							if (target.judges && target.judges.length > 0) {
								isJudgeArea = true;
							}
						} catch (e) {}

						if (isJudgeArea) {
							/* 拿判定区 → 加分（解乐/解兵） */
							give(me, Math.abs(v.use) * 1.5, "顺友方判定区（解乐/解兵，支援）");
							return;
						} else {
							/* 拿非判定区 → 只记录特征，不重罚 */
							logBestAction(me, null, { reason: '顺友方非判定区（特征记录）' });
							return;
						}
					} else {
						/* 乐不思蜀 / 兵粮寸断 → 只记录特征，不重罚 */
						logBestAction(me, null, { reason: '对友方使用' + (id === 'lebu' ? '乐不思蜀' : '兵粮寸断') + '（特征记录）' });
						return;
					}
				}

				/* ★ 对友方出牌：挂起，延迟评估，不立即给正分 */
				const rec = {
					me: me, target: target,
					value: v.use || 1,
					id: id,
					t0: Date.now(),
					snap: _snapshotAlly(target),
					hurt: false,
				};
				/* 记录挂起前的友方得分，供评估对比 */
				try { rec.snap.round = round[keyOf(target)] || 0; } catch (e) {}
				_allyActionPending.push(rec);

				setTimeout(function () {
					_evaluateAllyAction(rec);
					const idx = _allyActionPending.indexOf(rec);
					if (idx >= 0) _allyActionPending.splice(idx, 1);
				}, 600);

				/* 只给一点基础分（表示行动本身），大头等评估 */
				give(me, (v.use || 1) * 0.2, "对友方使用（待评估）");
			} else {
				givePair(me, target, v.use, "使用" + v.name + "（" + id + "）");
			}
		} else if (Array.isArray(target)) {
			/* ★ AOE：按友方/敌方分别结算 */
			let allyHurt = 0, enemyHit = 0;
			target.forEach(function (t) {
				if (!get.itemtype(t) === "player") return;
				let isAlly = false;
				try {
					if (isSameCamp(me, t)) isAlly = true;
					const strategy = typeof getModeStrategy === 'function' ? getModeStrategy() : null;
					if (strategy && strategy.getCamp) {
						if (strategy.getCamp(me) === strategy.getCamp(t)) isAlly = true;
					}
				} catch(e) {}
				if (isAlly) allyHurt++;
				else enemyHit++;
			});

			if (allyHurt > 0) {
				/* AOE 误伤友方，按 70% 重罚（AOE 通常是战略性出牌，容忍度更低） */
				const rate = 0.7;
				give(me, -allyHurt * Math.abs(v.use) * rate * 3, "AOE误伤友方（扣除 " + (rate * 100) + "%）");
				giveVs(me, -allyHurt * Math.abs(v.use) * rate, "阵营分扣除 " + (rate * 100) + "%");
			}
			if (enemyHit > 0) {
				giveVs(me, enemyHit * v.use, "AOE命中敌人");
			}
		} else {
			giveVs(me, v.use, "使用" + v.name + "（" + id + "）");
		}
	} catch (e) {}
}

/* ================= 效果处理器表 =================
 * 键与 installHooks 里 EF 数组一一对应。
 * 每个处理器签名：(me, a) —— me 是玩家对象，a 是 arguments 类数组。
 * 键为 "die" 的情况不在此表——阵亡计分独立在 installHooks 里处理。
 */
const EFFECT_HANDLERS = {
	damage: function (me, a) {
		try { _markAllyHurt(me); } catch (e) {}   /* ★ 友方评估标记 */
		const p0 = a[0];
		let src = null, n = 1;
		if (p0 && typeof p0 === "object" && !Array.isArray(p0)) {
			if (get.itemtype(p0) === "player") src = p0;
			if (typeof p0.num === "number") n = p0.num;
			if (p0.source && get.itemtype(p0.source) === "player" && p0.source !== me) src = p0.source;
		} else {
			/* noname 签名 damage(num, source, ...)：number 与 player 参数乱序，遍历全部参数 */
			for (let i = 0; i < a.length; i++) {
				const v = a[i];
				if (typeof v === "number") n = v;
				else if (v && typeof v === "object" && !Array.isArray(v) && v !== me) {
					/* 玩家判定优先 get.itemtype，其次 hp 兜底（兼容未初始化/隐匿状态的玩家） */
					let isP = false;
					try { isP = (typeof get === "object" && get.itemtype && get.itemtype(v) === "player"); } catch (e) {}
					if (isP || v.hp !== undefined) src = v;
				}
			}
		}
		if (src && src !== me) {
			/* ★ 污染修复：判断 src 和 me 是否是友方 */
			let isAlly = false;
			try {
				if (isSameCamp(src, me)) isAlly = true;
				const strategy = getModeStrategy();
				if (strategy && strategy.isSameCamp && strategy.isSameCamp(src, me)) isAlly = true;
			} catch (e) {}

			if (isAlly) {
				/* 打队友：src 不加分，me 也不扣分（避免污染） */
				/* 但是记录伤害次数 */
				try { memRecordHit(me); } catch (eH) {}
				try { observeAttack(src, me, n); } catch (eO) {}
			} else {
				/* 打敌人：正常计分 */
				givePair(src, me, 2 * n * cfg("dmgRate", 1), "造成" + n + "点伤害");
				try { memRecordHit(me); } catch (eH) {}
				try { observeAttack(src, me, n); } catch (eO) {}
			}
			/* ★ 追踪：src 对 me 的伤害次数（友方伤害线性衰减用） */
			try {
				if (src) {
					if (!src._djsc_hurtAlly) src._djsc_hurtAlly = {};
					const key = me.name1 || me.name || '?';
					src._djsc_hurtAlly[key] = (src._djsc_hurtAlly[key] || 0) + 1;
				}
			} catch (eT) {}
		} else {
			giveVs(me, -2 * n * cfg("dmgRate", 1), "受到" + n + "点伤害");
		}
	},
	changeHp: function (me, a) {
		const v = parseFloat(a[0]) || 0;
		if (v > 0) giveVs(me, 2 * v, "回复" + v + "点");
		else if (v < 0) giveVs(me, 2 * v, "失去" + (-v) + "点体力");
	},
	recover: function (me, a) {
		const n = Math.abs(parseFloat(a[0]) || 1);
		giveVs(me, 2 * n, "回复" + n + "点");
		/* 行为观察：若参数里能找出施救者，记为援助行为
		 * noname 签名 recover(num, source, ...)：遍历参数找 player 来源 */
		try {
			let src = null;
			for (let i = 0; i < a.length; i++) {
				const v = a[i];
				if (v && typeof v === "object" && !Array.isArray(v) && v !== me) {
					let isP = false;
					try { isP = (typeof get === "object" && get.itemtype && get.itemtype(v) === "player"); } catch (e) {}
					if (isP || v.hp !== undefined) { src = v; break; }
				}
			}
			if (!src && a[0] && typeof a[0] === "object" && !Array.isArray(a[0])) {
				const p0 = a[0];
				if (p0.source && get.itemtype(p0.source) === "player" && p0.source !== me) src = p0.source;
				else if (p0.sourcex && get.itemtype(p0.sourcex) === "player" && p0.sourcex !== me) src = p0.sourcex;
			}
			if (src) observeAid(src, me, n * 0.8);
		} catch (eO) {}
	},
	draw: function (me, a) {
		const n = Math.abs(parseFloat(a[0]) || 1);
		giveVs(me, n * cfg("drawRate", 1), "摸" + n + "张");
		/* ★ 牌堆感知：摸牌消耗 */
		try {
			const ev = _status.event;
			if (ev && ev.cards && Array.isArray(ev.cards)) {
				ev.cards.forEach(function(c) { try { deckConsume(c); } catch(e){} });
			}
		} catch(e) {}
	},
	discard: function (me, a) {
		try { _markAllyHurt(me); } catch (e) {}   /* ★ 友方评估标记 */
		let n = 1;
		let cards = null;
		try {
			const c0 = a[0];
			if (Array.isArray(c0)) { n = c0.length; cards = c0; }
			else if (typeof c0 === "number") n = c0;
		} catch (e) {}
		giveVs(me, -1 * n * cfg("discardRate", 1), "弃" + n + "张");
		if (n > 3) giveVs(me, -(n - 3) * 0.3 * cfg("discardRate", 1), "弃" + n + "张过多额外惩罚");
		/* ★ 牌堆感知：弃牌消耗 */
		try {
			if (cards) cards.forEach(function(c) { try { deckConsume(c); } catch(e){} });
			else {
				const ev = _status.event;
				if (ev && ev.cards) ev.cards.forEach(function(c) { try { deckConsume(c); } catch(e){} });
			}
		} catch(e) {}
	},
	loseHp: function (me, a) {
		try { _markAllyHurt(me); } catch (e) {}   /* ★ 友方评估标记 */
		const n = Math.abs(parseFloat(a[0]) || 1);
		giveVs(me, -2 * n, "失去" + n + "点体力");
	},
	gainMaxHp: function (me) { giveVs(me, 2, "体力上限+1"); },
	loseMaxHp: function (me) { giveVs(me, -2, "体力上限-1"); },
	turnOver: function (me) { giveVs(me, -3, "翻面"); },
	link: function (me) { giveVs(me, -1, "横置"); },
	gain: function (me, a) {
		const n = (Array.isArray(a[0]) ? a[0].length : Math.abs(parseFloat(a[0]) || 1));
		giveVs(me, n, "获得" + n + "张");
		/* ★ 牌堆感知：获得牌消耗 */
		try {
			if (Array.isArray(a[0])) {
				a[0].forEach(function(c) { try { deckConsume(c); } catch(e){} });
			}
		} catch(e) {}
	},
	lose: function (me, a) {
		try { _markAllyHurt(me); } catch (e) {}   /* ★ 友方评估标记 */
		const n = (Array.isArray(a[0]) ? a[0].length : Math.abs(parseFloat(a[0]) || 1));
		giveVs(me, -n, "失去" + n + "张");
		/* ★ 牌堆感知：失去牌消耗 */
		try {
			if (Array.isArray(a[0])) {
				a[0].forEach(function(c) { try { deckConsume(c); } catch(e){} });
			}
		} catch(e) {}
	},
	judge: function (me) {
		giveVs(me, 1, "判定");
		/* ★ 牌堆感知：判定牌消耗 */
		try {
			const ev = _status.event;
			let jc = null;
			if (ev) {
				if (ev.card) jc = ev.card;
				else if (ev.result && ev.result.card) jc = ev.result.card;
			}
			if (jc) deckConsume(jc);
		} catch(e) {}
	},
	equip: function (me) { giveVs(me, 1, "装备"); },
};

function scoreEffect(mm, me, a) {
	try {
		rec("effects", mm);
		const h = EFFECT_HANDLERS[mm];
		if (h) h(me, a || []);
	} catch (e) {}
}

function installHooks() {
	if (installed) return;
	const proto = lib.element && lib.element.Player && lib.element.Player.prototype;
	if (!proto) return;

	/* 热重载场景：proto 上若残留原函数记录，先还原，避免嵌套包装 */
	if (proto[DJSC_ORIG]) {
		try { uninstallHooks(); } catch (e) {}
	}

	memLoad();   // 上一局记忆载入
	try { deckAutoDetect(); } catch (e) {}   // ★ 自动识别牌堆模式
	try { trainStartGame(game.me, get.mode ? get.mode() : 'identity'); } catch (e) {}  // ★ 开始训练局
	try { loadStore(); } catch (eMem) {}   // 跨局记忆载入
	try { loadArchive(); } catch (eArc) {}  // 战报归档载入
	try { loadFeedback(); } catch (eFb) {}  // 技能反馈载入
	try { loadStyleFeedback(); } catch (eSf) {} // 风格反馈载入
	/* ★ 决策回放：局开始 */
	try {
		if (window.__DJSC && window.__DJSC.replay && window.__DJSC.replay.start) {
			window.__DJSC.replay.start({
				mode: (typeof get !== 'undefined' && get.mode) ? get.mode() : 'unknown',
				playerCount: (game.players || []).length,
				meKey: game.me ? (game.me.name1 || game.me.name || '?') : '?',
				myIdentity: game.me ? (game.me.identity || null) : null,
			});
		}
	} catch (eR) {}

	const orig = {};
	proto[DJSC_ORIG] = orig;

	/* 1) useCard —— 出牌记分 */
	const oUse = proto.useCard;
	if (typeof oUse === "function") {
		orig.useCard = oUse;
		proto.useCard = function () {
			const me = this, args = arguments;
			try {
				const next = oUse.apply(this, args);
				if (next && typeof next.then === "function") {
					Promise.resolve(next).then(function () { try { scoreCardUse(me, args[0], args[1]); } catch (e) {} }).catch(function () {});
				} else {
					try { scoreCardUse(me, args[0], args[1]); } catch (e) {}
				}
				return next;
			} catch (e) {
				try { return oUse.apply(this, args); } catch (e2) { return null; }
			}
		};
	}

	/* 2) 效果钩子 —— 每个 proto[m] 直接绑定对应的处理函数，不再经过 scoreEffect 的字符串分派 */
	const EF = ["damage", "recover", "draw", "discard", "loseHp", "gainMaxHp", "loseMaxHp",
	            "turnOver", "link", "changeHp", "gain", "lose", "judge", "equip"];
	EF.forEach(function (m) {
		const o = proto[m];
		if (typeof o !== "function") return;
		const handler = EFFECT_HANDLERS[m];
		orig[m] = o;
		proto[m] = function () {
			const me = this, args = arguments;
			try {
				const r = o.apply(this, args);
				if (handler) {
					try { rec("effects", m); handler(me, args); } catch (eS) {}
				}
				return r;
			} catch (e) {
				try { return o.apply(this, args); } catch (e2) { return null; }
			}
		};
	});

	/* ★ 单独监听 respond（打出牌响应） */
	const oRespond = proto.respond;
	if (typeof oRespond === "function") {
		orig.respond = oRespond;
		proto.respond = function () {
			const me = this, args = arguments;
			try {
				const r = oRespond.apply(this, args);
				/* respond 的第一个参数是 card */
				try { deckConsume(args[0]); } catch(e) {}
				return r;
			} catch (e) {
				try { return oRespond.apply(this, args); } catch (e2) { return null; }
			}
		};
	}

	/* ★ 精确 hook：get.cards —— 从牌堆拿牌的统一入口 */
	try {
		const _origGetCards = get.cards;
		if (typeof _origGetCards === "function" && !get.__djsc_patched) {
			get.cards = function () {
				const args = arguments;
				const r = _origGetCards.apply(this, args);
				/* r 是从牌堆拿到的牌数组 */
				try {
					if (Array.isArray(r)) {
						r.forEach(function (c) { try { deckConsume(c); } catch (e) {} });
					}
				} catch (e) {}
				return r;
			};
			get.__djsc_patched = true;
			orig.__djsc_getCards = _origGetCards;
		}
	} catch (e) {}

	/* ★ 初始手牌：监听 gameDraw 事件 */
	try {
		const _origGameDraw = game.gameDraw;
		if (typeof _origGameDraw === "function" && !game.__djsc_gameDraw_patched) {
			game.gameDraw = function () {
				const r = _origGameDraw.apply(this, arguments);
				/* 等 gameDraw 事件结束后同步一次 UI */
				try {
					const ev = r;
					if (ev && typeof ev.then === 'function') {
						Promise.resolve(ev).then(function () {
							try { deckSyncFromUI(true); } catch (e) {}
						});
					} else {
						setTimeout(function () {
							try { deckSyncFromUI(true); } catch (e) {}
						}, 200);
					}
				} catch (e) {}
				return r;
			};
			game.__djsc_gameDraw_patched = true;
		}
	} catch (e) {}

	/* 3) die —— 单独处理，不走 scoreEffect
	 * 原因：阵亡计分在语义上属于"终局事件"，不该与通用效果分派混在一起；
	 *       且若未来 scoreEffect 增加 die 分支会造成双倍扣分。
	 */
	const oDie = proto.die;
	if (typeof oDie === "function") {
		orig.die = oDie;
		proto.die = function () {
			const me = this, args = arguments;
			try {
				try { giveVs(me, -6, "阵亡"); } catch (e) {}
				/* 击杀奖励：从事件链上溯到造成致命伤的伤害事件源 */
				try {
					let killer = null;
					try {
						const ev = _status.event;
						if (ev && ev.getParent) {
							const dmgEv = ev.getParent('damage');
							if (dmgEv && dmgEv.source && dmgEv.source !== me) killer = dmgEv.source;
						}
					} catch (e) {}
					if (killer) {
						/* ★ 污染修复：判断 killer 和 me 是否是友方 */
						let isAlly = false;
						try {
							if (isSameCamp(killer, me)) isAlly = true;
							const strategy = getModeStrategy();
							if (strategy && strategy.isSameCamp && strategy.isSameCamp(killer, me)) isAlly = true;
						} catch (e) {}

						if (isAlly) {
							/* 杀队友：只记录特征，不重罚（走本体合法检测） */
							logBestAction(killer, null, { reason: '击杀队友（特征记录）' });
						} else {
							/* 杀敌人：正常加分 */
							give(killer, 6, "击杀" + (me.name || me.name1 || "敌方"));
						}
					}
				} catch (e) {}
				return oDie.apply(this, args);
			} catch (e) {
				try { return oDie.apply(this, args); } catch (e2) { return null; }
			}
		};
	}

	/* ★ 时序特征：回合开始时记录历史 */
	try {
		const oPhaseBegin = proto.phaseBegin;
		if (typeof oPhaseBegin === 'function' && !proto.__djsc_phaseBegin_patched) {
			proto.phaseBegin = function () {
				const me2 = this;
				const r = oPhaseBegin.apply(this, arguments);
				try { recordTurnHistory(me2); } catch (e) {}
				return r;
			};
			proto.__djsc_phaseBegin_patched = true;
		}
	} catch (e) {}

	/* ★ 元素反馈闭环启动 */
	try { startElementFeedbackLoop(); } catch (e) {}
	/* ★ 元认知启动 */
	try { metaStartGame(); } catch (e) {}

	installed = true;
	try { installBroadcastHooks(); } catch (eB) {}
	/* ★ 开机自修复：延迟 3 秒执行，等所有模块加载完 */
	try { import('./selfHeal.js').then(function (m) { m.autoSelfHeal(3000); }).catch(function () {}); } catch (e) {}
	try { log.info('init', '已接入记分钩子（卡牌/效果/时机，异步延迟记分，守恒）'); } catch (e) {}
}

function uninstallHooks() {
	try {
		const proto = lib.element && lib.element.Player && lib.element.Player.prototype;
		if (!proto) { installed = false; return; }
		const orig = proto[DJSC_ORIG];
		if (!orig) { installed = false; return; }
		for (const k in orig) {
			try { proto[k] = orig[k]; } catch (e) {}
		}
		try { delete proto[DJSC_ORIG]; } catch (e) {}

		/* ★ 还原 get.cards */
		try {
			if (get.__djsc_patched && orig.__djsc_getCards) {
				get.cards = orig.__djsc_getCards;
				delete get.__djsc_patched;
			}
		} catch (e) {}

		installed = false;
		try { log.info('init', '已卸下记分钩子（proto 方法已还原）'); } catch (e) {}
	} catch (e) { installed = false; }
}

/* ================= 灵活度升级：局势/目标/EV/边际/combo/记忆（统一动作评分框架） ================= */
function opportunityCost(id, econ) {
	const OC = { shan: 1.5, tao: 1.5, wuxie: 1.5, jiu: 0.8, sha: 0.3, guohe: 0.4, shunshou: 0.4, wuzhong: 0.2, tiesuo: 0.2, lebu: 0.3, bingliang: 0.3, nanman: 0.4, wanjian: 0.4, juedou: 0.4, huogong: 0.4 };
	let base = OC[id] !== undefined ? OC[id] : 0.3;
	if (econ) {
		if (econ.handCount <= 2) base *= 1.6;
		else if (econ.handCount <= 4) base *= 1.2;
		if (econ.hpRatio < 0.3 && (id === "shan" || id === "tao" || id === "wuxie")) base *= 1.3;
	}
	return Math.round(base * 100) / 100;
}
function countCardName(me, id) {
	try { let n = 0; me.getCards("h").forEach(function (c) { if (c.name === id) n++; }); return n; } catch (e) { return 0; }
}
function hasCardName(me, id) { try { return countCardName(me, id) > 0; } catch (e) { return false; } }
function hasNatureCard(me) {
	try { return !!me.getCards("h", function (c) { return game.hasNature ? (game.hasNature(c, "fire") || game.hasNature(c, "thunder")) : false; }).length; } catch (e) { return false; }
}
const _probShanCache = new Map();   // key: tgt 对象 → { hp, hc, value }
function _probShanCached(me, tgt) {
	try {
		const hc = tgt.countCards ? tgt.countCards("h") : 0;
		const hit = _probShanCache.get(tgt);
		if (hit && hit.hp === (tgt.hp || 0) && hit.hc === hc) return hit.value;
		const v = probHasShan(me, tgt);
		_probShanCache.set(tgt, { hp: tgt.hp || 0, hc: hc, value: v });
		return v;
	} catch (e) { return probHasShan(me, tgt); }
}
function expectedValue(me, card, tgt) {
	try {
		const id = typeof card === "string" ? card : (card.name || "");
		if (id === "sha") {
			let pHit = 1 - _probShanCached(me, tgt);
			try {
				if (probHasBagua(tgt)) {
					/* ★ 用牌堆实时八卦成功率替换固定 0.5 */
					const bgRate = baguaSuccessRate();
					pHit -= bgRate;
				}
			} catch (e) {
				if (probHasBagua(tgt)) pHit -= 0.5;
			}
			const dmg = 1 + (hasCardName(me, "jiu") ? 1 : 0);
			const kill = (tgt.hp !== undefined && tgt.hp - dmg <= 0) ? 6 : 0;
			let counter = 0;
			try { if (hasVengeanceSkill(tgt)) counter = -3; } catch (e) {}
			return Math.round((Math.max(0.03, pHit) * (2 * dmg + kill) + counter + (tgt.hp !== undefined && tgt.hp <= 2 ? 1 : 0)) * 100) / 100;
		}
		if (id === "juedou") {
			const hc = tgt.countCards ? tgt.countCards("h") : 0;
			const mySha = countCardName(me, "sha");
			const pHit = mySha >= hc ? 0.75 : 0.4;
			const kill = (tgt.hp !== undefined && tgt.hp <= 1) ? 6 : 0;
			return Math.round((pHit * (2 + kill)) * 100) / 100;
		}
		const v = VAL_CARD[id];
		if (!v || !v.use) return 0;
		const baseScore = v.use;
		/* ★ 积分自修改：应用 AI 自学习的调整 */
		try {
			if (window.__DJSC.scoreSelfMod && window.__DJSC.scoreSelfMod.getScore) {
				return window.__DJSC.scoreSelfMod.getScore(id, baseScore);
			}
		} catch (e) {}
		return baseScore;
	} catch (e) { return 0; }
}
function marginalValue(id, handIds) {
	try {
		const v = VAL_CARD[id];
		if (!v || !v.use) return 0;
		const count = handIds.filter(function (x) { return x === id; }).length;
		const baseScore = v.use * Math.pow(0.6, count);
		/* ★ 积分自修改：应用 AI 自学习的调整 */
		try {
			if (window.__DJSC.scoreSelfMod && window.__DJSC.scoreSelfMod.getScore) {
				return window.__DJSC.scoreSelfMod.getScore(id, baseScore);
			}
		} catch (e) {}
		return Math.round(baseScore * 100) / 100;
	} catch (e) { return 0; }
}
const COMBO_SKILLS = ["wuzhong","guohe","shunshou","nanman","wanjian","wuxie","lebu","bingliang","juedou","huogong","zhujin","taoyuan","wugu","tiesuo"];


/* ================= 决策回放记录器 ================= */
const DECISION_LOG = [];
const DECISION_LOG_MAX = 20;

/* ★ 正确获取当前轮次（修复轮次总是0的问题） */
function _getRoundNumber() {
	try {
		if (_status && typeof _status.roundNumber === "number") return _status.roundNumber;
		if (typeof game === "object" && typeof game.roundNumber === "number") return game.roundNumber;
		if (typeof game === "object" && typeof game.round === "number") return game.round;
	} catch (e) {}
	return 0;
}

function recordDecision(me, layers, candidates, winner) {
	try {
		const entry = {
			ts: Date.now(),
			round: _getRoundNumber(),
			player: (me && (me.name || me.name1)) || "?",
			layers: layers,
			candidates: (candidates || []).slice(0, 8).map(function (c) {
				return {
					type: c.type, id: c.id,
					target: c.target || null,
					score: c.score,
					reason: (c.reason || "").slice(0, 80),
					_feat: c._feat || null,
				};
			}),
			winner: winner ? { type: winner.type, id: winner.id, score: winner.score, reason: (winner.reason || "").slice(0, 120) } : null,
		};
		DECISION_LOG.push(entry);
		while (DECISION_LOG.length > DECISION_LOG_MAX) DECISION_LOG.shift();
	} catch (e) {}
}

/* ================= AI 性格三维解析（含身份基线修正） ================= */
const PERSONALITY_PRESETS = {
	aggressive: { agg: 80, rsk: 70, team: 40 },
	balanced:   { agg: 50, rsk: 50, team: 50 },
	cautious:   { agg: 30, rsk: 30, team: 70 },
	loner:      { agg: 70, rsk: 60, team: 10 },
	guardian:   { agg: 30, rsk: 20, team: 90 },
};
const IDENTITY_MODS = {
	zhu:       { agg: -15, rsk: -10, team:  10 },
	zhong:     { agg:   5, rsk:  -5, team:  15 },
	mingzhong: { agg:   5, rsk:  -5, team:  15 },
	fan:       { agg:  15, rsk:  10, team:   5 },
	nei:       { agg:   5, rsk:  15, team: -10 },
};

/* 身份推荐模板（与 templates.js 的 key 对应） */
const IDENTITY_TEMPLATES = {
	zhu: "guardian", zhong: "zhugeliang", mingzhong: "zhugeliang",
	fan: "zhangfei", nei: "loner",
};
const TEMPLATE_DIMS = {
	balanced: { agg: 50, rsk: 50, tea: 50 }, aggressive: { agg: 80, rsk: 70, tea: 40 },
	cautious: { agg: 30, rsk: 30, tea: 70 }, loner: { agg: 70, rsk: 60, tea: 10 },
	guardian: { agg: 30, rsk: 20, tea: 90 }, zhangfei: { agg: 95, rsk: 75, tea: 20 },
	zhugeliang: { agg: 35, rsk: 25, tea: 85 }, lvbu: { agg: 100, rsk: 85, tea: 10 },
	simayi: { agg: 40, rsk: 30, tea: 65 }, huatuo: { agg: 15, rsk: 20, tea: 95 },
	zhouyu: { agg: 60, rsk: 55, tea: 70 }, diaochan: { agg: 45, rsk: 60, tea: 60 },
	sunquan: { agg: 50, rsk: 40, tea: 75 }, caocao: { agg: 75, rsk: 65, tea: 30 },
};

function resolvePersonality(me) {
	try {
		const preset = cfg("riskProfile", "custom");
		let agg, rsk, tea;
		let identityTag = "none";
		let autoMatched = false;
		let autoTemplate = null;

		/* ===== 协作模式：该 AI 有专属性格设置则优先 ===== */
		let allyOverride = null;
		try {
			if (me) {
				const pk = me.nickname || me.uid || me.name1 || me.name;
				if (pk) {
					const all = JSON.parse(localStorage.getItem("无名AI_allyPersonalities") || "{}");
					if (all && all[pk] && typeof all[pk].agg === "number") allyOverride = all[pk];
				}
			}
		} catch (e) {}

		/* ===== 身份自动匹配 ===== */
		const autoMatch = cfg("autoIdentityMatch", false);
		if (autoMatch && !allyOverride) {
			try {
				const mode = (_status && _status.mode) || (get && get.mode ? get.mode() : "");
				if (mode === "identity" || mode === "guozhan") {
					const id = me && me.identity;
					if (id && IDENTITY_TEMPLATES[id]) {
						const tplKey = IDENTITY_TEMPLATES[id];
						const tpl = TEMPLATE_DIMS[tplKey];
						if (tpl) { agg = tpl.agg; rsk = tpl.rsk; tea = tpl.tea; identityTag = id; autoMatched = true; autoTemplate = tplKey; }
					}
				}
			} catch (e) {}
		}

		if (allyOverride) {
			agg = allyOverride.agg; rsk = allyOverride.rsk; tea = allyOverride.tea;
			identityTag = "ally"; autoMatched = false;
		} else if (!autoMatched) {
			if (preset !== "custom" && PERSONALITY_PRESETS[preset]) {
				agg = PERSONALITY_PRESETS[preset].agg; rsk = PERSONALITY_PRESETS[preset].rsk; tea = PERSONALITY_PRESETS[preset].team;
			} else {
				agg = Math.max(0, Math.min(100, Number(cfg("personalityAggression", 50)) || 50));
				rsk = Math.max(0, Math.min(100, Number(cfg("personalityRisk", 50)) || 50));
				tea = Math.max(0, Math.min(100, Number(cfg("personalityTeam", 50)) || 50));
			}
		}

		let idMod = { agg: 0, rsk: 0, team: 0 };
		if (!autoMatched && !allyOverride) {
			try {
				const mode = (_status && _status.mode) || (get && get.mode ? get.mode() : "");
				if (mode === "identity" || mode === "guozhan") {
					const id = me && me.identity;
					if (id && IDENTITY_MODS[id]) { idMod = IDENTITY_MODS[id]; identityTag = id; }
				}
			} catch (eId) {}
		}

		const norm = function (v) { return Math.round((0.5 + v / 100) * 100) / 100; };
		const rawAgg = Math.max(0, Math.min(100, agg + idMod.agg));
		const rawRsk = Math.max(0, Math.min(100, rsk + idMod.rsk));
		const rawTea = Math.max(0, Math.min(100, tea + idMod.team));
		return {
			label: autoMatched ? ("auto:" + autoTemplate) : (preset === "custom" ? "custom" : preset),
			identity: identityTag,
			identityMod: idMod,
			autoMatched: autoMatched,
			autoTemplate: autoTemplate,
			allyOverride: !!allyOverride,
			allyRole: (allyOverride && allyOverride.role) || null,
			raw: { agg: agg, rsk: rsk, tea: tea },
			eff: { agg: rawAgg, rsk: rawRsk, tea: rawTea },
			atk:  norm(rawAgg),
			def:  norm(100 - rawAgg),
			risk: norm(rawRsk),
			safe: norm(100 - rawRsk),
			team: norm(rawTea),
		};
	} catch (e) {
		return { label: "custom", identity: "none", identityMod: { agg: 0, rsk: 0, team: 0 }, autoMatched: false, autoTemplate: null, allyOverride: false, raw: { agg: 50, rsk: 50, tea: 50 }, eff: { agg: 50, rsk: 50, tea: 50 }, atk: 1, def: 1, risk: 1, safe: 1, team: 1 };
	}
}

/* ================= ★ 卡牌覆写信号提取 ================= */
/* 从 lib.card[id].__djsc_override 读取 optimization.js 的评分
 * 有效期 1500ms（避免跨回合污染）
 */
function readCardOverride(id, player, target) {
    try {
        const cardMeta = lib.card && lib.card[id];
        if (!cardMeta || !cardMeta.__djsc_override) return null;
        const ov = cardMeta.__djsc_override;
        if (typeof ov.score !== 'number') return null;
        /* 过期检查 */
        if (ov.ts && (Date.now() - ov.ts) > 1500) return null;
        /* ★ 校验 player 匹配，避免跨 AI 污染 */
        if (ov.player) {
            const myKey = player.name1 || player.name || '?';
            if (ov.player !== myKey) return null;
        }
        return ov;
    } catch (e) { return null; }
}

/* ================= ★ 友方伤害线性衰减 ================= */
function _calcAllyDamagePenalty(player, target, cardId) {
    try {
        if (!player || !target || player === target) return 0;
        let count = 0;
        try {
            const key = target.name1 || target.name || '?';
            count = (player._djsc_hurtAlly && player._djsc_hurtAlly[key]) || 0;
        } catch (e) {}
        /* 本次是第 (count+1) 次打这个友方
         *   第 1 次：-0.2
         *   第 2 次：-0.4
         *   第 3 次：-0.6
         *   ...
         *   封顶 -10（避免极端场景）
         */
        const penalty = -0.2 * (count + 1);
        return Math.max(-10, penalty);
    } catch (e) { return 0; }
}

/* 统一动作评分：枚举所有候选动作（技能/卡牌/装备/结束）→ 打分 → 选最高 */
function bestAction() {
	const _perfT0 = performance.now();
	profStart('bestAction');
	/* ★ 兜底声明：防止作用域问题导致 best is not defined */
	let best = { type: "end", id: "end", score: 0, reason: "初始化兜底" };
	try {
		const me = _status.currentPhase || game.me;
		if (!me) return null;
		const sit = situationFactor(me);
		/* ===== 性格三维（预设/滑条 + 身份基线） ===== */
		const P = resolvePersonality(me);
		const riskLabel = P.label;
		const risk = { atk: P.atk, def: P.def, safe: P.safe };
		const riskTaking = P.risk;
		const teamwork   = P.team;
		/* ===== AI 协作分工（角色） ===== */
		const ALLY_ROLE = P.allyRole || null;
		const ROLE_PREFS = ALLY_ROLE ? ({
			attack:  { atk: 1.35, skill: { atk: 1.4, def: 0.7, aux: 0.7, ctrl: 0.9, draw: 1.0 }, cardAtk: 1.3, cardDef: 0.8 },
			aux:     { atk: 0.75, skill: { atk: 0.7, def: 1.2, aux: 1.5, ctrl: 0.9, draw: 1.2 }, cardAtk: 0.8, cardDef: 1.3 },
			control: { atk: 1.0,  skill: { atk: 0.9, def: 1.0, aux: 1.0, ctrl: 1.5, draw: 1.1 }, cardAtk: 1.0, cardDef: 1.0 },
			defense: { atk: 0.7,  skill: { atk: 0.6, def: 1.5, aux: 1.2, ctrl: 0.9, draw: 1.0 }, cardAtk: 0.7, cardDef: 1.4 },
			balanced:{ atk: 1.0,  skill: { atk: 1.0, def: 1.0, aux: 1.0, ctrl: 1.0, draw: 1.0 }, cardAtk: 1.0, cardDef: 1.0 },
		})[ALLY_ROLE] : null;
		const atkMul = sit.atkMul || 1;
		const keepMul = sit.keepMul || 1;
		const burstMul = sit.burstMul || 1;
		const stageLabel = sit.stage || "mid";
		const ATK_CARDS = ["sha", "juedou", "huogong", "nanman", "wanjian", "zhujin", "shunshou", "guohe", "tiesuo", "lebu", "bingliang"];
		const DEF_CARDS = ["shan", "tao", "wuxie", "jiu"];
		const hand = [];
		try { me.getCards("h").forEach(function (c) { hand.push(c.name || ""); }); } catch (e) {}
		const combos = detectCombo(me);
		/* ===== 团队计划：集火 + 技能联动 ===== */
		const team = teamPlan(me);
		const teamCombos = team.combos || [];
		const focus = team.focus;
		/* ===== 座位压力（下家压制 / 上家威胁）===== */
		const seat = seatPressure(me);
		const SEAT_TARGET_CARDS = ["lebu", "bingliang"];
		/* ===== 资源经济快照（手牌 / 装备 / 血量） ===== */
		const econ = resourceBalance(me);
		/* ===== 下回合预测（先见之明）+ 多回合趋势 ===== */
		const forecast = forecastSummary(me);
		const incoming = forecast.incoming;
		/* ===== 敌方爆发威胁（连弩 + 多杀）===== */
		const burst = maxBurstThreat(me);
		const mt = multiTurnForecast(me);
		/* ===== 目标分缓存：每玩家只算一次，供所有卡牌共用 =====
		 * - tsMap：pp 对象 → targetScore 数值
		 * - bestT / bestTs：当前局势下全局最优目标及其分数（与具体卡牌无关）
		 */
		const tsMap = new Map();
		let bestT = null, bestTs = -1;
		try {
			for (const pp of (game.players || [])) {
				if (pp === me) continue;
				try { if (pp.isDead ? pp.isDead() : (pp.hp !== undefined && pp.hp <= 0)) continue; } catch (e) {}
				/* ★ 友方减免：友方目标分数大幅降低，防止 AI 乱打队友 */
				const isAlly = !isEnemyOf(me, pp);
				let ts = targetScore(me, pp);
				if (isAlly) ts *= 0.1; // 友方分数打1折
				/* C 阶段 clamp：目标分规范值域 [0, 15]。
				 * 防止某些极端场景（多个加成叠加）让单个目标分飙到 30+，
				 * 导致决策被单一目标碾压。 */
				if (ts < 0) ts = 0;
				if (ts > 15) ts = 15;
				tsMap.set(pp, ts);
				if (ts > bestTs) { bestTs = ts; bestT = pp; }
			}
		} catch (e) {}
		/* ★ 广播集火：读同阵营广播，给已集火目标加成 */
		try {
			const broadcastBonus = {};
			for (const pp of (game.players || [])) {
				if (pp === me) continue;
				const pk = pp.name1 || pp.name;
				if (!pk) continue;
				broadcastBonus[pk] = focusBonus(me, pk);
			}
			for (const [pp, ts] of tsMap) {
				const pk = pp.name1 || pp.name;
				const bb = broadcastBonus[pk] || 1.0;
				const newTs = ts * bb;
				tsMap.set(pp, newTs);
				if (newTs > bestTs) {
					bestTs = newTs;
					bestT = pp;
				}
			}
		} catch (eB) {}
		/* 集火优先：若队友共同攻击压力最大的敌人与当前最优目标不同，
		 * 且其目标分不低于最优的 70%，则切换为集火目标。 */
		if (focus && focus.target && bestT !== focus.target) {
			const focusTs = tsMap.get(focus.target) || 0;
			if (focusTs >= bestTs * 0.7) {
				bestT = focus.target;
				bestTs = focusTs;
			}
		}
		/* 风格偏好：优先打「激进/均衡」敌人，避开「保守」 */
		try {
			let styleAdjBest = bestT, styleAdjScore = -1;
			for (const [pp, ts] of tsMap) {
				if (pp === me) continue;
				const s = styleOf(pp);
				let mul = 1.0;
				if (s.tag === "aggressive") mul = 1.3;      /* ★ 提高权重：1.15 → 1.3 */
				else if (s.tag === "cautious") mul = 0.75;  /* ★ 提高权重：0.85 → 0.75 */
				else if (s.tag === "vengeful") mul = 0.9;   /* ★ 复仇心重：降低攻击欲望 */
				const adj = ts * mul;
				if (adj > styleAdjScore) { styleAdjScore = adj; styleAdjBest = pp; }
			}
			if (styleAdjBest && styleAdjBest !== bestT) {
				const origTs = tsMap.get(bestT) || 0;
				if (styleAdjScore >= origTs * 0.9) {     /* ★ 降低切换门槛：0.95 → 0.9 */
					bestT = styleAdjBest;
					bestTs = Math.round(styleAdjScore * 100) / 100;
				}
			}
		} catch (e) {}
		try { _probShanCache.clear(); } catch (e) {}
		/* ★ 缓存存活玩家，供 extractFeatures 复用，避免循环内重复遍历 */
		const alivePlayers = (game.players || []).filter(function(p) { return p && p.alive !== false; });
		const acts = [];
		/* ===== 趋势驱动策略（把 mt.overall 从提示升级为决策权重） ===== */
		const trend = mt ? mt.overall : "stable";
		const TREND = {
			worsening: { atk: 1.15, keep: 0.9, focus: 1.2, skill: 1.1 },
			improving: { atk: 0.9, keep: 1.12, focus: 0.95, skill: 1.0 },
			stable: { atk: 1.0, keep: 1.0, focus: 1.0, skill: 1.0 },
		};
		const trendMul = TREND[trend] || TREND.stable;
		/* ===== 技能候选（多维评分版） ===== */
		(me.skills || []).forEach(function (sid) {
			try {
				const prof = skillProfileOf(sid);
				if (!prof) return;

				const multi = prof.profit && prof.profit.multi;

				/* 用 multi.final 作为基础分 */
				let base = multi ? multi.final : (prof.profit.base || 0);
				if (base > 15) base = 15;
				if (base < -15) base = -15;
				if (base <= 0) return;

				/* 去掉双倍放大 —— multi.final 已是综合分 */
				let s = base * sit.tempo * (risk.atk || 1) * (atkMul || 1);

				/* 时机条件加成 */
				if (prof.timing.condition === '低血' && econ.hpRatio < 0.4) s *= 1.4;
				if (prof.timing.condition === '已受伤' && econ.hpDeficit > 0) s *= 1.2;

				/* 风险维度缩放 */
				const riskKey = multi ? multi.dims.risk : (
					prof.profit.risk >= 0.5 ? 'judge' : (prof.profit.risk >= 0.3 ? 'judge' : 'none')
				);
				if (riskKey === 'judge' || riskKey === 'compare') {
					s *= (stageLabel === 'endgame' ? 0.7 : 0.9) * (0.5 + 0.5 * (riskTaking || 1));
				}

				/* 团队维度缩放 */
				if (multi) {
					const teamTag = (prof.tags.teamGain || 0)
						+ (prof.tags.teamAid || 0)
						+ (prof.tags.teamChain || 0);
					const hurtTag = Math.abs(prof.tags.teamHurt || 0)
						+ Math.abs(prof.tags.teamRisk || 0);
					const teamShift = ((teamwork || 1) - 1) * 0.6;
					s += (teamTag - hurtTag) * teamShift;
				}

				/* 时机适配 */
				const timKey = multi ? multi.dims.timing : prof.timing.phase;
				if (timKey === 'dying') {
					let hasDying = false;
					for (const p of (game.players || [])) {
						if (p && p !== me && (p.hp || 0) <= 0) { hasDying = true; break; }
					}
					if (!hasDying) s *= 0.3;
				}
				if (timKey === 'damaged' && econ.hpRatio > 0.7) s *= 0.6;
				if (timKey === 'phaseUse' && sit.mode === 'defense') s *= 0.85;

				/* 范围调整：AOE 残局加成 */
				if (multi && (multi.dims.range === 'many' || multi.dims.range === 'all')) {
					const alive = (game.players || []).filter(function (p) {
						return p && p.alive !== false;
					}).length;
					if (alive <= 4) s *= 1.15;
				}

				/* 目标匹配 */
				if (prof.targets.category === 'enemy' && focus) s *= 1.15;
				if (prof.targets.category === 'ally' && team.protect) {
					s *= (0.9 + 0.3 * (teamwork || 1));
				}

				/* 趋势 */
				s *= trendMul.skill;

				/* 条件分支 */
				try {
					const br = skillBranchesOf(sid);
					if (br && br.branches.length) {
						const tgt = bestT || null;
						br.branches.forEach(function (b) {
							if (checkBranch(b.trigger, me, tgt)) s += b.bonus * 1.5;
						});
					}
				} catch (e) {}

				/* 净效果过滤 */
				try {
					const st = skillStagesOf(sid);
					if (st && st.cost.net < -2 && st.effect.net <= 0) s *= 0.6;
				} catch (e) {}

				/* 条件-收益联动 */
				try {
					const ia = skillInteractionOf(sid);
					if (ia && ia.interactions.length) {
						let maxRatio = 1.0;
						ia.interactions.forEach(function (it) {
							if (it.ratio > maxRatio) maxRatio = it.ratio;
						});
						s *= (1.0 + (maxRatio - 1.0) * 0.3);
					}
				} catch (e) {}

				/* 协作分工 */
				if (ROLE_PREFS && ROLE_PREFS.skill) {
					try {
						const tags = skillTagsOf(sid);
						if (tags) {
							const cat = tags.atk * ROLE_PREFS.skill.atk +
								tags.def * ROLE_PREFS.skill.def +
								tags.aux * ROLE_PREFS.skill.aux +
								tags.ctrl * ROLE_PREFS.skill.ctrl +
								tags.draw * ROLE_PREFS.skill.draw;
							const avg = ROLE_PREFS.skill.atk + ROLE_PREFS.skill.def
								+ ROLE_PREFS.skill.aux + ROLE_PREFS.skill.ctrl
								+ ROLE_PREFS.skill.draw;
							const ratio = (cat / Math.max(0.1, avg)) * 5;
							s *= Math.max(0.5, Math.min(1.8, ratio));
						}
					} catch (e) {}
				}

				/* 连招 */
				combos.forEach(function (c) {
					if (c.setup === sid) s += c.bonus * 0.5;
				});

				/* ★ skillTiming 技能触发时机分析加成（软指标化） */
				try {
					const st = window.__DJSC && window.__DJSC.skillTiming;
					if (st) {
						const analysis = st.predictSkillBehavior(sid, me);
						if (analysis) {
							/* 自动发动技能小加成 */
							if (analysis.isAuto) s *= getMetric('skill_auto_bonus');
							/* 锁定技小加成 */
							if (analysis.isForced) s *= getMetric('skill_forced_bonus');
							/* 有利技能加成 */
							if (analysis.predict === 'benefit') s *= getMetric('skill_benefit_bonus');
							/* 有害技能减分 */
							if (analysis.predict === 'cost') s *= getMetric('skill_cost_penalty');
							/* 有摸牌效果加成 */
							if (analysis.effects.indexOf('draw') >= 0) s *= getMetric('skill_draw_bonus');
							/* 有回血效果加成 */
							if (analysis.effects.indexOf('recover') >= 0) s *= getMetric('skill_recover_bonus');
							/* 有造成伤害效果加成 */
							if (analysis.effects.indexOf('damage') >= 0) s *= getMetric('skill_damage_bonus');
							/* 有弃牌效果减分 */
							if (analysis.effects.indexOf('discard') >= 0) s *= getMetric('skill_discard_penalty');
							/* 有失去体力效果减分 */
							if (analysis.effects.indexOf('loseHp') >= 0) s *= getMetric('skill_losehp_penalty');
							/* 有翻面效果减分 */
							if (analysis.effects.indexOf('turnOver') >= 0) s *= getMetric('skill_turnover_penalty');
							/* 有移除技能效果减分 */
							if (analysis.effects.indexOf('removeSkill') >= 0) s *= getMetric('skill_removeskill_penalty');
							/* 有添加技能效果加成 */
							if (analysis.effects.indexOf('addSkill') >= 0) s *= getMetric('skill_addskill_bonus');
							/* 有获得牌效果加成 */
							if (analysis.effects.indexOf('gainCard') >= 0) s *= getMetric('skill_gaincard_bonus');
							/* 有拆判定效果加成 */
							if (analysis.effects.indexOf('discardJudge') >= 0) s *= getMetric('skill_discardjudge_bonus');
							/* 有控顶效果加成 */
							if (analysis.effects.indexOf('deckTop') >= 0) s *= getMetric('skill_decktop_bonus');
						}
					}
				} catch (e) {}

				/* 新 reason */
				let reason = '技能' + sid + '（多维 ' + (Math.round(base * 100) / 100);
				if (multi) {
					reason += '，对象 ' + multi.dims.object
						+ ' 时机 ' + multi.dims.timing
						+ ' 频率 ' + multi.dims.frequency;
					const tg = (prof.tags.teamGain || 0) + (prof.tags.teamAid || 0);
					if (tg > 0) reason += '，团队+' + (Math.round(tg * 10) / 10);
				}
				reason += '）';

				acts.push({
					type: 'skill', id: sid,
					score: toInt8(s),
					reason: reason,
					multi: multi,
				});
			} catch (e) {}
		});

		/* 卡牌候选（目标综合评分 + EV）—— 复用外层 bestT / bestTs，不再对每张牌重算目标分 */
		const seen = {};
		hand.forEach(function (id) {
			if (seen[id]) return; seen[id] = 1;

			try {
				const v = VAL_CARD[id];
				if (!v || !v.use || v.use < 0) return;

				/* C 阶段 clamp：卡牌使用价值规范上限 +4 */
				let cardUse = v.use;
				if (cardUse > 4) cardUse = 4;

				const ev = expectedValue(me, id, bestT);
				const mv = marginalValue(id, hand);
				let s = ev * (0.5 + 0.5 * mv / (cardUse || 1)) * 2 * sit.tempo;

				/* ★ 记忆驱动：根据 bestT 的风格调整卡牌价值 */
				try {
					if (bestT) {
						const sStyle = styleOf(bestT);
						if (sStyle.tag === "aggressive") {
							/* 面对激进敌人：防御牌价值提高 */
							if (['shan', 'tao', 'jiu', 'wuxie', 'exjiu'].indexOf(id) >= 0) {
								s *= 1.2;
							}
						} else if (sStyle.tag === "vengeful") {
							/* 面对复仇心重敌人：攻击牌价值降低（避免招惹） */
							if (['sha', 'juedou', 'huogong', 'guohe', 'shunshou'].indexOf(id) >= 0) {
								s *= 0.85;
							}
						} else if (sStyle.tag === "cautious") {
							/* 面对保守敌人：攻击牌价值提高（压迫他） */
							if (['sha', 'juedou', 'huogong'].indexOf(id) >= 0) {
								s *= 1.1;
							}
						}
					}
				} catch (eStyle) {}

				/* ★ 融合 optimization.js 的覆写信号 */
				try {
					const ov = readCardOverride(id, me, bestT);
					if (ov) {
						/* 覆写分作为加权基准
						 *   ov.score > 0：opt 认为该牌此目标可出 → 加成
						 *   ov.score < 0：opt 认为该牌此目标不该出 → 惩罚
						 * 权重 ov.weight（默认 1.2）
						 */
						const w = ov.weight || 1.2;
						/* 覆写分直接加到 s 上（不替换，保留 EV 的稳定基线） */
						s += ov.score * w * sit.tempo * 2;
					}
				} catch (eOv) {}

				/* ★ 博弈策略层加成 */
				try {
					const psyBonus = psychologyBonus(
						me,
						{ type: 'card', id: id, target: bestT ? (bestT.name1 || bestT.name) : null },
						bestT
					);
					if (psyBonus !== 1.0) s *= psyBonus;
				} catch (ePsy) {}

				/* ★ 连招链加成 */
				try {
					const chainBonus = comboChainBonus(
						me,
						{ type: 'card', id: id, target: bestT ? (bestT.name1 || bestT.name) : null },
						bestT
					);
					if (chainBonus !== 1.0) s *= chainBonus;
				} catch (eChain) {}

				/* ★ 对手长期记忆加成 */
				try {
					const memBonus = playerMemoryBonus(
						me,
						bestT,
						{ type: 'card', id: id, target: bestT ? (bestT.name1 || bestT.name) : null }
					);
					if (memBonus !== 1.0) s *= memBonus;
				} catch (eMem) {}

				/* ★ AI工具集成（软指标：权重由模型自己学） */
				try {
					const aiT = window.__DJSC && window.__DJSC.aiTools;
					if (aiT && bestT) {
						let aiBonus = 1.0;

						/* ① 嘲讽度：嘲讽高的目标优先打（软指标权重） */
						const threaten = aiT.threaten(bestT) || 0;
						if (threaten > 1.5) {
							const w = getMetric('threaten_bonus', 1.15);
							aiBonus *= w;
						}

						/* ② 卖血将：别随便打（软指标权重） */
						if (aiT.isMaixie(bestT)) {
							const w = getMetric('maixie_penalty', 0.75);
							aiBonus *= w;
						}

						/* ③ 亡语技能：别随便杀（软指标权重） */
						if (aiT.hasDeathSkill(bestT)) {
							const w = getMetric('deathskill_penalty', 0.85);
							aiBonus *= w;
						}

						/* ④ 无视防具：打他更有效（软指标权重） */
						if (aiT.hasUnequip(bestT)) {
							const w = getMetric('unequip_bonus', 1.1);
							aiBonus *= w;
						}

						/* ⑤ 主公身份：开局就明置，直接用 game.zhu 判断（不需要推理） */
						/* 注意：主公身份开局就明置，所有人都知道，不需要通过技能推理 */

						if (aiBonus !== 1.0) s *= aiBonus;
					}
				} catch (eAiT) {}

				/* ★ 自动发现维度加成（软接管：让模型自己学） */
				try {
					const afContext = {
						cardType: id,
						targetIsAlly: bestT && isSameCamp(me, bestT),
						targetIsEnemy: bestT && isEnemy(me, bestT),
						myLowHp: (me.hp || 0) <= 2,
						myFewHand: me.countCards ? me.countCards('h') <= 2 : false,
						tgtLowHp: bestT && (bestT.hp || 0) <= 1,
						tgtManyHand: bestT && (bestT.countCards ? bestT.countCards('h') >= 5 : false),
						isEndgame: (game.players || []).filter(function (p) { return p && p.alive !== false; }).length <= 3,
						isEarly: (game.players || []).filter(function (p) { return p && p.alive !== false; }).length >= 7,
					};
					const afWeight = getAutoFeatureWeight(afContext);
					if (afWeight !== 0) s *= (1 + afWeight * 0.1);
				} catch (eAF) {}

				/* ★ 五期：火攻期望命中率修正 */
				try {
					if (id === 'huogong' && bestT) {
						var hitRate = fireAttackExpectedHit(me, bestT);
						/* 命中率 0~1，直接作为乘数，低于 0.3 直接劝退 */
						if (hitRate < 0.3) s *= 0.5;
						else s *= (0.7 + hitRate * 0.6);
					}
				} catch (eFire) {}

				/* ★ 友方伤害线性衰减 */
				try {
					const DMG = ['sha', 'juedou', 'huogong', 'nanman', 'wanjian', 'zhujin'];
					if (bestT && DMG.indexOf(id) >= 0) {
						if (isSameCamp(me, bestT)) {
							s += _calcAllyDamagePenalty(me, bestT, id);
						}
					}
				} catch (eHard) {}

				/* ===== ★ 24 模块集成：卡牌评分加成 ===== */
				try {
					/* ① 手牌推断：根据对手手牌概率调整卡牌价值 */
					if (bestT) {
						if (id === 'sha' || id === 'juedou') {
							const shanProb = probHasShan(bestT);
							if (shanProb > 0.6) s *= 0.7;      // 对手大概率有闪 → 杀价值降低
							else if (shanProb < 0.3) s *= 1.2; // 对手大概率没闪 → 杀价值提高
						}
						if (id === 'wuxie') {
							const wuxieProb = probHasWuxie(bestT);
							if (wuxieProb > 0.5) s *= 1.15;   // 对手大概率有无懈 → 我也要有无懈
						}
						if (id === 'tao') {
							const taoProb = probHasTao(bestT);
							if (taoProb > 0.4) s *= 0.9;      // 对手大概率有桃 → 击杀难度高
						}
					}

					/* ② 装备稀缺度：关键装备价值提高 */
					if (isKeyEquip(id)) {
						const scarcity = equipScarcity(id);
						if (scarcity <= 2) s *= 1.3;       // 仅剩 2 张以下 → 价值飙升
					}

					/* ③ 对手情绪：根据情绪状态调整卡牌价值 */
					if (bestT) {
						const mood = analyzeOpponentMood(bestT);
						if (mood) {
							const bonus = moodStrategyBonus(me, bestT, { id: id });
							if (bonus) s *= bonus;
						}
					}

					/* ④ 武将克制：根据克制关系调整 */
					if (bestT) {
						const relBonus = counterRelationBonus(me, bestT, { id: id });
						if (relBonus) s *= relBonus;
					}

					/* ⑤ 出牌顺序：根据优先级调整 */
					const priority = getCardPriority(id);
					if (priority > 3) s *= 1.1;           // 高优先级卡牌价值提高

					/* ⑥ 铁索连环：考虑伤害转移 */
					if (id === 'tiesuo' || id === 'sha' || id === 'juedou') {
						const transferBonus = damageTransferBonus(me, bestT, { id: id });
						if (transferBonus) s *= transferBonus;
					}

					/* ⑦ 概率树搜索：考虑后续影响 */
					if (bestT && (id === 'sha' || id === 'juedou')) {
						const treeBonus = treeSearchBonus(me, bestT, { id: id });
						if (treeBonus) s *= treeBonus;
					}

					/* ⑧ 牌堆顶预测：考虑牌堆顶的牌 */
					const deckBonus = deckTopBonus(me, { id: id });
					if (deckBonus) s *= deckBonus;

					/* ⑨ 博弈论：根据游戏阶段调整 */
					const gameBonus = gameTheoryBonus(me, { id: id });
					if (gameBonus) s *= gameBonus;

					/* ⑩ 局面策略：根据局面估值调整 */
					const sitBonus = situationStrategyBonus(me, { id: id });
					if (sitBonus) s *= sitBonus;
				} catch (e24) {}

					/* ===== ★ v1.7.0 新增 5 个优化模块 ===== */
					try {
						/* ⑪ 响应阶段优化：出闪/出无懈/出桃 */
						const respBonus = responseBonus(me, { id: id, source: bestT, target: bestT });
						if (respBonus !== 1.0) s *= respBonus;

						/* ⑫ 弃牌阶段优化 */
						const discardB = discardBonus(me, { card: { name: id } });
						if (discardB !== 1.0) s *= discardB;

						/* ⑬ 残局策略 */
						const endB = endgameBonus(me, { id: id });
						if (endB !== 1.0) s *= endB;

						/* ⑭ 对手预测 */
						if (bestT) {
							const oppB = opponentPredictBonus(me, bestT, { id: id });
							if (oppB !== 1.0) s *= oppB;
						}

						/* ⑮ 资源使用时机 */
						const resB = resourceTimingBonus(me, { id: id, target: bestT });
						if (resB !== 1.0) s *= resB;
					} catch (e17) {}

					/* ===== ★ v1.8.0 新增 5 个优化模块 ===== */
					try {
						/* ⑯ AOE 时机优化 */
						const aoeB = aoeBonus(me, { id: id });
						if (aoeB !== 1.0) s *= aoeB;

						/* ⑰ 判定锦囊时机优化 */
						const judgeB = judgeBonus(me, { id: id, target: bestT });
						if (judgeB !== 1.0) s *= judgeB;

						/* ⑱ 装备更换优化 */
						const equipB = equipReplaceBonus(me, { id: id, card: { name: id } });
						if (equipB !== 1.0) s *= equipB;

						/* ⑲ 手牌保留策略 */
						const keepB = keepBonus(me, { id: id, card: { name: id } });
						if (keepB !== 1.0) s *= keepB;

						/* ⑳ 多轮规划 */
						const mtB = multiTurnBonus(me, { id: id });
						if (mtB !== 1.0) s *= mtB;
					} catch (e18) {}

					/* ===== ★ v1.0.2 新增 5 个锦囊时机优化模块 ===== */
					try {
						/* ㉑ 决斗时机优化 */
						const duelB = duelBonus(me, { id: id, target: bestT });
						if (duelB !== 1.0) s *= duelB;

						/* ㉒ 借刀杀人时机优化 */
						const jiedaoB = jiedaoBonus(me, { id: id, target: bestT });
						if (jiedaoB !== 1.0) s *= jiedaoB;

						/* ㉓ 闪电时机优化 */
						const shandianB = shandianBonus(me, { id: id });
						if (shandianB !== 1.0) s *= shandianB;

						/* ㉔ 桃园结义时机优化 */
						const taoyuanB = taoyuanBonus(me, { id: id });
						if (taoyuanB !== 1.0) s *= taoyuanB;

						/* ㉕ 五谷丰登时机优化 */
						const wuguB = wuguBonus(me, { id: id });
						if (wuguB !== 1.0) s *= wuguB;
					} catch (e19) {}

					/* ===== ★ v1.0.3 新增 5 个时机优化模块 ===== */
					try {
						/* ㉖ 杀目标选择优化 */
						if (bestT) {
							const shaB = shaTargetBonus(me, bestT);
							if (shaB !== 1.0) s *= shaB;
						}

						/* ㉗ 桃使用时机优化 */
						const taoB = taoBonus(me, { id: id });
						if (taoB !== 1.0) s *= taoB;

						/* ㉘ 酒使用时机优化 */
						const jiuB = jiuBonus(me, { id: id });
						if (jiuB !== 1.0) s *= jiuB;

						/* ㉙ 无懈可击时机优化 */
						const wuxieB = wuxieBonus(me, { id: id });
						if (wuxieB !== 1.0) s *= wuxieB;

						/* ㉚ 顺手牵羊时机优化 */
						const shunshouB = shunshouBonus(me, { id: id, target: bestT });
						if (shunshouB !== 1.0) s *= shunshouB;
					} catch (e20) {}

					/* ===== ★ v1.0.4 深度价值量化模块 ===== */
					try {
						/* ㉛ 深度价值量化 */
						const deepB = deepValueBonus(me, { id: id, target: bestT });
						if (deepB !== 1.0) s *= deepB;
					} catch (e21) {}

				/* ★ E 阶段：救援濒死队友 —— 桃博弈模型 */
				if (id === 'tao') {
					try {
						let dyingAlly = null, dyingEnemy = null;
						for (const p of (game.players || [])) {
							if (!p || p === me) continue;
							if (!p.isAlive ? (p.alive === false) : false) continue;
							if ((p.hp || 0) > 0) continue;
							const att = get.attitude(me, p);
							if (att > 0 && !dyingAlly) dyingAlly = p;
							else if (att < 0 && !dyingEnemy) dyingEnemy = p;
						}

						if (dyingAlly) {
							/* ============ 桃博弈模型 ============ */

							/* ① 目标价值：身份 + 血量上限 + 威胁度 */
							let targetValue = 1.0;
							try {
								const tHp = dyingAlly.maxHp || 4;
								if (tHp >= 5) targetValue += 0.6;
								else if (tHp >= 4) targetValue += 0.3;
								const mode = (_status && _status.mode) || '';
								if (mode === 'identity') {
									const tid = dyingAlly.identity;
									if (tid === 'zhu') targetValue += 1.5;
									else if (tid === 'zhong' || tid === 'mingzhong') targetValue += 1.0;
									else if (tid === 'nei') targetValue += 0.3;
								}
								try {
									const th = threatOf(dyingAlly);
									targetValue += Math.min(1.0, th * 0.15);
								} catch (e) {}
							} catch (e) {}

							/* ② 救援成功率：自己手里桃数量 */
							let myTaoCount = 0;
							try {
								myTaoCount = me.countCards ? me.countCards('hs', 'tao') : 0;
							} catch (e) {}
							const hpDeficit = Math.max(1, -(dyingAlly.hp || 0) + 1);
							const needed = hpDeficit;
							const enough = myTaoCount >= needed ? 1.0 : (myTaoCount / needed);

							/* ③ 桃的机会成本：自己血量低 → 桃更贵 */
							let opportunityCost = 1.0;
							try {
								const myHp = me.hp || 0;
								const myMax = me.maxHp || 1;
								const hpRatio = myHp / Math.max(1, myMax);
								if (hpRatio < 0.3) opportunityCost = 3.0;
								else if (hpRatio < 0.5) opportunityCost = 2.0;
								else if (hpRatio < 0.7) opportunityCost = 1.3;
							} catch (e) {}

							/* ④ ★ 敌方再救风险：敌方手里的桃/酒越多 → 我救完可能又被打 */
							let enemyTaoRisk = 0;
							try {
								for (const p of (game.players || [])) {
									if (!p || p === me || p === dyingAlly) continue;
									if (p.alive === false) continue;
									if (!isEnemy(me, p)) continue;
									let knownTao = 0;
									try {
										const known = p.getKnownCards ? p.getKnownCards() : [];
										known.forEach(function (c) {
											const n = get.name(c);
											if (n === 'tao' || n === 'jiu') knownTao++;
										});
									} catch (e) {}
									enemyTaoRisk += knownTao;
									try {
										const hc = p.countCards ? p.countCards('h') : 0;
										enemyTaoRisk += hc * 0.08;
									} catch (e) {}
								}
							} catch (e) {}

							/* ⑤ 综合评分 */
							let score = 6 * targetValue * enough / Math.max(1, opportunityCost);
							const riskFactor = 1 / (1 + enemyTaoRisk * 0.3);
							score *= riskFactor;

							/* ⑥ 队友自己能自救 → 优先让他自救 */
							try {
								const allyTao = dyingAlly.countCards ? dyingAlly.countCards('hs', 'tao') : 0;
								const allyJiu = dyingAlly.countCards ? dyingAlly.countCards('hs', 'jiu') : 0;
								const selfSave = allyTao + allyJiu;
								if (selfSave >= needed) {
									score *= 0.4;
								}
							} catch (e) {}

							/* ⑦ 濒死目标 HP 缺口越大，救援紧迫度越高 */
							if (hpDeficit >= 2) score *= 1.4;

							s += score;

						} else if (dyingEnemy) {
							s -= 8;
						}
					} catch (eDying) {}
				}


				/* 酒：濒死时也能当桃用，但优先级低于桃 */
				if (id === 'jiu') {
					try {
						let dyingAlly = null;
						for (const p of (game.players || [])) {
							if (!p || p === me) continue;
							if (p.alive === false || (p.hp || 0) > 0) continue;
							if (isSameCamp(me, p)) { dyingAlly = p; break; }
						}
						if (dyingAlly) {
							const hpDeficit = Math.max(1, -(dyingAlly.hp || 0) + 1);
							/* 酒救援优先级比桃低一档（因为酒有攻击副作用） */
							s += hpDeficit >= 2 ? 5 : 3;
						}
					} catch (eDying) {}
				}

				/* AOE：场上只要有 HP=1 的友方，且友方无对应防御牌 → 强烈压制 */
				if (id === 'nanman' || id === 'wanjian') {
					try {
						const respCard = id === 'nanman' ? 'sha' : 'shan';
						let allyAtRisk = 0, enemyAtRisk = 0;
						for (const p of (game.players || [])) {
							if (!p || p === me || p.alive === false) continue;
							if (p.countCards('hs', respCard) > 0) continue;
							const hp = p.hp || 0;
							const w = hp <= 1 ? 3 : (hp <= 2 ? 2 : 1);
							if (isSameCamp(me, p)) allyAtRisk += w;
							else enemyAtRisk += w;
						}
						/* 自身：若自己无防御牌也计入风险 */
						if (me.countCards('hs', respCard) === 0) {
							const hp = me.hp || 0;
							allyAtRisk += hp <= 1 ? 3 : (hp <= 2 ? 2 : 1);
						}
						const net = enemyAtRisk - allyAtRisk;
						if (net <= -3) s -= 10;      // 严重亏损：强压
						else if (net <= -1) s -= 4;  // 轻度亏损
						else if (net >= 3) s += 3;   // 大赚
						else if (net >= 1) s += 1.5; // 小赚
							/* ★ 残局 AOE 乘数（与 optimization 层对齐） */
							try {
								const alive = (game.players || []).filter(function (p) {
									return p && p.alive !== false;
								}).length;
								let endgameMul = 1.0;
								if (alive <= 2) endgameMul = 1.6;
								else if (alive <= 4) endgameMul = 1.3;
								else if (alive <= 6) endgameMul = 1.1;
								/* 残局 + 敌方有残血 → 强推 */
								if (alive <= 4) {
									let enemyLowHp = 0, allyLowHp = 0;
									for (const p of (game.players || [])) {
										if (!p || p === me || p.alive === false) continue;
										if ((p.hp || 0) > 1) continue;
										if (isSameCamp(me, p)) allyLowHp++;
										else enemyLowHp++;
									}
									if (enemyLowHp >= 1 && allyLowHp === 0) s *= 1.5;
									if (allyLowHp >= 1) s *= 0.5;
								}
								s *= endgameMul;

								/* ★ 牌堆感知：南蛮/万箭的命中率随牌堆变化 */
								try {
									if (id === 'nanman') {
										const shaRemain = cardRemaining('sha');
										if (shaRemain <= 3) s *= 1.25;  /* 杀稀缺 → 南蛮更值 */
									} else if (id === 'wanjian') {
										const shanRemain = cardRemaining('shan');
										if (shanRemain <= 3) s *= 1.25;  /* 闪稀缺 → 万箭更值 */
									}
								} catch (eDeck) {}
							} catch (eEndgame) {}

					} catch (eAoe) {}
				}

				/* ★ 敌方爆发威胁调整 */
				if (burst.value >= 0.4) {
					/* 拆牌类：目标是爆发威胁者 → 大幅加分（优先拆连弩） */
					if ((id === 'guohe' || id === 'shunshou') && bestT === burst.target) {
						s += 3 * burst.value;
					}
					/* 防御牌：敌方连弩在 → 强烈保留 */
					if (DEF_CARDS.indexOf(id) >= 0) {
						s *= 1.0 + 0.6 * burst.value;
					}
					/* 攻击牌：趁对方未爆发提前压制（先手斩） */
					if (ATK_CARDS.indexOf(id) >= 0) {
						s *= 1.0 + 0.4 * burst.value;
					}
					/* 若目标是爆发威胁者本人，ATK 权重再加一档 */
					if (bestT === burst.target && ATK_CARDS.indexOf(id) >= 0) {
						s *= 1.15;
					}
				}

				/* ★ 连弩出牌顺序优化：装连弩 + 手里有杀时，调整候选优先级 */
				try {
					const hasZhuge = !!me.getEquip && !!me.getEquip('zhuge');
					const myShaCount = me.countCards ? me.countCards('hs', 'sha') : 0;
					if (hasZhuge && myShaCount > 0) {
						/* 1) 拆牌类前置：拆掉敌方防具，为后续连杀开路 */
						if (id === 'guohe' || id === 'shunshou') {
							if (bestT && !isSameCamp(me, bestT)) {
								/* 目标有装备 → 强前置 */
								const equips = bestT.getCards ? bestT.getCards('e') : [];
								if (equips.length > 0) s += 3.5;
								else s += 1.0;
							}
						}
						/* 2) 酒前置：有酒且有杀时，先喝酒再杀 */
						if (id === 'jiu') {
							/* 目标 HP≥2 时酒才有意义（HP=1 时杀直接带走，酒浪费） */
							if (bestT && (bestT.hp || 0) >= 2) s += 3.0;
						}
						/* 3) AOE 后置：南蛮/万箭会先消耗敌方的杀/闪，
						 *    如果敌人被逼出闪，后续杀的命中率反降；
						 *    如果敌人用杀应答南蛮，则更耐杀。
						 *    综合来看，连弩状态下 AOE 应后置。 */
						if (id === 'nanman' || id === 'wanjian') {
							s *= 0.7;
						}
						/* 4) 无中/桃园等纯收益牌：连弩状态下不宜抢先后 */
						if (id === 'wuzhong' || id === 'taoyuan' || id === 'wugu') {
							s *= 0.85;
						}
						/* 5) 杀本身：连弩 + 多杀场景下，基础分抬升 */
						if (id === 'sha' && myShaCount >= 2) {
							s *= 1.15;
						}
					}
				} catch (eZhuge) {}

				if (ATK_CARDS.indexOf(id) >= 0) s *= risk.atk * atkMul * cfg('wAtkCard', 1);
				else if (DEF_CARDS.indexOf(id) >= 0) s *= risk.def * keepMul * cfg('wDefCard', 1);
				/* ★ 对象匹配加成：攻击牌打敌 / 拆牌打敌 / 治疗对友 */
				if (bestT) {
					/* ★ 第四层：阵营识别兜底（斗地主/国战模式） */
					let isAlly = false;
					try {
						const modeStrategy = getModeStrategy();
						if (modeStrategy && modeStrategy.getCamp) {
							const myCamp = modeStrategy.getCamp(me);
							const targetCamp = modeStrategy.getCamp(bestT);
							if (myCamp && targetCamp && myCamp === targetCamp) {
								isAlly = true; // 强制标记为盟友
							}
						}
						if (!isAlly) {
							isAlly = (isSameCamp(me, bestT));
						}
					} catch(e) {
						isAlly = (isSameCamp(me, bestT));
					}
					const isEnemy = isAlly ? false : isEnemyOf(me, bestT);

					/* ★ 主忠互殴惩罚（调高，软指标） */
					try {
						if (isAlly && ['sha', 'juedou', 'huogong', 'zhujin', 'nanman', 'wanjian'].indexOf(id) >= 0) {
							/* 打队友：大幅扣分（主忠互殴惩罚变高） */
							s += getMetric('ally_attack_penalty');
							/* 残局打队友惩罚更重 */
							const aliveCount = (game.players || []).filter(function (p) { return p && p.alive !== false; }).length;
							if (aliveCount <= 4) {
								s += getMetric('ally_attack_endgame');
							}
						}
					} catch (eAlly) {}

					/* ★ 忠臣打主公：额外惩罚（软指标，初始-30，剩下让模型判断） */
					try {
						if (me.identity === 'zhong' || me.identity === 'zhu') {
							if (bestT && bestT.identity === 'zhu' && bestT.identityShown) {
								if (['sha', 'juedou', 'huogong', 'zhujin', 'nanman', 'wanjian'].indexOf(id) >= 0) {
									s += getMetric('zhong_attack_zhu_penalty', -30);
								}
							}
						}
					} catch (eZhongZhu) {}

					/* ★ 阵亡+明置角色：身份100%确定，加入策略 */
					try {
						if (bestT && bestT.hp <= 0 && bestT.identityShown && bestT.identity) {
							/* 阵亡+明置的角色，身份100%确定 */
							if (bestT.identity === 'fan') {
								/* 确定是反贼 → 打他有额外加分 */
								if (['sha', 'juedou', 'huogong'].indexOf(id) >= 0) {
									s += getMetric('dead_fan_bonus', 5);
								}
							}
							if (bestT.identity === 'zhong') {
								/* 确定是忠臣 → 打他有额外惩罚 */
								if (['sha', 'juedou', 'huogong'].indexOf(id) >= 0) {
									s += getMetric('dead_zhong_penalty', -10);
								}
							}
						}
					} catch (eDeadIdentity) {}

					/* ★ 忠臣保护主公加分（新增，软指标） */
					try {
						if (me.identity === 'zhong' || me.identity === 'zhu') {
							/* 找主公 */
							const zhugong = (game.players || []).find(function (p) {
								return p && p.alive !== false && p.identity === 'zhu';
							});
							if (zhugong && zhugong !== me) {
								/* 治疗/保护牌对主公 → 高加分 */
								if (['tao', 'taoyuan'].indexOf(id) >= 0 && bestT === zhugong) {
									s += getMetric('protect_zhugong_bonus');
								}
								/* 主公受威胁时，防御牌/救援牌权重提高 */
								const zhugongHp = zhugong.hp || 0;
								const zhugongMaxHp = zhugong.maxHp || 4;
								if (zhugongHp <= 2 && zhugongMaxHp > 2) {
									if (['tao', 'shan', 'shandian', 'jiuge'].indexOf(id) >= 0) {
										s += getMetric('zhugong_under_threat');
									}
								}
							}
						}
					} catch (eZhugong) {}

					/* ★ 主公不能把内奸当反贼打：要根据实际价值判断 */
					try {
						if (me.identity === 'zhu') {
							/* 主公身份：不直接根据身份打，要根据实际行为价值 */
							/* 如果目标身份不明置，不能直接当反贼打 */
							if (bestT && !bestT.identityShown) {
								/* 身份不明置：降低攻击权重，让模型自己判断价值 */
								if (['sha', 'juedou', 'huogong', 'zhujin'].indexOf(id) >= 0) {
									/* 攻击权重打个折，不要太激进 */
									s *= 0.8;
								}
							}
						}
					} catch (eZhuValue) {}

					/* 单体攻击牌打敌 → 加成 */
					if (['sha', 'juedou', 'huogong', 'zhujin'].indexOf(id) >= 0 && isEnemy) {
						s *= 1.12;
					}
					/* 拆牌/延时类打敌 → 加成 */
					if (['guohe', 'shunshou', 'lebu', 'bingliang'].indexOf(id) >= 0 && isEnemy) {
						s *= 1.08;
						/* ★ 衰减：顺敌方延时锦囊（兵/乐）→ 刷分漏洞衰减 0.3
						 *   原因：从敌方 A 顺兵/乐，再贴给敌方 B，
						 *   本质是拆东墙补西墙，不是真正收益 */
						if (id === 'shunshou' && bestT) {
							try {
								const hCards = bestT.getCards ? bestT.getCards('h') : [];
								const hasDelay = hCards.some(function (c) {
									return c.name === 'lebu' || c.name === 'bingliang';
								});
								if (hasDelay) s *= 0.7;
							} catch (e) {}
						}
						/* ★ 判定区检测：对手判定区有牌 → 拆牌/顺牌大幅加分 */
						try {
							if (bestT && bestT.judges && bestT.judges.length > 0) {
								/* 对手判定区有乐/兵/闪电 → 拆牌优先度提高 */
								const judgeCards = bestT.judges.map(function (c) {
									return get.name(c);
								});
								const hasDelayJudge = judgeCards.some(function (n) {
									return n === 'lebu' || n === 'bingliang' || n === 'shandian';
								});
								if (hasDelayJudge) {
									s *= 1.3;  /* 判定区有延时牌 → 拆牌/顺牌加30% */
								}
							}
						} catch (eJudge) {}
					}
					/* 治疗类对友 → 加成 */
					if (['tao', 'taoyuan', 'wuzhong'].indexOf(id) >= 0 && !isEnemy) {
						s *= 1.08;
					}
				}
				/* 高方差卡牌：按冒险轴缩放（赌徒性格更爱火攻/决斗） */
				if (["huogong", "juedou", "shandian"].indexOf(id) >= 0) s *= riskTaking * cfg('wRiskCard', 1);
				s -= opportunityCost(id, econ) * cfg('wOpportunityMul', 0.5);
				combos.forEach(function (c) { if (c.setup === id) s += c.bonus * cfg('wComboBonus', 1); });
				/* 团队技能联动加成 */
				teamCombos.forEach(function (c) {
					if (c.skill && (id === c.skill || (c.skill === "jizhi" && ["wuzhong","guohe","shunshou","nanman","wanjian","tiesuo","lebu","bingliang"].indexOf(id) >= 0))) {
						s += c.bonus * 0.5;
					}
				});
				/* 集火加成：攻击牌打集火目标（团队轴调节） */
				if (focus && bestT === focus.target && ATK_CARDS.indexOf(id) >= 0) s *= (0.85 + 0.4 * teamwork) * trendMul.focus * cfg('wFocusMul', 1);
				/* 座位压力加成：乐/兵优先打最近敌方下家 */
				if (SEAT_TARGET_CARDS.indexOf(id) >= 0) {
					if (seat.nextEnemy && bestT === seat.nextEnemy) s += 1.5;
					else s += seat.enemyPressure * 0.3 * cfg('wSeatPressure', 1);
				}
				/* 上家是敌人 → 防御牌保留倾向提高 */
				if (DEF_CARDS.indexOf(id) >= 0 && seat.prevEnemy) s *= 1.15;
				/* 下回合预测修正：高危时防御牌大涨、进攻牌降权 */
				if (DEF_CARDS.indexOf(id) >= 0) {
					if (incoming.killRisk) s *= 1.6;
					else if (incoming.selfRisk >= 0.6) s *= 1.3;
					else if (incoming.selfRisk >= 0.3) s *= 1.1;
					s *= cfg('wForecastMul', 1);
				}
				if (ATK_CARDS.indexOf(id) >= 0) {
					if (incoming.killRisk) s *= 0.75;
					else if (incoming.selfRisk >= 0.6) s *= 0.9;
					else if (incoming.selfRisk < 0.15) s *= 1.12;
					s *= cfg('wForecastMul', 1);
				}
				/* 多回合趋势修正 */
				if (mt && mt.overall === "worsening") {
					if (ATK_CARDS.indexOf(id) >= 0) s *= 1.1;
					if (DEF_CARDS.indexOf(id) >= 0) s *= 0.95;
				} else if (mt && mt.overall === "improving") {
					if (DEF_CARDS.indexOf(id) >= 0) s *= 1.08;
				}
				/* 趋势联动权重 */
				if (ATK_CARDS.indexOf(id) >= 0) s *= trendMul.atk;
				if (DEF_CARDS.indexOf(id) >= 0) s *= trendMul.keep;
				/* 协作分工：进攻/防御卡牌偏移 */
				if (ROLE_PREFS) {
					if (ATK_CARDS.indexOf(id) >= 0) s *= ROLE_PREFS.cardAtk;
					if (DEF_CARDS.indexOf(id) >= 0) s *= ROLE_PREFS.cardDef;
				}
				/* ★ 决策维度反馈（target / tempo / keep） */
				try {
					const targetBonus = bestT ? getDecisionBonus('target', bestT.name1 || bestT.name) : 1.0;
					s *= targetBonus;
					const tempoBonus = getDecisionBonus('tempo', stageLabel);
					s *= tempoBonus;
					const keepBonus = getDecisionBonus('keep', id);
					s *= keepBonus;
				} catch (eFB) {}

				/* ★ 覆写命中时增强 reason */
				let ovTag = '';
				try {
					const ov = readCardOverride(id, me, bestT);
					if (ov) ovTag = ' | 覆写:' + Math.round(ov.score * 10) / 10 + '(' + (ov.reason || '').slice(0, 20) + ')';
				} catch (e) {}

				acts.push({ type: "card", id: id, target: bestT ? bestT.name : null, targetScore: Math.round(bestTs), score: toInt8(s), reason: "使用" + (v.name || id) + (bestT ? "→" + bestT.name + "（目标分" + Math.round(bestTs) + "）" : "") + "（EV" + Math.round(ev) + " 边际" + Math.round(mv) + ovTag + "）" });
			} catch (e) {}
		});
		/* 装备候选（价值替换） */
		try {
			me.getCards("h").forEach(function (c) {
				try {
					const t = get.subtype ? get.subtype(c) : null;
					if (!t) return;
					const eq = me.getCards("e", function (ec) { try { return get.subtype(ec) === t; } catch (e) { return false; } });
					const oldCard = eq[0] || null;
					const eqCost = equipReplaceCost(me, c, oldCard);
					if (eqCost.net > 0) {
						acts.push({
							type: "equip",
							id: c.name || "",
							score: Math.round(eqCost.net * 2 * sit.tempo * risk.safe * 100) / 100,
							reason: "装备" + (c.name || "") + "（价值" + eqCost.newValue + ">" + eqCost.oldValue + "，拆风险" + Math.round(eqCost.stripPressure * 100) + "%）",
						});
					}
				} catch (e) {}
			});
		} catch (e) {}
		/* 小模型先验融合（模型只做建议，规则兜底） */
		try {
			const probs = miniPredict(miniFeatures());
			if (probs && MINI_W.labels) {
				acts.forEach(function (a) {
					let label = "B";
					if (a.type === "skill") label = "F";
					else if (a.type === "equip") label = "E";
					else if (a.type === "card") { const id = a.id; if (["sha","juedou","huogong","nanman","wanjian","zhujin","shunshou","guohe","tiesuo","lebu","bingliang"].indexOf(id) >= 0) label = "D"; else if (["shan","tao","wuxie","jiu"].indexOf(id) >= 0) label = "C"; }
					const idx = MINI_W.labels.indexOf(label);
					if (idx >= 0 && probs[idx]) a.score += probs[idx] * 3;
				});
			}
		} catch (e) {}
		/* 结束回合候选 */
		acts.push({ type: "end", id: "end", score: 0, reason: "结束回合（保留" + hand.length + "张，" + sit.mode + "）" });

		/* ★ 手牌管理策略：评估「留牌 vs 出牌」的全局权衡 */
		try {
			const handCount = hand.length;
			const alive = (game.players || []).filter(function (p) { return p && p.alive !== false; }).length;
			const round = _getRoundNumber();
			const stage = stageLabel;  /* early / mid / late / endgame */

			/* ① 阶段感知：早期手牌多 → 可以攒牌；后期 → 出手 */
			let handKeepBias = 0;
			if (stage === 'early') handKeepBias = 0.15;
			else if (stage === 'mid') handKeepBias = 0.0;
			else if (stage === 'late') handKeepBias = -0.15;
			else if (stage === 'endgame') handKeepBias = -0.3;

			/* ② 手牌溢出：手牌 > 手牌上限 → 必须出手 */
			try {
				const limit = me.getHandcardLimit ? me.getHandcardLimit() : 5;
				const overflow = handCount - limit;
				if (overflow >= 2) handKeepBias -= 0.4;
				else if (overflow >= 1) handKeepBias -= 0.2;
			} catch (e) {}

			/* ③ 队友濒死 → 强制出手（桃/无懈） */
			try {
				let dyingAlly = false;
				for (const p of (game.players || [])) {
					if (!p || p === me || p.alive === false) continue;
					if ((p.hp || 0) <= 0 && isSameCamp(me, p)) { dyingAlly = true; break; }
				}
				if (dyingAlly) handKeepBias -= 0.5;
			} catch (e) {}

			/* ④ 敌方连弩 → 留闪 */
			try {
				let enemyZhuge = false;
				for (const p of (game.players || [])) {
					if (!p || p === me || p.alive === false) continue;
					if (!isEnemy(me, p)) continue;
					if (p.getEquip && p.getEquip('zhuge')) { enemyZhuge = true; break; }
				}
				if (enemyZhuge) handKeepBias += 0.2;
			} catch (e) {}

			/* ⑤ 血量低 → 留防御牌 */
			try {
				const hpRatio = (me.hp || 0) / Math.max(1, me.maxHp || 1);
				if (hpRatio < 0.4) handKeepBias += 0.25;
				else if (hpRatio < 0.6) handKeepBias += 0.1;
			} catch (e) {}

			/* ⑥ 应用：对所有非攻击牌调整评分 */
			if (Math.abs(handKeepBias) > 0.01) {
				acts.forEach(function (a) {
					if (a.type !== 'card') return;
					const DEF_CARDS = ['shan', 'tao', 'wuxie', 'jiu'];
					const ATK_CARDS = ['sha', 'juedou', 'huogong', 'nanman', 'wanjian', 'zhujin'];
					/* 防御牌：留牌倾向 → 提高价值；出牌倾向 → 降低价值 */
					if (DEF_CARDS.indexOf(a.id) >= 0) {
						a.score *= (1 + handKeepBias);
					}
					/* 攻击牌：留牌倾向 → 降低价值；出牌倾向 → 提高价值 */
					else if (ATK_CARDS.indexOf(a.id) >= 0) {
						a.score *= (1 - handKeepBias * 0.7);
					}
				});
			}
		} catch (e) {}

		/* ★ 模式专属加成 */
		try {
			const modeStrategy = getModeStrategy();
			acts.forEach(function (a) {
				try {
					const boost = modeStrategy.decisionBoost(me, a);
					if (boost) a.score += boost;
					a.mode = modeStrategy.name;
				} catch (eB) {}
			});
		} catch (eM) {}

		/* ★ 攻击队友禁令：直接从候选中剔除所有攻击队友的动作 */
		try {
			const ATK_IDS = ["sha", "juedou", "huogong", "nanman", "wanjian", "jiedao", "lijian", "fanjian", "sidian", "huosha", "leisha", "zhujin", "shunshou", "guohe", "lebu", "bingliang", "tiesuo"];
			acts.forEach(function (a) {
				if (a.type !== "card") return;
				if (ATK_IDS.indexOf(a.id) < 0) return;
				/* 找到目标玩家对象 */
				let tgt = null;
				try {
					if (a.target) {
						for (const p of (game.players || [])) {
							if (!p) continue;
							if ((p.name1 || p.name || "") === a.target) { tgt = p; break; }
						}
					}
				} catch (e) {}
				if (!tgt) return;
				const att = get.attitude(me, tgt);
				if (att > 0) {
					/* ★ 不刻意加规则，让模型自己学：
					 *   打队友的惩罚不写死，而是把"是否打队友"作为特征写进 96 维特征
					 *   模型从对局反馈中自己学习这个特征的权重
					 *   打多了自然就知道不好，但又不会绝对禁止 */
					a.reason = (a.reason || "") + "（[特征]打队友）";
				}
			});
		} catch (eBan) {}

		/* ★ 模型融合变量声明（best 确定后再执行融合逻辑） */
		let modelConf = null, metaMod = null, intervention = 'skip';

		acts.sort(function (a, b) { return b.score - a.score; });
		const endAction = acts.filter(function (a) { return a.type === "end"; })[0] || { type: "end", id: "end", score: 0, reason: "结束回合" };
		best = (acts[0] && acts[0].score > 0) ? acts[0] : endAction;

		/* ★ 暴露候选给 planner */
		try {
			_status.djsc_lastCandidates = acts.slice(0, 8);
			_status.djsc_lastBestT = bestT;
			_status.djsc_lastBestTs = bestTs;
			_status.djsc_lastSit = sit;
			_status.djsc_lastEcon = econ;
		} catch (e) {}

		/* ★ 规划器：用多步视角微调 best */
		try {
			const refined = refineBestWithPlan(me, best, bestT);
			if (refined && refined !== best) {
				best = refined;
				if (!acts.some(function (a) { return a.id === refined.id; })) {
					acts.push(refined);
					acts.sort(function (a, b) { return b.score - a.score; });
				}
			}
		} catch (eP) {}

		/* ★ P0-1 精度模式：给所有动作算特征，学得最全 */
		try {
			const _buf = new Int8Array(FEATURE_DIM);
			const ctx = {
				bestT: bestT,
				bestTs: bestTs,
				isEnemy: bestT ? isEnemyOf(me, bestT) : false,
				focusTarget: focus ? focus.target : null,
			};
			/* 精度模式：给所有动作都算特征，不要只给前5个 */
			for (let i = 0; i < acts.length; i++) {
				try {
					/* 精度模式：时间限制放宽到 100ms */
					if (performance.now() - _perfT0 > 100) break;
					const f = extractFeatures(me, acts[i], ctx, _buf, alivePlayers);
					acts[i]._feat = Array.from(f);
				} catch (e) {}
			}
		} catch (eFeat) {}
		/* ★ 用训练好的模型微调（best 已确定，可安全访问 best._feat） */
		try {
			if (weightsReady() && cfg('useTrainedModel', true) && best && best._feat) {
				const feat = new Int8Array(96);
				for (let i = 0; i < 96 && i < best._feat.length; i++) feat[i] = best._feat[i];
				modelConf = window.__DJSC && window.__DJSC.confidence ? window.__DJSC.confidence(feat) : null;
				if (modelConf && modelConf.action !== 'skip') {
					metaMod = cognitiveModulate(
						{ type: best.type, id: best.id, target: best.target },
						{}
					);
					intervention = decideIntervention(modelConf, metaMod);
					const wModelMap = { model: 0.5, blend: 0.3, rule: 0.1, skip: 0 };
					const baseW = wModelMap[intervention] || 0.1;
					let calibTrust = 0;
					try {
						if (window.__DJSC.calibrator && window.__DJSC.calibrator.modelTrust) {
							calibTrust = window.__DJSC.calibrator.modelTrust();
						}
					} catch (e) {}
					const wModel = Math.max(0.05, Math.min(0.7, baseW - calibTrust));
					if (true) { // 强制允许模型接管，不管置信度多低
						let _takeoverCount = 0;  /* ★ 统计本轮接管次数 */
						let _lastMLog = '';
						for (let i = 0; i < acts.length; i++) {
							const a = acts[i];
							if (!a._feat) continue;
							const fa = new Int8Array(96);
							for (let j = 0; j < 96 && j < a._feat.length; j++) fa[j] = a._feat[j];
							const sub = window.__DJSC.confidence(fa);
							if (!sub) continue;
							const modelStrength = (sub.probs ? Math.max.apply(null, sub.probs) : 0) * 32;
							a.score = Math.round(a.score * (1 - wModel) + modelStrength * wModel);
							var mLog = '[M:' + sub.label + '·' + intervention + '·F' + Math.round(metaMod.familiarity * 100) + '%]';
							a.reason = (a.reason || '') + mLog;
							_takeoverCount++;
							_lastMLog = mLog;
						}
						/* ★ 日志合并：只打一行汇总 */
						if (_takeoverCount > 0) {
							try { game.log('模型接管 ×' + _takeoverCount + ' 个动作 ' + _lastMLog); } catch (e) {}
						}
					}
					try {
						if (window.__DJSC.conflict && window.__DJSC.conflict.detect) {
							window.__DJSC.conflict.detect(best, modelConf, metaMod, { type: best.type, id: best.id, target: best.target });
						}
					} catch (eC) {}
					try {
						if (window.__DJSC.calibrator && window.__DJSC.calibrator.record && modelConf) {
							window.__DJSC.calibrator.record(best, modelConf, { me: me, bestT: bestT, bestTs: bestTs });
						}
					} catch (eCal) {}
					try {
						if (window.__DJSC.strategyBus && modelConf && modelConf.confidence >= 0.55) {
							const busRes = window.__DJSC.strategyBus.arbitrate(best, modelConf, me, acts);
							if (busRes && busRes.picked) {
								best = busRes.picked;
								best.reason = (best.reason || '') + '｜总线：' + busRes.reason;
							}
						}
					} catch (eBus) {}
					try { _status.djsc_lastConfidence = modelConf; } catch (e) {}
					try { _status.djsc_lastMeta = { model: modelConf, meta: metaMod, intervention: intervention }; } catch (e) {}
				}
			}
		} catch (eModel) {
			try { console.error('[模型融合] 异常：', eModel); } catch (e) {}
		}

		/* ★ 认知日志 */
		try {
			if (window.__DJSC.cognitionLog && window.__DJSC.cognitionLog.log) {
				window.__DJSC.cognitionLog.log({
					round: (typeof _status !== 'undefined' && _status.roundNumber) || 0,
					player: (me.name1 || me.name) || '?',
					action: best.type + ':' + best.id,
					model: modelConf,
					meta: metaMod,
					intervention: intervention,
					effective: (window.__DJSC.metaCognition && modelConf && metaMod)
						? window.__DJSC.metaCognition.effective(modelConf, metaMod) : 0,
				});
			}
		} catch (eCL) {}

		let action = "B";
		if (best.type === "skill") action = "F";
		else if (best.type === "equip") action = "E";
		else if (best.type === "end") action = "C";
		else { const id = best.id; if (["sha","juedou","huogong","nanman","wanjian","zhujin","shunshou","guohe","tiesuo","lebu","bingliang"].indexOf(id) >= 0) action = "D"; else if (["shan","tao","wuxie","jiu"].indexOf(id) >= 0) action = "C"; else action = "B"; }
		const teamTip = focus ? ("｜集火：" + focus.name + "（" + focus.score + "）") : "";
		const seatTip = (seat.nextEnemy ? "｜下家敌：" + (seat.nextEnemy.name || "?") : "") +
		                (seat.prevEnemy ? "｜上家敌：" + (seat.prevEnemy.name || "?") : "");
		const econTip = "｜资源：手" + econ.handCount + "张(" + econ.handValue + ") 装" + econ.equipCount + "件(" + econ.equipValue + ") HP" + econ.hp + "/" + econ.maxHp;
		let styleTip = "";
		try { if (bestT) styleTip = "｜目标风格：" + styleOf(bestT).tag; } catch (e) {}
		const comboLen = teamCombos.length;
		/* ===== 技能反馈：记录本次技能使用的预测收益 ===== */
		try {
			if (best && best.type === "skill" && cfg("skillFeedback", true) !== false) {
				const sid = best.id;
				let predicted = 0;
				try {
					const prof = skillProfileOf(sid);
					if (prof && prof.profit) predicted = prof.profit.originalBase || prof.profit.base || 0;
				} catch (eP) {}
				if (predicted > 0) {
					recordSkillUse(sid, keyOf(me), predicted);
					/* ★ 元素反馈：观察技能使用 */
					try {
						observeElementUse('skill', sid, me, { hpBefore: me.hp || 0 });
					} catch (e) {}
					/* ★ 元认知：记录技能使用 */
					try { metaRecordSkill(sid); } catch (e) {}
				}
			}
		} catch (eFb) {}
		/* ===== 风格反馈：记录本局每个敌人的风格与胜负信号 ===== */
		try {
			if (cfg("styleFeedback", true) !== false) {
				for (const p of (game.players || [])) {
					if (!p || p === me || p.alive === false) continue;
					const s = styleOf(p);
					if (s && s.tag && s.tag !== "unknown") {
						recordStyleOutcome(s.tag, keyOf(p), (round[keyOf(p)] || 0));
					}
				}
			}
		} catch (eSf) {}
		/* ===== 记录本次决策（六层信号 + 候选 + 胜出） ===== */
		try {
			const layers = {
				tempo: { mode: sit.mode, stage: stageLabel, baseTempo: sit.tempo, atkMul: atkMul, keepMul: keepMul, burstMul: burstMul, desc: sit.tempoDesc || sit.desc },
				risk: { label: riskLabel, atk: risk.atk, def: risk.def, safe: risk.safe },
				team: { focus: focus ? focus.name : null, focusScore: focus ? focus.score : 0, protect: team.protect ? team.protect.name : null, protectScore: team.protect ? team.protect.score : 0, comboCount: teamCombos.length },
				seat: { enemyPressure: seat.enemyPressure, nextEnemy: seat.nextEnemy ? (seat.nextEnemy.name || "?") : null, prevEnemy: seat.prevEnemy ? (seat.prevEnemy.name || "?") : null },
				econ: { handCount: econ.handCount, handValue: econ.handValue, equipCount: econ.equipCount, equipValue: econ.equipValue, hp: econ.hp, maxHp: econ.maxHp, hpRatio: econ.hpRatio, totalValue: econ.totalValue, stripPressure: econ.strip ? econ.strip.pressure : 0 },
				style: { target: bestT ? (bestT.name || "?") : null, tag: (function () { try { return bestT ? styleOf(bestT).tag : null; } catch (e) { return null; } })() },
				forecast: {
					incomingTotal: incoming.total,
					selfRisk: incoming.selfRisk,
					killRisk: incoming.killRisk,
					topEnemy: (incoming.byEnemy && incoming.byEnemy[0]) ? incoming.byEnemy[0].name : null,
					teamRisk: forecast.team.map(function (t) { return t.name + "(" + t.risk + ")"; }).slice(0, 3),
					advice: forecast.advice,
				},
				multiturn: {
					overall: mt ? mt.overall : "stable",
					r1: mt && mt.r1 ? mt.r1.trend : null,
					r3: mt && mt.r3 ? mt.r3.trend : null,
					advice: mt ? mt.advice : "",
				},
			};
			/* ★ 把规划序列一起记入 layers */
			try {
				const plan = planSequence(me);
				if (plan && plan.best) {
					layers.plan = {
						isKill: plan.isKill || false,
						total: plan.best.total,
						futureScore: plan.best.futureScore || 0,
						steps: (plan.best.steps || []).map(function (s) { return s.id || s; }).slice(0, 3),
						alternatives: (plan.alternatives || []).map(function (alt) {
							return { id: alt.action && alt.action.id, total: alt.total };
						}).slice(0, 2),
					};
				}
			} catch (ePlan) {}
			recordDecision(me, layers, acts, best);
		} catch (eRec) {}
		const forecastTip = "｜预测：" + forecast.advice + "（压力 " + incoming.total + " 风险 " + Math.round(incoming.selfRisk * 100) + "%）";
		const mtTip = mt ? ("｜趋势：" + mt.overall) : "";
		const trendTip = "｜趋势权重：" + (trend === "worsening" ? "进攻↑守↓" : trend === "improving" ? "守↑攻↓" : "均衡");
		/* ★ 广播：告诉队友我打谁 */
		try {
			if (bestT && (best.type === 'card' || best.type === 'skill')) {
				const id = best.id || '';
				const ATK = ['sha','juedou','huogong','nanman','wanjian','zhujin','shunshou','guohe','tiesu','lebu','bingliang'];
				if (ATK.indexOf(id) >= 0) {
					broadcastIntent(me, bestT.name1 || bestT.name, id, best.score);
				}
			}
		} catch (eB) {}
		try { perfMark('bestAction', performance.now() - _perfT0); } catch (eP) {}
		try { profEnd('bestAction'); } catch (e) {}

		/* ===== ★ 模型护栏：执行前的最后一道法律检查 ===== */
		try {
			const _killCand = (function () {
				for (const a of acts) {
					if (a.type === 'card' && ['sha','juedou','huogong'].indexOf(a.id) >= 0) {
						if (a.score > 0 && a.reason && a.reason.indexOf('击杀') >= 0) return a;
					}
				}
				return null;
			})();
			const _guardCtx = { bestT: bestT, allCandidates: acts, killAvailable: _killCand };
			const _guardRes = guardCheck(me, best, _guardCtx);
			if (!_guardRes.ok) {
				/* 触碰红线：用兜底动作替换 */
				if (_guardRes.fallback) {
					best = _guardRes.fallback;
				} else {
					best = { type: 'end', id: 'end', score: 0, reason: '护栏拦截降级：' + _guardRes.reason };
				}
				applyGuardPenalty('chooseToUse', _guardRes.rule);
				best.reason = (best.reason || '') + '（🛡️护栏：' + _guardRes.reason + '）';
			}
		} catch (eGuard) {
			try { console.error('[模型护栏] 集成异常：', eGuard); } catch (e) {}
		}

		const _finalResult = {
			action: action,
			reason: best.reason + "（评分" + best.score + "，" + sit.mode + "×" + sit.tempo + "，阶段=" + stageLabel + "，性格=" + riskLabel + teamTip + seatTip + econTip + styleTip + forecastTip + mtTip + trendTip + (comboLen ? "，联动" + comboLen + "条" : "") + "）",
			strat: best.type === "skill" ? "chooseToUse" : (best.type === "equip" ? "equipAfter" : (best.type === "end" ? "switchToAuto" : "useCardAfter")),
			rule: best.id,
			target: bestT ? (bestT.name1 || bestT.name || bestT.name2 || null) : null,
			targetScore: Math.round(bestTs),
			score: Math.round(best.score),
		};
		/* ★ 暴露给策略总线 */
		try { _status.djsc_lastBest = _finalResult; } catch (e) {}

		/* ================= ★ 特征记录（不刻意加规则，让模型自己学） ================= */
		try {
			let _riskFeatures = null;

			if (best && best.type === 'card' && bestT) {
				const cardId = best.id;
				const cardName = (lib.translate && lib.translate[cardId]) || cardId;

				/* 把这些"风险场景"作为特征记录下来，
				 * 让模型从对局反馈中自己学习权重，
				 * 而不是写死规则 */
				const features = [];

				/* 特征 1：是否打队友 */
				let isAlly = false;
				try {
					if (isSameCamp(me, bestT)) isAlly = true;
					const _strat = typeof getModeStrategy === 'function' ? getModeStrategy() : null;
					if (_strat && _strat.isSameCamp && _strat.isSameCamp(me, bestT)) isAlly = true;
				} catch (e) {}
				if (isAlly) features.push('打队友');

				/* 特征 2：自己是否残血 */
				if ((me.hp || 0) <= 2) features.push('自己残血');

				/* 特征 3：目标是否残血 */
				if ((bestT.hp || 0) <= 1) features.push('目标残血');

				/* 特征 4：手牌是否太少 */
				if ((me.countCards ? me.countCards('h') : 0) <= 2) features.push('手牌少');

				/* 特征 5：是否残局 */
				const alive = (game.players || []).filter(function (p) { return p && p.alive !== false; }).length;
				if (alive <= 3) features.push('残局');

				if (features.length) {
					_riskFeatures = {
						features: features,
						ts: Date.now(),
					};
				}
			}

			try { _status.djsc_lastRisk = _riskFeatures; } catch (e) {}
		} catch (eR) {}

		/* ★ 训练数据：记录本次决策样本（带采样权重） */
		try {
			/* ★ 修复：确保 best._feat 有值 */
			let featToUse = best._feat;
			if (!featToUse || !featToUse.length) {
				/* 如果 best._feat 为空，从 acts 里找同 id 的对象 */
				for (let i = 0; i < acts.length; i++) {
					if (acts[i].id === best.id && acts[i].type === best.type && acts[i]._feat) {
						featToUse = acts[i]._feat;
						break;
					}
				}
			}
			/* 如果还是没有，直接调 extractFeatures 补 */
			if (!featToUse || !featToUse.length) {
				try {
					const _fb = new Int8Array(FEATURE_DIM);
					const _fx = extractFeatures(me, best, {
						bestT: bestT,
						bestTs: bestTs,
						isEnemy: bestT ? isEnemyOf(me, bestT) : false,
						focusTarget: focus ? focus.target : null,
					}, _fb);
					featToUse = Array.from(_fx);
				} catch (eFeat) {}
			}

			/* ★ 决策后检测：拍执行前快照 */
			let pcKey = null;
			try {
				pcKey = postCheckBefore(me, best, bestT);
			} catch (ePc) {}

			const w = window.__DJSC.metaCognition && window.__DJSC.metaCognition.sampleWeight
				? window.__DJSC.metaCognition.sampleWeight({ type: best.type, id: best.id, target: best.target })
				: 1.0;
			const times = Math.max(1, Math.round(w));
			for (let t = 0; t < times; t++) {
				trainRecordSample(me, best, sit, best.score, featToUse);
			}

			/* ★ 决策后检测：1.5 秒后自动计算实际收益，回填到样本 */
			if (pcKey) {
				postCheckDelayed(pcKey, me, bestT, function (gain) {
					/* ★ 静默：不输出到日志面板 */
					// try {
					// 	if (gain !== 0) {
					// 		log.info('postCheck', '决策后收益: ' + gain + '（已记录到样本）');
					// 	}
					// } catch (e) {}
				});
			}
		} catch (e) {}
		/* ★ 调用总线仲裁 */
		try {
			const stratResult = strategize(me, _status.event, _finalResult);
			if (stratResult) _finalResult.strategist = stratResult;
		} catch (e) {}
		return _finalResult;
	} catch (e) {
		try { perfMark('bestAction', performance.now() - _perfT0); } catch (eP) {}
		try { profEnd('bestAction'); } catch (e) {}
		return { action: "C", reason: "评分异常：" + String(e).slice(0, 60), strat: "switchToAuto" };
	}
}
function rulesDecide() { try { return bestAction(); } catch (e) { return null; } }

/* 模型决策：基础策略优先 + 小模型概率（偏置修正） */
function modelDecision() {
	try {
		const r = rulesDecide();
		const f = miniFeatures();
		let probs = f ? miniPredict(f) : null;
		if (probs) {
			const ab = cfg("atkBias", 1), db = cfg("defBias", 1);
			/* 标签: A引擎/B换牌/C结束/D进攻/E装备/F技能 —— 进攻偏置放大 D/F，防守偏置放大 C */
			const gain = [0, 0, db * 0.15, ab * 0.3, ab * 0.1, ab * 0.2];
			probs = probs.map(function (x, i) { return x + gain[i]; });
			const s = probs.reduce(function (a, b) { return a + b; }, 0);
			probs = probs.map(function (x) { return x / s; });
		}
		if (r && r.action && r.reason) {
			try { log.info('model', '【模型决策】' + r.action + '：' + r.reason + '（' + (r.rule || r.strat || '') + '）'); } catch (e) {}
		}
		return { rules: r, probs: probs, labels: probs ? MINI_W.labels : null };
	} catch (e) { return { err: String(e) }; }
}

/* ================= 结算 ================= */
function settle() {
	try {
		if (settleDone) return;
		settleDone = true;
		/* 终局存活奖励：活下来的阵营每人 +3 */
		try {
			(game.players || []).forEach(function (p) {
				if (p && p.alive !== false && (p.hp || 0) > 0) {
					give(p, 3, "存活至终局");
				}
			});
		} catch (e) {}
		const sum = Math.round(Object.keys(round).reduce(function (s, k) { return s + round[k]; }, 0) * 100) / 100;
		try { memSave(); } catch (eM2) {}
		/* 跨局记忆：把本局实时风格合并到存储 */
		try {
			(game.players || []).forEach(function (p) {
				if (!p || p === game.me) return;
				try {
					const s = styleOf(p);
					/* 只要观察到任何行为就存（source=live 或 unknown 但有数据） */
					if (!s) return;
					if (s.source !== 'live' && !s.attacks && !s.aids) return;
					mergeOnSettle(p, s);
				} catch (eS) {}
			});
			saveStore();
			try {
				const st = storeStats();
				if (typeof log !== 'undefined' && log.info) {
					log.info('memory', '跨局记忆已更新：' + st.entries + ' 位玩家，' + st.samples + ' 条样本');
				}
			} catch (e) {}
		} catch (eM) {}
		/* ★ 元素反馈合并 */
		try { settleElementFeedback(); } catch (e) {}
		/* ★ 元认知结算 */
		try { metaSettleGame(); } catch (e) {}
		/* ★ 记录校准快照（每局一次） */
		try {
			if (window.__DJSC.calibHistory && window.__DJSC.calibHistory.record) {
				window.__DJSC.calibHistory.record();
			}
		} catch (e) {}
		/* ★ 多档案：记录本局结果 */
		try {
			if (window.__DJSC.multiProfile) {
				const me2 = game.me;
				const myKey2 = me2 ? (me2.name1 || me2.name || '?') : '?';
				const myScore2 = (round && round[myKey2]) || 0;
				const cur2 = window.__DJSC.multiProfile.getCurrent();
				const curKey2 = cur2 ? cur2.key : 'balanced';
				window.__DJSC.multiProfile.recordResult(curKey2, myScore2 > 0);
				if (Math.random() < 0.2) {
					window.__DJSC.multiProfile.imitateBest(curKey2);
				}
			}
		} catch (e) {}
		/* ★ 决策回放归档 */
		try {
			if (window.__DJSC && window.__DJSC.replay && window.__DJSC.replay.settle) {
				const me3 = game.me;
				const myKey3 = me3 ? (me3.name1 || me3.name || '?') : '?';
				const myScore3 = (round && round[myKey3]) || 0;
				window.__DJSC.replay.settle({
					verdict: myScore3 > 3 ? 'win' : (myScore3 < -3 ? 'lose' : 'draw'),
					myScore: myScore3,
				});
			}
		} catch (eR) {}
		/* ★ 权重固化：把校准偏移刻进模型 */
		try {
			if (window.__DJSC && window.__DJSC.weightPersist && window.__DJSC.weightPersist.onSettle) {
				window.__DJSC.weightPersist.onSettle();
			}
		} catch (eWP) {}
		/* ★ 跨模式自动迁移 */
		try {
			if (window.__DJSC && window.__DJSC.crossMode && window.__DJSC.crossMode.autoPromote) {
				window.__DJSC.crossMode.autoPromote(3);
			}
		} catch (eCM) {}
		/* ★ 模型热更新：回填 A/B 分数 + 定期触发训练 */
		try {
			if (window.__DJSC && window.__DJSC.hotSwap) {
				const meHS = game.me;
				const myKeyHS = meHS ? (meHS.name1 || meHS.name || '?') : '?';
				const myScoreHS = (round && round[myKeyHS]) || 0;
				window.__DJSC.hotSwap.recordScore(myScoreHS);
				const st = window.__DJSC.hotSwap.stats();
				if (!st.hasCandidate && st.samples >= st.MIN_SAMPLES) {
					window.__DJSC.hotSwap.trigger();
				}
			}
		} catch (eHS) {}
		/* ★ 策略进化：回填本局结果 */
		try {
			if (window.__DJSC && window.__DJSC.evolution) {
				const meEV = game.me;
				const myScoreEV = (round && round[meEV ? (meEV.name1 || meEV.name || '?') : '?']) || 0;
				const bestEV = window.__DJSC.evolution.current ? window.__DJSC.evolution.current() : null;
				if (bestEV) {
					window.__DJSC.evolution.record(bestEV.id, myScoreEV > 0);
				}
			}
		} catch (eEV) {}
		/* ★ 积分自修改：根据本局结果调整积分 */
		try {
			if (window.__DJSC && window.__DJSC.scoreSelfMod) {
				const meSM = game.me;
				const myKeySM = meSM ? (meSM.name1 || meSM.name || '?') : '?';
				const myScoreSM = (round && round[myKeySM]) || 0;
				const winSM = myScoreSM > 0;
				/* 遍历本局使用过的牌，调整积分 */
				const usedCards = (scoreLog || []).filter(function (s) {
					return s && s.tag && s.tag.indexOf('使用') >= 0;
				});
				usedCards.forEach(function (s) {
					const cardId = (s.tag.match(/使用.*?（([^）]+)）/) || [])[1];
					if (cardId) {
						window.__DJSC.scoreSelfMod.observe(cardId, {
							win: winSM,
							hpDelta: myScoreSM,
							handDelta: 0,
						});
					}
				});
			}
		} catch (eSM) {}
		/* ===== 归档本局 ===== */
		try {
			const me = game.me;
			const myKey = me ? (me.name || me.name1 || "?") : "?";
			const myScore = round[myKey] || 0;
			/* ★ P0-1 修复：回填 reward */
			/* ★ P0-1 修复：回填 reward（仅 winner，不污染未选中候选） */
			try {
				const dLog = getDecisionLog();
				let pushed = 0;
				for (const entry of dLog) {
					if (!entry || !entry.candidates) continue;
					const winner = entry.winner || entry.candidates[0];
					if (!winner || !winner._feat) continue;
					pushSample(winner._feat, myScore, {
						round: entry.round || 0,
						type: winner.type || '',
						id: winner.id || '',
						score: Math.round(winner.score || 0),
					});
					pushed++;
				}
				if (pushed > 0) {
					try { log.info('train', '本局回填 ' + pushed + ' 条样本（仅 winner），累计 ' + bufferSize()); } catch (e) {}
				}
			} catch (eTrain) {}
			const q = { crush: 0, normal: 0, close: 0 };
			let dLog = [];
			try {
				dLog = getDecisionLog();
				dLog.forEach(function (e) {
					const c = e.candidates || [];
					if (c.length < 2) { q.normal++; return; }
					const gap = (c[0].score || 0) - (c[1].score || 0);
					if (gap >= 3) q.crush++;
					else if (gap <= 0.8) q.close++;
					else q.normal++;
				});
			} catch (eQ) {}
			/* 压缩决策为可持久化结构（每条 ~200 字节，最多 10 条） */
			const compressed = dLog.slice(-10).map(function (e) {
				const L = e.layers || {};
				return {
					round: e.round || 0,
					player: e.player || "?",
					winner: e.winner ? { type: e.winner.type, id: e.winner.id, score: e.winner.score } : null,
					top3: (e.candidates || []).slice(0, 3).map(function (c) {
						return { type: c.type, id: c.id, score: c.score, target: c.target || null };
					}),
					signals: {
						tempo: L.tempo ? L.tempo.stage : null,
						risk: L.risk ? L.risk.label : null,
						teamFocus: (L.team && L.team.focus) || null,
						styleTag: (L.style && L.style.tag) || null,
					},
				};
			});
			const cardCounts = {};
			try {
				const RECx = getREC();
				const ck = RECx.cards || {};
				Object.keys(ck).forEach(function (k) { cardCounts[k] = ck[k]; });
			} catch (eC) {}
			const topCards = Object.keys(cardCounts).sort(function (a, b) { return cardCounts[b] - cardCounts[a]; }).slice(0, 3);
			let mode = "unknown";
			try { mode = (get && get.mode) ? get.mode() : ((_status && _status.mode) || "unknown"); } catch (eM2) {}
			archiveGame({
				ts: Date.now(),
				mode: mode,
				myIdentity: me ? (me.identity || null) : null,
				myScore: Math.round(myScore * 100) / 100,
				playerCount: (game.players || []).length,
				roundCount: _getRoundNumber(),
				decisionSteps: dLog.length,
				quality: q,
				topCards: topCards,
				verdict: verdictOf(myScore),
				decisions: compressed,
			});
			try { log.info('archive', '本局已保存（共 ' + getArchive().length + ' 局，含 ' + compressed.length + ' 条决策）'); } catch (eL) {}
		} catch (eArch) {}
		/* ===== 技能反馈闭环：把本局结果合并到 storage ===== */
		try {
			if (cfg("skillFeedback", true) !== false) {
				flushFeedback(round);
				const fc = feedbackCount();
				try { log.info('feedback', '技能反馈已更新修正系数（累计 ' + fc + ' 个技能）'); } catch (eL) {}
			}
		} catch (eFb2) {}
		/* ===== 风格反馈闭环 ===== */
		try {
			if (cfg("styleFeedback", true) !== false) {
				flushStyleFeedback();
				for (const p of (game.players || [])) {
					if (!p || p === game.me) continue;
					const s = styleOf(p);
					if (s && s.tag && s.tag !== "unknown") {
						const pk = p.nickname || p.uid || p.name;
						if (pk) recordPlayerTag(pk, s.tag, 1);
					}
				}
				saveStyleFeedback();
				try { log.info('style', '风格反馈已更新标签可信度'); } catch (eL2) {}
			}
		} catch (eSf2) {}
		/* ★ 决策维度反馈回写（target / tempo / keep） */
		try {
			if (cfg("decisionFeedback", true) !== false) {
				const me = game.me;
				const myKey = me ? (me.name || me.name1 || "?") : "?";
				const myScore = (round && round[myKey]) || 0;
				const win = myScore > 0;
				(game.players || []).forEach(function (p) {
					if (!p || p === me) return;
					const pk = p.name1 || p.name;
					if (pk) recordTargetOutcome(pk, win);
				});
				try {
					const stage = (function () {
						const r = _getRoundNumber();
						const alive = (game.players || []).filter(function (x) { return x && !x.isDead && !(x.hp <= 0); }).length;
						if (r <= 3) return 'early';
						if (alive <= 4) return 'endgame';
						if (r >= 8) return 'late';
						return 'mid';
					})();
					recordTempoOutcome(stage, win);
				} catch (e) {}
				try {
					const RECx = getREC();
					const ck = (RECx && RECx.cards) || {};
					Object.keys(ck).forEach(function (k) { recordKeepOutcome(k, win); });
				} catch (e) {}
				flushDecisionFeedback();
				log.info('feedback', '决策维度反馈已更新');
			}
		} catch (e) {}
		/* ★ 自适应难度 */
		try { import('./adaptive.js').then(function (m) { m.updateAdaptive && m.updateAdaptive(); }).catch(function () {}); } catch (e) {}
		/* 延迟弹出战报（避免与本体结算界面冲突） */
		try {
			setTimeout(function () {
				try {
					import('./report.js').then(function (m) {
						try { m.showReport(); } catch (e) {}
					}).catch(function () {});
				} catch (e) {}
			}, 3200);
		} catch (e) {}
		if (cfg("persist", true)) {
			try {
				const key = "决策积分引擎_history";
				const old = localStorage.getItem(key);
				let arr = old ? JSON.parse(old) : [];
				if (!Array.isArray(arr)) arr = [];
				const entry = { t: Date.now(), round: round, sum: sum, log: scoreLog.slice(-60) };
				/* 附上行为观察快照 */
				try {
					const obsSnapshot = getObs();
					const compact = {};
					for (const k in obsSnapshot) {
						const e = obsSnapshot[k];
						if (e.hostile > 0 || e.friendly > 0) {
							compact[k] = { attacks: e.attacks, aids: e.aids, hostile: Math.round(e.hostile * 100) / 100, friendly: Math.round(e.friendly * 100) / 100 };
						}
					}
					entry.obs = compact;
				} catch (e) {}
				/* 附上身份推理快照 */
				try {
					const beliefs = {};
					(game.players || []).forEach(function (p) {
						if (!p) return;
						beliefs[p.name || "?"] = { real: p.identity || "?", inferred: _identityOf(p), belief: beliefOf(p) };
					});
					entry.identities = beliefs;
				} catch (e) {}
				arr.push(entry);
				while (arr.length > 100) arr.shift();
				localStorage.setItem(key, JSON.stringify(arr));
			} catch (e) {}
		}
		/* 终局汇总：用带阵营标注的显示名，只打一条日志 */
		try {
			const name2p = {};
			(game.players || []).forEach(function (p) { try { if (p) name2p[keyOf(p)] = p; } catch (e) {} });
			const parts = Object.keys(round).map(function (k) {
				const p = name2p[k];
				return (p ? displayName(p) : k) + (round[k] > 0 ? "+" : "") + round[k];
			});
			log.info('settle', '总分=' + sum + '（守恒） ' + parts.join("；"));
		} catch (e2) {}
		/* ★ Bandit：本局结果回填给决策点 */
		try {
			import('./bandit.js').then(function (m) {
				const myKey = game.me ? (game.me.name || game.me.name1 || '?') : '?';
				m.recordGameEnd(round[myKey] || 0);
			});
		} catch (eBandit) {}
		/* ★ 模型状态机推进 */
		try {
			import('./modelState.js').then(function (m) {
				m.onGameEnd();
			});
		} catch (eModel) {}
		/* ★ A/B 测试：记录本局我方归一化分 */
		try {
			import('./modelState.js').then(function (m) {
				const myKey = game.me ? (game.me.name || game.me.name1 || '?') : '?';
				m.recordABScore(round[myKey] || 0);
			});
		} catch (eAB) {}
		/* ★ 自动发现：检查后悔值，注册新决策点 */
		try {
			import('./autoDiscover.js').then(function (m) {
				m.promoteHighRegretPoints();
			});
		} catch (eDiscover) {}
		/* ★ 全局扫描：每局结束时检查新决策点 */
		try {
			import('./globalScanner.js').then(function (m) {
				m.autoRegister();
			});
		} catch (eScan) {}
		/* ★ 玩家评分反馈：每4-5局弹出一次，让玩家给AI表现打分 */
		try {
			const feedbackKey = "无名AI_playerFeedback";
			const feedbackData = JSON.parse(localStorage.getItem(feedbackKey) || '{"games":0,"scores":[],"skipped":0}');
			feedbackData.games = (feedbackData.games || 0) + 1;
			/* 每5局触发一次评分 */
			const shouldAsk = (feedbackData.games % 5 === 0);
			if (shouldAsk && cfg("playerFeedback", true) !== false) {
				const me = game.me;
				const myKey = me ? (me.name || me.name1 || "?") : "?";
				const myScore = (round && round[myKey]) || 0;
				const winText = myScore > 0 ? '胜利' : (myScore < 0 ? '失败' : '平局');
				setTimeout(function () {
					try {
						/* 用无名杀原生对话框 */
						const dlg = ui.create.dialog('无名AI 体验反馈');
						dlg.classList.add('fullheight');
						dlg.style.width = 'min(92vw, 480px)';
						dlg.style.left = '4vw';
						/* 内容 */
						const content = document.createElement('div');
						content.style.padding = '16px';
						content.innerHTML =
							'<div style="text-align:center; margin-bottom:16px;">' +
							'<div style="font-size:16px; margin-bottom:8px;">本局结果：<b>' + winText + '</b></div>' +
							'<div style="color:#999; font-size:13px;">你觉得AI的表现怎么样？点选一个分数</div>' +
							'</div>' +
							'<div style="display:flex; justify-content:center; gap:8px; margin-bottom:16px; flex-wrap:wrap;">' +
							[-5,-4,-3,-2,-1,0,1,2,3,4,5].map(function(s) {
								const color = s < 0 ? '#ff6b6b' : (s > 0 ? '#51cf66' : '#ffd43b');
								const label = s < 0 ? s : (s > 0 ? '+' + s : '0');
								return '<button data-score="' + s + '" style="width:40px; height:40px; border-radius:50%; border:2px solid ' + color + '; background:rgba(255,255,255,0.1); color:' + color + '; font-size:14px; cursor:pointer;">' + label + '</button>';
							}).join('') +
							'</div>' +
							'<div style="background:rgba(0,0,0,0.2); border-radius:8px; padding:12px; margin-bottom:16px; font-size:12px; line-height:1.8;">' +
							'<div style="color:#ff6b6b; margin-bottom:4px;">【差评区】</div>' +
							'<div>−5分：完全不会玩，低级错误频发</div>' +
							'<div>−4分：很离谱，决策明显错误</div>' +
							'<div>−3分：较差，经常选错目标/时机</div>' +
							'<div>−2分：一般偏差，偶尔犯傻</div>' +
							'<div>−1分：小问题，基本能打但不聪明</div>' +
							'<div style="color:#ffd43b; margin:6px 0 4px;">【中性区】</div>' +
							'<div>0分：中规中矩，像普通玩家</div>' +
							'<div style="color:#51cf66; margin:6px 0 4px;">【好评区】</div>' +
							'<div>+1分：还不错，决策比较合理</div>' +
							'<div>+2分：良好，思路清晰</div>' +
							'<div>+3分：不错，像会玩的玩家</div>' +
							'<div>+4分：很好，有配合意识</div>' +
							'<div>+5分：非常好，像高手大神</div>' +
							'</div>' +
							'<div style="text-align:center;">' +
							'<button id="skipFeedback" style="padding:8px 24px; border-radius:20px; border:none; background:rgba(255,255,255,0.2); color:#ccc; font-size:14px; cursor:pointer;">跳过本次反馈</button>' +
							'</div>';
						dlg.content.appendChild(content);
						/* 绑定按钮事件 */
						content.querySelectorAll('button[data-score]').forEach(function(btn) {
							btn.onclick = function() {
								const s = parseInt(btn.getAttribute('data-score'));
								feedbackData.scores.push({
									games: feedbackData.games,
									score: s,
									result: winText,
									time: Date.now()
								});
								if (feedbackData.scores.length > 20) feedbackData.scores = feedbackData.scores.slice(-20);
								localStorage.setItem(feedbackKey, JSON.stringify(feedbackData));
								dlg.close();
							};
						});
						const skipBtn = content.querySelector('#skipFeedback');
						if (skipBtn) {
							skipBtn.onclick = function() {
								feedbackData.skipped = (feedbackData.skipped || 0) + 1;
								localStorage.setItem(feedbackKey, JSON.stringify(feedbackData));
								dlg.close();
							};
						}
					} catch (eDlg) {
						/* 弹窗失败，降级用 prompt */
						const score = window.prompt(
							'【无名AI 体验反馈】\n本局结果：' + winText + '\n' +
							'给AI表现打分（-5到+5，0=跳过）：'
						);
						if (score !== null && score !== '' && parseInt(score) !== 0) {
							const s = parseInt(score);
							if (s >= -5 && s <= 5) {
								feedbackData.scores.push({ games: feedbackData.games, score: s, result: winText, time: Date.now() });
							}
						} else {
							feedbackData.skipped = (feedbackData.skipped || 0) + 1;
						}
						localStorage.setItem(feedbackKey, JSON.stringify(feedbackData));
					}
				}, 5000);
			}
			localStorage.setItem(feedbackKey, JSON.stringify(feedbackData));
			/* ★ 精度模式：把玩家评分接入模型，调整最近样本权重 */
			try {
				if (feedbackData.scores && feedbackData.scores.length > 0) {
					const latestScore = feedbackData.scores[feedbackData.scores.length - 1].score;
					/* 评分 -5~+5 → 权重倍数 0.5~1.5 */
					const weightMul = 1 + latestScore / 10;
					/* 调整最近20条样本的权重 */
					if (window.__DJSC && window.__DJSC.training && window.__DJSC.training.adjustRecentWeights) {
						window.__DJSC.training.adjustRecentWeights(weightMul, 20);
					}
				}
			} catch (eAdj) {}
		} catch (eFeedback) {}
	} catch (e) {}
}
/* ================= 终局信号统一判断 =================
 * noname 各版本终局信号不一致：
 *   - _status.over（推荐，最稳）
 *   - game.over 可能是布尔，也可能是函数（版本差异）
 * 按可靠性从高到低依次判断，任一为真即视为终局。
 */
function isGameOver() {
	try {
		if (_status && _status.over === true) return true;
	} catch (e) {}
	try {
		if (game) {
			if (game.over === true) return true;
			/* 注意：game.over() 是"结束游戏"的函数（会设 _status.over=true 并弹出结算），
			 * 绝不能为了判断终局而调用它——那会主动把游戏搞结束。
			 * 这里只读布尔，不调用函数。 */
		}
	} catch (e) {}
	return false;
}
function startSettleWatch() {
	if (settleIv) return;
	settleIv = setInterval(function () {
		try {
			if (isGameOver() && !settleDone) settle();
		} catch (e) {}
	}, 1500);
}

/* 停止结算监视：卸载/重载时调用，避免定时器残留 */
function stopSettleWatch() {
	if (settleIv) {
		try { clearInterval(settleIv); } catch (e) {}
		settleIv = null;
	}
}


/* ================= 导出（供面板/调试桥使用） ================= */
export function getRound() { return round; }
export function getScoreLog() { return scoreLog; }
export function getREC() { return REC; }
export function resetRound() { round = {}; scoreLog = []; }
export function getSettleIv() { return settleIv; }
export function setSettleIv(v) { settleIv = v; }
export function getInstalled() { return installed; }
export function setInstalled(v) { installed = v; }
export function getMEM() { return MEM; }
export function clearScoreState() {
	settleDone = false; round = {}; _rawRound = {}; scoreLog = [];
	REC = { effects: {}, cards: {}, timings: {}, log: [] };
	memReset();
	try { clearThreatCache(); } catch (e) {}
	try { resetObs(); } catch (e) {}
	try { resetBelief(); } catch (e) {}
	try { deckReset(); } catch (e) {}
	try { clearCompensation(); } catch (e) {}
	_turnUse = 0; _lastTurnPlayer = null;
	try { import('./report.js').then(function (m) { m.resetReportShown && m.resetReportShown(); }); } catch (e) {}
	try { import('./decisionFeedback.js').then(function (m) { m.resetDecisionFeedback && m.resetDecisionFeedback(); }); } catch (e) {}
	/* ★ 清理策略总线信号 */
	try {
		if (_status) {
			delete _status.djsc_lastBest;
			delete _status.djsc_lastResponse;
			delete _status.djsc_lastCompare;
		}
	} catch (e) {}
}
export function getDecisionLog() { return DECISION_LOG; }
export function clearDecisionLog() { try { DECISION_LOG.length = 0; } catch (e) {} }
/* ★ 供 aiOverride 等模块写入决策日志（去重后调用） */
export function appendDecision(entry) {
	try {
		if (!entry || typeof entry !== 'object') return;
		DECISION_LOG.push(entry);
		while (DECISION_LOG.length > DECISION_LOG_MAX) DECISION_LOG.shift();
	} catch (e) {}
}
export { loadStore, saveStore, storeStats } from './memory.js';
export { give, givePair, giveVs, scoreCardUse, scoreEffect, installHooks, uninstallHooks, bestAction, rulesDecide, modelDecision, startSettleWatch, stopSettleWatch, settle, isGameOver };

/* ================= ★ 选将评分系统（多模式 + 批量平均 + 多维） ================= */
(function() {
  var CHAR_STORE_KEY = "无名AI_charUsage_v2";
  var STORE_VERSION = 2;
  var MAX_ENTRIES_PER_MODE = 50;
  var MAX_SAMPLES = 100;
  var BATCH_SIZE = 2;

  function loadStore() {
    try {
      var raw = localStorage.getItem(CHAR_STORE_KEY);
      if (raw) {
        var obj = JSON.parse(raw);
        if (obj && obj.v === STORE_VERSION && obj.modes) return obj;
      }
    } catch(e){}
    return { v: STORE_VERSION, modes: {} };
  }

  function saveStore(s) {
    try { localStorage.setItem(CHAR_STORE_KEY, JSON.stringify(s)); } catch(e){}
  }

  function currentMode() {
    try {
      if (typeof _status !== 'undefined' && _status && _status.mode) return String(_status.mode);
    } catch(e){}
    try {
      if (typeof game !== 'undefined' && game && game.getMode) return String(game.getMode());
    } catch(e){}
    return "identity";
  }

  function computeCharDims(charName) {
    var dims = {
      skillPower: 0, attack: 0, defense: 0, control: 0, support: 0,
      burst: 0, sustain: 0, teamwork: 0, solo: 0, difficulty: 0
    };
    try {
      if (typeof lib === 'undefined' || !lib.character) return dims;
      var cd = lib.character[charName];
      if (!cd || !cd.skills) return dims;
      var sc = cd.skills.length;
      if (sc === 0) return dims;
      
      for (var i = 0; i < sc; i++) {
        var sn = cd.skills[i];
        var prof = null;
        try {
          if (window.__DJSC && window.__DJSC.skillProfile) prof = window.__DJSC.skillProfile(sn);
        } catch(e){}
        if (!prof) continue;
        
        if (typeof prof.final === 'number') dims.skillPower += prof.final;
        
        if (prof.dims) {
          for (var d in prof.dims) {
            if (typeof dims[d] === 'number' && typeof prof.dims[d] === 'number') {
              dims[d] += prof.dims[d];
            }
          }
        }
      }
      
      for (var key in dims) {
        dims[key] = Math.round((dims[key] / sc) * 100) / 100;
      }
    } catch(e){}
    return dims;
  }

  function updateCharStats(charName, won, gameScore) {
    try {
      if (!charName) return null;
      var mode = currentMode();
      var store = loadStore();
      if (!store.modes[mode]) store.modes[mode] = {};
      var m = store.modes[mode];

      if (!m[charName]) {
        m[charName] = {
          games: 0, wins: 0,
          avgScore: 0,
          pendingN: 0, pendingSum: 0,
          dimsSum: {}, dimsN: 0,
          lastSeen: 0
        };
      }
      var rec = m[charName];

      rec.pendingN += 1;
      rec.pendingSum += (gameScore || 0);
      rec.games += 1;
      if (won) rec.wins += 1;

      var dims = computeCharDims(charName);
      for (var d in dims) {
        if (typeof dims[d] === 'number') {
          rec.dimsSum[d] = (rec.dimsSum[d] || 0) + dims[d];
        }
      }
      rec.dimsN += 1;

      if (rec.pendingN >= BATCH_SIZE) {
        var batchAvg = rec.pendingSum / rec.pendingN;
        var histGames = rec.games - rec.pendingN;
        if (histGames <= 0) {
          rec.avgScore = batchAvg;
        } else {
          rec.avgScore = (rec.avgScore * histGames + batchAvg * rec.pendingN) / (histGames + rec.pendingN);
        }
        rec.avgScore = Math.round(rec.avgScore * 100) / 100;
        rec.pendingN = 0;
        rec.pendingSum = 0;
      }

      if (rec.dimsN > 0) {
        var newDims = {};
        for (var d2 in rec.dimsSum) {
          newDims[d2] = Math.round((rec.dimsSum[d2] / rec.dimsN) * 100) / 100;
        }
        rec.dims = newDims;
      }

      if (rec.games > MAX_SAMPLES) {
        rec.games = MAX_SAMPLES;
        rec.wins = Math.min(rec.wins, MAX_SAMPLES);
      }

      rec.lastSeen = Date.now();

      var names = Object.keys(m);
      if (names.length > MAX_ENTRIES_PER_MODE) {
        names.sort(function(a, b) { return (m[b].lastSeen || 0) - (m[a].lastSeen || 0); });
        for (var i = MAX_ENTRIES_PER_MODE; i < names.length; i++) delete m[names[i]];
      }

      saveStore(store);
      return rec;
    } catch(e) { return null; }
  }

  function getTopChars(mode, limit) {
    limit = limit || MAX_ENTRIES_PER_MODE;
    var store = loadStore();
    var modeData = store.modes[mode || currentMode()] || {};
    var list = [];
    for (var name in modeData) {
      var rec = modeData[name];
      if (!rec) continue;
      list.push({
        name: name,
        score: rec.avgScore || 0,
        games: rec.games || 0,
        wins: rec.wins || 0,
        winRate: rec.games > 0 ? Math.round((rec.wins / rec.games) * 100) / 100 : 0,
        dims: rec.dims || {}
      });
    }
    list.sort(function(a, b) { return b.score - a.score; });
    return list.slice(0, limit);
  }

  function getCharRecord(charName, mode) {
    var store = loadStore();
    var m = store.modes[mode || currentMode()] || {};
    return m[charName] || null;
  }

  function getAllModeStats() {
    var store = loadStore();
    var result = {};
    for (var mode in store.modes) {
      result[mode] = { charCount: Object.keys(store.modes[mode]).length };
    }
    return result;
  }

  function clearMode(mode) {
    var store = loadStore();
    if (mode) delete store.modes[mode];
    else store.modes = {};
    saveStore(store);
  }

  window.__DJSC = window.__DJSC || {};
  window.__DJSC.__weightsModule = _weightsModule;
  window.__DJSC.__trainExportModule = _trainExportModule;

  /* ★ 提前挂载训练数据导入/导出（扩展加载时就可用，不用进对局） */
  window.__DJSC.trainExport = function() { return _trainExportModule.exportForImport(); };
  window.__DJSC.trainImport = function(jsonStr) { return _trainExportModule.importFromJson(jsonStr); };
  window.__DJSC.trainBufferSize = function() { return _trainExportModule.bufferSize(); };

  window.__DJSC.charStore = {
    update: updateCharStats,
    top: getTopChars,
    get: getCharRecord,
    allModes: getAllModeStats,
    clear: clearMode,
    currentMode: currentMode,
    dimsOf: computeCharDims
  };

  /* ★ gameOver 事件挂载已移到 panel.js（确保 game 已初始化） */

  console.log("[无名AI] 选将评分系统已加载，当前模式:", currentMode());
})();
