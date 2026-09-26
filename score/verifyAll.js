/*
 * ============================================
 * // 作者: 飞升原创  交流群: 123456789
 * v3.0 验证指令·全量自检
 * 整合 面板/核心命令/暴露模块/配置开关 一键在游戏内验证
 * 打开方式：控制台执行  window.__DJSC.verifyAll()
 * ============================================
 */

/* 期望的 23 个面板打开指令 */
const PANEL_KEYS = [
    'openScorePanel', 'openScoreDetailPanel', 'openPlanPanel', 'openFeedbackPanel',
    'openArchivePanel', 'openRecommendPanel', 'openSmartPanel', 'openSkillPanel',
    'openSkillBreakdownPanel', 'openSkillCustomPanel', 'openOverridePanel',
    'openMemoryPanel', 'openHealthPanel', 'openConfigPanel', 'openBrainDashboard',
    'openCalibratorPanel', 'openComparePanel', 'openDecisionDashboard',
    'openExportPanel', 'openGuardPanel', 'openProfilerPanel', 'openReplayPanel',
    'openSelfCheck'
];

/* 希望存在的核心命令 */
const CMD_KEYS = [
    'predict', 'confidence', 'weightsReady', 'cfg', 'trainBufferSize', 'trainStats',
    'trainExport', 'trainImport', 'trainBufferClear', 'getMeta', 'reloadWeights',
    'seatPressure', 'cardValueOf', 'enemiesOf', 'isEnemyOf', 'situationFactor',
    'targetScore', 'forecastSummary', 'maxBurstThreat', 'probHasShan', 'probHasTao',
    'probHasWuxie', 'probHasSha', 'probHasJiu', 'inferHand'
];

/* 应暴露为对象/可自检的模块 */
const MODULE_KEYS = [
    'elementFB', 'metaCognition', 'cognitionLog', 'conflict', 'calibrator',
    'multiProfile', 'strategyBus', 'replay', 'weightPersist', 'compare', 'hotSwap',
    'shared', 'evolution', 'psychology', 'comboChain', 'playerMemory', 'postCheck',
    'autoFeature', 'softMetrics', 'skillTags', 'judgeZone', 'cardTags', 'viewAs',
    'cost', 'aiTools', 'identity', 'learningOptimizer', 'decision', 'bandit',
    'discover', 'modelState', 'strategist', 'localTrainer', 'guardRecorder',
    'health', 'decisionHook', 'decisionRegistry', 'responseAI', 'replayAnalysis',
    'profiles', 'skillCustom', 'compat', 'pickRecommend', 'smartPanel',
    'decisionDashboard', 'autoplay', 'changelog', 'charts', 'compareAI',
    'modelGuard', 'modules', 'selfCheck'
];

/* 主要配置开关 */
const CONFIG_KEYS = [
    'decisionScore', 'decisionFeedback', 'responseAI', 'broadcastAI', 'compareAI',
    'adaptiveDifficulty', 'enablePlanner', 'psychologyLayer', 'comboChain', 'narrator',
    'profiler', 'hardOverride', 'override_use', 'override_respond', 'override_discard',
    'override_compare', 'crossGameMemory', 'skillFeedback', 'styleFeedback',
    'playerMemory', 'showReport', 'archiveGames', 'showLog', 'persist',
    'deckAwareness', 'deckConsumeAllPlayers', 'useTrainedModel', 'useResidual', 'aiStrength',
    'learningRate', 'forceTrain',
    'showSampleCount', 'clearSamples', 'showModelStatus', 'autoFixModel',
    'autoIdentityMatch'
];

/* 各模块常见的自检函数名候选 */
const STAT_FNS = ['stats', 'getStats', 'status', 'getMeta'];

function _safe(fn, label) {
    try { return { ok: true, val: fn() }; }
    catch (e) { return { ok: false, err: String(e && e.message || e), label: label }; }
}

export function verifyAll() {
    const D = window.__DJSC || {};
    const out = [];
    let ok = 0, fail = 0;

    function rec(cat, name, pass, detail) {
        out.push({ cat: cat, name: name, pass: pass ? '✅' : '❌', detail: detail || '' });
        pass ? ok++ : fail++;
    }

    /* 1. 面板 */
    PANEL_KEYS.forEach(function (k) {
        rec('面板', k, typeof D[k] === 'function', typeof D[k] === 'function' ? '已挂载' : '缺失');
    });

    /* 2. 核心命令 */
    CMD_KEYS.forEach(function (k) {
        rec('命令', k, typeof D[k] === 'function', typeof D[k] === 'function' ? '可调用' : '缺失');
    });

    /* 2.5 前向传播健全性：forward 不得因内部错误抛错返回 null（防残差/几何 bug → 准确率恒0） */
    import('./weights.js').then(function (m) {
        const fwd = (m && typeof m.forward === 'function') ? m.forward : null;
        if (fwd) {
            try {
                const probe = new Array(130).fill(0);
                const r = fwd(probe);
                rec('模型', 'forward 前向传播', Array.isArray(r) && r.length === 6, Array.isArray(r) ? '输出6维' : '返回异常(null/抛错)');
            } catch (e) {
                rec('模型', 'forward 前向传播', false, String(e));
            }
        } else {
            rec('模型', 'forward 前向传播', false, 'weights.forward 未就绪');
        }
    }).catch(function (e) {
        rec('模型', 'forward 前向传播', false, '加载失败 ' + String(e));
    });

    /* 3. 模块 + 子自检调用 */
    MODULE_KEYS.forEach(function (k) {
        const m = D[k];
        if (!m || typeof m !== 'object') { rec('模块', k, false, '未挂载'); return; }
        let okk = m._real === true ? true : (Object.keys(m).length > 0);
        let note = '已挂载';
        /* 尝试调用一个自检函数 */
        for (const fn of STAT_FNS) {
            if (typeof m[fn] === 'function') {
                const r = _safe(function () { return m[fn](); }, k + '.' + fn);
                note += '; ' + fn + '()=' + (r.ok ? '正常' : '异常:' + r.err);
                if (!r.ok) okk = false;
                break;
            }
        }
        rec('模块', k, okk, note);
    });

    /* 4. 配置开关（读默认值验证存在） */
    CONFIG_KEYS.forEach(function (k) {
        let pass = false, detail = '缺失';
        if (typeof D.cfg === 'function') {
            try { D.cfg(k, undefined); pass = true; detail = '可读'; } catch (e) { detail = '读取异常:' + e.message; }
        }
        rec('配置', k, pass, detail);
    });

    /* 5. 训练数据/模型就绪 */
    const bs = _safe(function () { return D.trainBufferSize ? D.trainBufferSize() : -1; });
    rec('数据', 'trainBufferSize', bs.ok, bs.ok ? bs.val + ' 条样本' : '异常:' + bs.err);
    const wr = _safe(function () { return D.weightsReady ? D.weightsReady() : -1; });
    rec('模型', 'weightsReady', wr.ok, wr.ok ? String(wr.val) : '异常:' + wr.err);

    /* 生成报告 */
    const total = out.length;
    const lines = out.map(function (r) {
        return r.pass + ' [' + r.cat + '] ' + r.name + ' — ' + r.detail;
    });
    const summary = '✅通过 ' + ok + '  ❌失败 ' + fail + '  共 ' + total + ' 项';

    let html = '<div style="font:12px/1.7 sans-serif;color:#dfeaf5;background:#0f1b28;padding:12px;max-height:78vh;overflow:auto;">'
        + '<b style="color:#00ffb0">无名AI 全量自检</b><br>' + summary
        + '<br><span style="color:#7fd4ff">' + (ok === total ? '🎉 全部通过，引擎就绪' : '⚠️ 有 ' + fail + ' 项未通过') + '</span>'
        + '<hr>' + lines.map(function (l) { return '<div>' + l + '</div>'; }).join('')
        + '</div>';

    /* 面板展示 */
    try {
        const bgs = ui && ui.create && ui.create.div ? ui.create.div('', _status.window) : null;
        const mask = document.createElement('div');
        mask.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);overflow:auto;';
        const box = document.createElement('div');
        box.style.cssText = 'width:92%;max-width:760px;margin:6vh auto;';
        box.innerHTML = html + '<div style="text-align:center;padding:8px"><a style="color:#7fd4ff;cursor:pointer" onclick="this.parentElement.parentElement.parentElement.remove()">[关闭]</a></div>';
        mask.appendChild(box);
        (document.body || document.documentElement).appendChild(mask);
    } catch (e) {
        try { game.log('⚠️ 自检：' + summary); } catch (e2) {}
    }
    try { console.log('[无名AI 自检] ' + summary + '\n' + lines.join('\n')); } catch (e) {}

    return { total: total, ok: ok, fail: fail, summary: summary, report: out };
}

/* 挂载到全局总线：verifyAll / verifyAllQuick 同一处一次挂好。
 * verifyAll 入口查找不到的常见原因——旧扩展缓存/侧载路径未重载；
 * 因此把 quick 也做成 verifyAll 的属性，只要 verifyAll 在，quick 必然在。 */
try {
    window.__DJSC = window.__DJSC || {};
    const _quick = function () {
        const r = (typeof verifyAll === 'function') ? verifyAll() : window.__DJSC.verifyAll();
        try { window.__DJSC.health && window.__DJSC.health.check && window.__DJSC.health.check(); } catch (e) {}
        try { window.__DJSC.selfCheck && window.__DJSC.selfCheck.run && window.__DJSC.selfCheck.run(); } catch (e) {}
        return r;
    };
    window.__DJSC.verifyAll = verifyAll;
    window.__DJSC.verifyAllQuick = _quick;
    verifyAll.quick = _quick;   /* 属性备份，防挂名不一致 */
} catch (e) {}