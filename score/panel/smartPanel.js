/* ================= 决策积分引擎 · 智能可视化面板 =================
 * 把 24 个模块的数据全部可视化展示
 */
import { lib, game, get, _status } from '../../../noname.js';

/* 导入所有模块 */
import { probHasShan, probHasWuxie, probHasTao, probHasSha, probHasJiu, inferHand } from '../card/handInference.js';
import { keepScore, recommendKeep, suitValue, cardKeepValue } from '../card/keepStrategy.js';
import { equipScarcity, equipValue, sortEquips, isKeyEquip } from '../card/equipScarcity.js';
import { predictCombo, predictTaoNeed, multiTurnScore } from '../misc/multiTurnPlan.js';
import { analyzeTeammateIntent, analyzeTeammateStrategy, teammateCoordination, recordTeammateAction } from '../strategy/teammateIntent.js';
import { analyzeOpponentPref, counterStrategy, predictOpponentNext } from '../analysis/counterStrategy.js';
import { evaluateSituation, describeSituation, situationStrategyBonus } from '../analysis/situationEval.js';
import { shaHitRate, wuxieRisk, duelWinRate, riskScore, describeRisk, taoNecessity } from '../analysis/riskQuant.js';
import { taoTiming, wuxieTiming, jiuTiming, resourceScarcity } from '../economy/resourceManage.js';
import { analyzeOpponentMood, describeMood, moodStrategyBonus, getAllMoods } from '../identity/moodState.js';
import { inferIdentity, describeIdentity, getAllIdentities, identityPanelData } from '../identity/identityVisual.js';
import { recordDecision, getDecisionLog, clearDecisionLog, analyzeReplay, replayPanelData } from '../export/replayAnalysis.js';
import { getMutualRelations, isCountering, isBeingCountered, counterRelationBonus } from '../analysis/mutualRelations.js';
import { getCardPriority, recommendOrder, orderBonus, recommendFlow } from '../economy/orderOptimizer.js';
import { shouldPassCard, whatTeammateNeeds, passCardBonus } from '../economy/passStrategy.js';
import { countTiesuo, tiesuoTransfer, tianxiangTransfer, damageTransfer, damageTransferBonus } from '../misc/damageTransfer.js';
import { predictShaFollowup, predictJuedouFollowup, searchTree, treeSearchBonus } from '../analysis/treeSearch.js';
import { needLongDelay, getSmartDelay, checkSkillTriggered } from '../timing/delayOptimizer.js';
import { getDeckTop, hasGuanxingSkill, prioritizeDeckTop, deckTopBonus, clearDeckTopCache } from '../card/deckTopPredict.js';
import { recommendDiscard, discardValue, specialDiscardAdvice, discardAdvice } from '../card/discardStrategy.js';
import { recordGameResult, getWinRate, autoAdjustWeights, learningPanelData, clearLearningData } from '../learning/learningLoop.js';
import { aliveCount, identityGameStrategy, shouldRevealIdentity, gameTheoryBonus } from '../identity/gameTheory.js';
import { cached, clearAllCache, cacheStats, perfStart, perfEnd, perfReport } from '../misc/perfOptimizer.js';

/* ================= 1. 生成智能面板 HTML ================= */
export function generateSmartPanelHtml() {
	try {
		const me = _status.currentPhase || game.me;
		if (!me) return '<div>没有当前玩家</div>';

		let html = '';

		/* ===== 区块 1：当前局面 ===== */
		html += '<div style="margin-bottom:16px;padding:12px;background:#14243c;border-radius:8px;border-left:4px solid #ffd479;">';
		html += '<div style="font-size:16px;font-weight:bold;color:#ffd479;margin-bottom:8px;">📊 当前局面</div>';

		const sit = evaluateSituation(me);
		const sitDesc = describeSituation(me);
		html += '<div style="margin:4px 0;">局面估值：<b style="color:' + sitDesc.color + '">' + sitDesc.label + ' (' + Math.round(sit * 100) + '%)</b></div>';

		const alive = aliveCount();
		html += '<div style="margin:4px 0;">存活人数：<b>' + alive + '</b></div>';

		const gameStrat = identityGameStrategy(me);
		const stratLabel = {
			'aggressive': '激进（进攻）',
			'defensive': '保守（防守）',
			'balanced': '均势（平衡）',
		}[gameStrat.strategy] || gameStrat.strategy;
		html += '<div style="margin:4px 0;">推荐策略：<b>' + stratLabel + '</b></div>';

		const reveal = shouldRevealIdentity(me);
		if (reveal.reveal) {
			html += '<div style="margin:4px 0;color:orange;">⚠️ ' + reveal.reason + '</div>';
		}

		html += '</div>';

		/* ===== 区块 2：对手手牌推断 ===== */
		html += '<div style="margin-bottom:16px;padding:12px;background:#14243c;border-radius:8px;border-left:4px solid #9ad8ff;">';
		html += '<div style="font-size:16px;font-weight:bold;color:#9ad8ff;margin-bottom:8px;">🃏 对手手牌推断</div>';

		const players = game.players || [];
		players.forEach(function (p) {
			if (!p || p.alive === false) return;
			if (p === me) return;

			const hand = inferHand(p);
			const name = p.name1 || p.name || '?';

			html += '<div style="margin:8px 0;padding:8px;background:#1a2a4a;border-radius:4px;">';
			html += '<div style="font-weight:bold;color:#fff;margin-bottom:4px;">' + name + '</div>';
			html += '<div style="color:#dbe7f5;">';
			html += '杀：' + Math.round(hand.sha * 100) + '%<br>';
			html += '闪：' + Math.round(hand.shan * 100) + '%<br>';
			html += '桃：' + Math.round(hand.tao * 100) + '%<br>';
			html += '无懈：' + Math.round(hand.wuxie * 100) + '%<br>';
			html += '酒：' + Math.round(hand.jiu * 100) + '%';
			html += '</div></div>';
		});

		html += '</div>';

		/* ===== 区块 3：对手情绪状态 ===== */
		html += '<div style="margin-bottom:16px;padding:12px;background:#14243c;border-radius:8px;border-left:4px solid #ff9c9c;">';
		html += '<div style="font-size:16px;font-weight:bold;color:#ff9c9c;margin-bottom:8px;">😠 对手情绪状态</div>';

		const moods = getAllMoods(me);
		moods.forEach(function (m) {
			html += '<div style="margin:4px 0;color:#dbe7f5;">';
			html += '<b style="color:' + m.color + '">' + m.name + '</b>：' + m.moodLabel + '（强度 ' + Math.round(m.intensity * 100) + '%）';
			html += '</div>';
		});

		html += '</div>';

		/* ===== 区块 4：身份推理 ===== */
		html += '<div style="margin-bottom:16px;padding:12px;background:#14243c;border-radius:8px;border-left:4px solid #a8b8c8;">';
		html += '<div style="font-size:16px;font-weight:bold;color:#a8b8c8;margin-bottom:8px;">🎭 身份推理</div>';

		const identities = getAllIdentities(me);
		identities.forEach(function (id) {
			html += '<div style="margin:4px 0;color:#dbe7f5;">';
			html += '<b style="color:' + id.color + '">' + id.name + '</b>：' + id.identityLabel + '（置信度 ' + Math.round(id.confidence * 100) + '%）';
			html += '</div>';
		});

		html += '</div>';

		/* ===== 区块 5：风险量化 ===== */
		html += '<div style="margin-bottom:16px;padding:12px;background:#14243c;border-radius:8px;border-left:4px solid #7fe3a0;">';
		html += '<div style="font-size:16px;font-weight:bold;color:#7fe3a0;margin-bottom:8px;">⚠️ 风险量化</div>';

		players.forEach(function (p) {
			if (!p || p.alive === false) return;
			if (p === me) return;

			const hitRate = shaHitRate(me, p);
			const name = p.name1 || p.name || '?';

			html += '<div style="margin:4px 0;color:#dbe7f5;">';
			html += '打 <b>' + name + '</b> 杀命中率：<b>' + Math.round(hitRate * 100) + '%</b>';
			html += '</div>';
		});

		const taoNeed = taoNecessity(me);
		html += '<div style="margin-top:8px;color:#dbe7f5;">桃必要性：<b>' + taoNeed.reason + '</b></div>';

		html += '</div>';

		/* ===== 区块 6：资源管理 ===== */
		html += '<div style="margin-bottom:16px;padding:12px;background:#14243c;border-radius:8px;border-left:4px solid #ffd479;">';
		html += '<div style="font-size:16px;font-weight:bold;color:#ffd479;margin-bottom:8px;">💰 资源管理</div>';

		const scarcity = resourceScarcity(me);
		html += '<div style="margin:4px 0;color:#dbe7f5;">牌堆剩余：</div>';
		html += '<div style="margin:4px 0;color:#dbe7f5;margin-left:12px;">· 桃：' + scarcity.tao.remain + ' 张（' + scarcity.tao.scarcity + '稀缺）</div>';
		html += '<div style="margin:4px 0;color:#dbe7f5;margin-left:12px;">· 无懈：' + scarcity.wuxie.remain + ' 张（' + scarcity.wuxie.scarcity + '稀缺）</div>';
		html += '<div style="margin:4px 0;color:#dbe7f5;margin-left:12px;">· 酒：' + scarcity.jiu.remain + ' 张（' + scarcity.jiu.scarcity + '稀缺）</div>';

		const taoTim = taoTiming(me);
		html += '<div style="margin-top:8px;color:#dbe7f5;">桃建议：<b>' + (taoTim.action === 'use' ? '用（使用）' : taoTim.action === 'keep' ? '留（保留）' : '看情况（待定）') + '</b>（' + taoTim.reason + '）</div>';

		html += '</div>';

		/* ===== 区块 7：队友意图 ===== */
		html += '<div style="margin-bottom:16px;padding:12px;background:#14243c;border-radius:8px;border-left:4px solid #7fe3a0;">';
		html += '<div style="font-size:16px;font-weight:bold;color:#7fe3a0;margin-bottom:8px;">🤝 队友意图</div>';

		let hasAlly = false;
		players.forEach(function (p) {
			if (!p || p.alive === false) return;
			if (p === me) return;

			let isAlly = false;
			try { if (get.attitude(me, p) > 0) isAlly = true; } catch (e) {}
			if (!isAlly) return;

			hasAlly = true;
			const strategy = analyzeTeammateStrategy(p);
			const strategyLabel = {
				'aggressive': '激进（进攻）',
				'defensive': '保守（防守）',
				'control': '控制（限制）',
				'support': '辅助（支援）',
				'balanced': '均势（平衡）',
			}[strategy.strategy] || strategy.strategy;

			html += '<div style="margin:8px 0;padding:8px;background:#1a2a4a;border-radius:4px;">';
			html += '<div style="font-weight:bold;color:#fff;margin-bottom:4px;">' + name + '</div>';
			html += '<div style="color:#dbe7f5;">策略：<b>' + strategyLabel + '</b>（置信度 ' + Math.round(strategy.confidence * 100) + '%）</div>';

			const needs = whatTeammateNeeds(me, p);
			if (needs.length > 0) {
				html += '<div style="margin-top:4px;color:#dbe7f5;">需要：</div>';
				needs.slice(0, 3).forEach(function (n) {
					html += '<div style="margin-left:12px;color:#dbe7f5;">· ' + n.reason + '</div>';
				});
			}
			html += '</div>';
		});

		if (!hasAlly) {
			html += '<div style="color:#dbe7f5;">没有队友</div>';
		}

		html += '</div>';

		/* ===== 区块 8：反制策略 ===== */
		html += '<div style="margin-bottom:16px;padding:12px;background:#14243c;border-radius:8px;border-left:4px solid #ff9c9c;">';
		html += '<div style="font-size:16px;font-weight:bold;color:#ff9c9c;margin-bottom:8px;">🛡️ 反制策略</div>';

		players.forEach(function (p) {
			if (!p || p.alive === false) return;
			if (p === me) return;

			let isEnemy = false;
			try { if (get.attitude(me, p) < 0) isEnemy = true; } catch (e) {}
			if (!isEnemy) return;

			const name = p.name1 || p.name || '?';
			const suggestions = counterStrategy(me, p);

			if (suggestions.length > 0) {
				html += '<div style="margin:8px 0;color:#dbe7f5;"><b>对 ' + name + '：</b></div>';
				suggestions.slice(0, 3).forEach(function (s) {
					html += '<div style="margin-left:12px;color:#dbe7f5;">· ' + s.desc + '</div>';
				});
			}
		});

		html += '</div>';

		/* ===== 区块 9：伤害转移 ===== */
		html += '<div style="margin-bottom:16px;padding:12px;background:#14243c;border-radius:8px;border-left:4px solid #a8b8c8;">';
		html += '<div style="font-size:16px;font-weight:bold;color:#a8b8c8;margin-bottom:8px;">⚡ 伤害转移</div>';

		const tiesuoCount = countTiesuo();
		html += '<div style="margin:4px 0;color:#dbe7f5;">铁索连环：' + tiesuoCount + ' 人被横置</div>';

		html += '</div>';

		/* ===== 区块 10：学习数据 ===== */
		html += '<div style="margin-bottom:16px;padding:12px;background:#14243c;border-radius:8px;border-left:4px solid #9ad8ff;">';
		html += '<div style="font-size:16px;font-weight:bold;color:#9ad8ff;margin-bottom:8px;">📚 学习数据</div>';

		const learning = learningPanelData();
		html += '<div style="margin:4px 0;color:#dbe7f5;">已对局：' + learning.games + ' 局</div>';
		html += '<div style="margin:4px 0;color:#dbe7f5;">胜率：' + Math.round(learning.winRate * 100) + '%</div>';
		html += '<div style="margin:4px 0;color:#dbe7f5;">模型就绪：' + (learning.weightReady ? '✅' : '❌') + '</div>';

		html += '</div>';

		/* ===== 区块 11：回放分析 ===== */
		html += '<div style="margin-bottom:16px;padding:12px;background:#14243c;border-radius:8px;border-left:4px solid #7fe3a0;">';
		html += '<div style="font-size:16px;font-weight:bold;color:#7fe3a0;margin-bottom:8px;">🎬 回放分析</div>';

		const replay = replayPanelData(me);
		html += '<div style="margin:4px 0;color:#dbe7f5;">决策记录：' + replay.total + ' 条</div>';
		if (replay.errors.length > 0) {
			html += '<div style="margin:4px 0;color:red;">错误：' + replay.errors.length + ' 个</div>';
			replay.errors.slice(0, 3).forEach(function (e) {
				html += '<div style="margin-left:12px;color:red;">· ' + e.reason + '</div>';
			});
		}

		html += '</div>';

		return html;
	} catch (e) {
		return '<div>生成面板出错：' + e.message + '</div>';
	}
}

/* ================= 2. 打开智能面板 ================= */
export function openSmartPanel() {
	try {
		const me = _status.currentPhase || game.me;
		if (!me) {
			alert('没有当前玩家');
			return;
		}

		/* 用无名杀自带的 chooseControl 显示 */
		const choices = ['查看手牌推断', '查看身份推理', '查看风险量化', '查看资源管理', '查看学习数据', '关闭'];
		const choiceList = [
			'查看所有对手的手牌推断',
			'查看所有玩家的身份推理结果',
			'查看杀命中率和桃必要性',
			'查看牌堆剩余和资源建议',
			'查看对局数和胜率',
			'关闭面板',
		];

		game.players[0].chooseControl(choices, choiceList, function (control) {
			if (control === '查看手牌推断') {
				showHandInference(me);
			} else if (control === '查看身份推理') {
				showIdentity(me);
			} else if (control === '查看风险量化') {
				showRisk(me);
			} else if (control === '查看资源管理') {
				showResource(me);
			} else if (control === '查看学习数据') {
				showLearning(me);
			}
		});
	} catch (e) {
		alert('打开面板出错：' + e.message);
	}
}

/* ================= 3. 显示手牌推断 ================= */
function showHandInference(me) {
	try {
		const players = game.players || [];
		let text = '=== 对手手牌推断 ===\n\n';

		players.forEach(function (p) {
			if (!p || p.alive === false) return;
			if (p === me) return;

			const hand = inferHand(p);
			const name = p.name1 || p.name || '?';

			text += name + '：\n';
			text += '  杀：' + Math.round(hand.sha * 100) + '%\n';
			text += '  闪：' + Math.round(hand.shan * 100) + '%\n';
			text += '  桃：' + Math.round(hand.tao * 100) + '%\n';
			text += '  无懈：' + Math.round(hand.wuxie * 100) + '%\n';
			text += '  酒：' + Math.round(hand.jiu * 100) + '%\n\n';
		});

		alert(text);
	} catch (e) {
		alert('出错：' + e.message);
	}
}

/* ================= 4. 显示身份推理 ================= */
function showIdentity(me) {
	try {
		const identities = getAllIdentities(me);
		let text = '=== 身份推理 ===\n\n';

		identities.forEach(function (id) {
			text += id.name + '：' + id.identityLabel + '（置信度 ' + Math.round(id.confidence * 100) + '%）\n';
		});

		alert(text);
	} catch (e) {
		alert('出错：' + e.message);
	}
}

/* ================= 5. 显示风险量化 ================= */
function showRisk(me) {
	try {
		const players = game.players || [];
		let text = '=== 风险量化 ===\n\n';

		players.forEach(function (p) {
			if (!p || p.alive === false) return;
			if (p === me) return;

			const hitRate = shaHitRate(me, p);
			const name = p.name1 || p.name || '?';

			text += '打 ' + name + ' 杀命中率：' + Math.round(hitRate * 100) + '%\n';
		});

		const taoNeed = taoNecessity(me);
		text += '\n桃必要性：' + taoNeed.reason + '\n';

		alert(text);
	} catch (e) {
		alert('出错：' + e.message);
	}
}

/* ================= 6. 显示资源管理 ================= */
function showResource(me) {
	try {
		const scarcity = resourceScarcity(me);
		let text = '=== 资源管理 ===\n\n';

		text += '牌堆剩余：\n';
		text += '  桃：' + scarcity.tao.remain + ' 张（' + scarcity.tao.scarcity + '稀缺）\n';
		text += '  无懈：' + scarcity.wuxie.remain + ' 张（' + scarcity.wuxie.scarcity + '稀缺）\n';
		text += '  酒：' + scarcity.jiu.remain + ' 张（' + scarcity.jiu.scarcity + '稀缺）\n\n';

		const taoTim = taoTiming(me);
		text += '桃建议：' + (taoTim.action === 'use' ? '用（使用）' : taoTim.action === 'keep' ? '留（保留）' : '看情况（待定）') + '（' + taoTim.reason + '）\n';

		alert(text);
	} catch (e) {
		alert('出错：' + e.message);
	}
}

/* ================= 7. 显示学习数据 ================= */
function showLearning(me) {
	try {
		const learning = learningPanelData();
		let text = '=== 学习数据 ===\n\n';

		text += '已对局：' + learning.games + ' 局\n';
		text += '胜率：' + Math.round(learning.winRate * 100) + '%\n';
		text += '模型就绪：' + (learning.weightReady ? '✅' : '❌') + '\n';

		alert(text);
	} catch (e) {
		alert('出错：' + e.message);
	}
}
