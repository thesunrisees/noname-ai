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
            const ok = (type === 'any') ? (val !== undefined && val !== null) : (actual === type);
            results.push({ name: name, path: path, expect: type, actual: actual, ok: ok });
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
    check('全局扫描', 'scan', 'object');
    check('全局扫描', 'scan.install', 'function');
    check('全局扫描', 'scan.autoRegister', 'function');
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
    let content = '=== 模块自检 ===\n\n';
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
