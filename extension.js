
/* ===== 版本号校验（功能层面防盗） ===== */
const _fs_version = '\x33\x2e\x30\x2e\x30';
const _fs_author = '\x98de\x5347\x539f\x521b';

try {
    const decoded_ver = eval(_fs_version.replace(/\\x/g, '0x'));
    const decoded_author = eval(_fs_author.replace(/\\x/g, '0x'));
    console.log('%c[无名AI] 版本: ' + decoded_ver + ' | 作者: ' + decoded_author, 'color: #00d4ff;');
} catch(e) {
    console.warn('[无名AI] 版本校验失败，请确认是官方版本');
}
/* ==================================== */

// ===== 隐藏水印（不影响功能） =====
const __AUTHOR__ = "飞升原创";
const __CONTACT__ = "交流群: 123456789";
const __VERSION__ = "v3.0";
// ====================================
/*
 * ============================================
 * // Wydawca: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ★ 挂载所有23个面板到 window.__DJSC（扩展一加载就挂载好） */
(async function mountAllPanels() {
	try {
		window.__DJSC = window.__DJSC || {};
		
		/* panel.js里的13个面板 */
		const panel = await import('./score/panel.js');
		window.__DJSC.openScorePanel = panel.openScorePanel;
		window.__DJSC.openScoreDetailPanel = panel.openScoreDetailPanel;
		window.__DJSC.openPlanPanel = panel.openPlanPanel;
		window.__DJSC.openFeedbackPanel = panel.openFeedbackPanel;
		window.__DJSC.openArchivePanel = panel.openArchivePanel;
		window.__DJSC.openRecommendPanel = panel.openRecommendPanel;
		window.__DJSC.openConfigPanel = panel.openConfigPanel;
		window.__DJSC.openMemoryPanel = panel.openMemoryPanel;
		window.__DJSC.openSkillPanel = panel.openSkillPanel;
		window.__DJSC.openOverridePanel = panel.openOverridePanel;
		window.__DJSC.openSkillBreakdownPanel = panel.openSkillBreakdownPanel;
		window.__DJSC.openSkillCustomPanel = panel.openSkillCustomPanel;
		window.__DJSC.openHealthPanel = panel.openHealthPanel;
		
		/* 其他文件里的10个面板 */
		try { const m = await import('./score/brainDashboard.js'); window.__DJSC.openBrainDashboard = m.openBrainDashboard; } catch(e) {}
		try { const m = await import('./score/calibratorPanel.js'); window.__DJSC.openCalibratorPanel = m.openCalibratorPanel; } catch(e) {}
		try { const m = await import('./score/comparePanel.js'); window.__DJSC.openComparePanel = m.openComparePanel; } catch(e) {}
		try { const m = await import('./score/decisionDashboard.js'); window.__DJSC.openDecisionDashboard = m.openDecisionDashboard; } catch(e) {}
		try { const m = await import('./score/exportAll.js'); window.__DJSC.openExportPanel = m.openExportPanel; } catch(e) {}
		try { const m = await import('./score/modelGuard.js'); window.__DJSC.openGuardPanel = m.openGuardPanel; } catch(e) {}
		try { const m = await import('./score/profiler.js'); window.__DJSC.openProfilerPanel = m.openProfilerPanel; } catch(e) {}
		try { const m = await import('./score/replayPanel.js'); window.__DJSC.openReplayPanel = m.openReplayPanel; } catch(e) {}
		try { const m = await import('./score/selfCheck.js'); window.__DJSC.openSelfCheck = m.openSelfCheck; } catch(e) {}
		try { const m = await import('./score/smartPanel.js'); window.__DJSC.openSmartPanel = m.openSmartPanel; } catch(e) {}
		
		console.log('%c[无名AI v3.0] ✅ 扩展加载完成！', 'color: #00d4ff; font-weight: bold;');
		console.log('%c作者: 飞升原创 | 交流群: 123456789', 'color: #aaa; font-size: 10px;');
		console.log('%c[无名AI] ✅ 所有23个面板挂载完成！', 'color: #0f0;');

		/* ★ 自动加载内置训练数据 ★ */
		try {
			const trainExport = await import('./score/trainExport.js');
			await trainExport.loadBuiltinData();
			window.__DJSC.loadBuiltinData = trainExport.loadBuiltinData;
		} catch(e) {
			console.warn('[无名AI] 内置数据加载失败:', e);
		}
	} catch(e) {
		console.error('[无名AI] ❌ 面板挂载失败:', e);
	}
})();

/* ===== 目标合理性校验（前置校验，不拦截，仅日志） ===== */
setTimeout(function () {
    try {
        var _p = lib.element.Player.prototype;
        if (_p.__logicCheck) return;
        _p.__logicCheck = true;
        var _o = _p.useCard;
        var TARGET_RESTRICT_CARDS = ['sha','huosha','leisha','juedou','huogong','nanman','wanjian',
                   'zhujin','jiedao','lijian','shunshou','guohe','lebu','bingliang',
                   'tiesuo','fanjian','sidian'];
        _p.useCard = function (card, cards, target) {
            try {
                var me = this;
                var cn = typeof card === 'string' ? card : (card && (card.name || card.cardname));
                if (cn && TARGET_RESTRICT_CARDS.indexOf(cn) >= 0) {
                    var list = Array.isArray(target) ? target : (target ? [target] : []);
                    for (var i = 0; i < list.length; i++) {
                        var t = list[i];
                        if (!t || typeof t !== 'object' || t === me) continue;
                        var myId = me.identity, tid = t.identity;
                        var isSameFaction = false;
                        if (myId === 'zhu' && (tid === 'zhong' || tid === 'mingzhong')) isSameFaction = true;
                        if ((myId === 'zhong' || myId === 'mingzhong') && tid === 'zhu') isSameFaction = true;
                        if ((myId === 'zhong' || myId === 'mingzhong') && (tid === 'zhong' || tid === 'mingzhong')) isSameFaction = true;
                        if (myId === 'fan' && tid === 'fan') isSameFaction = true;
                        try { if (get.attitude(me, t) > 0) isSameFaction = true; } catch (e) {}
                        if (isSameFaction) {
                            var exempt = false;
                            try {
                                if (window.__DJSC && window.__DJSC.checkAllyExempt) {
                                    exempt = window.__DJSC.checkAllyExempt(me, t, cn);
                                }
                            } catch (e) {}
                            if (!exempt) {
                                try { game.log('⚠️ 校验：' + cn + ' 对同阵营目标 ' + (t.name1 || t.name) + ' 不推荐'); } catch (e) {}
                            } else {
                                try { game.log('✅ 豁免：' + cn + ' 对同阵营目标 ' + (t.name1 || t.name) + ' 合理'); } catch (e) {}
                            }
                        }
                    }
                }
            } catch (e) {}
            return _o.apply(me, arguments);
        };
        try { game.log('✅ 目标合理性校验模块已就绪（仅日志，不拦截）'); } catch (e) {}
    } catch (e) {}
}, 3000);

import { lib, game, ui, get, ai, _status } from './js/utils.js';
import { arenaReady } from './js/arenaReady.js';
import { config } from './js/config.js';
import { content } from './js/content.js';
import { precontent } from './js/precontent.js';
import { help } from './js/help.js';
import { installScoreEngine, uninstallScoreEngine, isScoreEngineEnabled } from './score/index.js';

const extensionInfo = await lib.init.promises.json(`${lib.assetURL}extension/无名AI/info.json`);
let extensionPackage = {
	name: '无名AI',
	arenaReady,
	content,
	precontent,
	config,
	help,
	package: {},
	files: {},
	css: ['./css/AIjinjiang.css'],
};
Object.keys(extensionInfo)
	.filter((key) => key !== 'name')
	.forEach((key) => {
		extensionPackage.package[key] = extensionInfo[key];
	});

/* ★ 整合：原 content 钩子后初始化决策积分引擎（可配置开关） */
const _content = extensionPackage.content;
extensionPackage.content = function (config, pack) {
	try { if (typeof _content === 'function') _content(config, pack); } catch (e) {}
	try {
		if (isScoreEngineEnabled()) {
			installScoreEngine();
		}
	} catch (e) {}
};

/* ★ 卸载时清理决策积分引擎 */
const _uninstall = extensionPackage.uninstall;
extensionPackage.uninstall = function () {
	try { uninstallScoreEngine(); } catch (e) {}
	try { if (typeof _uninstall === 'function') _uninstall(); } catch (e) {}
};

/* ★ 挂载校验相关接口到 window.__DJSC（直接内联，避免加载失败） */
window.__DJSC = window.__DJSC || {};

/* ★ 提前挂载训练数据导入/导出（扩展加载时就可用，不用进对局） */
import('./score/trainExport.js').then(function (m) {
    window.__DJSC.trainExport = function() { return m.exportForImport(); };
    window.__DJSC.trainImport = function(jsonStr) { return m.importFromJson(jsonStr); };
    window.__DJSC.trainBufferSize = function() { return m.bufferSize(); };
    console.log('[extension] ✅ trainExport/trainImport 已挂载（提前加载）');
}).catch(function (e) {
    console.warn('[extension] trainExport 加载失败:', e);
});

/* 合法性校验函数（直接内联，不依赖 allyExempt.js） */
window.__DJSC.checkAllyExempt = function (me, target, cardName) {
    try {
        if (!me || !target) return false;

        /* 1. 技能战术判定：目标有卖血技能 */
        const SPECIAL_SKILLS = ['yiji', 'jianxiong', 'fankui', 'gangzhi', 'yongsi', 'juejing', 'guicai', 'buyi', 'xingshang'];
        if (target.getSkills) {
            const skills = target.getSkills();
            for (let i = 0; i < skills.length; i++) {
                if (SPECIAL_SKILLS.indexOf(skills[i]) >= 0) return true;
            }
        }

        /* 2. 送牌收益判定：目标手牌少 */
        const hc = target.countCards ? target.countCards('h') : 0;
        if (hc <= 1) return true;

        /* 3. 残局判定：只剩2人且目标残血 */
        try {
            const alive = (game.players || []).filter(function (p) { return p && p.alive !== false; });
            if (alive.length <= 2 && target.hp <= 1) return true;
        } catch (e) {}

        return false;
    } catch (e) { return false; }
};

/* 校验记录器（动态加载） */
import('./score/guardRecorder.js').then(function (m) {
    window.__DJSC.guardRecorder = {
        record: m.recordGuardEvent,
        getStats: m.getGuardStats,
        reset: m.resetGuardRecorder,
    };
}).catch(function (e) { console.warn('guardRecorder 加载失败:', e); });

export let type = 'extension';
export default extensionPackage;
