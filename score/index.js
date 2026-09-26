/*
 * ============================================
 * // 作者：飛昇原創
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 统一入口（整合进 无名AI） ================= */
import { lib, game, ui, get, ai, _status } from '../../../noname.js';
import { installHooks, uninstallHooks, startSettleWatch, stopSettleWatch, bestAction, rulesDecide, clearScoreState } from './engine.js';
import { openScorePanel, installDebugBridge, uninstallDebugBridge, startDialogGuard, stopDialogGuard } from './panel.js';
import { scanReset } from './skills.js';
import { installAIOverride, uninstallAIOverride } from './aiOverride.js';
import { warnConflicts, shouldDisableOverride, applyCompatPatches } from './compat.js';
import { log } from './logger.js';
import { installResponseAI, uninstallResponseAI } from './responseAI.js';
import { installCompareAI, uninstallCompareAI } from './compareAI.js';
import { installStrategist, uninstallStrategist } from './strategist.js';
import { installOptimizationHooks, uninstallOptimizationHooks } from './optimization.js';
import { installOverrideLayers, uninstallOverrideLayers, overrideStatus, retryOverrideLayers } from './override/index.js';

let _installed = false;

export function isScoreEngineEnabled() {
	try { return lib.config["extension_无名AI_decisionScore"] !== false; } catch (e) { return true; }
}

export function installScoreEngine() {
	if (_installed) return;

	/* installHooks 是关键路径：失败则不置 _installed，允许下次重试
	 * （原代码先置 true 再 try，任何异常都会被吞掉且永远无法恢复）
	 */
	try { installHooks(); } catch (e) { return; }
	_installed = true;

	try { startSettleWatch(); } catch (e) {}
	try { installDebugBridge(); } catch (e) {}
	try { startDialogGuard(); } catch (e) {}
	/* ★ 兼容性检测（不阻断，只打日志） */
	try { warnConflicts(); } catch (e) {}
	/* ★ 本体 Bug 兼容补丁 */
	try { applyCompatPatches(); } catch (e) {}
	/* ★ 联机自动禁用接管层 */
	try {
		if (!shouldDisableOverride()) {
			// 软接管：永远安装（保底层，不破坏本体）
			installAIOverride();
			// 硬接管：逐层安装（每层独立熔断，自动重试）
			installOverrideLayers();
		} else {
			log.info('compat', '联机模式：已跳过原生 AI 接管层');
		}
	} catch (e) {}
	try { import('./autoplay.js').then(function (m) { try { m.initAutoplayMonitor(); } catch (e) {} }).catch(function () {}); } catch (e) {}
	try {
		if (ui && ui.create && typeof ui.create.system === "function") {
			ui.create.system("决策积分", function () { try { openScorePanel(); } catch (e) {} }, true);
			ui.create.system("战报", function () {
				try {
					import('./report.js').then(function (m) { try { m.showReport(true); } catch (e) {} }).catch(function () {});
				} catch (e) {}
			}, true);
		}
	} catch (e) {}
	/* ★ 主面板通过 config.js 的 openPanel.onclick 打开，旧版 setInterval 轮询已移除 */
	try { log.info('init', '已整合进 无名AI（记分+评分框架+小模型+扩展识别）'); } catch (e) {}
	/* ★ 响应/弃牌 AI 增强 */
	try { installResponseAI(); } catch (e) {}
	/* ★ 拼点/选牌 AI */
	try { installCompareAI(); } catch (e) {}
	/* ★ 策略总线（最后安装，收集所有信号） */
	try { installStrategist(); } catch (e) {}
	/* ★ 卡牌优化器（hook result.target 暴露覆写信号） */
	try { installOptimizationHooks(); } catch (e) {}
	/* ★ 选将推荐 */
	try { import('./pickRecommend.js').then(function (m) { m.installPickRecommend && m.installPickRecommend(); }).catch(function () {}); } catch (e) {}
	/* ★ 模型状态机 + Bandit 自动调 trust */
	try {
		import('./weights.js').then(function (m) {
			window.__DJSC.weightsReady = m.isReady;
			window.__DJSC.predict = m.predict;
			window.__DJSC.reloadWeights = m.reloadWeights;
			window.__DJSC.getMeta = m.getMeta;
			window.__DJSC.resetWeights = m.resetWeights;
		}).catch(function () {});
	} catch (e) {}
	try { import('./modelState.js').catch(function () {}); } catch (e) {}
	try { import('./bandit.js').catch(function () {}); } catch (e) {}
	try { import('./decisionHook.js').catch(function () {}); } catch (e) {}
	/* ★ 决策点自动发现（影子模式） */
	try { import('./autoDiscover.js').then(function (m) { try { m.installAutoDiscover(); } catch (e) {} }).catch(function () {}); } catch (e) {}
	/* ★ 全局反射扫描器（运行时探针） */
	try { import('./globalScanner.js').then(function (m) { try { m.installProbes(); } catch (e) {} }).catch(function () {}); } catch (e) {}
	/* ★ 决策点观测面板 */
	try { import('./decisionDashboard.js').catch(function () {}); } catch (e) {}
	/* ★ 全量自检指令（window.__DJSC.verifyAll） */
	try { import('./verifyAll.js').catch(function () {}); } catch (e) {}

	/* ★ 补全接口挂载到 window.__DJSC */
	try {
		window.__DJSC = window.__DJSC || {};
		/* 反馈统计 */
		import('./feedback.js').then(function (m) {
			window.__DJSC.feedbackStats = m.getFeedbackStats;
		}).catch(function () {});
		/* 决策反馈 */
		import('./decisionFeedback.js').then(function (m) {
			window.__DJSC.decisionFeedbackStats = m.getDecisionFeedbackStats;
		}).catch(function () {});
		/* 自适应状态 */
		import('./adaptive.js').then(function (m) {
			window.__DJSC.adaptiveStatus = m.adaptiveStatus;
		}).catch(function () {});
		/* 记忆存储 */
		import('./memory.js').then(function (m) {
			window.__DJSC.memoryStats = m.storeStats;
		}).catch(function () {});
		/* 合法性校验 */
		import('./allyExempt.js').then(function (m) {
			window.__DJSC.checkAllyExempt = m.checkAllyExempt;
		}).catch(function () {});
		/* 校验记录器 */
		import('./guardRecorder.js').then(function (m) {
			window.__DJSC.guardRecorder = {
				record: m.recordGuardEvent,
				getStats: m.getGuardStats,
				reset: m.resetGuardRecorder,
			};
		}).catch(function () {});
		/* 自检面板 */
		import('./selfCheck.js').then(function (m) {
			window.__DJSC.openSelfCheck = m.openSelfCheck;
		}).catch(function () {});
		/* 模型护栏 */
		import('./modelGuard.js').then(function (m) {
			window.__DJSC.modelGuard = {
				check: m.guardCheck,
				penalty: m.applyGuardPenalty,
				isCoolingDown: m.isGuardCoolingDown,
				status: m.guardStatus,
				reset: m.resetGuard,
				openPanel: m.openGuardPanel,
				RED_LINES: m.RED_LINES,
			};
		}).catch(function () {});
	} catch (e) {}
	/* ★ 激活子目录模块化版（仅加载模块定义，不重复安装 hook）
	 * 递归 import core/index.js 会把 score/core/、score/modules/、score/analysis/ 等
	 * 所有子目录文件加载为活代码；installScoreEngine 不会被自动调用，
	 * 因此不会重复注册 hook / 重复触发 AI 接管。
	 */
	/* ★ core/index.js 已删除，直接标记模块化版就绪 */
	try {
		window.__DJSC = window.__DJSC || {};
		window.__DJSC.modular = {
			isEnabled: function() { return true; },
			install: function() {},
			uninstall: function() {},
		};
		window.__DJSC.modularReady = true;
		log.info('init', '模块化版已就绪（所有模块都在根目录）');
	} catch (e) {}
	/* ★ 批量暴露模块到 window.__DJSC（供自检面板访问）
	 * 每个模块动态 import 后，把全部导出挂到 __DJSC[模块名] 下。
	 * 这样自检面板就能调用 stats/getStats 等函数验证功能。 */
	try {
		const MODULES_TO_EXPOSE = [
			['elementFB', './elementFeedback.js'],
			['metaCognition', './metaCognition.js'],
			['cognitionLog', './cognitiveLog.js'],
			['conflict', './conflictDetector.js'],
			['calibrator', './decisionCalibrator.js'],
			['multiProfile', './multiProfile.js'],
			['strategyBus', './strategyBus.js'],
			['replay', './archive.js'],
			['weightPersist', './weightPersist.js'],
			['compare', './compareAI.js'],
			['hotSwap', './modelHotSwap.js'],
			['shared', './sharedKnowledge.js'],
			['evolution', './evolution.js'],
			['psychology', './gameTheory.js'],
			['comboChain', './comboChain.js'],
			['playerMemory', './playerMemory.js'],
			['postCheck', './postCheck.js'],
			['autoFeature', './autoFeature.js'],
			['softMetrics', './softMetrics.js'],
			['skillTags', './skillTags.js'],
			['judgeZone', './judgeZone.js'],
			['cardTags', './cardTags.js'],
			['viewAs', './viewAs.js'],
			['cost', './costCalc.js'],
			['aiTools', './aiTools.js'],
			['identity', './identity.js'],
			['learningOptimizer', './learningOptimizer.js'],
			['decision', './decisionRegistry.js'],
			['bandit', './bandit.js'],
			['discover', './autoDiscover.js'],
			['modelState', './modelState.js'],
			['strategist', './strategist.js'],
		];
		MODULES_TO_EXPOSE.forEach(function ([name, path]) {
			import(path).then(function (mod) {
				window.__DJSC = window.__DJSC || {};
				/* 把模块的全部导出合并到 __DJSC[name] 下 */
				if (!window.__DJSC[name] || typeof window.__DJSC[name] !== 'object') {
					window.__DJSC[name] = {};
				}
				for (const key of Object.keys(mod)) {
					try { window.__DJSC[name][key] = mod[key]; } catch (e) {}
				}
				/* ★ 给模块加别名，统一函数名 */
				try {
					if (name === 'multiProfile') {
						window.__DJSC.multiProfile.stats = mod.multiProfileStats;
						window.__DJSC.multiProfile.effectiveShift = mod.getEffectiveShift;
					} else if (name === 'strategyBus') {
						window.__DJSC.strategyBus.stats = mod.strategyBusStats;
					} else if (name === 'softMetrics') {
						window.__DJSC.softMetrics.get = mod.getMetric;
						window.__DJSC.softMetrics.learn = mod.learnMetric;
						window.__DJSC.softMetrics.stats = mod.softMetricStats;
						window.__DJSC.softMetrics.reset = mod.resetSoftMetrics;
					} else if (name === 'postCheck') {
						window.__DJSC.postCheck.before = mod.postCheckBefore;
						window.__DJSC.postCheck.after = mod.postCheckAfter;
						window.__DJSC.postCheck.stats = mod.postCheckStats;
					} else if (name === 'evolution') {
						window.__DJSC.evolution.stats = mod.evolveStats;
					}
				} catch (e) {}
			}).catch(function () {});
		});
	} catch (e) {}
}

export function uninstallScoreEngine() {
	if (!_installed) return;
	_installed = false;
	try { uninstallHooks(); } catch (e) {}
	try { stopSettleWatch(); } catch (e) {}
	try { stopDialogGuard(); } catch (e) {}
	try { uninstallDebugBridge(); } catch (e) {}
	try { uninstallAIOverride(); } catch (e) {}
	try { uninstallOverrideLayers(); } catch (e) {}
	try { uninstallResponseAI(); } catch (e) {}
	try { uninstallCompareAI(); } catch (e) {}
	try { uninstallStrategist(); } catch (e) {}
	try { uninstallOptimizationHooks(); } catch (e) {}
}

export { openScorePanel, bestAction, rulesDecide, scanReset };
