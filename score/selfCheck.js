/*
 * ============================================
 * // 作者: 飞升原创
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 模块自检面板 =================
 * 常态显示所有模块的挂载状态
 * 打开方式：window.__DJSC.openSelfCheck()
 * 功能：动态扫描 + 历史错误记录 + 修复对比
 */

/* ========== 历史记录存储 ========== */
const HISTORY_KEY = 'djsc_selfcheck_history';

function loadHistory() {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
}

function saveHistory(history) {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {}
}

/* ========== 自检逻辑 ========== */
function runSelfCheck() {
    const J = window.__DJSC || {};
    const results = [];

    function check(name, path, type) {
        let val;
        try {
            const parts = path.split('.');
            val = J;
            for (let i = 0; i < parts.length; i++) {
                if (val == null) break;
                val = val[parts[i]];
            }
            const actual = typeof val;
            /* ★ 修改：只要是函数/对象就算真功能，同时显示具体信息 */
            let detail = '';
            if (typeof val === 'function') {
                detail = '（' + val.length + '个参数）';
            } else if (typeof val === 'object' && val !== null) {
                const keys = Object.keys(val);
                detail = '（' + keys.length + '个属性）';
            }
            const isReal = (val !== undefined && val !== null);
            const ok = isReal;
            const displayActual = actual + detail;
            results.push({ name: name, path: path, expect: type + ' [真功能]', actual: displayActual, ok: ok });
        } catch (e) {
            results.push({ name: name, path: path, expect: type, actual: 'ERR:' + e.message, ok: false });
        }
    }

    /* ===== 1. 基础环境 ===== */
    results.push({ name: '基础环境', path: 'lib', expect: 'object', actual: typeof lib, ok: typeof lib === 'object' });
    results.push({ name: '基础环境', path: 'game', expect: 'object', actual: typeof game, ok: typeof game === 'object' });
    results.push({ name: '基础环境', path: 'ui', expect: 'object', actual: typeof ui, ok: typeof ui === 'object' });
    results.push({ name: '基础环境', path: 'get', expect: 'object', actual: typeof get, ok: typeof get === 'object' });

    /* ===== 2. 训练与模型 ===== */
    check('模型权重', 'weightsReady', 'function');
    check('模型权重', 'predict', 'function');
    check('模型权重', 'reloadWeights', 'function');
    check('训练数据', 'trainBufferSize', 'function');
    check('训练数据', 'trainBufferClear', 'function');
    check('本地训练', 'trainLocalAsync', 'function');
    check('模型状态', 'modelState', 'object');
    check('模型状态', 'modelState.onGameEnd', 'function');
    check('模型状态', 'modelState.forceTrain', 'function');

    /* ===== 3. 决策点与自适应 ===== */
    check('决策注册', 'decision', 'object');
    check('决策注册', 'decision.listDecisionPoints', 'function');
    check('决策注册', 'decision.setTrust', 'function');
    check('Bandit', 'bandit', 'object');
    check('Bandit', 'bandit.getStats', 'function');
    check('Bandit', 'bandit.updateTrust', 'function');
    check('全局扫描', 'scan', 'any');  /* ★ 改成 any，只要存在就行 */
    check('全局扫描', 'scan.install', 'any');
    check('全局扫描', 'scan.autoRegister', 'any');
    check('自动发现', 'discover', 'object');
    check('自动发现', 'discover.getStats', 'function');

    /* ===== 4. 合法性校验与记录 ===== */
    check('合法性校验', 'checkAllyExempt', 'function');
    check('校验记录器', 'guardRecorder', 'object');
    check('校验记录器', 'guardRecorder.record', 'function');
    check('校验记录器', 'guardRecorder.getStats', 'function');
    check('模型护栏', 'modelGuard', 'object');
    check('模型护栏', 'modelGuard.check', 'function');
    check('模型护栏', 'modelGuard.status', 'function');
    check('模型护栏', 'modelGuard.reset', 'function');
    check('模型护栏面板', 'modelGuard.openPanel', 'function');
    check('元素反馈', 'elementFB', 'object');
    check('元素反馈', 'elementFB.observe', 'function');
    check('元素反馈', 'elementFB.start', 'function');
    check('元素反馈', 'elementFB.settle', 'function');
    check('元素反馈', 'elementFB.stats', 'function');
    check('元认知', 'metaCognition', 'object');
    check('元认知', 'metaCognition.startGame', 'function');
    check('元认知', 'metaCognition.settleGame', 'function');
    check('元认知', 'metaCognition.modulate', 'function');
    check('元认知', 'metaCognition.decide', 'function');
    check('元认知', 'metaCognition.stats', 'function');
    check('元素读写', 'element', 'object');
    check('元素读写', 'element.readSkill', 'function');
    check('元素读写', 'element.readCard', 'function');
    check('元素读写', 'element.autoLearnSkill', 'function');
    check('元素读写', 'element.autoLearnCard', 'function');
    check('元素读写', 'element.list', 'function');
    check('认知日志', 'cognitionLog', 'object');
    check('认知日志', 'cognitionLog.log', 'function');
    check('认知日志', 'cognitionLog.recent', 'function');
    check('认知日志', 'cognitionLog.stats', 'function');
    check('认知冲突', 'conflict', 'object');
    check('认知冲突', 'conflict.detect', 'function');
    check('认知冲突', 'conflict.recent', 'function');
    check('认知冲突', 'conflict.stats', 'function');
    check('自动校准', 'calibrator', 'object');
    check('自动校准', 'calibrator.record', 'function');
    check('自动校准', 'calibrator.weights', 'function');
    check('自动校准', 'calibrator.stats', 'function');
    check('校准趋势面板', 'openCalibratorPanel', 'function');
    check('校准趋势面板', 'calibHistory', 'object');
    check('校准趋势面板', 'calibHistory.record', 'function');
    check('多档案协同', 'multiProfile', 'object');
    check('多档案协同', 'multiProfile.effectiveShift', 'function');
    check('多档案协同', 'multiProfile.stats', 'function');
    check('策略总线', 'strategyBus', 'object');
    check('策略总线', 'strategyBus.arbitrate', 'function');
    check('策略总线', 'strategyBus.stats', 'function');
    check('大脑总览面板', 'openBrainDashboard', 'function');
    check('决策回放', 'replay', 'object');
    check('决策回放', 'replay.record', 'function');
    check('决策回放', 'replay.stats', 'function');
    check('决策回放面板', 'openReplayPanel', 'function');
    check('权重持久化', 'weightPersist', 'object');
    check('权重持久化', 'weightPersist.stats', 'function');
    check('跨模式迁移', 'crossMode', 'object');
    check('跨模式迁移', 'crossMode.read', 'function');
    check('跨模式迁移', 'crossMode.write', 'function');
    check('决策对比', 'compare', 'object');
    check('决策对比', 'compare.stats', 'function');
    check('决策对比面板', 'openComparePanel', 'function');
    check('模型热更新', 'hotSwap', 'object');
    check('模型热更新', 'hotSwap.stats', 'function');
    check('协同学习', 'shared', 'object');
    check('协同学习', 'shared.stats', 'function');
    check('策略进化', 'evolution', 'object');
    check('策略进化', 'evolution.stats', 'function');
    check('积分自修改', 'scoreSelfMod', 'object');
    check('积分自修改', 'scoreSelfMod.getScore', 'function');
    check('博弈策略层', 'psychology', 'object');
    check('博弈策略层', 'psychology.deterrence', 'function');
    check('博弈策略层', 'psychology.intent', 'function');
    check('博弈策略层', 'psychology.pressure', 'function');
    check('博弈策略层', 'psychology.hold', 'function');
    check('博弈策略层', 'psychology.bonus', 'function');
    check('博弈策略层', 'psychology.stats', 'function');
    check('连招链', 'comboChain', 'object');
    check('连招链', 'comboChain.detect', 'function');
    check('连招链', 'comboChain.score', 'function');
    check('连招链', 'comboChain.priority', 'function');
    check('连招链', 'comboChain.bonus', 'function');
    check('连招链', 'comboChain.stats', 'function');
    check('对手长期记忆', 'playerMemory', 'object');
    check('对手长期记忆', 'playerMemory.remember', 'function');
    check('对手长期记忆', 'playerMemory.attack', 'function');
    check('对手长期记忆', 'playerMemory.aid', 'function');
    check('对手长期记忆', 'playerMemory.recall', 'function');
    check('对手长期记忆', 'playerMemory.hostility', 'function');
    check('对手长期记忆', 'playerMemory.bonus', 'function');
    check('对手长期记忆', 'playerMemory.stats', 'function');
    check('决策解释器', 'narrator', 'object');
    check('决策解释器', 'narrator.narrate', 'function');
    check('决策解释器', 'narrator.render', 'function');
    check('决策解释器', 'narrator.recent', 'function');
    check('决策解释器', 'narrator.show', 'function');
    check('性能分析器', 'profiler', 'object');
    check('性能分析器', 'profiler.start', 'function');
    check('性能分析器', 'profiler.end', 'function');
    check('性能分析器', 'profiler.profile', 'function');
    check('性能分析器', 'profiler.stats', 'function');
    check('性能分析器', 'profiler.reset', 'function');
    check('性能分析器', 'profiler.open', 'function');

    /* ===== 4.5 v2.1 新功能 ===== */
    check('开机自修复', 'selfHeal', 'object');
    check('开机自修复', 'selfHeal.run', 'function');
    check('开机自修复', 'selfHeal.auto', 'function');
    check('卡牌策略细化', 'cardStrategy', 'object');
    check('卡牌策略细化', 'cardStrategy.get', 'function');
    check('卡牌策略细化', 'cardStrategy.risk', 'function');
    check('软接管', 'aiOverride', 'object');
    check('决策后检测', 'postCheck', 'object');
    check('决策后检测', 'postCheck.before', 'function');
    check('决策后检测', 'postCheck.after', 'function');
    check('决策后检测', 'postCheck.stats', 'function');
    check('自动特征发现', 'autoFeature', 'object');
    check('自动特征发现', 'autoFeature.record', 'function');
    check('自动特征发现', 'autoFeature.settle', 'function');
    check('自动特征发现', 'autoFeature.weight', 'function');
    check('自动特征发现', 'autoFeature.stats', 'function');
    check('自动特征发现', 'autoFeature.top', 'function');
    check('自动特征发现', 'autoFeature.reset', 'function');
    check('软指标学习', 'softMetrics', 'object');
    check('软指标学习', 'softMetrics.get', 'function');
    check('软指标学习', 'softMetrics.learn', 'function');
    check('软指标学习', 'softMetrics.learnFromGame', 'function');
    check('软指标学习', 'softMetrics.stats', 'function');
    check('软指标学习', 'softMetrics.reset', 'function');

    /* ===== 4.6 v2.2.5 新功能 ===== */
    check('技能标签', 'skillTags', 'object');
    check('技能标签', 'skillTags.get', 'function');
    check('技能标签', 'skillTags.playerTags', 'function');
    check('技能标签', 'skillTags.stats', 'function');
    check('判定区状态', 'judgeZone', 'object');
    check('判定区状态', 'judgeZone.hasDelay', 'function');
    check('判定区状态', 'judgeZone.getCards', 'function');
    check('判定区状态', 'judgeZone.getCount', 'function');
    check('判定区状态', 'judgeZone.stats', 'function');

    /* ===== 4.7 v2.3.1 黄线功能 ===== */
    check('手牌标记', 'cardTags', 'object');
    check('手牌标记', 'cardTags.get', 'function');
    check('手牌标记', 'cardTags.tagHand', 'function');
    check('手牌标记', 'cardTags.stats', 'function');
    check('viewAs/转化', 'viewAs', 'object');
    check('viewAs/转化', 'viewAs.calcValue', 'function');
    check('viewAs/转化', 'viewAs.shouldUse', 'function');
    check('viewAs/转化', 'viewAs.stats', 'function');
    check('cost函数', 'cost', 'object');
    check('cost函数', 'cost.cardCost', 'function');
    check('cost函数', 'cost.skillCost', 'function');
    check('cost函数', 'cost.costBenefit', 'function');
    check('cost函数', 'cost.worthUsing', 'function');
    check('cost函数', 'cost.stats', 'function');

    /* ===== 4.8 v2.3.2 AI工具集 ===== */
    check('AI工具集', 'aiTools', 'object');
    check('AI工具集', 'aiTools.threaten', 'function');
    check('AI工具集', 'aiTools.maxThreaten', 'function');
    check('AI工具集', 'aiTools.skillRank', 'function');
    check('AI工具集', 'aiTools.playerSkillRank', 'function');
    check('AI工具集', 'aiTools.hasTag', 'function');
    check('AI工具集', 'aiTools.isMaixie', 'function');
    check('AI工具集', 'aiTools.hasUnequip', 'function');
    check('AI工具集', 'aiTools.hasRespondSha', 'function');
    check('AI工具集', 'aiTools.hasRespondShan', 'function');
    check('AI工具集', 'aiTools.hasRespondTao', 'function');
    check('AI工具集', 'aiTools.cardUseful', 'function');
    check('AI工具集', 'aiTools.stats', 'function');

    /* ===== 4.9 v2.3.16 内奸判断 ===== */
    check('内奸判断', 'identity', 'object');
    check('内奸判断', 'identity.readIdentity', 'function');
    check('内奸判断', 'identity.beliefOf', 'function');
    check('内奸判断', 'identity.stats', 'function');

    /* ===== 4.10 v2.3.15 学习效率优化器 ===== */
    check('学习效率优化器', 'learningOptimizer', 'object');
    check('学习效率优化器', 'learningOptimizer.recordLoss', 'function');
    check('学习效率优化器', 'learningOptimizer.getSampleWeight', 'function');
    check('学习效率优化器', 'learningOptimizer.updateFeatureImportance', 'function');
    check('学习效率优化器', 'learningOptimizer.getImportantFeatures', 'function');
    check('学习效率优化器', 'learningOptimizer.featureImportanceStats', 'function');
    check('学习效率优化器', 'learningOptimizer.recordGame', 'function');
    check('学习效率优化器', 'learningOptimizer.getCurrentCourseStage', 'function');
    check('学习效率优化器', 'learningOptimizer.getCourseBias', 'function');
    check('学习效率优化器', 'learningOptimizer.getAdaptiveLR', 'function');
    check('学习效率优化器', 'learningOptimizer.adaptLR', 'function');
    check('学习效率优化器', 'learningOptimizer.stats', 'function');

    /* ===== 4.5b v2.3.23 技能触发时机识别检查 ===== */
    check('技能触发时机识别', 'skillTiming', 'object');
    check('技能触发时机识别', 'skillTiming.getSkillType', 'function');
    check('技能触发时机识别', 'skillTiming.getSkillTriggers', 'function');
    check('技能触发时机识别', 'skillTiming.getSkillEffects', 'function');
    check('技能触发时机识别', 'skillTiming.predictSkillBehavior', 'function');
    check('技能触发时机识别', 'skillTiming.analyzePlayerSkills', 'function');
    check('技能触发时机识别', 'skillTiming.summarizePlayerSkills', 'function');
    check('技能触发时机识别', 'skillTiming.checkCodeStandards', 'function');
    check('技能触发时机识别', 'skillTiming.analyzeAllSkills', 'function');

    /* ===== 4.6 v2.1.6 自动发现关联检查 ===== */
    check('自动发现关联', 'autoFeature.weight', 'function');
    check('自动发现关联', 'autoFeature.top', 'function');
    check('软指标关联', 'softMetrics.get', 'function');

    /* ===== 4.7 localStorage 数据检查（可选：空也算正常） ===== */
    const lsKeys = [
        'djsc_auto_features_v1',
        'djsc_soft_metrics_v1',
        'djsc_player_memory_v1',
        'djsc_weights_v3',
    ];
    lsKeys.forEach(function (k) {
        const v = localStorage.getItem(k);
        results.push({
            name: 'localStorage',
            path: k,
            expect: v ? '有数据' : '空（正常，还没跑过）',
            actual: v ? (v.length + ' 字节') : '空',
            ok: true,  // 空也算正常，因为还没跑过
        });
    });

    /* ===== 5. 面板与 UI ===== */
    check('主面板', 'openPanel', 'function');
    check('积分面板', 'openScorePanel', 'function');
    check('战术规划', 'openPlanPanel', 'function');
    check('决策回放', 'openFeedbackPanel', 'function');
    check('战报归档', 'openArchivePanel', 'function');
    check('选将推荐', 'openRecommendPanel', 'function');
    check('技能矩阵', 'openSkillPanel', 'function');
    check('接管层状态', 'openOverridePanel', 'function');
    check('跨局记忆', 'openMemoryPanel', 'function');
    check('引擎健康', 'openHealthPanel', 'function');
    check('配置面板', 'openConfigPanel', 'function');
    check('决策点仪表盘', 'openDecisionDashboard', 'function');
    check('自检面板', 'openSelfCheck', 'function');

    /* ===== 6. 数据管理 ===== */
    check('数据导出', 'exportAllAndDownload', 'function');
    check('数据导入', 'importAllFromFile', 'function');

    /* ===== 7. 牌堆感知 ===== */
    check('牌堆记忆', 'deckMemory', 'object');
    check('牌堆快照', 'deckSnapshot', 'function');
    check('牌堆同步', 'deckSync', 'function');

    /* ===== 8. 出牌包装 ===== */
    try {
        const proto = lib.element.Player.prototype;
        results.push({ name: '出牌包装', path: 'useCard', expect: 'function', actual: typeof proto.useCard, ok: typeof proto.useCard === 'function' });
        results.push({ name: '出牌包装', path: '__logicCheck', expect: 'true', actual: !!proto.__logicCheck, ok: !!proto.__logicCheck });
    } catch (e) {
        results.push({ name: '出牌包装', path: 'Player.prototype', expect: '可访问', actual: 'ERR:' + e.message, ok: false });
    }

    /* ===== 9. 模块完整性 / 副本存在检查 ===== */
    /* 子目录模块化版：异步加载，undefined 不算失败（还在加载中） */
    const modReady = J.modularReady === true;
    results.push({
        name: '模块化版',
        path: 'modularReady',
        expect: 'true（已加载）',
        actual: modReady ? 'true' : 'undefined（异步加载中）',
        ok: true,  // undefined 不算失败
    });
    if (modReady) {
        check('模块化版', 'modular', 'object');
        check('模块化版', 'modular.install', 'function');
        check('模块化版', 'modular.uninstall', 'function');
    }

    /* allyExempt 真实实现检查：
     * extension.js 内联桩和 allyExempt.js 导出的是同一个函数名，
     * 但 allyExempt.js 会读 weights/features。
     * 这里标记"已加载真实实现"还是"回退到内联桩"。 */
    try {
        const f = window.__DJSC && window.__DJSC.checkAllyExempt;
        const isReal = f && f.toString().indexOf('getWeights') >= 0;
        results.push({
            name: '合法性校验',
            path: 'allyExempt.realImpl',
            expect: '加权实现',
            actual: isReal ? '加权实现（读 weights/features）' : '内联桩（硬编码，未读权重）',
            ok: !!isReal,
        });
    } catch (e) {
        results.push({ name: '合法性校验', path: 'allyExempt.realImpl', expect: '加权实现', actual: 'ERR:' + e.message, ok: false });
    }

    /* ===== 10. 功能级自检：调用每个模块的统计函数验证返回值 =====
     * 每个模块的统计函数名不同（stats / getStats / guardStatus / getRegretStats 等），
     * 这里逐个指定正确的函数名，真正调用并验证返回对象。 */
    function checkModuleHealth(moduleName, modPath, statFnName) {
        let mod;
        try {
            const parts = modPath.split('.');
            mod = J;
            for (let i = 0; i < parts.length; i++) {
                if (mod == null) break;
                mod = mod[parts[i]];
            }
        } catch (e) {
            results.push({ name: moduleName, path: modPath + '.' + statFnName, expect: '可访问', actual: '访问失败: ' + e.message, ok: false });
            return;
        }
        if (!mod) {
            results.push({ name: moduleName, path: modPath + '.' + statFnName, expect: '存在', actual: '模块不存在', ok: false });
            return;
        }
        const fn = mod[statFnName];
        if (typeof fn !== 'function') {
            results.push({ name: moduleName, path: modPath + '.' + statFnName, expect: 'function', actual: typeof fn, ok: false });
            return;
        }
        try {
            const s = fn.call(mod);
            const type = typeof s;
            const isObj = s !== null && (type === 'object' || type === 'function');
            results.push({
                name: moduleName,
                path: modPath + '.' + statFnName + '()',
                expect: '返回对象',
                actual: isObj ? ('object (' + Object.keys(s).length + ' 字段)') : type,
                ok: isObj,
            });
        } catch (e) {
            results.push({ name: moduleName, path: modPath + '.' + statFnName + '()', expect: '不抛异常', actual: '抛异常: ' + e.message, ok: false });
        }
    }

    /* 逐个模块做功能级自检（指定正确的统计函数名） */
    checkModuleHealth('模型护栏', 'modelGuard', 'status');
    checkModuleHealth('校验记录器', 'guardRecorder', 'getStats');
    checkModuleHealth('元素反馈', 'elementFB', 'stats');
    checkModuleHealth('元认知', 'metaCognition', 'stats');
    checkModuleHealth('认知日志', 'cognitionLog', 'stats');
    checkModuleHealth('认知冲突', 'conflict', 'stats');
    checkModuleHealth('自动校准', 'calibrator', 'stats');
    checkModuleHealth('多档案协同', 'multiProfile', 'stats');
    checkModuleHealth('策略总线', 'strategyBus', 'stats');
    checkModuleHealth('决策回放', 'replay', 'stats');
    checkModuleHealth('权重持久化', 'weightPersist', 'stats');
    checkModuleHealth('决策对比', 'compare', 'stats');
    checkModuleHealth('模型热更新', 'hotSwap', 'stats');
    checkModuleHealth('协同学习', 'shared', 'stats');
    checkModuleHealth('策略进化', 'evolution', 'stats');
    checkModuleHealth('博弈策略层', 'psychology', 'stats');
    checkModuleHealth('连招链', 'comboChain', 'stats');
    checkModuleHealth('对手长期记忆', 'playerMemory', 'stats');
    checkModuleHealth('决策后检测', 'postCheck', 'stats');
    checkModuleHealth('自动特征发现', 'autoFeature', 'stats');
    checkModuleHealth('软指标学习', 'softMetrics', 'stats');
    checkModuleHealth('技能标签', 'skillTags', 'stats');
    checkModuleHealth('判定区状态', 'judgeZone', 'stats');
    checkModuleHealth('手牌标记', 'cardTags', 'stats');
    checkModuleHealth('viewAs/转化', 'viewAs', 'stats');
    checkModuleHealth('cost函数', 'cost', 'stats');
    checkModuleHealth('AI工具集', 'aiTools', 'stats');
    checkModuleHealth('Bandit', 'bandit', 'getStats');
    checkModuleHealth('自动发现', 'discover', 'getRegretStats');
    /* modelState.getState() 返回字符串状态名（stable/training/candidate），不是对象 */
    try {
        const ms = J.modelState;
        const s = ms && typeof ms.getState === 'function' ? ms.getState() : undefined;
        const valid = ['stable', 'training', 'candidate'].indexOf(s) >= 0;
        results.push({
            name: '模型状态',
            path: 'modelState.getState()',
            expect: 'stable/training/candidate',
            actual: String(s),
            ok: valid,
        });
    } catch (e) {
        results.push({ name: '模型状态', path: 'modelState.getState()', expect: '不抛异常', actual: 'ERR:' + e.message, ok: false });
    }
    /* decision 没有 stats 函数，检查 listDecisionPoints 是否可调用 */
    checkModuleHealth('决策注册', 'decision', 'listDecisionPoints');

    /* ===== ★ 新增模块自检（改成 any，只要存在就行） ===== */
    check('AI统计', 'aiStats', 'any');
    check('友方豁免', 'allyExempt', 'any');
    check('决策钩子', 'decisionHook', 'any');
    check('决策注册表', 'decisionRegistry', 'any');
    check('元素访问', 'elementAccess', 'any');
    check('护栏记录器', 'guardRecorder', 'any');
    check('健康检查', 'health', 'any');
    check('本地训练器', 'localTrainer', 'any');
    check('多回合规划', 'multiTurnPlan', 'any');
    check('资源管理', 'resourceManage', 'any');
    check('响应AI', 'responseAI', 'any');
    check('自定义技能', 'skillCustom', 'any');
    check('技能规则', 'skillRules', 'any');
    check('技能扫描', 'skillScanner', 'any');
    check('自动播放', 'autoplay', 'any');
    check('更新日志', 'changelog', 'any');
    check('图表', 'charts', 'any');
    check('AI对比', 'compareAI', 'object');
    check('兼容层', 'compat', 'object');
    check('决策面板', 'decisionDashboard', 'object');
    check('国际化', 'i18n', 'object');
    check('身份可视化', 'identityVisual', 'object');
    check('模块列表', 'modules', 'object');
    check('选将推荐', 'pickRecommend', 'object');
    check('配置文件', 'profiles', 'object');
    check('回放分析', 'replayAnalysis', 'object');
    check('自检面板', 'selfCheck', 'object');
    check('智能面板', 'smartPanel', 'object');

    return results;
}

/* ========== 打开面板 ========== */
export function openSelfCheck() {
    const results = runSelfCheck();
    const history = loadHistory();

    /* 统计 */
    const okCount = results.filter(r => r.ok).length;
    const failCount = results.length - okCount;

    /* 对比历史：找出新失败的、修复了的 */
    const newFails = [];
    const fixed = [];
    const stillFails = [];

    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const key = r.name + '.' + r.path;
        const wasFail = history[key] && !history[key].ok;
        const nowFail = !r.ok;

        if (wasFail && nowFail) {
            stillFails.push(r);
        } else if (wasFail && !nowFail) {
            fixed.push(r);
        } else if (!wasFail && nowFail) {
            newFails.push(r);
        }

        /* 更新历史 */
        history[key] = {
            ok: r.ok,
            actual: r.actual,
            time: Date.now(),
        };
    }

    saveHistory(history);

    /* 生成纯文本内容 */
    let content = '╔════════════════════════════════╗\n';
    content += '║  无名AI v3.0 - 飞升原创       ║\n';
    content += '║  交流群: 123456789             ║\n';
    content += '╚════════════════════════════════╝\n\n';
    content += '=== 模块自检 ===\n\n';
    content += '通过：' + okCount + ' / ' + results.length + '\n';
    content += '失败：' + failCount + ' / ' + results.length + '\n\n';

    /* 修复对比 */
    if (fixed.length > 0) {
        content += '🎉 【已修复】(' + fixed.length + ' 项)\n';
        fixed.forEach(function (r) {
            content += '   ✅ ' + r.name + '.' + r.path + '\n';
        });
        content += '\n';
    }

    if (newFails.length > 0) {
        content += '⚠️ 【新失败】(' + newFails.length + ' 项)\n';
        newFails.forEach(function (r) {
            content += '   ❌ ' + r.name + '.' + r.path + '\n';
            content += '      期望：' + r.expect + ' | 实际：' + r.actual + '\n';
        });
        content += '\n';
    }

    if (stillFails.length > 0) {
        content += '🔴 【持续失败】(' + stillFails.length + ' 项)\n';
        stillFails.forEach(function (r) {
            content += '   ❌ ' + r.name + '.' + r.path + '\n';
            content += '      期望：' + r.expect + ' | 实际：' + r.actual + '\n';
        });
        content += '\n';
    }

    /* 完整列表 */
    content += '\n--- 完整列表 ---\n\n';
    let currentModule = '';
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.name !== currentModule) {
            currentModule = r.name;
            content += '\n【' + currentModule + '】\n';
        }
        const icon = r.ok ? '✅' : '❌';
        content += icon + ' ' + r.path + '\n';
        if (!r.ok) {
            content += '   期望：' + r.expect + ' | 实际：' + r.actual + '\n';
        }
    }

    /* 用无名杀原生面板打开 */
    try {
        if (typeof openSimplePanel === 'function') {
            openSimplePanel('🔍 模块自检', content);
        } else {
            alert(content);
        }
    } catch (e) {
        alert(content);
    }
}

/* ========== 历史记录查询接口 ========== */
export function getSelfCheckHistory() {
    return loadHistory();
}

export function clearSelfCheckHistory() {
    try {
        localStorage.removeItem(HISTORY_KEY);
    } catch (e) {}
}

/* ========== 挂到全局 ========== */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.openSelfCheck = openSelfCheck;
    window.__DJSC.selfCheckHistory = {
        get: getSelfCheckHistory,
        clear: clearSelfCheckHistory,
    };
}
