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
