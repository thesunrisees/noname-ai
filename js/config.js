
/* ===== 水印追踪（隐藏build ID） ===== */
const _fs_build_id = '2w9yg1uo';  // 隐藏的构建ID，用于追踪泄露
// ====================================

// ===== 防伪标识（隐藏） =====
const _antiPiracy = {
    author: "飞升原创",
    version: "3.0.0",
    build: Date.now().toString(36),
    checksum: "fs_" + Math.random().toString(36).substring(2, 10)
};
// ========================
/*
 * ============================================
// Auteur: Feisheng Origineel | Licentie: GPL-3.0
 * // Éditeur: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

import { lib, game, ui, get, ai, _status } from './utils.js';
import { arrangeConfig } from './configLayout.js';
import { changelog } from './changelog.js';
 import { zhong } from './zhong.js';
 import { fan } from './fan.js';
 import { nei } from './nei.js';
export let config = {
	/* ===== 主标题 ===== */
	djscBd: { clear: true, name: '<hr aria-hidden="true"><div style="color: #00FFB0; text-align:center; font-size: 16px; padding: 10px;">📊 决策积分引擎 v4.55.4</div>' },

	/* ===== 🎛️ 功能面板按钮（大按钮） ===== */
	panelBd: { clear: true, name: '<hr aria-hidden="true"><div class="djsc-config-section-title">功能面板（点击打开）</div>' },

	openPanel: {
		name: '<button class="djsc-menu-config-btn">📊 打开 · 决策积分主面板</button>',
		onclick: function () {
			try {
				import('../score/panel.js').then(function (m) {
					m.openScorePanel();
				}).catch(function (e) { alert('主面板加载失败：' + e.message); });
			} catch (e) {
				alert('打开失败：' + e.message);
			}
			return false;
		}
	},

	openScorePanel: {
		name: '<button class="djsc-menu-config-btn">📈 打开 · 本局积分面板</button>',
		onclick: function () {
			try {
				import('../score/panel.js').then(function (m) {
					if (m.openScorePanel) m.openScorePanel();
					else alert('openScorePanel 未就绪');
				}).catch(function (e) { alert('打开失败：' + e.message); });
			} catch (e) {
				alert('打开失败：' + e.message);
			}
			return false;
		}
	},

	openPlanPanel: {
		name: '<button class="djsc-menu-config-btn">🎯 打开 · 战术规划面板</button>',
		onclick: function () {
			try {
				import('../score/panel.js').then(function (m) {
					if (m.openPlanPanel) m.openPlanPanel();
					else alert('openPlanPanel 未就绪');
				}).catch(function (e) { alert('打开失败：' + e.message); });
			} catch (e) {
				alert('打开失败：' + e.message);
			}
			return false;
		}
	},

	openFeedbackPanel: {
		name: '<button class="djsc-menu-config-btn">📝 打开 · 决策回放面板</button>',
		onclick: function () {
			try {
				import('../score/panel.js').then(function (m) {
					if (m.openFeedbackPanel) m.openFeedbackPanel();
					else alert('openFeedbackPanel 未就绪');
				}).catch(function (e) { alert('打开失败：' + e.message); });
			} catch (e) {
				alert('打开失败：' + e.message);
			}
			return false;
		}
	},

	openArchivePanel: {
		name: '<button class="djsc-menu-config-btn">📁 打开 · 战报归档面板</button>',
		onclick: function () {
			try {
				import('../score/panel.js').then(function (m) {
					if (m.openArchivePanel) m.openArchivePanel();
					else alert('openArchivePanel 未就绪');
				}).catch(function (e) { alert('打开失败：' + e.message); });
			} catch (e) {
				alert('打开失败：' + e.message);
			}
			return false;
		}
	},

	openRecommendPanel: {
		name: '<button class="djsc-menu-config-btn">🎮 打开 · 选将推荐面板</button>',
		onclick: function () {
			try {
				import('../score/panel.js').then(function (m) {
					if (m.openRecommendPanel) m.openRecommendPanel();
					else alert('openRecommendPanel 未就绪');
				}).catch(function (e) { alert('打开失败：' + e.message); });
			} catch (e) {
				alert('打开失败：' + e.message);
			}
			return false;
		}
	},

	openSmartPanel: {
		name: '<button class="djsc-menu-config-btn">🧠 打开 · 智能可视化面板</button>',
		onclick: function () {
			try {
				import('../score/smartPanel.js').then(function (m) {
					if (m.openSmartPanel) m.openSmartPanel();
					else alert('openSmartPanel 未就绪');
				}).catch(function (e) { alert('打开失败：' + e.message); });
			} catch (e) {
				alert('打开失败：' + e.message);
			}
			return false;
		}
	},

	openSkillPanel: {
		name: '<button class="djsc-menu-config-btn">📚 打开 · 技能矩阵面板</button>',
		intro: '查看技能评分和学习修正数据',
		onclick: function () {
			if (_status.djscSkillPanel) return false;
			_status.djscSkillPanel = true;
			try {
				if (window.__DJSC && window.__DJSC.openSkillPanel) {
					window.__DJSC.openSkillPanel();
				} else {
					alert('技能矩阵面板开发中...');
				}
			} catch (e) {
				alert('打开失败：' + e.message);
			}
			return false;
		}
	},

	openSkillBreakdownPanel: {
		name: '<button class="djsc-menu-config-btn">🧩 打开 · 技能拆解面板</button>',
		intro: '代码级识别技能几何效果：分支/多段/联动',
		onclick: function () {
			try {
				import('../score/panel.js').then(function (m) {
					if (m.openSkillBreakdownPanel) m.openSkillBreakdownPanel();
					else alert('技能拆解面板未就绪');
				}).catch(function (e) { alert('打开失败：' + e.message); });
			} catch (e) {
				alert('打开失败：' + e.message);
			}
			return false;
		}
	},

	openOverridePanel: {
		name: '<button class="djsc-menu-config-btn">🔧 打开 · 接管层状态面板</button>',
		intro: '查看硬接管/软接管双轨架构运行状态',
		onclick: function () {
			try {
				import('../score/panel.js').then(function (m) {
					if (m.openOverridePanel) m.openOverridePanel();
					else alert('openOverridePanel 未就绪');
				}).catch(function (e) { alert('打开失败：' + e.message); });
			} catch (e) {
				alert('打开失败：' + e.message);
			}
			return false;
		}
	},

	openMemoryPanel: {
		name: '<button class="djsc-menu-config-btn">🧠 打开 · 跨局记忆面板</button>',
		onclick: function () {
			if (_status.djscMemoryPanel) return false;
			_status.djscMemoryPanel = true;
			try {
				if (window.__DJSC && window.__DJSC.openMemoryPanel) {
					window.__DJSC.openMemoryPanel();
				} else {
					alert('跨局记忆面板开发中...');
				}
			} catch (e) {
				alert('打开失败：' + e.message);
			}
			return false;
		}
	},

	openHealthPanel: {
		name: '<button class="djsc-menu-config-btn">🩺 打开 · 引擎健康度面板</button>',
		onclick: function () {
			try {
				import('../score/panel.js').then(function (m) {
					if (m.openHealthPanel) m.openHealthPanel();
					else alert('openHealthPanel 未就绪');
				}).catch(function (e) { alert('打开失败：' + e.message); });
			} catch (e) {
				alert('打开失败：' + e.message);
			}
			return false;
		}
	},

	openConfigPanel: {
		name: '<button class="djsc-menu-config-btn">⚙️ 打开 · 当前配置面板</button>',
		onclick: function () {
			if (_status.djscConfigPanel) return false;
			_status.djscConfigPanel = true;
			try {
				if (window.__DJSC && window.__DJSC.openConfigPanel) {
					window.__DJSC.openConfigPanel();
				} else {
					alert('配置面板开发中...');
				}
			} catch (e) {
				alert('打开失败：' + e.message);
			}
			return false;
		}
	},

	/* ===== 💬 问题反馈 ===== */
	feedbackBd: { clear: true, name: '<hr aria-hidden="true"><div style="color: #ff9c9c; text-align:center; padding: 8px;">▸ 问题反馈</div>' },

	openFeedbackGroup: {
		name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #ff6b9d, #c44569);">💬 问题反馈联系群</button>',
		intro: '扫描二维码加入QQ群，反馈问题或交流建议',
		onclick: function () {
			try {
				if (window.__DJSC && window.__DJSC.showFeedbackGroup) {
					window.__DJSC.showFeedbackGroup();
				} else {
					alert('问题反馈联系群功能开发中...');
				}
			} catch (e) {
				alert('打开失败：' + e.message);
			}
			return false;
		}
	},

	/* ===== 📦 数据管理 ===== */
	dataBd: { clear: true, name: '<hr aria-hidden="true"><div style="color: #ffd479; text-align:center; padding: 8px;">▸ 数据管理（导出/导入面板数据）</div>' },

	exportAllData: {
		name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #1e90ff, #00bfff);">📥 导出所有面板数据</button>',
		intro: '导出 JSON 数据到剪贴板',
		onclick: function () {
			try {
				if (window.__DJSC && window.__DJSC.exportAllAndDownload) {
					const result = window.__DJSC.exportAllAndDownload();
					if (result && result.ok) {
						alert(
							'✅ 导出成功！\n\n' +
							'💾 数据大小：' + result.size + '\n' +
							'\n' +
							'📋 数据已复制到剪贴板\n' +
							'   你可以粘贴到任何地方查看\n' +
							'\n' +
							'⚠️ 空技能数：' + (result.emptySkillsCount || 0) + ' 个（已打包详细代码）'
						);
					} else {
						alert('导出失败：' + (result && result.err ? result.err : '未知错误'));
					}
				} else {
					alert('导出功能未就绪（请进入对局后再试）');
				}
			} catch (e) {
				alert('导出失败：' + e.message);
			}
			return false;
		}
	},

	importOverwrite: {
		name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #ff6b6b, #ee5a5a);">📤 导入数据（覆盖现有）</button>',
		intro: '清空现有数据，全部替换为导入的 JSON 数据',
		onclick: function () {
			try {
				if (window.__DJSC && window.__DJSC.importAllFromFile) {
					window.__DJSC.importAllFromFile('overwrite');
				} else {
					alert('导入功能未就绪');
				}
			} catch (e) {
				alert('导入失败：' + e.message);
			}
			return false;
		}
	},

	importMerge: {
		name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #ffa500, #ff8c00);">📤 导入数据（不覆盖，只追加）</button>',
		intro: '只导入新数据，不覆盖现有的数据',
		onclick: function () {
			try {
				if (window.__DJSC && window.__DJSC.importAllFromFile) {
					window.__DJSC.importAllFromFile('merge');
				} else {
					alert('导入功能未就绪');
				}
			} catch (e) {
				alert('导入失败：' + e.message);
			}
			return false;
		}
	},

	/* ===== ⚙️ 引擎开关与参数 ===== */
	engineBd: { clear: true, name: '<hr aria-hidden="true"><div style="color: #7fe3a0; text-align:center; padding: 8px;">▸ 引擎开关与参数</div>' },

	/* ===== 总开关 ===== */
	decisionScore: { name: '✅ 决策积分引擎总开关', init: true },

	/* ===== 决策模式 ===== */
		/* 🎯 决策模式 */
		/* ⚔️ 进攻倾向 */
		/* 🛡️ 防守倾向 */

	/* ===== 决策权重 ===== */
	weightBd: { clear: true, name: '<div style="color: #9ad8ff; text-align:center; padding: 4px;">▸ 决策权重</div>' },
		/* 📊 进攻牌基础系数 */
		/* 📊 防御牌基础系数 */
		/* 📊 机会成本系数 */
		/* 📊 集火目标加成 */
		/* 📊 座位压力系数 */
		/* 📊 预测修正系数 */
		/* 📊 连招加成系数 */
		/* 📊 高方差卡牌系数 */

	/* ===== AI 增强 ===== */
	aiBd: { clear: true, name: '<div style="color: #9ad8ff; text-align:center; padding: 4px;">▸ AI 增强</div>' },
	decisionFeedback: { 
		name: '📝 决策维度反馈（目标/阶段/留牌三维度学习）', 
		intro: 'AI 会从三个维度评估决策质量：打谁最优、当前阶段该激进还是保守、手牌该留什么弃什么',
		init: true 
	},
	responseAI: { 
		name: '🛡️ 响应/弃牌 AI 增强（AI 学会留闪/桃/无懈）', 
		intro: 'AI 不再无脑出牌，会根据局势留闪防杀、留桃保命、留无懈防关键锦囊',
		init: true 
	},
	broadcastAI: { 
		name: '📡 AI 广播协作（同阵营 AI 共享攻击意图形成集火）', 
		intro: '忠臣/反贼AI会互相通气：我要打谁了，你也一起打，形成集火秒杀',
		init: true 
	},
	compareAI: { 
		name: '🎲 拼点/选牌 AI 微调（保留高点数牌用于拼点）', 
		intro: 'AI 会记住高点数的牌，留着拼点用，而不是随便打出去',
		init: true 
	},
	adaptiveDifficulty: { 
		name: '📈 自适应难度（AI 根据你的近期战绩自动调整强度）', 
		intro: '你连胜AI就变强，你连败AI就放水，永远让你觉得势均力敌',
		init: false 
	},
	enablePlanner: { 
		name: '🎯 战术规划器（多步连招 + 残局解）', 
		intro: 'AI 会提前想两步：先出什么、再出什么，怎么连招一套带走；残局会算最优解',
		init: true 
	},
		/* 🎯 规划深度（1=单步 2=两步展望） */
	psychologyLayer: {
		name: '🧠 博弈策略层（威慑姿态 / 意图识别 / 压迫力 / 策略保留）',
		intro: 'AI 会摆出进攻架势、判断对手是真强还是试探、评估心理压迫价值、保留无用牌作消耗',
		init: true,
	},
	comboChain: {
		name: '🔗 连招链（铁索火攻 / 拆防连杀 / 酒杀斩杀 / AOE顺拆 / 连弩爆发）',
		intro: 'AI 会识别手牌里的连招组合，并按起手优先级执行',
		init: true,
	},
	narrator: {
		name: '💬 决策解释器（自然语言解释每次决策）',
		intro: '把引擎信号翻译成人话：因为…所以…；如果…就会…',
		init: true,
	},
	profiler: {
		name: '⏱️ 性能分析器（记录各阶段耗时）',
		intro: '轻微开销，用于诊断卡顿。默认开，不想要可关',
		init: true,
	},

	/* ===== 接管原生 AI ===== */
	overrideBd: { clear: true, name: '<div style="color: #ff9c9c; text-align:center; padding: 4px;">▸ 接管原生 AI</div>' },
	hardOverride: {
		name: '⚠️ 硬接管层（4 层独立熔断，异常自动降级到软接管）',
		intro: '开启后：<br>① 引擎说"结束回合"→ 立即结束<br>② 引擎选的牌不可用 → 回退原生 AI<br>③ 出牌顺序/目标选择仍由软接管驱动<br>④ 任意层异常 3 次 → 该层自动熔断 30 秒',
		init: true,
	},
	override_use: { name: '⚠️ 硬接管 · 出牌决策（仅做"结束回合"短路）', init: true },
	override_respond: { name: '⚠️ 硬接管 · 响应决策（保留闪/桃/无懈）', init: true },
	override_discard: { name: '⚠️ 硬接管 · 弃牌决策（弃低价值牌）', init: true },
	override_compare: { name: '⚠️ 硬接管 · 拼点决策（按赢率选牌）', init: true },

	/* ===== 分值倍率 ===== */
	rateBd: { clear: true, name: '<div style="color: #9ad8ff; text-align:center; padding: 4px;">▸ 分值倍率</div>' },
		/* 💥 伤害分值倍率（默认2分/点） */
		/* 🎴 摸牌分值倍率（默认1分/张） */
		/* 🗑️ 弃牌惩罚倍率（默认-1.5/张） */

	/* ===== AI 性格 ===== */
	personalityBd: { clear: true, name: '<div style="color: #9ad8ff; text-align:center; padding: 4px;">▸ AI 性格</div>' },
		/* ⚔️ 性格 · 攻守轴（0=保守 50=均衡 100=激进） */
		/* 🎲 性格 · 冒险轴（0=稳健 50=均衡 100=赌徒） */
		/* 🤝 性格 · 团队轴（0=独狼 50=均衡 100=团队） */
		/* 🎭 性格预设（一键覆盖上方三维） */

	/* ===== 记忆/学习 ===== */
	memoryBd: { clear: true, name: '<div style="color: #9ad8ff; text-align:center; padding: 4px;">▸ 记忆/学习</div>' },
	crossGameMemory: {
		name: '🧠 跨局记忆（记住武将打法风格，跨局累积，所有模式生效）',
		init: true,
	},
	skillFeedback: {
		name: '📚 技能矩阵反馈闭环（AI 会随对局自动学习修正技能评分）',
		init: true,
	},
	styleFeedback: {
		name: '🎨 对手风格反馈（用胜负修正风格标签可信度）',
		init: true,
	},
	playerMemory: {
		name: '👤 对手长期记忆（记住每个玩家的身份偏好 / 行为画像 / 仇恨度）',
		intro: 'AI 跨局记住与你交手过的玩家，越玩越懂对方',
		init: true,
	},

	/* ===== 战报/日志 ===== */
	reportBd: { clear: true, name: '<div style="color: #9ad8ff; text-align:center; padding: 4px;">▸ 战报/日志</div>' },
	showReport: {
		name: '📊 结算战报（终局后弹出对局图文报告）',
		init: true,
	},
	archiveGames: {
		name: '📁 战报归档（每局保存，最多 30 局）',
		init: true,
	},
	showLog: { name: '📋 对局日志显示积分明细', init: false },
	persist: { name: '💾 结算保存历史（localStorage）', init: false },

	/* ===== 牌堆感知 ===== */
	deckBd: { clear: true, name: '<div style="color: #9ad8ff; text-align:center; padding: 4px;">▸ 牌堆感知</div>' },
	deckAwareness: {
		name: '🎴 牌堆感知（追踪剩余牌，修正判定/摸牌概率）',
		init: true,
	},
		/* 📊 牌堆预测权重（影响 AOE/判定类卡牌评分） */
	deckConsumeAllPlayers: {
		name: '👥 感知所有玩家的牌（不只是 AI 自己）',
		init: true,
	},

	/* ===== 训练/蒸馏 ===== */
	trainBd: { clear: true, name: '<hr aria-hidden="true"><div style="color: #ffd479; text-align:center; font-size: 16px; padding: 10px;">🎓 训练/蒸馏（AI 学习闭环）</div>' },

	exportTrainingData: {
		name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #ffd479, #ffa500); width: 100%; padding: 15px; font-size: 16px; margin: 8px 0;">📥 导出AI学习数据</button>',
		intro: '导出你的AI训练样本，保存到 data/training/ 文件夹，可分享给别人',
		onclick: function () {
			try {
				if (window.__DJSC && window.__DJSC.__trainExportModule) {
					/* ★ 调用真正的导出函数，只生成一个数据文件 */
					const result = window.__DJSC.__trainExportModule.downloadJson();
					if (result.ok) {
						alert('✅ 导出成功！\n\n📊 样本数：' + result.count + ' 条\n📁 文件：' + result.file);
					} else {
						alert('导出失败：' + result.err);
					}
				} else {
					alert('训练数据模块未就绪');
				}
			} catch (e) {
				alert('导出失败：' + e.message);
			}
			return false;
		}
	},

	importTrainingData: {
		name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #ffb379, #ff8c42); width: 100%; padding: 15px; font-size: 16px; margin: 8px 0;">📤 导入别人的AI数据</button>',
		intro: '选择别人发给你的JSON文件（可多选），自动合并到你的样本里',
		onclick: function () {
			try {
				const input = document.createElement('input');
				input.type = 'file';
				input.accept = '.json';
				input.multiple = true;  /* 支持多选文件 */
				input.onchange = function (e) {
					const files = Array.from(e.target.files);
					if (!files.length) return;
					
					let totalAdded = 0, totalMerged = 0, totalSkipped = 0;
					let processed = 0;
					
					files.forEach(function(file) {
						const reader = new FileReader();
						reader.onload = function(ev) {
							try {
								const jsonStr = ev.target.result;
								if (window.__DJSC && window.__DJSC.trainImport) {
									const result = window.__DJSC.trainImport(jsonStr);
									if (result.ok) {
										totalAdded += result.added;
										totalMerged += result.merged;
										totalSkipped += result.skipped;
									}
								}
							} catch (err) {}
							processed++;
							if (processed === files.length) {
								alert('✅ 导入完成！\n\n文件数：' + files.length + ' 个\n新增样本：' + totalAdded + ' 条\n合并样本：' + totalMerged + ' 条\n跳过样本：' + totalSkipped + ' 条\n\n当前总样本：' + (window.__DJSC.trainBufferSize ? window.__DJSC.trainBufferSize() : '?') + ' 条');
							}
						};
						reader.readAsText(file);
					});
				};
				input.click();
			} catch (e) {
				alert('导入失败：' + e.message);
			}
			return false;
		}
	},

	clearTrainingBuffer: {
		name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #ff6b6b, #ee5a5a); width: 100%; padding: 15px; font-size: 16px; margin: 8px 0;">🗑️ 清空训练缓冲区</button>',
		intro: '清空所有已缓冲的训练样本',
		onclick: function () {
			try {
				if (window.__DJSC && window.__DJSC.trainClearBuffer) {
					window.__DJSC.trainClearBuffer();
					alert('✅ 已清空训练缓冲区');
				} else {
					alert('训练数据模块未就绪');
				}
			} catch (e) {
				alert('清空失败：' + e.message);
			}
			return false;
		}
	},

	showTrainStats: {
		name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #9ad8ff, #1e90ff); width: 100%; padding: 15px; font-size: 16px; margin: 8px 0;">📊 查看训练统计</button>',
		intro: '查看当前缓冲的训练样本数',
		onclick: function () {
			try {
				if (window.__DJSC && window.__DJSC.trainStats) {
					const s = window.__DJSC.trainStats();
					alert('📊 训练样本数：' + s.count + ' 条' + '\n上限：' + s.max + ' 条' + '\n累计导出：' + s.exports + ' 次');
				} else {
					alert('训练数据模块未就绪');
				}
			} catch (e) {
				alert('查询失败：' + e.message);
			}
			return false;
		}
	},

		/* ===== 模型训练与更新 ===== */
		modelBd: { clear: true, name: '<div style="color: #7fe3a0; text-align:center; padding: 4px;">▸ 模型训练与更新</div>' },

		useTrainedModel: {
			name: '🤖 启用训练模型（默认开启，新手开箱即用，日志显示 M 标签）',
			init: true,
		},

		/* 🔧 模型高级配置 */
		useResidual: {
			name: '🔗 启用残差连接（默认关闭，开启后训练更稳定）',
			init: false,
		},

		learningRate: {
			name: '📈 学习率（越大训练越快）',
			init: '0.005',
			intro: '0.001~0.01，默认0.005平衡',
			item: {
				'0.001': '0.001（极慢超稳）',
				'0.002': '0.002（很慢很稳）',
				'0.003': '0.003（慢但稳）',
				'0.004': '0.004（偏慢稳定）',
				'0.005': '0.005（平衡推荐）',
				'0.006': '0.006（偏快）',
				'0.007': '0.007（较快）',
				'0.008': '0.008（很快）',
				'0.009': '0.009（非常快）',
				'0.010': '0.010（极快最快）',
			},
		},

		/* 🔄 模型更新模式 */

		/* 🧪 A/B 测试局数 */

		/* 📈 候选胜出阈值（高于旧模型 X%） */

		forceTrain: {
			name: '<button class="djsc-menu-config-btn">手动触发训练</button>',
			intro: '立即用当前样本训练模型',
			onclick: function () {
				try {
					if (window.__DJSC && window.__DJSC.forceTrain) {
						window.__DJSC.forceTrain();
					} else {
						alert('模型模块未就绪');
					}
				} catch (e) {
					alert('触发失败：' + e.message);
				}
				return false;
			}
		},

		showSampleCount: {
			name: '<button class="djsc-menu-config-btn">查看样本数</button>',
			intro: '查看当前训练样本数量',
			onclick: function () {
				try {
					import('../score/trainExport.js').then(function (m) {
						const count = m.bufferSize();
						let ready = false;
						try { ready = window.__DJSC.weightsReady(); } catch (e) {}
						let state = 'unknown';
						try { state = window.__DJSC.modelState.getState(); } catch (e) {}
						alert('当前样本数：' + count + '\n模型状态：' + state + '\n模型就绪：' + (ready ? '是' : '否'));
					});
				} catch (e) {
					alert('查看失败：' + e.message);
				}
				return false;
			}
		},

		clearSamples: {
			name: '<button class="djsc-menu-config-btn" style="background: #ff6b6b;">清空训练样本</button>',
			intro: '清空所有训练样本（谨慎操作）',
			onclick: function () {
				try {
					if (confirm('确定要清空所有训练样本吗？\n此操作不可恢复！')) {
						import('../score/trainExport.js').then(function (m) {
							m.bufferClear();
							alert('样本已清空');
						});
					}
				} catch (e) {
					alert('清空失败：' + e.message);
				}
				return false;
			}
		},

		showModelStatus: {
			name: '<button class="djsc-menu-config-btn">查看模型状态</button>',
			intro: '查看当前模型的训练状态和准确率',
			onclick: function () {
				try {
					let state = 'unknown';
					let gamesSince = 0;
					let accuracy = 0;
					let ready = false;
					try { state = window.__DJSC.modelState.getState(); } catch (e) {}
					try { gamesSince = window.__DJSC.modelState.getGamesSince(); } catch (e) {}
					try { ready = window.__DJSC.weightsReady(); } catch (e) {}
					try {
						import('../score/weights.js').then(function (m) {
							accuracy = m.getAccuracy();
							alert('模型状态：' + state +
								'\n当前阶段局数：' + gamesSince +
								'\n模型就绪：' + (ready ? '是' : '否') +
								'\n模型准确率：' + (accuracy * 100).toFixed(1) + '%');
						});
					} catch (e) {}
				} catch (e) {
					alert('查看失败：' + e.message);
				}
				return false;
			}
		},

		autoFixModel: {
			name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #ff9c9c, #ff5a5a);">🔧 模型自启动修复</button>',
			intro: '自动检查模型是否正常工作，如果不工作就自动修复',
			onclick: function () {
				try {
					let report = '═══ 模型自启动修复报告 ═══\n\n';
					let allOk = true;

					/* 1. 检查weights模块 */
					try {
						if (typeof window.__DJSC.weightsReady === 'function') {
							report += '✅ weights模块: 已加载\n';
						} else {
							report += '❌ weights模块: 未加载\n';
							allOk = false;
						}
					} catch (e) {
						report += '❌ weights模块: 异常 - ' + e.message + '\n';
						allOk = false;
					}

					/* 2. 检查predict函数 */
					try {
						if (typeof window.__DJSC.confidence === 'function') {
							report += '✅ predict函数: 已挂载\n';
						} else {
							report += '❌ predict函数: 未挂载\n';
							allOk = false;
						}
					} catch (e) {
						report += '❌ predict函数: 异常\n';
						allOk = false;
					}

					/* 3. 检查W1输入层 */
					try {
						var w = window.__DJSC.weights;
						if (w && w.W1 && w.W1.length === 16640) {
							report += '✅ W1输入层: 正常 (' + w.W1.length + '维)\n';
						} else if (w && w.W1) {
							report += '⚠️ W1输入层: 长度不对 (' + w.W1.length + '，应为16640)\n';
						} else {
							report += '❌ W1输入层: 未初始化\n';
							allOk = false;
						}
					} catch (e) {
						report += '❌ W1输入层: 异常\n';
						allOk = false;
					}

					/* 4. 检查W4价值头 */
					try {
						if (w && w.W4_critic && w.W4_critic.length === 64) {
							report += '✅ W4价值头: 正常 (' + w.W4_critic.length + '维)\n';
						} else if (w && w.W4_critic) {
							report += '⚠️ W4价值头: 长度不对 (' + w.W4_critic.length + '，应为64)\n';
						} else {
							report += '❌ W4价值头: 未初始化\n';
							allOk = false;
						}
					} catch (e) {
						report += '❌ W4价值头: 异常\n';
						allOk = false;
					}

					/* 5. 测试推理 */
					try {
						var r = window.__DJSC.confidence(Array(130).fill(0));
						if (r && r.action && r.value !== undefined) {
							report += '✅ 测试推理: 正常\n';
							report += '   value=' + r.value.toFixed(3) + ', confidence=' + r.confidence.toFixed(3) + '\n';
						} else {
							report += '⚠️ 测试推理: 返回值异常\n';
						}
					} catch (e) {
						report += '❌ 测试推理: 失败 - ' + e.message + '\n';
						allOk = false;
					}

					/* 6. 样本数 */
					try {
						import('../score/trainExport.js').then(function (m) {
							var stats = m.trainStats();
							report += '\n📊 当前样本数: ' + (stats.count || 0) + '\n';
							if (allOk) {
								report += '\n✅ 所有检查通过！模型正常工作。';
							} else {
								report += '\n⚠️ 有问题需要修复，请重载扩展。';
							}
							alert(report);
						});
					} catch (e) {
						report += '\n❌ 样本统计: 异常\n';
						alert(report);
					}

				} catch (e) {
					alert('自启动修复失败：' + e.message);
				}
				return false;
			}
		},

		openDecisionDashboard: {
			name: '<button class="djsc-menu-config-btn">打开决策点观测面板</button>',
			intro: '查看所有决策点的 trust / 调用 / 后悔值 / 返回值类型',
			onclick: function () {
				try {
					if (window.__DJSC && window.__DJSC.openDecisionDashboard) {
						window.__DJSC.openDecisionDashboard();
					} else {
						alert('面板未就绪');
					}
				} catch (e) { alert('打开失败：' + e.message); }
				return false;
			}
		},

		openCalibratorPanel: {
			name: '<button class="djsc-menu-config-btn">📈 打开 · 决策校准趋势</button>',
			intro: '查看规则引擎与模型的博弈趋势',
			onclick: function () {
				try {
					if (window.__DJSC && window.__DJSC.openCalibratorPanel) {
						window.__DJSC.openCalibratorPanel();
					} else {
						alert('校准趋势面板未就绪');
					}
				} catch (e) { alert('打开失败：' + e.message); }
				return false;
			}
		},

		openBrainDashboard: {
			name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #7fe3a0, #2a6);">🧠 打开 · AI 大脑总览</button>',
			intro: '校准/认知/冲突/多档案/策略总线/护栏 一屏看完',
			onclick: function () {
				try {
					if (window.__DJSC && window.__DJSC.openBrainDashboard) {
						window.__DJSC.openBrainDashboard();
					} else {
						alert('大脑总览面板未就绪');
					}
				} catch (e) { alert('打开失败：' + e.message); }
				return false;
			}
		},

		openReplayPanel: {
			name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #9ad8ff, #4a6a9a);">🎬 打开 · 决策回放时间轴</button>',
			intro: '查看每次决策的完整链路：状态→候选→模型→总线→执行→结果',
			onclick: function () {
				try {
					if (window.__DJSC && window.__DJSC.openReplayPanel) {
						window.__DJSC.openReplayPanel();
					} else {
						alert('决策回放面板未就绪');
					}
				} catch (e) { alert('打开失败：' + e.message); }
				return false;
			}
		},

		openComparePanel: {
			name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #ffd479, #c58b22);">⚖️ 打开 · 决策对比模式</button>',
			intro: '同一局面下，不同档案会怎么选？',
			onclick: function () {
				try {
					if (window.__DJSC && window.__DJSC.openComparePanel) {
						window.__DJSC.openComparePanel();
					} else {
						alert('决策对比面板未就绪');
					}
				} catch (e) { alert('打开失败：' + e.message); }
				return false;
			}
		},

		openNarratorPanel: {
			name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #9ad8ff, #4a6a9a);">💬 打开 · 决策解释器</button>',
			intro: '用自然语言解释最近 5 次决策的主因、反事实和置信度',
			onclick: function () {
				try {
					if (window.__DJSC && window.__DJSC.openNarratorPanel) {
						window.__DJSC.openNarratorPanel(5);
					} else {
						alert('决策解释器未就绪');
					}
				} catch (e) { alert('打开失败：' + e.message); }
				return false;
			}
		},

		openProfilerPanel: {
			name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #a8b8c8, #4a6a9a);">⏱️ 打开 · 性能分析器</button>',
			intro: '查看各阶段耗时、调用树、内存占用与优化建议',
			onclick: function () {
				try {
					if (window.__DJSC && window.__DJSC.openProfilerPanel) {
						window.__DJSC.openProfilerPanel();
					} else {
						alert('性能分析器未就绪');
					}
				} catch (e) { alert('打开失败：' + e.message); }
				return false;
			}
		},

		openExportPanel: {
			name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #7fe3a0, #2a6);">📦 打开 · 数据导出中心</button>',
			intro: '一键导出蒸馏包 / 完整训练包 / 全量备份包，支持导入还原',
			onclick: function () {
				try {
					if (window.__DJSC && window.__DJSC.openExportPanel) {
						window.__DJSC.openExportPanel();
					} else {
						alert('数据导出中心未就绪');
					}
				} catch (e) { alert('打开失败：' + e.message); }
				return false;
			}
		},

		quickExportAll: {
			name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #c9aaff, #6a4a9a);">⚡ 一键全量导出</button>',
			intro: '点一下自动导出全部 3 个包，无需打开面板',
			onclick: function () {
				try {
					const D = window.__DJSC;
					if (!D || !D.export) { alert('导出模块未就绪'); return false; }
					D.export.distill();
					setTimeout(function(){ D.export.fullTrain(); }, 300);
					setTimeout(function(){ D.export.backup(); }, 600);
					alert('✅ 已开始一键全量导出\n文件保存到：无名AI/data/output/');
				} catch (e) { alert('导出失败：' + e.message); }
				return false;
			}
		},

		openPostCheckPanel: {
			name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #7fd4ff, #2a7a9a); padding: 10px 20px; font-size: 14px;">📊 决策后检测 · 数据中心</button>',
			intro: '查看决策后实际收益统计 / 样本质量分析 / 一键清空样本',
			onclick: function () {
				try {
					const D = window.__DJSC;
					if (!D || !D.postCheck) { alert('决策后检测未就绪'); return false; }

					const pc = D.postCheck.stats();
					const te = D.__trainExportModule;
					const sampleCount = te ? te.bufferSize() : 0;

					let msg = '【决策后检测 · 数据中心】\n\n';
					msg += '📊 检测池状态：\n';
					msg += '  · 当前快照数：' + pc.poolSize + '\n';
					msg += '  · 当前回合：' + pc.round + '\n\n';
					msg += '📦 训练样本：\n';
					msg += '  · 总样本数：' + sampleCount + '\n\n';
					msg += '🎯 功能说明：\n';
					msg += '  · 每次决策后 1.5 秒自动检测实际收益\n';
					msg += '  · 检测维度：目标掉血/掉牌/掉装备 + 自身掉血/掉牌 + 局势变化\n';
					msg += '  · 实际收益自动写入训练样本的 reward 字段\n\n';
					msg += '⚠️ 注意：日志面板里不会显示这些记录\n';

					alert(msg);
				} catch (e) { alert('打开失败：' + e.message); }
				return false;
			}
		},

		openHotSwapPanel: {
			name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #ff9c9c, #c33);">🔥 打开 · 模型热更新</button>',
			intro: '查看候选模型 / A/B 进度 / 晋升历史',
			onclick: function () {
				try {
					const s = window.__DJSC.hotSwap && window.__DJSC.hotSwap.stats();
					if (!s) { alert('未就绪'); return false; }
					alert(
						'【模型热更新】\n\n' +
						'样本：' + s.samples + '\n' +
						'候选：' + (s.hasCandidate ? '有（年龄 ' + s.candidateAge + 's）' : '无') + '\n' +
						'A/B 进度：' + s.abProgress + '\n' +
						'晋升：' + s.promoted + ' 次\n' +
						'丢弃：' + s.discarded + ' 次'
					);
				} catch (e) { alert('失败：' + e.message); }
				return false;
			}
		},

		openSharedPanel: {
			name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #7fe3a0, #2a6);">🤝 打开 · 公共知识库</button>',
			intro: '局面指纹 → 群体智慧 → 采纳加成',
			onclick: function () {
				try {
					const s = window.__DJSC.shared.stats();
					const list = window.__DJSC.shared.list(8);
					let msg = '【公共知识库】\n\n' +
						'局面指纹：' + s.fingerprints + '\n' +
						'选择条目：' + s.choices + '（高置信 ' + s.highConfidence + '）\n' +
						'贡献 ' + s.contributes + ' 次 / 采纳 ' + s.adopts + ' 次\n\n' +
						'Top 8 高置信条目：\n';
					list.forEach(function (x) {
						msg += '· ' + x.fingerprint + ' → ' + x.choice +
						       '（' + (x.winRate * 100).toFixed(0) + '% / ' + x.samples + '）\n';
					});
					alert(msg);
				} catch (e) { alert('失败：' + e.message); }
				return false;
			}
		},

		openEvolutionPanel: {
			name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #9ad8ff, #4a6a9a);">🧬 打开 · 策略进化</button>',
			intro: '遗传算法维护档案种群，自动迭代优化',
			onclick: function () {
				try {
					const s = window.__DJSC.evolution.stats();
					let msg = '【策略进化】\n\n' +
						'当前代数：第 ' + s.generation + ' 代\n' +
						'种群大小：' + s.popSize + '\n' +
						'距下次进化：' + (window.__DJSC.evolution.EVOLVE_INTERVAL - s.gamesSinceEvolve) + ' 局\n\n' +
						'种群排行：\n';
					s.population.forEach(function (p, i) {
						msg += (i + 1) + '. ' + p.id +
						       ' 适应度 ' + (p.fitness * 100).toFixed(0) + '%' +
						       '（' + p.wins + '/' + p.games + '）' +
						       ' 攻' + (p.genome.atk * 100).toFixed(0) +
						       ' 守' + (p.genome.def * 100).toFixed(0) + '\n';
					});
					if (confirm(msg + '\n\n立即强制进化一代？')) {
						window.__DJSC.evolution.forceEvolve();
						alert('已进化到第 ' + (window.__DJSC.evolution.stats().generation) + ' 代');
					}
				} catch (e) { alert('失败：' + e.message); }
				return false;
			}
		},

		openSelfCheck: {
			name: '<button class="djsc-menu-config-btn">🔍 打开 · 模块自检面板</button>',
			intro: '检查所有模块是否正确挂载，显示通过/失败状态',
			onclick: function () {
				try {
					/* 直接动态加载 selfCheck.js，不依赖 installScoreEngine */
					import('../score/selfCheck.js').then(function (m) {
						m.openSelfCheck();
					}).catch(function (e) {
						alert('自检面板加载失败：' + e.message);
					});
				} catch (e) { alert('打开失败：' + e.message); }
				return false;
			}
		},

		openGuardPanel: {
			name: '<button class="djsc-menu-config-btn">🛡️ 打开 · 模型护栏面板</button>',
			intro: '查看模型护栏的拦截统计、冷却状态、红线类型',
			onclick: function () {
				try {
					import('../score/modelGuard.js').then(function (m) {
						m.openGuardPanel();
					}).catch(function (e) {
						alert('模型护栏面板加载失败：' + e.message);
					});
				} catch (e) { alert('打开失败：' + e.message); }
				return false;
			}
		},

	/* ===== 身份匹配 ===== */
	identityBd: { clear: true, name: '<div style="color: #9ad8ff; text-align:center; padding: 4px;">▸ 身份匹配</div>' },
	autoIdentityMatch: {
		name: '🎭 身份自动匹配（主公→守护型，反贼→张飞型，忠臣→诸葛亮型，内奸→独狼型）',
		init: false,
	},

	/* ===== 📊 实时状态检测（大按钮） ===== */
	monitorBd: { clear: true, name: '<hr aria-hidden="true"><div style="color: #ffd479; text-align:center; padding: 8px;">▸ 📊 实时状态检测（点击查看）</div>' },

	openPsychologyMonitor: {
		name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #9ad8ff, #4a6a9a);">🧠 博弈策略状态</button>',
		intro: '查看博弈策略（威慑/意图/压迫/保留）的实时统计',
		onclick: function () {
			try {
				const D = window.__DJSC || {};
				if (!D.psychology) return alert('博弈策略未挂载');
				const stats = D.psychology.stats();
				alert('═══ 博弈策略状态 ═══\n' +
					'总决策次数：' + (stats.totalDecisions || 0) + '\n' +
					'威慑检测：' + (stats.deterrenceCount || 0) + ' 次\n' +
					'意图识别：' + (stats.intentCount || 0) + ' 次\n' +
					'压迫评分：' + (stats.pressureAvg || 0) + '\n' +
					'保留策略：' + (stats.holdCount || 0) + ' 次');
			} catch (e) { alert('打开失败：' + e.message); }
			return false;
		}
	},

	openComboMonitor: {
		name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #7fe3a0, #4a9a6a);">🔗 连招链状态</button>',
		intro: '查看当前手牌能识别到的连招组合',
		onclick: function () {
			try {
				const D = window.__DJSC || {};
				if (!D.comboChain) return alert('连招链未挂载');
				const stats = D.comboChain.stats();
				let msg = '═══ 连招链状态 ═══\n\n' +
					'当前手牌检测到：' + (stats.chains || 0) + ' 个\n';
				if (stats.chains > 0) {
					msg += '连招列表：' + (stats.list || []).map(c => c.name).join('、') + '\n';
				} else {
					msg += '（当前手牌无合适连招组合）\n';
				}
				msg += '\n已知连招库：' + (stats.totalKnown || 0) + ' 种\n';
				msg += (stats.allChains || []).map(c => '· ' + c.name + '（+' + c.bonus + '）').join('\n');
				alert(msg);
			} catch (e) { alert('打开失败：' + e.message); }
			return false;
		}
	},

	openMemoryMonitor: {
		name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #ffd479, #9a7a4a);">👤 对手记忆状态</button>',
		intro: '查看长期记忆中记录的对手数量和对局数',
		onclick: function () {
			try {
				const D = window.__DJSC || {};
				if (!D.playerMemory) return alert('对手记忆未挂载');
				const stats = D.playerMemory.stats();
				alert('═══ 对手记忆状态 ═══\n' +
					'记录玩家：' + (stats.players || 0) + ' 人\n' +
					'累计对局：' + (stats.totalGames || 0) + ' 局\n' +
					'有攻击历史：' + (stats.playersWithAttackHistory || 0) + ' 人');
			} catch (e) { alert('打开失败：' + e.message); }
			return false;
		}
	},

	openAutoFeatureMonitor: {
		name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #c49aff, #7a5a9a);">🔮 自动特征发现状态</button>',
		intro: '查看自动发现的维度数量和样本数',
		onclick: function () {
			try {
				const D = window.__DJSC || {};
				if (!D.autoFeature) return alert('自动发现未挂载');
				const stats = D.autoFeature.stats();
				alert('═══ 自动特征发现状态 ═══\n' +
					'总维度数：' + (stats.totalDimensions || 0) + '\n' +
					'总样本数：' + (stats.totalSamples || 0) + '\n' +
					'重要维度：' + (stats.importantDimensions || 0) + ' 个');
			} catch (e) { alert('打开失败：' + e.message); }
			return false;
		}
	},

	openSoftMetricsMonitor: {
		name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #ff9c9c, #9a5a5a);">🎛️ 软指标学习状态</button>',
		intro: '查看软指标的当前值和学习次数',
		onclick: function () {
			try {
				const D = window.__DJSC || {};
				if (!D.softMetrics) return alert('软指标未挂载');
				const stats = D.softMetrics.stats();
				const keys = ['ally_attack_penalty', 'enemy_attack_bonus', 'protect_zhugong_bonus', 'zhugong_under_threat'];
				let lines = '═══ 软指标学习状态 ═══\n';
				lines += '总学习次数：' + (stats.totalLearn || 0) + '\n\n';
				keys.forEach(function (k) {
					try {
						const v = D.softMetrics.get(k);
						lines += k + ' = ' + v + '\n';
					} catch (e) {}
				});
				alert(lines);
			} catch (e) { alert('打开失败：' + e.message); }
			return false;
		}
	},

	openPostCheckMonitor: {
		name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #9cdcff, #5a8a9a);">🔍 决策后检测状态</button>',
		intro: '查看决策后检测的统计和收益记录',
		onclick: function () {
			try {
				const D = window.__DJSC || {};
				if (!D.postCheck) return alert('后检测未挂载');
				const stats = D.postCheck.stats();
				alert('═══ 决策后检测状态 ═══\n' +
					'总检测次数：' + (stats.totalChecks || 0) + '\n' +
					'平均收益：' + (stats.avgReward || 0) + '\n' +
					'正收益决策：' + (stats.positiveCount || 0) + ' 次\n' +
					'负收益决策：' + (stats.negativeCount || 0) + ' 次');
			} catch (e) { alert('打开失败：' + e.message); }
			return false;
		}
	},

	openProfilerMonitor: {
		name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #a8b8c8, #5a6a7a);">⏱️ 性能分析状态</button>',
		intro: '查看各阶段耗时和优化建议',
		onclick: function () {
			try {
				const D = window.__DJSC || {};
				if (!D.profiler) return alert('性能分析器未挂载');
				const stats = D.profiler.stats();
				let lines = '═══ 性能分析状态 ═══\n';
				lines += 'localStorage：' + (stats.memory.localStorageKB || 0) + ' KB\n\n';
				lines += 'Top 5 阶段：\n';
				(stats.phases || []).slice(0, 5).forEach(function (p) {
					lines += '  ' + p.phase + '：' + p.avg + 'ms（' + p.count + ' 次）\n';
				});
				alert(lines);
			} catch (e) { alert('打开失败：' + e.message); }
			return false;
		}
	},

	openTrainBufferMonitor: {
		name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #9affc4, #5a9a7a);">📦 训练缓冲状态</button>',
		intro: '查看训练样本缓冲的大小',
		onclick: function () {
			try {
				const D = window.__DJSC || {};
				if (!D.trainBufferSize) return alert('训练缓冲未挂载');
				const size = D.trainBufferSize();
				alert('═══ 训练缓冲状态 ═══\n' +
					'当前缓冲：' + size + ' 条样本\n' +
					'导出命令：window.__DJSC.trainExportJSONL()');
			} catch (e) { alert('打开失败：' + e.message); }
			return false;
		}
	},

	openFullMonitor: {
		name: '<button class="djsc-menu-config-btn" style="background: linear-gradient(135deg, #ffd479, #9a7a4a); width: 100%;">📊 一键全功能状态检测</button>',
		intro: '一次性检测所有功能的运行状态',
		onclick: function () {
			try {
				const D = window.__DJSC || {};
				let lines = '═══ 全功能状态检测 ═══\n\n';
				
				/* 1. 博弈策略 */
				lines += '🧠 博弈策略：' + (D.psychology ? '✅ 已挂载' : '❌ 未挂载') + '\n';
				/* 2. 连招链 */
				lines += '🔗 连招链：' + (D.comboChain ? '✅ 已挂载' : '❌ 未挂载') + '\n';
				/* 3. 对手记忆 */
				lines += '👤 对手记忆：' + (D.playerMemory ? '✅ 已挂载' : '❌ 未挂载') + '\n';
				/* 4. 自动发现 */
				lines += '🔮 自动发现：' + (D.autoFeature ? '✅ 已挂载' : '❌ 未挂载') + '\n';
				/* 5. 软指标 */
				lines += '🎛️ 软指标：' + (D.softMetrics ? '✅ 已挂载' : '❌ 未挂载') + '\n';
				/* 6. 后检测 */
				lines += '🔍 后检测：' + (D.postCheck ? '✅ 已挂载' : '❌ 未挂载') + '\n';
				/* 7. 性能分析 */
				lines += '⏱️ 性能分析：' + (D.profiler ? '✅ 已挂载' : '❌ 未挂载') + '\n';
				/* 8. 训练缓冲 */
				lines += '📦 训练缓冲：' + (D.trainBufferSize ? '✅ 已挂载' : '❌ 未挂载') + '\n';
				
				lines += '\n═══ 对局状态 ═══\n';
				const me = (typeof game !== 'undefined' && game.me) ? game.me : null;
				if (me) {
					lines += '玩家：' + (me.name1 || me.name || '?') + '\n';
					lines += '身份：' + (me.identity || '?') + '\n';
					lines += '血量：' + (me.hp || 0) + '/' + (me.maxHp || 0) + '\n';
				} else {
					lines += '未在对局中\n';
				}
				
				alert(lines);
			} catch (e) { alert('检测失败：' + e.message); }
			return false;
		}
	},

	/* ===== 界面设置 ===== */
	uiBd: { clear: true, name: '<div style="color: #9ad8ff; text-align:center; padding: 4px;">▸ 界面设置</div>' },
		/* 🌐 界面语言（UI Language） */

};

config = arrangeConfig(config, lib, game);
config.updateLog = { clear: true, nopointer: true, name: changelog, onclick: function () { return false; } };
