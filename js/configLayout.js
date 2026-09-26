/*
 * ============================================
 * // 作者: 飞升原创
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * License: GPL-3.0
 * ============================================
 */

/* 设置分组仅整理展示，沿用原有配置键、保存方式与功能回调。 */
export function arrangeConfig(source, lib, game) {
    const groups = [
        ['basic', '一、基础设置', ['decisionScore', 'adaptiveDifficulty', 'autoIdentityMatch', 'openConfigPanel']],
        ['tactics', '二、决策与战术', ['responseAI', 'compareAI', 'broadcastAI', 'enablePlanner', 'psychologyLayer', 'comboChain', 'deckAwareness', 'deckConsumeAllPlayers', 'openPlanPanel', 'openRecommendPanel']],
        ['override', '三、原生 AI 接管', ['hardOverride', 'override_use', 'override_respond', 'override_discard', 'override_compare', 'openOverridePanel']],
        ['memory', '四、记忆与反馈', ['decisionFeedback', 'skillFeedback', 'styleFeedback', 'crossGameMemory', 'playerMemory', 'openMemoryPanel']],
        ['training', '五、模型与训练', ['useTrainedModel', 'useResidual', 'learningRate', 'forceTrain', 'showSampleCount', 'showModelStatus', 'autoFixModel']],
        ['report', '六、战报与分析', ['showReport', 'archiveGames', 'showLog', 'persist', 'narrator', 'openPanel', 'openArchivePanel', 'openSkillPanel', 'openSkillBreakdownPanel', 'openFeedbackPanel', 'openReplayPanel', 'openComparePanel', 'openNarratorPanel', 'openSmartPanel']],
        ['data', '七、数据管理', ['exportTrainingData', 'importTrainingData', 'exportAllData', 'importOverwrite', 'importMerge', 'openExportPanel', 'quickExportAll', 'clearSamples']],
        ['diagnostics', '八、高级与诊断', ['openHotSwapPanel', 'openSharedPanel', 'openEvolutionPanel', 'openBrainDashboard', 'openDecisionDashboard', 'openCalibratorPanel', 'profiler', 'openProfilerPanel', 'openHealthPanel', 'openSelfCheck', 'openGuardPanel', 'openPostCheckPanel', 'openPsychologyMonitor', 'openComboMonitor', 'openMemoryMonitor', 'openAutoFeatureMonitor', 'openSoftMetricsMonitor', 'openPostCheckMonitor', 'openProfilerMonitor', 'openTrainBufferMonitor', 'openFullMonitor']],
    ];
    const text = html => html.replace(/<[^>]*>/g, '').replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').replace(/^\s*打开\s*[·・]?\s*/, '').trim();
    const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const hidden = new Set(['openNarratorPanel', 'openSkillPanel', 'openRecommendPanel', 'exportAllData', 'importOverwrite', 'importMerge', 'openExportPanel', 'quickExportAll']);
    const explanations = {
        // ===== 基础设置 =====
        decisionScore: '开关AI积分系统，开启后AI会根据局势动态计算每张牌的价值。',
        adaptiveDifficulty: '根据近期战绩自动调整AI难度，越打越聪明。关闭后使用固定难度。',
        autoIdentityMatch: '自动匹配身份阵营，AI会根据身份调整出牌策略。',
        openConfigPanel: '打开AI扩展的主设置面板，所有功能开关都在这里。',

        // ===== 决策与战术 =====
        responseAI: '响应阶段AI优化，自动判断该出闪、桃还是无懈可击，减少浪费。',
        compareAI: '拼点阶段AI优化，自动保留高点数手牌，提高拼点胜率。',
        broadcastAI: '同阵营AI共享攻击意图，自动集火同一个敌人，配合更默契。',
        enablePlanner: '多步战术规划，AI会提前想好接下来几轮的出牌顺序和连招。',
        psychologyLayer: '心理战术层，AI会猜测对手的手牌和意图，做出更精准的决策。',
        comboChain: '连招识别，AI会自动识别并打出最优连招组合，比如酒杀、铁索连环等。',
        deckAwareness: '牌堆感知，AI会记住已经出过的牌，推算牌堆里还剩什么牌。',
        deckConsumeAllPlayers: '全局牌堆消耗感知，考虑所有玩家的手牌和弃牌堆，更精准地推算牌堆。',
        openPlanPanel: '打开战术规划面板，查看AI当前的多步出牌计划和预测。',
        openRecommendPanel: '选将推荐面板，根据当前身份和模式，推荐最优武将。',

        // ===== 原生AI接管 =====
        hardOverride: '强制接管原生AI，所有决策都由无名AI做出，不使用原生AI逻辑。',
        override_use: '接管出牌阶段，AI自动决定出什么牌。',
        override_respond: '接管响应阶段，AI自动决定要不要出闪、桃、无懈可击。',
        override_discard: '接管弃牌阶段，AI自动决定弃哪些牌，保留最优手牌。',
        override_compare: '接管拼点阶段，AI自动决定要不要拼点、出什么牌。',
        openOverridePanel: '打开接管层状态面板，查看哪些阶段被AI接管了。',

        // ===== 记忆与反馈 =====
        decisionFeedback: '记录每局的决策反馈，AI会根据这些反馈调整后续策略。',
        skillFeedback: '记录技能使用反馈，AI会学习什么时候该用技能、什么时候该留着。',
        styleFeedback: '记录风格反馈，AI会学习你的出牌习惯，越打越像你。',
        crossGameMemory: '跨局记忆，AI会记住之前对局的经验，下局自动应用。',
        playerMemory: '玩家记忆，AI会记住每个玩家的出牌习惯，针对性调整策略。',
        openMemoryPanel: '打开跨局记忆面板，查看AI记住了哪些玩家和对局习惯。',

        // ===== 模型与训练 =====
        useTrainedModel: '启用训练好的神经网络模型，开启后AI会用学到的经验做决策。',
        useResidual: '残差连接开关，开启后神经网络更深，学习能力更强，但更耗性能。',
        learningRate: '学习效率，数值越大学得越快但容易过拟合，数值越小学得越稳但慢。',
        forceTrain: '强制训练按钮，手动触发一次模型训练，把积累的样本学进去。',
        showSampleCount: '显示样本数量，在面板上实时显示已经积累了多少训练样本。',
        showModelStatus: '显示模型状态，在面板上实时显示模型的置信度和准确率。',
        autoFixModel: '自动修复模型，当模型出现异常时自动重置，防止AI变傻。',

        // ===== 战报与分析 =====
        showReport: '显示战报，每局结束后自动弹出战报总结。',
        archiveGames: '自动归档对局，把每局的战报保存下来，随时可以回看。',
        showLog: '显示日志，在游戏界面显示AI的决策日志，方便调试和观察。',
        persist: '持久化存储，所有设置和数据都会保存，重启游戏不丢失。',
        narrator: '解说模式，AI会用文字解说自己的每一步操作，像看比赛解说一样。',
        openPanel: '打开主面板，显示AI的所有状态和数据。',
        openArchivePanel: '打开战报归档面板，查看之前所有对局的战报和统计。',
        openSkillPanel: '打开技能矩阵面板，查看所有技能的使用频率和胜率统计。',
        openSkillBreakdownPanel: '打开技能拆解面板，分析每个技能的最佳使用时机和策略。',
        openFeedbackPanel: '打开决策回放面板，回看AI每一步决策的思考过程。',
        openReplayPanel: '打开对局回放面板，像看录像一样回看整局游戏。',
        openComparePanel: '打开对比面板，对比不同AI策略的胜率和表现。',
        openNarratorPanel: '打开解说面板，调整解说的风格和详细程度。',
        openSmartPanel: '打开智能面板，AI自动推荐当前最优操作。',

        // ===== 数据管理 =====
        exportTrainingData: '导出训练样本，把AI积累的学习数据导出成JSON文件，用于备份或分享。',
        importTrainingData: '导入训练样本，从JSON文件导入别人分享的学习数据，快速提升AI。',
        exportAllData: '导出所有数据，包括样本、模型权重、设置，完整备份。',
        importOverwrite: '导入并覆盖，导入数据时覆盖本地所有数据，谨慎使用。',
        importMerge: '导入并合并，导入数据时和本地数据合并，不覆盖原有数据。',
        openExportPanel: '打开导出面板，选择要导出的数据类型和范围。',
        quickExportAll: '快速导出所有，一键导出全部数据，不用选选项。',
        clearSamples: '清空训练样本，删除所有积累的学习数据，建议先导出备份。',

        // ===== 高级与诊断 =====
        openHotSwapPanel: '打开热重载面板，不重启游戏就能更新代码，开发调试用。',
        openSharedPanel: '打开共享面板，和其他玩家共享AI模型和数据。',
        openEvolutionPanel: '打开进化面板，查看AI从开始到现在的进化历程和数据。',
        openBrainDashboard: '打开大脑总览面板，把AI的所有状态汇总在一个页面，一目了然。',
        openDecisionDashboard: '打开决策面板，实时显示AI当前正在思考什么、为什么这么选。',
        openCalibratorPanel: '打开校准面板，手动调整AI的评分参数，优化出牌策略。',
        profiler: '性能分析开关，开启后记录AI每一步的耗时，找出卡顿原因。',
        openProfilerPanel: '打开性能分析面板，查看AI的性能数据和耗时分布。',
        openHealthPanel: '打开健康检查面板，一键检测所有模块是否正常工作。',
        openSelfCheck: '打开自检面板，自动检查所有功能是否正常，有问题会标红。',
        openGuardPanel: '打开护栏面板，查看AI的安全护栏规则，防止AI做出傻事。',
        openPostCheckPanel: '打开后置检查面板，查看AI决策后的检查结果和修正。',
        openPsychologyMonitor: '打开心理监控面板，实时显示AI对对手的心理分析。',
        openComboMonitor: '打开连招监控面板，实时显示AI识别到的连招组合。',
        openMemoryMonitor: '打开记忆监控面板，实时显示AI的记忆系统状态。',
        openAutoFeatureMonitor: '打开自动特征监控面板，查看AI自动提取的特征数据。',
        openSoftMetricsMonitor: '打开软指标监控面板，查看AI的软指标参数和权重。',
        openPostCheckMonitor: '打开后置检查监控面板，实时显示后置检查的运行状态。',
        openProfilerMonitor: '打开性能监控面板，实时显示AI的性能指标。',
        openTrainBufferMonitor: '打开训练缓冲监控面板，查看训练样本的缓冲队列。',
        openFullMonitor: '打开全功能监控面板，把所有监控数据汇总在一个页面。',
    };
    const result = {};
    const omitted = new Set(['openScorePanel', 'clearTrainingBuffer', 'showTrainStats', 'openFeedbackGroup']);
    const assigned = new Set(groups.flatMap(group => group[2]));
    for (const key of Object.keys(source)) {
        if (!key.endsWith('Bd') && !assigned.has(key) && !omitted.has(key) && !hidden.has(key)) groups[7][2].push(key);
    }
    for (const [id, title, keys] of groups) {
        const storageKey = 'extension_无名AI_settings_group_' + id;
        const expanded = lib.config[storageKey] === undefined ? id === 'basic' : !!lib.config[storageKey];
        result['group_' + id] = {
            clear: true,
            name: '<div class="djsc-settings-group" data-group="' + id + '" data-open="' + expanded + '"><span>' + title + '</span><span class="djsc-settings-arrow">' + (expanded ? '▼' : '▶') + '</span></div>',
            onclick: function () {
                const header = this.querySelector('.djsc-settings-group');
                const open = header.dataset.open !== 'true';
                header.dataset.open = String(open);
                header.querySelector('.djsc-settings-arrow').textContent = open ? '▼' : '▶';
                game.saveConfig(storageKey, open);
                return false;
            },
        };
        for (const key of keys) {
            if (!source[key] || hidden.has(key)) continue;
            const option = { ...source[key] };
            const fullName = text(option.name);
            const label = key === 'importTrainingData' ? '导入AI学习数据' : fullName.replace(/[（(].*$/s, '').trim();
            option.intro = explanations[key] || option.intro || fullName;
            const help = typeof option.intro === 'string' ? text(option.intro) : fullName;
            // 注释直接显示在按钮下面
            const descHtml = explanations[key] ? '<div style="font-size:11px;color:#888;font-weight:normal;margin-top:2px;line-height:1.3;">' + escape(explanations[key]) + '</div>' : '';
            const name = '<span class="djsc-setting-name" data-group="' + id + '">' + escape(label) + descHtml + '</span>';
            if (option.name.includes('djsc-menu-config-btn')) {
                const action = /clear/i.test(key) ? '清空' : /import/i.test(key) ? '导入' : /export/i.test(key) ? '导出' : key === 'forceTrain' ? '训练' : key === 'autoFixModel' ? '修复' : key === 'openSelfCheck' || key === 'openFullMonitor' ? '检测' : '查看';
                option.clear = true;
                option.name = '<span class="djsc-setting-action-row">' + name + '<button type="button" class="djsc-setting-action">' + action + '</button></span>';
            } else {
                option.name = name;
            }
            result[key] = option;
        }
    }
    result.openFeedbackGroup = {
        clear: true,
        name: '<span class="djsc-setting-action-row"><span class="djsc-setting-name">反馈QQ群：<span class="djsc-feedback-number" style="user-select:text;-webkit-user-select:text">1080487560</span></span><button type="button" class="djsc-setting-action">复制</button></span>',
        onclick: function () {
            const button = this.querySelector('.djsc-setting-action');
            (async () => {
                const number = '1080487560';
                let copied = false;
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(number);
                        copied = true;
                    }
                } catch (_) { /* 非安全上下文或权限限制时使用兼容方式。 */ }
                if (!copied) {
                    const input = document.createElement('textarea');
                    const previousFocus = document.activeElement;
                    input.value = number;
                    input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
                    document.body.appendChild(input);
                    try {
                        input.focus();
                        input.select();
                        copied = document.execCommand('copy');
                    } catch (_) { /* 保留可手动复制的群号。 */ }
                    finally {
                        input.remove();
                        if (previousFocus && previousFocus.focus) previousFocus.focus();
                    }
                }
                if (button) {
                    button.textContent = copied ? '已复制' : '请手动复制';
                    button.classList.add('djsc-copy-result');
                    setTimeout(() => { button.textContent = '复制'; button.classList.remove('djsc-copy-result'); }, 2000);
                }
            })();
            return false;
        },
    };
    return result;
}
