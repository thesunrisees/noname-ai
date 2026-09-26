/*
 * ============================================
 * // Wydawca: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 多语言兜底 ================= */
import { lib } from '../../../noname.js';

const LANG_PACKS = {
	zh: {
		"panel.title": "决策积分引擎 · 全模式积分+策略",
// Автор: Фэйшэн Оригинал | Лицензия: GPL-3.0
		"panel.expand": "全部展开",
		"panel.collapse": "全部折叠",
		"panel.search": "搜索段落（编号或关键词）",
		"panel.onlyClose": "只看胶着",
		"panel.clearArchive": "清空归档",
		"panel.resetFeedback": "重置反馈",
		"panel.report": "结算战报",
		"panel.detail": "详情",
		"panel.close": "关闭",
		"panel.export": "导出全部归档 JSON",
		"personality.aggression": "攻守",
		"personality.risk": "冒险",
		"personality.team": "团队",
		"personality.template": "模板市场",
		"personality.custom": "自定义",
		"personality.save": "保存当前三维",
		"personality.manage": "管理",
		"personality.copy": "复制",
		"personality.import": "导入",
		"alert.importOK": "导入成功",
		"alert.importFail": "导入失败",
		"alert.copied": "已复制到剪贴板",
		"alert.reset": "已重置",
		"decision.winner": "胜出",
		"decision.candidates": "候选",
		"decision.crush": "碾压胜出",
		"decision.normal": "正常",
		"decision.close": "五五开",
	},
	en: {
		"panel.title": "Decision Score Engine",
		"panel.expand": "Expand All",
		"panel.collapse": "Collapse All",
		"panel.search": "Search sections...",
		"panel.onlyClose": "Close only",
		"panel.clearArchive": "Clear archive",
		"panel.resetFeedback": "Reset feedback",
		"panel.report": "Battle Report",
		"panel.detail": "Details",
		"panel.close": "Close",
		"panel.export": "Export archive JSON",
		"personality.aggression": "Aggro",
		"personality.risk": "Risk",
		"personality.team": "Team",
		"personality.template": "Templates",
		"personality.custom": "Custom",
		"personality.save": "Save current",
		"personality.manage": "Manage",
		"personality.copy": "Copy",
		"personality.import": "Import",
		"alert.importOK": "Imported",
		"alert.importFail": "Import failed",
		"alert.copied": "Copied to clipboard",
		"alert.reset": "Reset done",
		"decision.winner": "Winner",
		"decision.candidates": "Candidates",
		"decision.crush": "Crush",
		"decision.normal": "Normal",
		"decision.close": "Toss-up",
	},
};

let _lang = null;

function _detectLang() {
	try {
		const cfgLang = lib.config["extension_无名AI_lang"];
		if (typeof cfgLang === "string" && LANG_PACKS[cfgLang]) return cfgLang;
		const sys = (lib.config && lib.config.language) || (lib.config && lib.config.lang);
		if (typeof sys === "string" && LANG_PACKS[sys]) return sys;
		if (typeof sys === "string" && sys.indexOf("en") === 0) return "en";
	} catch (e) {}
	return "zh";
}

export function t(key, fallbackZh) {
	try {
		if (!_lang) _lang = _detectLang();
		const pack = LANG_PACKS[_lang] || LANG_PACKS.zh;
		if (pack && pack[key]) return pack[key];
		return fallbackZh || key;
	} catch (e) { return fallbackZh || key; }
}

export function setLang(lang) {
	try {
		if (LANG_PACKS[lang]) {
			_lang = lang;
			lib.config["extension_无名AI_lang"] = lang;
			return true;
		}
	} catch (e) {}
	return false;
}

export function availableLangs() {
	return Object.keys(LANG_PACKS);
}
