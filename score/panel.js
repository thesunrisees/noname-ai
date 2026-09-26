/*
 * ============================================
 * // Éditeur: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 面板+调试桥（整合模块） ================= */
import { lib, game, ui, get, _status } from '../../../noname.js';
import { buildConfigOverview, styleUtilityPanel, openUtilityHtml } from './panelTheme.js';

/* ★ 工具函数：所有显示数字都取整 */
function _int(v) {
// Autore: Feisheng Originale | Licenza: GPL-3.0
    if (v === null || v === undefined || isNaN(v)) return 0;
    return Math.round(Number(v));
}
import { VAL_CARD, VAL_EFFECT, VAL_TIMING, STRATEGY, SKILL_RULE } from './value-tables.js';
import { codeGainOf, scanCharacters, buildAutoSkillRules, charComboOf, advice, detectCombo, clearGainCache, skillTagsOf, aggregateSkillTags, skillProfileOf, skillProfitBreakdown, renderSkillBreakdownText } from './skills.js';
import { renderScoreBreakdown } from './skillRules.js';
import { enemiesOf, isEnemyOf, threatOf, situationFactor, cardValueOf, seatPressure, distancePressure, mountValue, forecastSummary, incomingPressure } from './threat.js';
import { miniPredict } from './mini-model.js';
import { miniFeatures } from './skills.js';
import { getRound, getScoreLog, getREC, resetRound, getMEM, bestAction, modelDecision, isGameOver, getDecisionLog, clearDecisionLog, appendDecision } from './engine.js';
import { trainExportAndDownload, trainClearBuffer, trainStats } from './trainExport.js';
import { cfg } from './util.js';
import { getObs, explainObs, relationOf, observedStance, hostilityOf, friendlinessOf, styleOf } from './observer.js';
import { identityOf, confidenceOf, beliefOf, explainIdentity, updateBelief, currentMode } from './identity.js';
import { teamPlan } from './team.js';
import { resourceBalance, sellHpValue, equipStripRisk } from './economy.js';
import { storeStats, resetStore, importStore, clearStore, exportStore } from './memory.js';
import { overrideStatus, getOverrideStats, resetOverrideStats } from './override/index.js';
import { showReport, buildReportHtml } from './report.js';
import { getArchive, archiveStats, clearArchive, fmtTime, getGameDecisions, exportArchiveJson, fullArchiveStats } from './archive.js';
import { exportAll, exportAllJson, exporters, downloadFile, exportAllFile, exportModuleFile, exportBatchFiles, downloadTextFile } from './export.js';
import { exportPersonality, importPersonality, copyToClipboard } from './share.js';
import { getFeedbackStats, resetFeedback, feedbackCount } from './feedback.js';
import { deckAutoDetect, deckSetMode, deckGetMode, totalRemaining, suitRemaining, cardRemaining, deckSnapshot, deckInitialCounts, deckAvailableModes } from './deckMemory.js';
import { lebuEscapeRate, bingliangEscapeRate, shandianHitRate, baguaSuccessRate, expectDrawValue } from './deckPredict.js';
import { getTagConf, resetStyleFeedback } from './styleFeedback.js';
import { multiTurnForecast } from './multiturn.js';
import { PERSONALITY_TEMPLATES, findTemplate, listCustomTemplates, saveCustomTemplate, deleteCustomTemplate, allTemplates, findTemplateAll } from './templates.js';
import { lineChart, barChart, radarChart, donutChart } from './charts.js';
import { aggregateByPlayer, buildComparisonHtml } from './aiStats.js';
import { t, setLang, availableLangs } from './i18n.js';
import { startAutoplay, stopAutoplay, autoplayStatus, showAutoplayReport, initAutoplayMonitor, startBatchAutoplay, stopBatchAutoplay, batchStatus, showBatchReport } from './autoplay.js';
import { exportDecisionsJson, exportDecisionsMarkdown, parseDecisionsJson, showImportedDecisions } from './report.js';
import { importArchiveJson } from './archive.js';
import { getPlayerMemoryStats, resetPlayerMemory } from './styleFeedback.js';
import { skillBranchesOf, checkBranch, skillStagesOf, skillInteractionOf } from './skills.js';
import { listProfiles, saveProfile, loadProfile, deleteProfile, renameProfile, exportProfilesJson, importProfilesJson, resetProfiles, profileCount, buildSnapshot, applySnapshot } from './profiles.js';
import { getLogLevel, setLogLevel } from './logger.js';
import { selfCheck } from './compat.js';
import { getDecisionFeedbackStats, resetDecisionFeedback } from './decisionFeedback.js';
import { perfStats, perfHistory, perfReset } from './perf.js';
import { openSmartPanel } from './smartPanel.js';
import { listRecommends, applyRecommend, snapshotCurrent } from './recommend.js';
import { healthCheck } from './health.js';
import { recentExplains } from './explain.js';
import { adaptiveStatus } from './adaptive.js';
import { recommendChars } from './pickRecommend.js';
import { planSequence } from './planner.js';
import {
	buildStrategistHtml,
	getStats as getStrategistStats,
	setEnabled as setStrategistEnabled,
	clearAudit as clearStrategistAudit,
	resetStats as resetStrategistStats,
	getAuditLog as getStrategistAuditLog,
	getLastDecision as getStrategistLast,
} from './strategist.js';
import { resetCircuit } from './override/index.js';

/* ================= 面板 ================= */
function probBarHtml(probs, labels) {
	let h = "";
	for (let i = 0; i < probs.length; i++) {
		const pct = Math.round(probs[i] * 100);
		h += "<div style='display:flex;align-items:center;margin:3px 0;'>"
			+ "<span style='width:70px;font-size:12px;color:#9ad8ff;'>" + labels[i] + "</span>"
			+ "<div style='flex:1;height:16px;background:#14243c;border-radius:4px;overflow:hidden;'>"
			+ "<div style='width:" + pct + "%;height:100%;background:" + (pct >= 25 ? "#7fe3a0" : (pct >= 15 ? "#ffd479" : "#5a7aa8")) + ";border-radius:4px;'></div></div>"
			+ "<span style='width:42px;text-align:right;font-size:12px;color:#e8f2ff;'>" + pct + "%</span></div>";
	}
	return h;
}

/* ================= 面板交互化（折叠 / 搜索 / 批量控制） ================= */
const DJSC_SEC_RE = /<b>((?:[①-⑬]|⑧[a-z0-9]*)\s+[^<]{1,60})<\/b>/g;

function wrapSections(html) {
	try {
		const matches = [];
		let m;
		DJSC_SEC_RE.lastIndex = 0;
		while ((m = DJSC_SEC_RE.exec(html))) {
			matches.push({ title: m[1], start: m.index, end: m.index + m[0].length });
		}
		if (!matches.length) return html;
		let result = html.slice(0, matches[0].start);
		for (let i = 0; i < matches.length; i++) {
			const cur = matches[i];
			const next = matches[i + 1];
			const bodyEnd = next ? next.start : html.length;
			const body = html.slice(cur.end, bodyEnd);
			const safeTitle = cur.title.replace(/'/g, "&#39;");
			const dataKey = cur.title.replace(/[^\w\u4e00-\u9fa5]/g, "_");
			result +=
				"<div class='djsc-sec' data-t='" + safeTitle + "' data-key='" + dataKey + "'>" +
				"<div class='djsc-hd' data-c='0'>▼ " + cur.title + "</div>" +
				"<div class='djsc-bd'>" + body + "</div>" +
				"</div>";
		}
		return result;
	} catch (e) { return html; }
}

function bindPanelInteractions(d) {
	try {
		d.querySelectorAll(".djsc-hd").forEach(function (hd) {
			hd.style.cssText = "cursor:pointer;user-select:none;padding:4px 0;border-top:1px solid #2a3a52;margin-top:8px;color:#9ad8ff;";
			const sec = hd.parentNode;
			const key = sec.getAttribute("data-key");
			try {
				const saved = key && localStorage.getItem("无名AI_panelCollapse_" + key);
				if (saved === "1") {
					const bd = sec.querySelector(".djsc-bd");
					if (bd) bd.style.display = "none";
					hd.setAttribute("data-c", "1");
					hd.textContent = "▶ " + hd.getAttribute("data-t");
				}
			} catch (e) {}
			hd.addEventListener("click", function () {
				const bd = sec.querySelector(".djsc-bd");
				const collapsed = hd.getAttribute("data-c") === "1";
				if (bd) bd.style.display = collapsed ? "" : "none";
				hd.setAttribute("data-c", collapsed ? "0" : "1");
				hd.textContent = (collapsed ? "▼ " : "▶ ") + hd.getAttribute("data-t");
				try { if (key) localStorage.setItem("无名AI_panelCollapse_" + key, collapsed ? "0" : "1"); } catch (e) {}
			});
		});

		/* ★ 手机检测 */
		const _isMobile = (function () {
			try {
				if (lib.config.touchscreen) return true;
				if (window.innerWidth <= 768) return true;
				if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return true;
			} catch (e) {}
			return false;
		})();

		const tb = document.createElement("div");
		/* ★ 手机端：工具栏换行 + 按钮变大 */
		tb.style.cssText = _isMobile
			? "position:sticky;top:0;z-index:100;background:#1a2637;padding:8px 8px;" +
			  "border-bottom:2px solid #2a3a52;margin-bottom:10px;" +
			  "display:flex;gap:8px;align-items:center;flex-wrap:wrap;" +
			  "box-shadow:0 2px 8px rgba(0,0,0,0.4);"
			: "position:sticky;top:0;z-index:10;background:#1a2637;padding:6px 8px;" +
			  "border-bottom:1px solid #2a3a52;margin-bottom:8px;" +
			  "display:flex;gap:6px;align-items:center;flex-wrap:wrap;";
		tb.innerHTML =
			"<button class='djsc-btn' data-act='expand'>全部展开</button>" +
			"<button class='djsc-btn' data-act='collapse'>全部折叠</button>" +
			"<input class='djsc-search' type='text' placeholder='搜索段落' " +
			"style='flex:1;min-width:100px;padding:" + (_isMobile ? "6px 10px;font-size:13px;" : "4px 8px;font-size:11px;") + "border-radius:4px;" +
			"border:1px solid #2a3a52;background:#0d1622;color:#dbe7f5;outline:none;' />" +
			"<span class='djsc-count' style='color:#666;font-size:11px;'></span>";
		d.insertBefore(tb, d.firstChild);

		tb.querySelectorAll(".djsc-btn").forEach(function (btn) {
			btn.style.cssText = _isMobile
				? "padding:6px 14px;border-radius:6px;border:1px solid #2a3a52;" +
				  "background:#14243c;color:#dbe7f5;cursor:pointer;font-size:13px;" +
				  "min-height:32px;touch-action:manipulation;"
				: "padding:3px 10px;border-radius:4px;border:1px solid #2a3a52;" +
				  "background:#14243c;color:#dbe7f5;cursor:pointer;font-size:11px;";
			btn.addEventListener("click", function () {
				const collapse = btn.getAttribute("data-act") === "collapse";
				d.querySelectorAll(".djsc-sec").forEach(function (sec) {
					const hd = sec.querySelector(".djsc-hd");
					const bd = sec.querySelector(".djsc-bd");
					if (hd && bd) {
						bd.style.display = collapse ? "none" : "";
						hd.setAttribute("data-c", collapse ? "1" : "0");
						hd.textContent = (collapse ? "▶ " : "▼ ") + hd.getAttribute("data-t");
					}
				});
			});
		});

		const searchInput = tb.querySelector(".djsc-search");
		const countEl = tb.querySelector(".djsc-count");
		searchInput.addEventListener("input", function () {
			const kw = searchInput.value.trim().toLowerCase();
			let shown = 0, total = 0;
			d.querySelectorAll(".djsc-sec").forEach(function (sec) {
				total++;
				const text = (sec.textContent || "").toLowerCase();
				const title = (sec.getAttribute("data-t") || "").toLowerCase();
				const hit = !kw || text.indexOf(kw) >= 0 || title.indexOf(kw) >= 0;
				sec.style.display = hit ? "" : "none";
				if (hit) shown++;
			});
			countEl.textContent = kw ? ("匹配 " + shown + "/" + total) : "";
		});

		/* 只看胶着（评分差 ≤0.8） */
		const replayCards = d.querySelectorAll(".djsc-replay-card");
		if (replayCards.length) {
			const filterBtn = document.createElement("button");
			filterBtn.className = "djsc-btn";
			filterBtn.textContent = "只看胶着";
			filterBtn.style.cssText =
				"padding:3px 10px;border-radius:4px;border:1px solid #2a3a52;" +
				"background:#14243c;color:#ffd479;cursor:pointer;font-size:11px;";
			let onlyClose = false;
			filterBtn.addEventListener("click", function () {
				onlyClose = !onlyClose;
				filterBtn.textContent = onlyClose ? "显示全部" : "只看胶着";
				filterBtn.style.color = onlyClose ? "#7fe3a0" : "#ffd479";
				replayCards.forEach(function (c) {
					const gap = parseFloat(c.getAttribute("data-gap")) || 0;
					c.style.display = (onlyClose && gap > 0.8) ? "none" : "";
				});
			});
			tb.appendChild(filterBtn);
		}

		/* 清空归档按钮 */
		try {
			if (getArchive().length) {
				const clearBtn = document.createElement("button");
				clearBtn.className = "djsc-btn";
				clearBtn.textContent = "清空归档";
				clearBtn.style.cssText = "padding:3px 10px;border-radius:4px;border:1px solid #2a3a52;background:#14243c;color:#ff9c9c;cursor:pointer;font-size:11px;";
				clearBtn.addEventListener("click", function () {
					if (confirm("确定清空所有战报归档？此操作不可撤销。")) {
						clearArchive();
						alert("归档已清空");
					}
				});
				tb.appendChild(clearBtn);
			}
		} catch (e) {}

		/* ★ 数据导出按钮（全量 + 分项） */
		try {
			const exportBtn = document.createElement("button");
			exportBtn.className = "djsc-btn";
			exportBtn.textContent = "导出数据";
			exportBtn.style.cssText = _isMobile
				? "padding:6px 14px;border-radius:6px;border:1px solid #2a3a52;background:#14243c;color:#ffd479;cursor:pointer;font-size:13px;min-height:32px;touch-action:manipulation;"
				: "padding:3px 10px;border-radius:4px;border:1px solid #2a3a52;background:#14243c;color:#ffd479;cursor:pointer;font-size:11px;";
			exportBtn.addEventListener("click", function () {
				_showExportMenu();
			});
			tb.appendChild(exportBtn);
		} catch (e) {}

		/* ★ 一键下载全量 JSON */
		try {
			const jsonBtn = document.createElement("button");
			jsonBtn.className = "djsc-btn";
			jsonBtn.textContent = "下载JSON";
			jsonBtn.style.cssText = _isMobile
				? "padding:6px 14px;border-radius:6px;border:1px solid #2a3a52;background:#14243c;color:#7fe3a0;cursor:pointer;font-size:13px;min-height:32px;touch-action:manipulation;"
				: "padding:3px 10px;border-radius:4px;border:1px solid #2a3a52;background:#14243c;color:#7fe3a0;cursor:pointer;font-size:11px;";
			jsonBtn.addEventListener("click", function () {
				const ok = exportAllFile(true);
				if (ok) {
					try { if (game && game.log) game.log('【决策积分】已导出全量数据文件'); } catch (e) {}
				} else {
					/* 下载失败 → 回退到复制 */
					try {
						const json = exportAllJson(true);
						if (typeof game.copy === "function") {
							game.copy(json, "下载失败，已复制到剪贴板（" + Math.round(json.length / 1024) + " KB）", "复制失败");
						} else {
							alert("下载失败，数据长度 " + json.length + " 字符");
						}
					} catch (e2) { alert("导出失败：" + e2.message); }
				}
			});
			tb.appendChild(jsonBtn);
		} catch (e) {}

		/* 分享字符串：复制 / 导入 */
		try {
			d.querySelectorAll(".djsc-btn[data-act='copy-share']").forEach(function (btn) {
				btn.addEventListener("click", function () {
					const s = exportPersonality();
					if (s) copyToClipboard(s);
					else alert("导出失败");
				});
			});
			d.querySelectorAll(".djsc-btn[data-act='paste-share']").forEach(function (btn) {
				btn.addEventListener("click", function () {
					const s = prompt("粘贴性格分享字符串（形如 DJSC1:...）", "");
					if (!s) return;
					const r = importPersonality(s);
					if (r.ok) {
						alert("导入成功！\n预设：" + r.data.preset + "\n攻守 / 冒险 / 团队：" + r.data.agg + " / " + r.data.rsk + " / " + r.data.tea + "\n\n请重新打开面板查看更新后的配置。");
					} else {
						alert("导入失败：" + r.err);
					}
				});
			});
		} catch (e) {}

		/* 模板市场：一键应用 */
		try {
			const sel = d.querySelector(".djsc-btn[data-act='apply-template']");
			if (sel) {
				sel.addEventListener("change", function () {
					const key = sel.value;
					if (!key) return;
					const t = findTemplateAll(key);
					if (!t) return;
					if (!confirm("应用模板【" + t.name + "】？\n" + t.desc + "\n\n攻守/冒险/团队 = " + t.agg + "/" + t.rsk + "/" + t.tea)) return;
					try {
						lib.config["extension_无名AI_riskProfile"] = "custom";
						lib.config["extension_无名AI_personalityAggression"] = t.agg;
						lib.config["extension_无名AI_personalityRisk"] = t.rsk;
						lib.config["extension_无名AI_personalityTeam"] = t.tea;
						game.saveConfig("extension_无名AI_riskProfile", "custom");
						game.saveConfig("extension_无名AI_personalityAggression", t.agg);
						game.saveConfig("extension_无名AI_personalityRisk", t.rsk);
						game.saveConfig("extension_无名AI_personalityTeam", t.tea);
						alert("模板【" + t.name + "】已应用！\n请重新打开面板查看更新后的三维。");
					} catch (e) { alert("应用失败：" + e); }
				});
			}
		} catch (e) {}

		/* 归档详情：点击弹出该局的历史决策回放 */
		try {
			d.querySelectorAll(".djsc-archive-detail").forEach(function (btn) {
				btn.addEventListener("click", function (ev) {
					ev.stopPropagation();
					const idx = parseInt(btn.getAttribute("data-idx"), 10);
					if (isNaN(idx) || idx < 0) return;
					_openArchiveDetail(idx);
				});
			});
		} catch (e) {}

		/* 自定义模板：保存 / 管理 */
		try {
			const saveBtn = d.querySelector(".djsc-btn[data-act='tpl-save']");
			if (saveBtn) {
				saveBtn.addEventListener("click", function () {
					const nameInput = d.querySelector(".djsc-btn[data-act='tpl-name']");
					const name = nameInput ? nameInput.value.trim() : "";
					if (!name) { alert("请先输入模板名"); return; }
					const cur = (function () {
						try {
							const P = lib.config["extension_无名AI_riskProfile"] || "custom";
							if (P !== "custom") {
								const tp = PERSONALITY_TEMPLATES.find(function (x) { return x.key === P; });
								if (tp) return { agg: tp.agg, rsk: tp.rsk, tea: tp.tea };
							}
							return {
								agg: Number(lib.config["extension_无名AI_personalityAggression"]) || 50,
								rsk: Number(lib.config["extension_无名AI_personalityRisk"]) || 50,
								tea: Number(lib.config["extension_无名AI_personalityTeam"]) || 50,
							};
						} catch (e) { return { agg: 50, rsk: 50, tea: 50 }; }
					})();
					const r = saveCustomTemplate(name, "自定义 " + cur.agg + "/" + cur.rsk + "/" + cur.tea, cur.agg, cur.rsk, cur.tea);
					if (r.ok) alert("已保存：【" + r.template.name + "】\n重开面板后可在模板市场中选择。");
					else alert("保存失败：" + r.err);
				});
			}
			const manageBtn = d.querySelector(".djsc-btn[data-act='tpl-manage']");
			if (manageBtn) {
				manageBtn.addEventListener("click", function () {
					const list = listCustomTemplates();
					if (!list.length) { alert("暂无自定义模板"); return; }
					const lines = list.map(function (tp, i) { return (i + 1) + ". " + tp.name + "（" + tp.agg + "/" + tp.rsk + "/" + tp.tea + "）"; });
					const ans = prompt("自定义模板（输入编号删除）：\n\n" + lines.join("\n"), "");
					if (!ans) return;
					const idx = parseInt(ans, 10) - 1;
					if (isNaN(idx) || idx < 0 || idx >= list.length) return;
					if (!confirm("删除【" + list[idx].name + "】？")) return;
					const r = deleteCustomTemplate(list[idx].key);
					alert(r.ok ? "已删除" : ("删除失败：" + r.err));
				});
			}
		} catch (e) {}

		/* 归档导入 */
		try {
			const impBtn = d.querySelector(".djsc-btn[data-act='archive-import']");
			if (impBtn) {
				impBtn.addEventListener("click", function () {
					const s = prompt("粘贴归档 JSON：", "");
					if (!s) return;
					const mode = confirm("合并到现有归档？（取消=覆盖全部）") ? "merge" : "replace";
					const r = importArchiveJson(s, mode);
					if (r.ok) alert("导入成功！本次导入 " + r.imported + " 局，当前共 " + r.total + " 局");
					else alert("导入失败：" + r.err);
				});
			}
		} catch (e) {}

		/* 决策导出 JSON / Markdown */
		try {
			const jsonBtn = d.querySelector(".djsc-btn[data-act='export-decisions-json']");
			if (jsonBtn) jsonBtn.addEventListener("click", function () {
				const s = exportDecisionsJson();
				if (typeof game.copy === "function") game.copy(s, "决策回放 JSON 已复制", "复制失败");
				else alert("JSON 长度 " + s.length + " 字符");
			});
			const mdBtn = d.querySelector(".djsc-btn[data-act='export-decisions-md']");
			if (mdBtn) mdBtn.addEventListener("click", function () {
				const s = exportDecisionsMarkdown();
				if (typeof game.copy === "function") game.copy(s, "决策回放 Markdown 已复制", "复制失败");
				else alert("Markdown 长度 " + s.length + " 字符");
			});
		} catch (e) {}

		/* AI 协作：为队友指定性格 */
		try {
			d.querySelectorAll(".djsc-ally-tpl").forEach(function (sel) {
				sel.addEventListener("change", function () {
					const pk = sel.getAttribute("data-pk");
					const key = sel.value;
					if (!key) return;
					let stored = {};
					try { stored = JSON.parse(localStorage.getItem("无名AI_allyPersonalities") || "{}"); } catch (e) {}
					if (key === "__clear__") {
						delete stored[pk];
						alert("已清除");
					} else {
						const tp = findTemplateAll(key);
						if (!tp) { alert("模板不存在"); return; }
						stored[pk] = { agg: tp.agg, rsk: tp.rsk, tea: tp.tea, name: tp.name, ts: Date.now() };
						alert("已为【" + pk + "】设置性格：" + tp.name);
					}
					try { localStorage.setItem("无名AI_allyPersonalities", JSON.stringify(stored)); } catch (e) {}
				});
			});
		} catch (e) {}

		/* 决策导入回放 */
		try {
			const impBtn = d.querySelector(".djsc-btn[data-act='import-decisions']");
			if (impBtn) {
				impBtn.addEventListener("click", function () {
					const s = prompt("粘贴决策回放 JSON（导出自其它会话/机器）：", "");
					if (!s) return;
					const r = parseDecisionsJson(s);
					if (!r.ok) { alert("解析失败：" + r.err); return; }
					showImportedDecisions(r);
				});
			}
		} catch (e) {}

		/* AI 协作分工（角色下拉） */
		try {
			d.querySelectorAll(".djsc-ally-role").forEach(function (sel) {
				sel.addEventListener("change", function () {
					const pk = sel.getAttribute("data-pk");
					const role = sel.value;
					if (!pk || !role) return;
					let stored = {};
					try { stored = JSON.parse(localStorage.getItem("无名AI_allyPersonalities") || "{}"); } catch (e) {}
					if (!stored[pk]) stored[pk] = { agg: 50, rsk: 50, tea: 50, name: "默认", ts: Date.now() };
					stored[pk].role = role;
					try { localStorage.setItem("无名AI_allyPersonalities", JSON.stringify(stored)); } catch (e) {}
					const roleName = { attack: "主攻", aux: "辅助", control: "控场", defense: "防守", balanced: "均衡" }[role];
					alert("【" + pk + "】分工已设为：" + roleName + "\n下次决策时生效。");
				});
			});
		} catch (e) {}

		/* 配置档案 CRUD */
		try {
			const snapGetters = {
				riskProfile: function () { return lib.config["extension_无名AI_riskProfile"]; },
				personalityAggression: function () { return lib.config["extension_无名AI_personalityAggression"]; },
				personalityRisk: function () { return lib.config["extension_无名AI_personalityRisk"]; },
				personalityTeam: function () { return lib.config["extension_无名AI_personalityTeam"]; },
				atkBias: function () { return lib.config["extension_无名AI_atkBias"]; },
				defBias: function () { return lib.config["extension_无名AI_defBias"]; },
				mode: function () { return lib.config["extension_无名AI_mode"]; },
				decisionScore: function () { return lib.config["extension_无名AI_decisionScore"]; },
				autoIdentityMatch: function () { return lib.config["extension_无名AI_autoIdentityMatch"]; },
				allyPersonalities: function () { try { return JSON.parse(localStorage.getItem("无名AI_allyPersonalities") || "{}"); } catch (e) { return {}; } },
			};
			const snapSetters = {
				riskProfile: function (v) { lib.config["extension_无名AI_riskProfile"] = v; game.saveConfig("extension_无名AI_riskProfile", v); },
				personalityAggression: function (v) { lib.config["extension_无名AI_personalityAggression"] = v; game.saveConfig("extension_无名AI_personalityAggression", v); },
				personalityRisk: function (v) { lib.config["extension_无名AI_personalityRisk"] = v; game.saveConfig("extension_无名AI_personalityRisk", v); },
				personalityTeam: function (v) { lib.config["extension_无名AI_personalityTeam"] = v; game.saveConfig("extension_无名AI_personalityTeam", v); },
				atkBias: function (v) { lib.config["extension_无名AI_atkBias"] = v; game.saveConfig("extension_无名AI_atkBias", v); },
				defBias: function (v) { lib.config["extension_无名AI_defBias"] = v; game.saveConfig("extension_无名AI_defBias", v); },
				mode: function (v) { lib.config["extension_无名AI_mode"] = v; game.saveConfig("extension_无名AI_mode", v); },
				decisionScore: function (v) { lib.config["extension_无名AI_decisionScore"] = v; game.saveConfig("extension_无名AI_decisionScore", v); },
				autoIdentityMatch: function (v) { lib.config["extension_无名AI_autoIdentityMatch"] = v; game.saveConfig("extension_无名AI_autoIdentityMatch", v); },
				allyPersonalities: function (v) { try { localStorage.setItem("无名AI_allyPersonalities", JSON.stringify(v || {})); } catch (e) {} },
			};
			const saveBtn = d.querySelector(".djsc-btn[data-act='prof-save']");
			if (saveBtn) saveBtn.addEventListener("click", function () {
				const name = prompt("档案名称（≤16 字符）：", "档案" + (profileCount() + 1));
				if (!name) return;
				const snap = buildSnapshot(snapGetters);
				const r = saveProfile(name, snap);
				if (r.ok) alert("已保存档案【" + r.name + "】\n重新打开面板可查看。");
				else alert("保存失败：" + r.err);
			});
			d.querySelectorAll(".djsc-prof-load").forEach(function (btn) {
				btn.addEventListener("click", function () {
					const name = btn.getAttribute("data-name");
					if (!confirm("载入档案【" + name + "】？当前配置将被覆盖。")) return;
					const r = loadProfile(name);
					if (!r.ok) { alert("载入失败：" + r.err); return; }
					const ap = applySnapshot(r.data, snapSetters);
					alert(ap.ok ? "已载入【" + name + "】，重新打开面板查看更新。" : "载入异常");
				});
			});
			d.querySelectorAll(".djsc-prof-rename").forEach(function (btn) {
				btn.addEventListener("click", function () {
					const oldName = btn.getAttribute("data-name");
					const newName = prompt("重命名为：", oldName);
					if (!newName || newName === oldName) return;
					const r = renameProfile(oldName, newName);
					alert(r.ok ? "已重命名" : ("失败：" + r.err));
				});
			});
			d.querySelectorAll(".djsc-prof-del").forEach(function (btn) {
				btn.addEventListener("click", function () {
					const name = btn.getAttribute("data-name");
					if (!confirm("删除档案【" + name + "】？不可恢复。")) return;
					const r = deleteProfile(name);
					alert(r.ok ? "已删除" : ("失败：" + r.err));
				});
			});
			const expBtn = d.querySelector(".djsc-btn[data-act='prof-export']");
			if (expBtn) expBtn.addEventListener("click", function () {
				const s = exportProfilesJson();
				if (typeof game.copy === "function") game.copy(s, "档案 JSON 已复制（" + s.length + " 字符）", "复制失败");
				else alert("JSON 长度 " + s.length);
			});
			const impProfBtn = d.querySelector(".djsc-btn[data-act='prof-import']");
			if (impProfBtn) impProfBtn.addEventListener("click", function () {
				const s = prompt("粘贴档案 JSON：", "");
				if (!s) return;
				const mode = confirm("合并？（取消=覆盖全部）") ? "merge" : "replace";
				const r = importProfilesJson(s, mode);
				alert(r.ok ? ("导入成功，共 " + r.count + " 个档案") : ("失败：" + r.err));
			});
		} catch (e) {}

		/* 重置反馈 / 重置风格反馈 */
		try {
			if (feedbackCount() > 0) {
				const resetBtn = document.createElement("button");
				resetBtn.className = "djsc-btn";
				resetBtn.textContent = "重置反馈";
				resetBtn.style.cssText = "padding:3px 10px;border-radius:4px;border:1px solid #2a3a52;background:#14243c;color:#ffd479;cursor:pointer;font-size:11px;";
				resetBtn.addEventListener("click", function () {
					if (confirm("确定重置技能反馈？将清空所有学习数据。")) {
						resetFeedback();
						alert("技能反馈已重置");
					}
				});
				tb.appendChild(resetBtn);
			}
		} catch (e) {}

		/* 观战按钮 */
		try {
			const playBtn = document.createElement("button");
			playBtn.className = "djsc-btn";
			playBtn.textContent = "观战/批量";
			playBtn.style.cssText = "padding:3px 10px;border-radius:4px;border:1px solid #2a3a52;background:#14243c;color:#7fe3a0;cursor:pointer;font-size:11px;";
			playBtn.addEventListener("click", function () {
				const st = autoplayStatus();
				const bst = (function () { try { return batchStatus(); } catch (e) { return { running: false }; } })();
				if (st.running || bst.running) {
					if (confirm("观战正在进行，要停止吗？")) {
						try { stopBatchAutoplay(); } catch (e) {}
						stopAutoplay();
						alert("已停止");
					}
					return;
				}
				const mode = confirm("单配置（确定）还是批量对比（取消）？");
				if (mode) {
					const n = prompt("输入观战局数（1~50）：", "5");
					if (!n) return;
					const r = startAutoplay(parseInt(n, 10));
					if (r.ok) alert("已启动观战 " + r.target + " 局");
					else alert("启动失败：" + r.err);
				} else {
					const configs = [
						{ name: "激进型", agg: 80, rsk: 70, tea: 40, games: 3 },
						{ name: "均衡型", agg: 50, rsk: 50, tea: 50, games: 3 },
						{ name: "保守型", agg: 30, rsk: 30, tea: 70, games: 3 },
					];
					const r = startBatchAutoplay(configs);
					if (r.ok) alert("已启动批量对比\n共 " + r.batches + " 组 × 3 局\n结束后弹出对比报告");
					else alert("启动失败：" + r.err);
				}
			});
			tb.appendChild(playBtn);
		} catch (e) {}

		/* 决策树视图切换 */
		try {
			const treeBtn = document.createElement("button");
			treeBtn.className = "djsc-btn";
			treeBtn.textContent = "决策树视图";
			treeBtn.style.cssText = "padding:3px 10px;border-radius:4px;border:1px solid #2a3a52;background:#14243c;color:#9ad8ff;cursor:pointer;font-size:11px;";
			let treeOn = false;
			treeBtn.addEventListener("click", function () {
				treeOn = !treeOn;
				treeBtn.style.color = treeOn ? "#7fe3a0" : "#9ad8ff";
				treeBtn.textContent = treeOn ? "决策树视图 ✓" : "决策树视图";
				d.querySelectorAll(".djsc-tree-group").forEach(function (el) { el.style.display = treeOn ? "" : "none"; });
			});
			tb.appendChild(treeBtn);
		} catch (e) {}

		/* 语言选择器 */
		try {
			const langSel = document.createElement("select");
			langSel.className = "djsc-btn";
			langSel.style.cssText = "padding:3px 6px;border-radius:4px;border:1px solid #2a3a52;background:#14243c;color:#9ad8ff;cursor:pointer;font-size:11px;";
			availableLangs().forEach(function (l) {
				const opt = document.createElement("option");
				opt.value = l; opt.textContent = l === "zh" ? "中" : l.toUpperCase();
				langSel.appendChild(opt);
			});
			try { langSel.value = lib.config["extension_无名AI_lang"] || "zh"; } catch (e) {}
			langSel.addEventListener("change", function () {
				if (setLang(langSel.value)) alert("语言已切换，重新打开面板查看");
			});
			tb.appendChild(langSel);
		} catch (e) {}

		/* 重置折叠 */
		try {
			const rcBtn = document.createElement("button");
			rcBtn.className = "djsc-btn";
			rcBtn.textContent = "重置折叠";
			rcBtn.style.cssText = "padding:3px 10px;border-radius:4px;border:1px solid #2a3a52;background:#14243c;color:#a8b8c8;cursor:pointer;font-size:11px;";
			rcBtn.addEventListener("click", function () {
				try {
					const keys = Object.keys(localStorage).filter(function (k) { return k.indexOf("无名AI_panelCollapse_") === 0; });
					keys.forEach(function (k) { localStorage.removeItem(k); });
					alert("已重置 " + keys.length + " 个折叠状态");
				} catch (e) { alert("重置失败"); }
			});
			tb.appendChild(rcBtn);
		} catch (e) {}
	} catch (e) {}
	/* ★ 一键推荐配置 */
	try {
		d.querySelectorAll('.djsc-recommend').forEach(function (btn) {
			btn.addEventListener('click', function () {
				const key = btn.getAttribute('data-key');
				const r = listRecommends().find(function (x) { return x.key === key; });
				if (!r) return;
				if (!confirm('应用配置【' + r.name + '】？\n' + r.desc + '\n\n当前配置会被覆盖。')) return;
				const res = applyRecommend(key);
				if (res.ok) {
					alert('已应用【' + res.name + '】，共 ' + res.applied + ' 项。\n重启游戏后完全生效。');
				} else {
					alert('应用失败：' + res.err);
				}
			});
		});
		const snapBtn = d.querySelector("[data-act='snapshot-config']");
		if (snapBtn) {
			snapBtn.addEventListener('click', function () {
				const s = snapshotCurrent();
				const json = JSON.stringify(s, null, 2);
				if (typeof game.copy === 'function') {
					game.copy(json, '当前配置已复制（' + json.length + ' 字符）', '复制失败');
				} else {
					alert('配置长度：' + json.length);
				}
			});
		}
	} catch (e) {}

		/* 复位熔断器 */
		try {
			const resetBtn = d.querySelector(".djsc-btn[data-act='reset-circuit']");
			if (resetBtn) {
				resetBtn.addEventListener('click', function () {
					if (!confirm('复位熔断器？接管层将立即尝试恢复。')) return;
					resetCircuit();
					alert('熔断器已复位');
				});
			}
		} catch (e) {}

		/* ★ 策略总线按钮 */
		try {
			const toggleBtn = d.querySelector(".djsc-btn[data-act='strategist-toggle']");
			if (toggleBtn) {
				toggleBtn.addEventListener("click", function () {
					const cur = getStrategistStats().enabled;
					setStrategistEnabled(!cur);
					alert("策略总线已" + (!cur ? "开启" : "关闭"));
				});
			}
			const clearBtn = d.querySelector(".djsc-btn[data-act='strategist-clear']");
			if (clearBtn) {
				clearBtn.addEventListener("click", function () {
					if (confirm("清空策略总线审计日志？")) {
						clearStrategistAudit();
						alert("已清空");
					}
				});
			}
			const resetBtn = d.querySelector(".djsc-btn[data-act='strategist-reset']");
			if (resetBtn) {
				resetBtn.addEventListener("click", function () {
					if (confirm("重置策略总线统计？")) {
						resetStrategistStats();
						alert("已重置");
					}
				});
			}
		} catch (e) {}

		/* ★ 技能拆解按钮点击展开/收起 */
		try {
			d.querySelectorAll(".djsc-skill-btn").forEach(function (btn) {
				btn.addEventListener("click", function () {
					const idx = btn.getAttribute("data-idx");
					const detail = d.querySelector(".djsc-skill-detail[data-idx='" + idx + "']");
					if (detail) {
						const isHidden = detail.style.display === "none" || !detail.style.display;
						detail.style.display = isHidden ? "block" : "none";
						btn.style.borderColor = isHidden ? "#9ad8ff" : "#2a3a52";
					}
				});
			});
		} catch (e) {}
}

/* ================= 导出菜单弹窗（文件下载版） ================= */
function _showExportMenu() {
	try {
		const W = window.innerWidth;
		const H = window.innerHeight;
		const overlay = document.createElement('div');
		overlay.style.cssText = [
			'position:fixed', 'left:0', 'top:0',
			'width:' + W + 'px', 'height:' + H + 'px',
			'background:rgba(0,0,0,0.75)', 'z-index:2147483647',
			'display:flex', 'align-items:center', 'justify-content:center',
		].join(';') + ';';

		const box = document.createElement('div');
		box.style.cssText = [
			'background:#0d1622', 'border:1px solid #2a3a52', 'border-radius:12px',
			'padding:20px', 'max-width:min(92vw, 560px)', 'max-height:85vh',
			'overflow-y:auto', 'color:#dbe7f5', 'font-size:13px', 'line-height:1.7',
			'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
		].join(';') + ';';

		let html = "<div style='font-size:16px;color:#ffd479;font-weight:bold;margin-bottom:12px;text-align:center;'>📦 数据导出</div>";
		html += "<div style='font-size:11px;color:#9ad8ff;margin-bottom:10px;'>点击即下载 .json 文件（若下载失败自动回退到剪贴板）</div>";

		/* 全量导出 */
		html += "<div class='djsc-exp-all' style='padding:12px;background:rgba(127,227,160,0.08);border-left:4px solid #7fe3a0;border-radius:6px;margin:8px 0;cursor:pointer;'>";
		html += "<b style='color:#7fe3a0;font-size:14px;'>📦 全量导出（下载单个文件）</b>";
		html += "<div style='color:#a8b8c8;font-size:11px;margin-top:4px;'>包含所有模块：环境/配置/对局/技能/策略总线/接管层/反馈/归档/性能/健康度</div>";
		html += "</div>";

		/* 批量导出 */
		html += "<div class='djsc-exp-batch' style='padding:12px;background:rgba(255,212,121,0.08);border-left:4px solid #ffd479;border-radius:6px;margin:8px 0;cursor:pointer;'>";
		html += "<b style='color:#ffd479;font-size:14px;'>📦 批量导出（每模块一个文件）</b>";
		html += "<div style='color:#a8b8c8;font-size:11px;margin-top:4px;'>依次下载 20+ 个独立文件，适合分类存档</div>";
		html += "</div>";

		/* 分项导出 */
		html += "<div style='font-size:11px;color:#9ad8ff;margin:12px 0 6px;'>分项导出（点击下载对应文件）：</div>";
		html += "<div style='display:grid;grid-template-columns:repeat(2, 1fr);gap:6px;'>";

		const modules = [
			{ key: 'env',            icon: '🌐', label: '环境信息',      desc: '版本/模式/轮次' },
			{ key: 'config',         icon: '⚙️', label: '配置快照',      desc: '当前所有开关与权重' },
			{ key: 'game',           icon: '🎮', label: '对局信息',      desc: '玩家/HP/身份/技能' },
			{ key: 'round',          icon: '📊', label: '本局积分',      desc: '各玩家实时积分' },
			{ key: 'scoreLog',       icon: '📋', label: '记分明细',      desc: '最近 100 条记分记录' },
			{ key: 'rec',            icon: '📈', label: '行为统计',      desc: '卡牌/效果触发次数' },
			{ key: 'decisionLog',    icon: '🎯', label: '决策回放',      desc: '六层信号 + 候选分解' },
			{ key: 'skillBreakdown', icon: '🔍', label: '技能拆解',      desc: '所有技能的正负收益' },
			{ key: 'skillCustom',    icon: '⚙️', label: '自定义技能六维', desc: '维度说明 + 值范围提醒 + 模板' },
			{ key: 'mySkillMatrix',  icon: '📚', label: '我方技能矩阵',  desc: '技能时机/目标/收益' },
			{ key: 'strategist',     icon: '🧠', label: '策略总线',      desc: '仲裁统计 + 审计日志' },
			{ key: 'override',       icon: '🔧', label: '接管层状态',    desc: '熔断器 + 各层状态' },
			{ key: 'feedback',       icon: '🔄', label: '学习反馈',      desc: '技能/决策/风格学习数据' },
			{ key: 'archive',        icon: '📁', label: '战报归档',      desc: '历史对局统计' },
			{ key: 'observer',       icon: '👁️', label: '行为观察',      desc: '谁打过谁/谁救过谁' },
			{ key: 'identity',       icon: '🎭', label: '身份推理',      desc: '信念矩阵 + 置信度' },
			{ key: 'perf',           icon: '⏱️', label: '性能监控',      desc: '决策耗时统计' },
			{ key: 'health',         icon: '🩺', label: '健康度',        desc: '引擎自检结果' },
			{ key: 'compat',         icon: '🔍', label: '兼容性自检',    desc: '与其它扩展的冲突' },
			{ key: 'adaptive',       icon: '📈', label: '自适应难度',    desc: '当前难度偏移' },
			{ key: 'profiles',       icon: '👤', label: '配置档案',      desc: '档案列表 + 自定义模板' },
			{ key: 'emptySkills',    icon: '❓', label: '空技能详解',    desc: '未识别技能诊断' },
			{ key: 'memoryFull',     icon: '💾', label: '记忆库（完整）', desc: '所有武将风格详细数据' },
			{ key: 'skillSource',    icon: '🔧', label: '技能源码导出',  desc: '导出当前武将技能源码' },
		];

		modules.forEach(function (m) {
			html += "<div class='djsc-exp-item' data-key='" + m.key + "' data-label='" + m.label + "' style='padding:8px;background:rgba(154,216,255,0.05);border:1px solid #2a3a52;border-radius:5px;cursor:pointer;'>";
			html += "<div style='color:#9ad8ff;font-size:12px;'><b>" + m.icon + " " + m.label + "</b></div>";
			html += "<div style='color:#666;font-size:10px;margin-top:2px;'>" + m.desc + "</div>";
			html += "</div>";
		});
		html += "</div>";

		/* 底部按钮 */
		html += "<div style='text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;'>";
		html += "<button class='djsc-exp-copyall' style='padding:8px 16px;border-radius:6px;border:1px solid #2a3a52;background:#14243c;color:#9ad8ff;cursor:pointer;font-size:12px;'>复制全量到剪贴板</button>";
		html += "<button class='djsc-exp-import-mem' style='padding:8px 16px;border-radius:6px;border:1px solid #2a3a52;background:#14243c;color:#7fe3a0;cursor:pointer;font-size:12px;'>导入记忆库</button>";
		html += "<button class='djsc-exp-clear-mem' style='padding:8px 16px;border-radius:6px;border:1px solid #2a3a52;background:#14243c;color:#ff9c9c;cursor:pointer;font-size:12px;'>清空记忆库</button>";
		html += "<button class='djsc-exp-close' style='padding:8px 20px;border-radius:6px;border:1px solid #2a3a52;background:#14243c;color:#dbe7f5;cursor:pointer;font-size:13px;'>关闭</button>";
		html += "</div>";

		/* 状态提示 */
		html += "<div class='djsc-exp-status' style='text-align:center;color:#7fe3a0;font-size:11px;margin-top:8px;min-height:16px;'></div>";

		box.innerHTML = html;
		overlay.appendChild(box);
		document.body.appendChild(overlay);

		const statusEl = box.querySelector('.djsc-exp-status');
		const setStatus = function (msg, color) {
			try {
				statusEl.textContent = msg;
				statusEl.style.color = color || '#7fe3a0';
			} catch (e) {}
		};

		/* 关闭 */
		const close = function () { try { overlay.remove(); } catch (e) {} };
		box.querySelector('.djsc-exp-close').addEventListener('click', close);
		overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

		/* 全量下载 */
		box.querySelector('.djsc-exp-all').addEventListener('click', function () {
			try {
				setStatus('正在生成文件…', '#ffd479');
				const ok = exportAllFile(true);
				if (ok) setStatus('✓ 已触发下载', '#7fe3a0');
				else setStatus('✗ 下载失败（浏览器限制）', '#ff9c9c');
			} catch (e) { setStatus('✗ 异常：' + e.message, '#ff9c9c'); }
		});

		/* 批量下载 */
		box.querySelector('.djsc-exp-batch').addEventListener('click', function () {
			try {
				setStatus('批量下载中，请留意浏览器下载栏…', '#ffd479');
				const n = exportBatchFiles(modules.map(function (m) {
					return { key: m.key, label: m.label };
				}));
				setStatus('✓ 已触发 ' + n + ' 个文件下载', '#7fe3a0');
			} catch (e) { setStatus('✗ 异常：' + e.message, '#ff9c9c'); }
		});

		/* 分项下载 */
		box.querySelectorAll('.djsc-exp-item').forEach(function (item) {
			item.addEventListener('click', function () {
				try {
					const key = item.getAttribute('data-key');
					const label = item.getAttribute('data-label');
					/* 特殊处理：技能源码导出 */
					if (key === 'skillSource') {
						const r = showSkillSource();
						setStatus('✓ 【' + label + '】已导出', '#7fe3a0');
						return;
					}
					const ok = exportModuleFile(key, label);
					if (ok) setStatus('✓ 【' + label + '】已触发下载', '#7fe3a0');
					else setStatus('✗ 【' + label + '】下载失败', '#ff9c9c');
				} catch (e) { setStatus('✗ 异常：' + e.message, '#ff9c9c'); }
			});
		});

		/* 复制全量（备用） */
		box.querySelector('.djsc-exp-copyall').addEventListener('click', function () {
			try {
				const json = exportAllJson(true);
				if (typeof game.copy === 'function') {
					game.copy(json, "已复制（" + Math.round(json.length / 1024) + " KB）", "复制失败");
					setStatus('✓ 已复制到剪贴板', '#7fe3a0');
				} else {
					setStatus('✗ 当前环境不支持复制', '#ff9c9c');
				}
			} catch (e) { setStatus('✗ 异常：' + e.message, '#ff9c9c'); }
		});

		/* 导入记忆库 */
		box.querySelector('.djsc-exp-import-mem').addEventListener('click', function () {
			try {
				const s = prompt('粘贴记忆库 JSON（可从其它设备导出）：', '');
				if (!s) return;
				let data;
				try {
					data = JSON.parse(s);
				} catch (e) {
					setStatus('✗ JSON 格式错误', '#ff9c9c');
					return;
				}
				/* 兼容两种格式：
				 *   ① { v, players, ... }（直接是记忆库）
				 *   ② { memoryFull: { v, players } }（从全量导出里拷的） */
				const payload = data.memoryFull || data.memory || data;
				const mode = confirm('合并到现有记忆？（取消=覆盖全部）') ? 'merge' : 'replace';
				const r = importStore(payload, mode);
				if (r.ok) {
					setStatus('✓ 导入成功：' + r.imported + ' 条，当前共 ' + r.total + ' 条', '#7fe3a0');
				} else {
					setStatus('✗ 导入失败：' + r.err, '#ff9c9c');
				}
			} catch (e) { setStatus('✗ 异常：' + e.message, '#ff9c9c'); }
		});

		/* 清空记忆库 */
		box.querySelector('.djsc-exp-clear-mem').addEventListener('click', function () {
			try {
				if (!confirm('确定清空记忆库？所有武将风格数据将被删除，不可恢复。')) return;
				const r = clearStore();
				if (r.ok) setStatus('✓ 记忆库已清空', '#7fe3a0');
				else setStatus('✗ ' + r.err, '#ff9c9c');
			} catch (e) { setStatus('✗ 异常：' + e.message, '#ff9c9c'); }
		});
	} catch (e) { alert("打开导出菜单失败：" + e.message); }
}

/* ================= 归档详情弹窗 ================= */
function _openArchiveDetail(idx) {
	try {
		const gd = getGameDecisions(idx);
		if (!gd) { alert("无法读取该局详情"); return; }
		let dlg = null;
		try { dlg = ui.create.dialog("战报详情 · " + fmtTime(gd.ts)); } catch (e) { dlg = null; }
		if (!dlg) return;
		try {
			dlg.classList.add("fullheight");
			dlg.style.width = "min(92vw, 860px)";
			dlg.style.maxWidth = "92vw";
			dlg.style.left = "4vw";
		} catch (eS) {}
		const d = document.createElement("div");
		d.style.cssText = "color:#dbe7f5;font-size:12px;line-height:1.7;padding:6px 4px;";
		let html = "";
		html += "<div style='display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;'>";
		const card = function (label, val, color) {
			return "<div style='flex:1;min-width:76px;padding:8px;background:rgba(255,255,255,0.04);border-radius:6px;text-align:center;'>" +
				"<div style='font-size:11px;color:#9ad8ff;margin-bottom:3px;'>" + label + "</div>" +
				"<div style='font-size:16px;font-weight:600;color:" + (color || "#dbe7f5") + ";'>" + val + "</div>" +
				"</div>";
		};
		const vCol = gd.verdict === "win" ? "#7fe3a0" : gd.verdict === "lose" ? "#ff9c9c" : "#ffd479";
		html += card("时间", fmtTime(gd.ts), "#a8b8c8");
		html += card("模式", gd.mode, "#9ad8ff");
		html += card("身份", gd.myIdentity || "—", "#9ad8ff");
		html += card("结果", gd.verdict, vCol);
		html += card("积分", (gd.myScore > 0 ? "+" : "") + gd.myScore, gd.myScore >= 0 ? "#7fe3a0" : "#ff9c9c");
		html += "</div>";
		if (gd.legacy) {
			html += "<div style='color:#666;font-size:11px;padding:8px 0;'>· 该局为旧版本归档，无决策记录</div>";
		} else if (!gd.decisions.length) {
			html += "<div style='color:#666;font-size:11px;padding:8px 0;'>· 该局未记录到决策</div>";
		} else {
			html += "<b style='color:#9ad8ff'>决策回放（" + gd.decisions.length + " 步）</b><br>";
			html += "<div style='font-size:11px;margin-top:6px;'>";
			gd.decisions.forEach(function (dd, i) {
				const w = dd.winner || {};
				const S = dd.signals || {};
				const signalParts = [];
				if (S.tempo) signalParts.push("节奏:" + S.tempo);
				if (S.risk) signalParts.push("性格:" + S.risk);
				if (S.teamFocus) signalParts.push("集火:" + S.teamFocus);
				if (S.styleTag) signalParts.push("对手:" + S.styleTag);
				html += "<div style='margin:6px 0;padding:6px 8px;border-left:3px solid #5a7aa8;background:rgba(255,255,255,0.02);border-radius:3px;'>";
				html += "<div style='color:#9ad8ff;'>";
				html += "<b>#" + (i + 1) + "</b> 轮 " + dd.round + " · " + dd.player + " → ";
				html += "<b style='color:#7fe3a0'>" + (w.type || "?") + ":" + (w.id || "?") + "</b>";
				if (w.score !== undefined) html += "（" + w.score + "）";
				html += "</div>";
				if (signalParts.length) {
					html += "<div style='color:#888;font-size:10px;margin-top:2px;'>" + signalParts.join("｜") + "</div>";
				}
				if (dd.top3 && dd.top3.length) {
					html += "<div style='color:#a8b8c8;font-size:10px;margin-top:3px;'>";
					html += "<span style='color:#666'>候选Top3：</span>";
					dd.top3.forEach(function (c, j) {
						const isWin = w && c.type === w.type && c.id === w.id;
						const col = isWin ? "#7fe3a0" : "#a8b8c8";
						html += "<span style='display:inline-block;margin-right:8px;color:" + col + "'>";
						html += (j + 1) + ". " + c.type + ":" + c.id + "(" + c.score + ")";
						if (c.target) html += "→" + c.target;
						html += "</span>";
					});
					html += "</div>";
				}
				html += "</div>";
			});
			html += "</div>";
		}
		html += "<div style='text-align:center;margin-top:12px;'>";
		html += "<span id='djsc-detail-close' style='color:#9ad8ff;cursor:pointer;text-decoration:underline;margin:0 12px;'>[关闭]</span>";
		html += "<span id='djsc-detail-export' style='color:#ffd479;cursor:pointer;text-decoration:underline;margin:0 12px;'>[导出全部归档 JSON]</span>";
		html += "</div>";
		d.innerHTML = html;
		dlg.content.appendChild(d);
		try {
			const closeBtn = d.querySelector("#djsc-detail-close");
			if (closeBtn) closeBtn.addEventListener("click", function () { try { dlg.close(); } catch (e) {} });
			const exportBtn = d.querySelector("#djsc-detail-export");
			if (exportBtn) exportBtn.addEventListener("click", function () {
				try {
					const json = exportArchiveJson();
					if (typeof game.copy === "function") game.copy(json, "归档 JSON 已复制到剪贴板（" + json.length + " 字符）", "复制失败");
					else alert("归档 JSON 长度：" + json.length + " 字符");
				} catch (e) { alert("导出失败：" + String(e).slice(0, 60)); }
			});
		} catch (eBind) {}
	} catch (e) {
		try { alert("详情弹窗异常：" + String(e).slice(0, 80)); } catch (e2) {}
	}
}

/* ================= 简单面板（每个功能独立打开） ================= */
function openSimplePanel(title, content) {
	try {
		/* 关闭旧面板 */
		try {
			if (window.__DJSC_PANEL) {
				try { window.__DJSC_PANEL.remove(); } catch (e) {}
				window.__DJSC_PANEL = null;
			}
		} catch (e) {}

		/* 创建全屏遮罩（用 px 值，不用 vw/vh） */
		const W = window.innerWidth;
		const H = window.innerHeight;

		const panel = document.createElement('div');
		panel.id = 'djsc-simple-panel';
		panel.style.cssText = [
			'position: fixed',
			'top: 0',
			'left: 0',
			'width: ' + W + 'px',
			'height: ' + H + 'px',
			'max-width: ' + W + 'px',
			'max-height: ' + H + 'px',
			'min-width: 0',
			'min-height: 0',
			'margin: 0',
			'padding: 0',
			'transform: none',
			'box-sizing: border-box',
			'z-index: 2147483647',
			'background: #0a1018',
			'overflow-y: auto',
			'overflow-x: hidden',
			'-webkit-overflow-scrolling: touch',
			'color: white',
			'font-size: 16px',
			'line-height: 1.8',
		].join('; ') + ';';

		/* 标题栏 */
		const header = document.createElement('div');
		header.style.cssText = 'font-size: 20px; color: #00FFB0; margin: 20px; text-align: center; font-weight: bold; padding: 10px; background: #14243c; border-radius: 8px;';
		header.textContent = title;
		panel.appendChild(header);

		/* 内容区 */
		const body = document.createElement('div');
		body.style.cssText = 'color: #dbe7f5; background: #14243c; border-radius: 12px; padding: 20px; margin: 10px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); white-space: pre-wrap;';
		body.textContent = content;
		panel.appendChild(body);

		/* 关闭按钮（固定在右下角） */
		const closeBtn = document.createElement('div');
		closeBtn.textContent = '✕ 关闭';
		closeBtn.style.cssText = [
			'position: fixed',
			'bottom: 20px',
			'right: 16px',
			'padding: 12px 20px',
			'background: #1E90FF',
			'color: white',
			'border-radius: 26px',
			'font-size: 15px',
			'cursor: pointer',
			'box-shadow: 0 4px 12px rgba(0,0,0,0.6)',
			'z-index: 2147483646',
		].join('; ') + ';';
		closeBtn.addEventListener('click', function () {
			try { panel.remove(); } catch (e) {}
			window.__DJSC_PANEL = null;
			/* 清空所有面板状态，确保能再次打开 */
			try {
				delete _status.djscHealthPanel;
				delete _status.djscScorePanel;
				delete _status.djscPlanPanel;
				delete _status.djscFeedbackPanel;
				delete _status.djscArchivePanel;
				delete _status.djscRecommendPanel;
				delete _status.djscConfigPanel;
				delete _status.djscMemoryPanel;
				delete _status.djscSkillPanel;
			} catch (e) {}
		});
		panel.appendChild(closeBtn);
		styleUtilityPanel(panel, closeBtn);

		/* 挂到 body 最外层 */
		document.body.appendChild(panel);
		window.__DJSC_PANEL = panel;

		/* ★ 同时把面板函数挂载到 window.__DJSC 上（自检面板检测用） */
		try {
			window.__DJSC = window.__DJSC || {};
			window.__DJSC.openMemoryPanel = openMemoryPanel;
			window.__DJSC.openHealthPanel = openHealthPanel;
			window.__DJSC.openConfigPanel = openConfigPanel;
			window.__DJSC.exportAllAndDownload = exportAllAndDownload;
			window.__DJSC.importAllFromFile = importAllFromFile;
		} catch (e) {}
	} catch (e) {
		alert('打开面板失败：' + e.message);
	}
}

/* ================= 问题反馈联系群弹窗 ================= */
function showFeedbackGroup() {
	try {
		const W = window.innerWidth;
		const H = window.innerHeight;
		const overlay = document.createElement('div');
		overlay.style.cssText = [
			'position:fixed', 'left:0', 'top:0',
			'width:' + W + 'px', 'height:' + H + 'px',
			'background:rgba(0,0,0,0.8)', 'z-index:2147483647',
			'display:flex', 'align-items:center', 'justify-content:center',
		].join(';') + ';';

		const box = document.createElement('div');
		box.style.cssText = [
			'background:#fff', 'border-radius:16px',
			'padding:20px', 'max-width:min(90vw, 360px)',
			'text-align:center', 'box-shadow:0 8px 32px rgba(0,0,0,0.4)',
		].join(';') + ';';

		box.innerHTML = [
			'<div style="font-size:20px;font-weight:bold;color:#333;margin-bottom:8px;">💬 问题反馈联系群</div>',
			'<div style="font-size:13px;color:#666;margin-bottom:16px;">无名AI内测群</div>',
			'<img src="./extension/无名AI/assets/qrcode.png" style="width:100%;max-width:280px;border-radius:8px;" alt="问题反馈联系群二维码">',
			'<div style="font-size:14px;color:#333;margin-top:16px;">扫一扫二维码，加入群聊</div>',
			'<div style="font-size:12px;color:#999;margin-top:8px;">群号：1080487560</div>',
			'<button onclick="this.closest(\'.djsc-fb-overlay\').remove()" style="margin-top:16px;padding:10px 32px;border-radius:8px;border:none;background:#1677ff;color:#fff;font-size:15px;cursor:pointer;">关闭</button>',
		].join('');

		overlay.classList.add('djsc-fb-overlay');
		overlay.appendChild(box);
		document.body.appendChild(overlay);

		/* 点击背景关闭 */
		overlay.addEventListener('click', function (e) {
			if (e.target === overlay) overlay.remove();
		});

		return 'ok';
	} catch (e) {
		try { alert('打开失败：' + e.message); } catch (e2) {}
		return 'ERR:' + e.message;
	}
}

/* ================= 技能源码导出（手机端调试用） ================= */
function showSkillSource(skillIds) {
	try {
		/* 如果没传技能ID，就导出当前武将的所有技能 */
		let ids = skillIds;
		if (!ids || !ids.length) {
			const me = game.me;
			if (me && me.skills) {
				ids = me.skills.slice();
			} else {
				alert('请先进入对局，或传入技能ID列表');
				return 'ERR: no game';
			}
		}

		const parts = [];
		parts.push('=== 技能源码导出 ===');
		parts.push('版本: ' + (lib.version || '?'));
		parts.push('时间: ' + new Date().toLocaleString());
		parts.push('技能数: ' + ids.length);
		parts.push('');

		ids.forEach(function (sid) {
			parts.push('');
			parts.push('========== ' + sid + ' ==========');
			const sk = lib.skill && lib.skill[sid];
			if (!sk) {
				parts.push('（技能不存在）');
				return;
			}
			parts.push('【顶层键】' + Object.keys(sk).join(', '));

			/* content */
			if (typeof sk.content === 'function') {
				parts.push('');
				parts.push('【content】');
				try {
					parts.push(sk.content.toString());
				} catch (e) {
					parts.push('（toString 失败：' + e.message + '）');
				}
			} else if (sk.content !== undefined) {
				parts.push('');
				parts.push('【content（非函数）】');
				parts.push(String(sk.content).slice(0, 2000));
			}

			/* filter */
			if (typeof sk.filter === 'function') {
				parts.push('');
				parts.push('【filter】');
				try {
					parts.push(sk.filter.toString());
				} catch (e) {
					parts.push('（toString 失败：' + e.message + '）');
				}
			} else if (sk.filter !== undefined) {
				parts.push('');
				parts.push('【filter（非函数）】');
				parts.push(String(sk.filter).slice(0, 2000));
			}

			/* cost */
			if (typeof sk.cost === 'function') {
				parts.push('');
				parts.push('【cost】');
				try { parts.push(sk.cost.toString()); } catch (e) {}
			}

			/* check */
			if (typeof sk.check === 'function') {
				parts.push('');
				parts.push('【check】');
				try { parts.push(sk.check.toString()); } catch (e) {}
			}

			/* trigger */
			if (sk.trigger) {
				parts.push('');
				parts.push('【trigger】');
				try {
					parts.push(JSON.stringify(sk.trigger, function (k, v) {
						return typeof v === 'function' ? '[Function]' : v;
					}, 2));
				} catch (e) {
					parts.push(String(sk.trigger).slice(0, 2000));
				}
			}

			/* mod */
			if (sk.mod) {
				parts.push('');
				parts.push('【mod 键】' + Object.keys(sk.mod).join(', '));
				for (const mk in sk.mod) {
					if (typeof sk.mod[mk] === 'function') {
						parts.push('  mod.' + mk + ':');
						try { parts.push('  ' + sk.mod[mk].toString().slice(0, 1500)); } catch (e) {}
					}
				}
			}

			/* subSkill */
			if (sk.subSkill) {
				parts.push('');
				parts.push('【subSkill 键】' + Object.keys(sk.subSkill).join(', '));
			}

			/* group */
			if (sk.group) {
				parts.push('');
				parts.push('【group】' + JSON.stringify(sk.group));
			}

			/* viewAs */
			if (sk.viewAs) {
				parts.push('');
				parts.push('【viewAs】' + (typeof sk.viewAs === 'string'
					? sk.viewAs
					: JSON.stringify(sk.viewAs).slice(0, 800)));
			}

			/* 扫描结果 */
			try {
				const tags = skillTagsOf(sid);
				parts.push('');
				parts.push('【扫描结果】');
				parts.push('  __source=' + tags.__source);
				parts.push('  __phases=' + JSON.stringify(tags.__phases || []));
				parts.push('  __metaTypes=' + JSON.stringify(tags.__metaTypes || []));
				parts.push('  __isPureAI=' + tags.__isPureAI);
				/* 非零标签 */
				const nz = {};
				for (const k in tags) {
					if (k.indexOf('__') === 0) continue;
					if (typeof tags[k] === 'number' && Math.abs(tags[k]) > 0.001) nz[k] = tags[k];
				}
				parts.push('  非零标签=' + JSON.stringify(nz));
			} catch (e) {}

			parts.push('');
		});

		const fullText = parts.join('\n');
		console.log(fullText);

		/* 1) 弹窗显示（手机端可长按复制） */
		try {
			openSimplePanel('技能源码（长按可复制）', fullText);
		} catch (e) {}

		/* 2) 自动下载为 txt 文件 */
		try {
			const ts = (function () {
				const d = new Date();
				const p = function (n) { return n < 10 ? '0' + n : '' + n; };
				return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate())
					+ '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
			})();
			downloadFile('技能源码_' + ts + '.txt', fullText, 'text/plain;charset=utf-8');
		} catch (e) {}

		return 'ok';
	} catch (e) {
		try { alert('导出失败：' + e.message); } catch (e2) {}
		return 'ERR:' + e.message;
	}
}

/* ================= 各个功能面板 ================= */
function openHealthPanel() {
	try {
		let content = '=== 引擎健康度 ===\n\n';
		try {
			const sc = selfCheck();  /* ★ 直接调用import的selfCheck，不用window.__DJSC */
			content += '通过检查：' + (sc.ok || []).join(', ') + '\n';
			content += '失败检查：' + (sc.fail || []).join(', ') + '\n';
		} catch (e) {
			content += '自检失败：' + e.message + '\n';
		}
		content += '\n=== 对局状态 ===\n';
		try {
			content += '当前轮次：' + (function() {
				try {
					if (typeof _status === "object" && typeof _status.roundNumber === "number") return _status.roundNumber;
					if (typeof game === "object" && typeof game.roundNumber === "number") return game.roundNumber;
					if (typeof game === "object" && typeof game.round === "number") return game.round;
				} catch (e) {}
				return '未知';
			})() + '\n';
			content += '当前阶段：' + (_status.currentPhase ? _status.currentPhase.name : '未知') + '\n';
			content += '当前模式：' + (get.mode ? get.mode() : '未知') + '\n';
			content += '玩家数量：' + (game.players ? game.players.length : 0) + '\n';
		} catch (e) {
			content += '获取对局状态失败：' + e.message + '\n';
		}
		openSimplePanel('🩺 引擎健康度', content);
	} catch (e) {
		alert('打开健康度面板失败：' + e.message);
	}
}

function openScoreDetailPanel() {
	try {
		let content = '=== 本局积分 ===\n\n';
		try {
			const log = getScoreLog().slice(-30);
			content += '最近积分记录（共 ' + log.length + ' 条）：\n\n';
			if (log.length === 0) {
				content += '暂无记录\n';
			} else {
				log.slice(-10).forEach(function (item, i) {
					content += (i + 1) + '. 角色：' + (item.char || '未知') + '\n';
					content += '   得分：' + (item.pts || 0) + '\n';
					if (item.tag) {
						content += '   标签：' + item.tag + '\n';
					}
					content += '\n';
				});
			}
		} catch (e) {
			content += '获取积分失败：' + e.message + '\n';
		}
		openSimplePanel('📈 本局积分', content);
	} catch (e) {
		alert('打开积分面板失败：' + e.message);
	}
}

function openPlanPanel() {
	try {
		let content = '=== 战术规划 ===\n\n';
		try {
			const me = _status.currentPhase || (game.players && game.players[0]);
			if (me) {
				const plan = window.__DJSC.plan ? window.__DJSC.plan() : null;
				if (plan) {
					content += '当前规划：\n';
					if (plan.isKill) {
						content += '⚔ 残局解！\n';
					}
					content += '最优动作：' + (plan.best && plan.best.action ? plan.best.action.id : '未知') + '\n';
					content += '总分：' + (plan.best ? plan.best.total : 0) + '\n';
				} else {
					content += '当前无规划（候选不足或超时）\n';
				}
			} else {
				content += '未在对局中\n';
			}
		} catch (e) {
			content += '获取规划失败：' + e.message + '\n';
		}
		openSimplePanel('🎯 战术规划', content);
	} catch (e) {
		alert('打开规划面板失败：' + e.message);
	}
}

function openFeedbackPanel() {
	try {
		let content = '=== 决策回放 ===\n\n';
		try {
			const log = getDecisionLog();
			content += '决策记录（共 ' + log.length + ' 条）：\n\n';
			if (log.length === 0) {
				content += '暂无记录\n';
			} else {
				log.slice(-10).forEach(function (item, i) {
					content += (i + 1) + '. 玩家：' + (item.player || '未知') + '\n';
					content += '   轮次：' + (item.round || 0) + '\n';
					if (item.winner) {
						content += '   最优：' + (item.winner.id || item.winner.type || '未知') + '\n';
						content += '   得分：' + (item.winner.score || 0) + '\n';
						if (item.winner.reason) {
							content += '   原因：' + item.winner.reason + '\n';
						}
					}
					content += '\n';
				});
			}
		} catch (e) {
			content += '获取决策记录失败：' + e.message + '\n';
		}
		openSimplePanel('📝 决策回放', content);
	} catch (e) {
		alert('打开回放面板失败：' + e.message);
	}
}

function openArchivePanel() {
	try {
		let content = '=== 战报归档 ===\n\n';
		try {
			const archive = getArchive();
			content += '历史对局（共 ' + archive.length + ' 局）：\n\n';
			if (archive.length === 0) {
				content += '暂无记录\n';
			} else {
				archive.slice(-5).forEach(function (game, i) {
					content += (i + 1) + '. 结果：' + (game.verdict || '未知') + '\n';
					content += '   模式：' + (game.mode || '未知') + '\n';
					content += '   身份：' + (game.myIdentity || '未知') + '\n';
					content += '   分数：' + (game.myScore || 0) + '\n';
					content += '   轮次：' + (game.roundCount || 0) + '\n';
					content += '\n';
				});
			}
		} catch (e) {
			content += '获取归档失败：' + e.message + '\n';
		}
		openSimplePanel('📁 战报归档', content);
	} catch (e) {
		alert('打开归档面板失败：' + e.message);
	}
}

function openRecommendPanel() {
	try {
		let content = '=== 选将推荐 ===\n\n';

		/* ★ 接入选将评分系统 */
		try {
			const csFn = window.__DJSC && window.__DJSC.charStore;
			if (!csFn) {
				content += '选将评分系统未加载\n';
			} else {
				const cs = csFn();  /* ★ charStore 是函数，先调用拿对象 */
				const mode = cs.currentMode();
				content += '【当前模式】' + mode + '\n\n';

				const stats = cs.allModes();
				const modeKeys = Object.keys(stats);
				if (modeKeys.length === 0) {
					content += '暂无历史数据（打完一局后自动记录）\n';
				} else {
					content += '【各模式统计】\n';
					modeKeys.forEach(function(mk) {
						content += '  ' + mk + ': ' + stats[mk].charCount + ' 个武将\n';
					});
					content += '\n';

					const top = cs.top(null, 10);
					if (top.length > 0) {
						content += '【当前模式排行榜（前 10）】\n';
						top.forEach(function(t, i) {
							content += '  ' + (i+1) + '. ' + t.name
								+ ' | 分:' + t.score
								+ ' | 局:' + t.games
								+ ' | 胜率:' + (t.winRate * 100) + '%\n';
							/* 显示多维 */
							if (t.dims && Object.keys(t.dims).length > 0) {
								const dimStr = [];
								const dimNames = {
									attack: '攻', defense: '防', control: '控',
									support: '辅', burst: '爆', sustain: '续',
									teamwork: '队', solo: '单'
								};
								for (const dk in dimNames) {
									if (t.dims[dk] !== undefined) {
										dimStr.push(dimNames[dk] + Math.round(t.dims[dk] * 10) / 10);
									}
								}
								if (dimStr.length > 0) {
									content += '     [' + dimStr.join(' ') + ']\n';
								}
							}
						});
					} else {
						content += '当前模式暂无数据\n';
					}
				}
			}
		} catch (e) {
			content += '读取评分数据异常：' + String(e).slice(0, 60) + '\n';
		}

		openSimplePanel('🎮 选将推荐', content);
	} catch (e) {
		alert('打开推荐面板失败：' + e.message);
	}
}

function openConfigPanel() {
	try {
		/* 关闭旧面板 */
		try {
			if (window.__DJSC_PANEL) {
				try { window.__DJSC_PANEL.remove(); } catch (e) {}
				window.__DJSC_PANEL = null;
			}
		} catch (e) {}

		const W = window.innerWidth;
		const H = window.innerHeight;

		const panel = document.createElement('div');
		panel.id = 'djsc-config-panel';
		panel.style.cssText = [
			'position: fixed',
			'top: 0',
			'left: 0',
			'width: ' + W + 'px',
			'height: ' + H + 'px',
			'z-index: 2147483647',
			'background: #0a1018',
			'overflow-y: auto',
			'overflow-x: hidden',
			'-webkit-overflow-scrolling: touch',
			'color: white',
			'font-size: 16px',
			'line-height: 1.8',
		].join('; ') + ';';

		const html = buildConfigOverview(cfg);

		panel.innerHTML = html;
		document.body.appendChild(panel);
		window.__DJSC_PANEL = panel;

		/* 绑定按钮事件 */
		setTimeout(function () {
			try {
				/* 导出按钮 */
				var btnExport = document.getElementById('djsc-btn-export-all');
				if (btnExport) {
					btnExport.addEventListener('click', function () {
						try {
							window.__DJSC.exportAllAndDownload();
						} catch (e) {
							alert('导出失败：' + e.message);
						}
					});
				}
				/* 导入（覆盖） */
				var btnImportOverwrite = document.getElementById('djsc-btn-import-overwrite');
				if (btnImportOverwrite) {
					btnImportOverwrite.addEventListener('click', function () {
						try {
							window.__DJSC.importAllFromFile('overwrite');
						} catch (e) {
							alert('导入失败：' + e.message);
						}
					});
				}
				/* 导入（不覆盖） */
				var btnImportMerge = document.getElementById('djsc-btn-import-merge');
				if (btnImportMerge) {
					btnImportMerge.addEventListener('click', function () {
						try {
							window.__DJSC.importAllFromFile('merge');
						} catch (e) {
							alert('导入失败：' + e.message);
						}
					});
				}
			} catch (e) {}
		}, 100);

		/* 关闭按钮 */
		var closeBtn = document.createElement('div');
		closeBtn.textContent = '✕ 关闭';
		closeBtn.style.cssText = [
			'position: fixed',
			'bottom: 20px',
			'right: 16px',
			'padding: 12px 20px',
			'background: #1E90FF',
			'color: white',
			'border-radius: 26px',
			'font-size: 15px',
			'cursor: pointer',
			'box-shadow: 0 4px 12px rgba(0,0,0,0.6)',
			'z-index: 2147483646',
		].join('; ') + ';';
		closeBtn.addEventListener('click', function () {
			try { panel.remove(); } catch (e) {}
			window.__DJSC_PANEL = null;
			try {
				delete _status.djscConfigPanel;
			} catch (e) {}
		});
		panel.appendChild(closeBtn);
		styleUtilityPanel(panel, closeBtn);
	} catch (e) {
		alert('打开配置面板失败：' + e.message);
	}
}

function openMemoryPanel() {
	try {
		let content = '=== 跨局记忆 ===\n\n';
		try {
			const memory = storeStats();
			content += '记忆数据：' + JSON.stringify(memory || {}, null, 2) + '\n';
		} catch (e) {
			content += '获取记忆失败：' + e.message + '\n';
		}
		openSimplePanel('🧠 跨局记忆', content);
	} catch (e) {
		alert('打开记忆面板失败：' + e.message);
	}
}

function openSkillPanel() {
	try {
		let content = '=== 技能矩阵 ===\n\n';
		try {
			const matrix = (function () {
				try {
					const tgt = game.me;
					const out = {};
					((tgt && tgt.skills) || []).forEach(function (sid) {
						try { out[sid] = skillProfileOf(sid); } catch (e) {}
					});
					return out;
				} catch (e) { return {}; }
			})();
			content += '技能数量：' + Object.keys(matrix || {}).length + '\n\n';
			for (const sid in (matrix || {})) {
				content += '- ' + sid + '\n';
			}
		} catch (e) {
			content += '获取技能矩阵失败：' + e.message + '\n';
		}
		openSimplePanel('📚 技能矩阵', content);
	} catch (e) {
		alert('打开技能面板失败：' + e.message);
	}
}

/* ★ 接管层状态面板 */
function openOverridePanel() {
	try {
		const os = overrideStatus();
		if (!os) {
			openSimplePanel('🔧 接管层状态', '接管层未安装');
			return;
		}
		const layers = os.layers || {};
		const circuit = os.circuit || {};
		let content = '=== 接管层状态（硬接管 / 软接管双轨）===\n\n';

		['use', 'respond', 'discard', 'compare'].forEach(function (k) {
			const L = layers[k] || {};
			const C = circuit[k] || {};
			const status = C.tripped ? '🔴 熔断中' : (L.installed ? '🟢 已安装' : (L.enabled ? '🟡 等待安装' : '⚫ 未启用'));
			content += k + '：' + status + '\n';
			if (C.recentCount) content += '  近异常：' + C.recentCount + ' 次\n';
			if (C.cooldownRemain) content += '  冷却剩余：' + Math.round(C.cooldownRemain / 1000) + ' 秒\n';
			if (C.lastReason) content += '  最后原因：' + C.lastReason + '\n';
			content += '\n';
		});

		content += '全局状态：' + (circuit.global && circuit.global.tripped ? '🔴 全局熔断' : '🟢 正常') + '\n\n';

		/* ★ 运行统计 */
		try {
			const stats = getOverrideStats();
			const useStats = stats.use || {};
			const respStats = stats.respond || {};
			const softStats = stats.soft || {};
			const endTurn = useStats.endTurn || 0;
			const pass = useStats.pass || 0;
			const passLimited = useStats['pass-limited'] || 0;
			const useError = useStats.error || 0;
			const veto = useStats.veto || 0;                    /* ★ 新增 */
			const block = respStats.block || 0;
			const allow = respStats.allow || 0;
			const discardCheck = (stats.discard && stats.discard.check) || 0;
			const softHit = softStats.hit || 0;

			content += '=== 📊 运行统计（本局） ===\n';

			/* ★ 总决策数：出牌层 + 响应层 + 弃牌层 */
			var playLayerTotal = endTurn + veto + pass + passLimited + useError;
			var responseLayerTotal = block + allow;
			var totalDecisions = playLayerTotal + responseLayerTotal + discardCheck;

			/* ★ 硬接管率：结束回合 + 否决 + 阻止响应 + 弃牌改写 */
			var hardEvents = endTurn + veto + block + discardCheck;
			var hardRate = totalDecisions > 0 ? Math.round((hardEvents / totalDecisions) * 1000) / 10 : 0;

			/* ★ 软接管率：通过 mod.aiOrder/aiUseful/aiValue 影响决策的次数 / 总决策 */
			var softRate = totalDecisions > 0 ? Math.round((softHit / totalDecisions) * 1000) / 10 : 0;

			content += '总决策数：' + totalDecisions + ' 次\n';
			content += '  🔴 硬接管率：' + hardRate + '%（' + hardEvents + ' 次）\n';
			content += '  🟡 软接管率：' + softRate + '%（' + softHit + ' 次）\n';
			content += '  ⚪ 放行原生：' + (pass + allow) + ' 次\n';
			content += '\n';

			content += '出牌层：\n';
			content += '  引擎强制结束：' + endTurn + ' 次\n';
			content += '  引擎否决低价值牌：' + veto + ' 次\n';         /* ★ 新增 */
			content += '  放行原生：' + pass + ' 次\n';
			content += '  限定技放行：' + passLimited + ' 次\n';
			content += '  异常：' + useError + ' 次\n';
			content += '响应层：\n';
			content += '  保留闪桃：' + block + ' 次\n';
			content += '  放行响应：' + allow + ' 次\n';
			content += '弃牌层：\n';
			content += '  检查次数：' + discardCheck + ' 次\n';
			content += '软接管：\n';
			content += '  命中次数：' + softHit + ' 次\n';
			content += '\n';
		} catch (e) {}

		content += '· 硬接管挂掉后，软接管（aiOverride）自动兜底\n';
		content += '· 熔断冷却 30 秒后自动恢复\n';
		content += '· 10 秒定时器自动重试已熔断层\n';

		openSimplePanel('🔧 接管层状态', content);
	} catch (e) {
		alert('打开接管层面板失败：' + e.message);
	}
}

/* ★ 技能拆解面板 */
/* ================= 技能拆解面板（正/负/总分三项） ================= */
function openSkillBreakdownPanel() {
	try {
		let content = '=== 技能拆解（代码级识别） ===\n\n';
		const me = _status.currentPhase || (game.players && game.players[0]);

		if (!me) {
			content += '未在对局中\n';
			openSimplePanel('技能拆解', content);
			return;
		}

		content += '武将: ' + (me.name || me.name1 || '?') + '\n';
		content += '技能数量: ' + ((me.skills || []).length) + '\n\n';

		/* 逐个技能用新拆解函数渲染 */
		(me.skills || []).forEach(function (sid) {
			try {
				content += renderSkillBreakdownText(sid) + '\n\n';
			} catch (e) {
				content += '--- ' + sid + ' ---\n渲染异常：' + String(e).slice(0, 60) + '\n\n';
			}
		});

		openSimplePanel('技能拆解', content);
	} catch (e) {
		openSimplePanel('技能拆解', '打开失败：' + e.message);
	}
}

/* ★ 自定义技能六维面板 */
/* ================= 自定义技能六维面板 ================= */
function openSkillCustomPanel() {
	try {
		import('./skillCustom.js').then(function (m) {
			let content = '=== 自定义技能六维面板 ===\n\n';
			
			/* 维度说明 */
			content += '【维度说明】\n';
			const dims = m.getDimDescriptions();
			for (const k in dims) {
				content += '· ' + dims[k] + '\n';
			}
			content += '\n';
			
			/* 值的范围提醒 */
			content += '【值的范围提醒】\n';
			const hints = m.getValueHints();
			for (const k in hints) {
				content += '· ' + hints[k] + '\n';
			}
			content += '\n';
			
			/* 对象说明 */
			content += '【对象说明】\n';
			const objs = m.getObjectDescriptions();
			for (const k in objs) {
				content += '· ' + objs[k] + '\n';
			}
			content += '\n';
			
			/* 模板 */
			content += '【模板】\n';
			const templates = m.getTemplates();
			for (const k in templates) {
				const t = templates[k];
				content += '· ' + t.name + '：' + t.description + '\n';
			}
			
			openSimplePanel('自定义技能六维', content);
		}).catch(function (e) {
			openSimplePanel('自定义技能六维', '打开失败：' + e.message);
		});
	} catch (e) {
		openSimplePanel('自定义技能六维', '打开失败：' + e.message);
	}
}

function openScorePanel() {
    const entries = [
        ['引擎健康度', '查看引擎各项指标', openHealthPanel],
        ['本局积分', '查看当前对局积分', openScoreDetailPanel],
        ['战术规划', '查看多步连招和残局建议', openPlanPanel],
        ['决策回放', '查看最近决策记录', openFeedbackPanel],
        ['当前配置', '查看引擎参数设置', openConfigPanel],
        ['战报归档', '查看历史对局记录', openArchivePanel],
        ['智能可视化', '查看局面、风险和学习数据', openSmartPanel],
    ];
    const html = '<div class="djsc-main-grid">' + entries.map((entry, i) => '<button type="button" class="djsc-main-entry" data-entry="' + i + '"><b>' + entry[0] + '</b><span>' + entry[1] + '</span></button>').join('') + '</div>';
    const panel = openUtilityHtml('无名AI · 决策积分引擎', html, 'djsc-panel');
    panel.querySelectorAll('[data-entry]').forEach(button => button.addEventListener('click', () => {
        try { entries[Number(button.dataset.entry)][2](); }
        catch (error) { alert('打开功能失败：' + error.message); }
    }));
}

// 保留旧版综合视图源码供迁移参考；入口不再运行这段失效的混合布局。
function _openLegacyScorePanel() {
	try {
		/* ★ 检测手机端 */
		const isMobile = (function () {
			try {
				if (lib.config.touchscreen) return true;
				if (window.innerWidth <= 768) return true;
				if (window.orientation !== undefined) return true;
				if (/Android|iPhone|iPad|iPod|Mobile|Harmony/i.test(navigator.userAgent)) return true;
			} catch (e) {}
			return false;
		})();

		/* ★ 关闭旧面板 */
		try {
			if (window.__DJSC_PANEL) {
				try { window.__DJSC_PANEL.remove(); } catch (e) {}
				window.__DJSC_PANEL = null;
			}
		} catch (e) {}

		/* ★ 照着全能搜索的结构做：全屏遮罩 + 顶部菜单 + 内容区 */
		const panel = document.createElement('div');
		panel.id = 'djsc-panel';
		panel.style.cssText = [
			'position: fixed',
			'left: 0',
			'top: 0',
			'width: 100%',
			'height: 100%',
			'background: rgba(0, 0, 0, 0.8)',
			'z-index: 2147483647',
			'color: white',
			'text-shadow: none',
		].join('; ') + ';';

		/* 顶部菜单 */
		const menu = document.createElement('div');
		menu.style.cssText = [
			'display: block',
			'position: absolute',
			'left: 0',
			'top: 0',
			'width: 100%',
			'height: 50px',
			'background: rgba(0, 0, 0, 0.6)',
			'color: white',
			'display: flex',
			'align-items: center',
			'justify-content: center',
		].join('; ') + ';';
		menu.innerHTML = '<b style="font-size:18px;color:#00FFB0;">📊 决策积分引擎</b>';
		panel.appendChild(menu);

		/* 关闭按钮（右上角） */
		const closeBtn = document.createElement('div');
		closeBtn.textContent = '✕ 关闭';
		closeBtn.style.cssText = [
			'position: absolute',
			'right: 10px',
			'top: 10px',
			'padding: 8px 16px',
			'background: red',
			'border-radius: 6px',
			'cursor: pointer',
			'font-size: 14px',
		].join('; ') + ';';
		closeBtn.addEventListener('click', function () {
			try { panel.remove(); } catch (e) {}
			window.__DJSC_PANEL = null;
		});
		panel.appendChild(closeBtn);

		/* 内容区（可滚动） */
		const content = document.createElement('div');
		content.style.cssText = [
			'position: absolute',
			'left: 0',
			'top: 50px',
			'width: 100%',
			'height: calc(100% - 50px)',
			'background: none',
			'overflow-y: auto',
			'-webkit-overflow-scrolling: touch',
			'padding: 16px',
			'box-sizing: border-box',
		].join('; ') + ';';
		panel.appendChild(content);

		document.body.appendChild(panel);
		window.__DJSC_PANEL = panel;

		/* ★ 大按钮式菜单：每个功能一个大按钮，竖排排列 */
		content.innerHTML = `
			<div style="margin-bottom: 20px;">
				<b style="font-size:16px;color:#9ad8ff;">选择功能：</b>
			</div>
			
			<div class="djsc-menu-item" data-tab="health" style="background:#14243c;border-radius:12px;padding:16px;margin:12px 0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);border-left:4px solid #7fe3a0;">
				<b style="color:#7fe3a0;font-size:16px;">🩺 引擎健康度</b>
				<div style="color:#a8b8c8;font-size:13px;margin-top:6px;">查看引擎各项指标是否正常</div>
			</div>
			
			<div class="djsc-menu-item" data-tab="score" style="background:#14243c;border-radius:12px;padding:16px;margin:12px 0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);border-left:4px solid #9ad8ff;">
				<b style="color:#9ad8ff;font-size:16px;">📈 本局积分</b>
				<div style="color:#a8b8c8;font-size:13px;margin-top:6px;">查看当前对局积分情况</div>
			</div>
			
			<div class="djsc-menu-item" data-tab="plan" style="background:#14243c;border-radius:12px;padding:16px;margin:12px 0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);border-left:4px solid #ffd479;">
				<b style="color:#ffd479;font-size:16px;">🎯 战术规划</b>
				<div style="color:#a8b8c8;font-size:13px;margin-top:6px;">查看多步连招和残局解</div>
			</div>
			
			<div class="djsc-menu-item" data-tab="feedback" style="background:#14243c;border-radius:12px;padding:16px;margin:12px 0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);border-left:4px solid #ff9c9c;">
				<b style="color:#ff9c9c;font-size:16px;">📝 决策回放</b>
				<div style="color:#a8b8c8;font-size:13px;margin-top:6px;">查看最近决策记录和六层信号</div>
			</div>
			
			<div class="djsc-menu-item" data-tab="config" style="background:#14243c;border-radius:12px;padding:16px;margin:12px 0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);border-left:4px solid #a8b8c8;">
				<b style="color:#a8b8c8;font-size:16px;">⚙️ 当前配置</b>
				<div style="color:#a8b8c8;font-size:13px;margin-top:6px;">查看当前引擎参数设置</div>
			</div>
			
			<div class="djsc-menu-item" data-tab="archive" style="background:#14243c;border-radius:12px;padding:16px;margin:12px 0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);border-left:4px solid #7fe3a0;">
				<b style="color:#7fe3a0;font-size:16px;">📁 战报归档</b>
				<div style="color:#a8b8c8;font-size:13px;margin-top:6px;">查看历史对局记录</div>
			</div>
			
			<div class="djsc-menu-item" data-tab="recommend" style="background:#14243c;border-radius:12px;padding:16px;margin:12px 0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);border-left:4px solid #9ad8ff;">
				<b style="color:#9ad8ff;font-size:16px;">🎮 选将推荐</b>
				<div style="color:#a8b8c8;font-size:13px;margin-top:6px;">根据身份推荐武将</div>
			</div>
			
			<div class="djsc-menu-item" data-tab="smart" style="background:#14243c;border-radius:12px;padding:16px;margin:12px 0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);border-left:4px solid #ffd479;">
				<b style="color:#ffd479;font-size:16px;">🧠 智能可视化</b>
				<div style="color:#a8b8c8;font-size:13px;margin-top:6px;">查看手牌推断/风险量化/身份推理/情绪状态等</div>
			</div>
		`;

		/* ★ 绑定按钮点击事件 */
		try {
			const items = content.querySelectorAll('.djsc-menu-item');
			items.forEach(function (item) {
				item.addEventListener('click', function () {
					const tab = item.getAttribute('data-tab');
					if (tab === 'smart') {
						/* 打开智能可视化面板 */
						try { openSmartPanel(); } catch (e) { alert('打开智能面板出错：' + e.message); }
					} else {
						alert('点击了：' + tab + '\n（功能开发中）');
					}
				});
			});
		} catch (e) {}

		/* ★ 内嵌 CSS 样式表（用 CSS 控制布局，不用 JS 后处理） */
		const style = document.createElement('style');
		style.textContent = `
			#djsc-fullscreen-panel * {
				box-sizing: border-box;
				word-break: break-all;
				line-height: 2 !important;
			}
			#djsc-fullscreen-panel div {
				display: block !important;
				width: 100% !important;
				margin: 10px 0 !important;
				padding: 12px 14px !important;
				background: #14243c !important;
				border-radius: 8px !important;
				box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important;
			}
			#djsc-fullscreen-panel b {
				display: block !important;
				width: 100% !important;
				margin: 10px 0 !important;
				padding: 10px 12px !important;
				background: rgba(154,216,255,0.1) !important;
				border-left: 4px solid #9ad8ff !important;
				border-radius: 4px !important;
				font-size: 15px !important;
			}
			#djsc-fullscreen-panel span {
				display: block !important;
				width: 100% !important;
				margin: 6px 0 !important;
				padding: 6px 10px !important;
			}
			#djsc-fullscreen-panel br {
				display: block !important;
				content: "" !important;
				margin: 4px 0 !important;
			}
			#djsc-fullscreen-panel details {
				display: block !important;
				width: 100% !important;
				margin: 10px 0 !important;
			}
			#djsc-fullscreen-panel summary {
				display: block !important;
				width: 100% !important;
				cursor: pointer !important;
				padding: 8px 12px !important;
				background: #1a2637 !important;
				border-radius: 4px !important;
			}
			#djsc-fullscreen-panel button {
				display: inline-block !important;
				margin: 6px !important;
				padding: 8px 14px !important;
			}
		`;
		dlg.appendChild(style);

		/* ★ 内容容器 */
		const d = document.createElement("div");
		d.style.cssText = "color:#dbe7f5;font-size:14px;line-height:1.8;padding:12px;box-sizing:border-box;width:100%;";

		/* ★ 大按钮式 UI：每个功能一个大按钮，点击才展开 */
		d.innerHTML = `
			<div style="text-align:center;margin-bottom:20px;">
				<b style="font-size:18px;color:#00FFB0;">📊 决策积分引擎</b>
			</div>
			
			<div class="djsc-menu-item" data-tab="health" style="background:#14243c;border-radius:12px;padding:16px;margin:10px 0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);border-left:4px solid #7fe3a0;">
				<b style="color:#7fe3a0;font-size:15px;">🩺 引擎健康度</b>
				<div style="color:#9ad8ff;font-size:12px;margin-top:4px;">查看引擎各项指标是否正常</div>
			</div>
			
			<div class="djsc-menu-item" data-tab="score" style="background:#14243c;border-radius:12px;padding:16px;margin:10px 0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);border-left:4px solid #9ad8ff;">
				<b style="color:#9ad8ff;font-size:15px;">📈 本局积分</b>
				<div style="color:#9ad8ff;font-size:12px;margin-top:4px;">查看当前对局积分情况</div>
			</div>
			
			<div class="djsc-menu-item" data-tab="plan" style="background:#14243c;border-radius:12px;padding:16px;margin:10px 0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);border-left:4px solid #ffd479;">
				<b style="color:#ffd479;font-size:15px;">🎯 战术规划</b>
				<div style="color:#9ad8ff;font-size:12px;margin-top:4px;">查看多步连招和残局解</div>
			</div>
			
			<div class="djsc-menu-item" data-tab="feedback" style="background:#14243c;border-radius:12px;padding:16px;margin:10px 0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);border-left:4px solid #ff9c9c;">
				<b style="color:#ff9c9c;font-size:15px;">📝 决策回放</b>
				<div style="color:#9ad8ff;font-size:12px;margin-top:4px;">查看最近决策记录和六层信号</div>
			</div>
			
			<div class="djsc-menu-item" data-tab="config" style="background:#14243c;border-radius:12px;padding:16px;margin:10px 0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);border-left:4px solid #a8b8c8;">
				<b style="color:#a8b8c8;font-size:15px;">⚙️ 当前配置</b>
				<div style="color:#9ad8ff;font-size:12px;margin-top:4px;">查看当前引擎参数设置</div>
			</div>
			
			<div class="djsc-menu-item" data-tab="archive" style="background:#14243c;border-radius:12px;padding:16px;margin:10px 0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);border-left:4px solid #7fe3a0;">
				<b style="color:#7fe3a0;font-size:15px;">📁 战报归档</b>
				<div style="color:#9ad8ff;font-size:12px;margin-top:4px;">查看历史对局记录</div>
			</div>
			
			<div class="djsc-menu-item" data-tab="recommend" style="background:#14243c;border-radius:12px;padding:16px;margin:10px 0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);border-left:4px solid #9ad8ff;">
				<b style="color:#9ad8ff;font-size:15px;">🎮 选将推荐</b>
				<div style="color:#9ad8ff;font-size:12px;margin-top:4px;">根据身份推荐武将</div>
			</div>
			
			<div class="djsc-menu-item" data-tab="smart" style="background:#14243c;border-radius:12px;padding:16px;margin:10px 0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);border-left:4px solid #ffd479;">
				<b style="color:#ffd479;font-size:15px;">🧠 智能可视化</b>
				<div style="color:#9ad8ff;font-size:12px;margin-top:4px;">查看手牌推断/风险量化/身份推理等</div>
			</div>
		`;

		/* ★ 绑定按钮点击事件 */
		try {
			const items = d.querySelectorAll('.djsc-menu-item');
			items.forEach(function (item) {
				item.addEventListener('click', function () {
					const tab = item.getAttribute('data-tab');
					if (tab === 'smart') {
						/* 打开智能可视化面板 */
						try { openSmartPanel(); } catch (e) { alert('打开智能面板出错：' + e.message); }
					} else {
						// 这里可以展开对应内容，暂时先 alert
						alert('点击了：' + tab);
					}
				});
			});
		} catch (e) {}
		/* ★ 引擎健康度体检 */
		try {
			const hc = healthCheck();
			const okCount = hc.results.filter(function (r) { return r.ok; }).length;
			const totalCount = hc.results.length;
			const hcColor = hc.allOk ? '#7fe3a0' : (okCount >= totalCount * 0.7 ? '#ffd479' : '#ff9c9c');
			html += "<div style='padding:8px;background:rgba(127,227,160,0.05);border-left:3px solid " + hcColor + ";border-radius:4px;margin-bottom:10px;'>";
			html += "<b style='color:" + hcColor + "'>🩺 引擎健康度：" + okCount + "/" + totalCount + " 正常</b>";
			html += "<details style='margin-top:6px;'>";
			html += "<summary style='cursor:pointer;color:#9ad8ff;font-size:11px;'>展开详情</summary>";
			html += "<div style='font-size:11px;margin-top:4px;'>";
			hc.results.forEach(function (r) {
				const col = r.ok ? "#7fe3a0" : "#ff9c9c";
				const icon = r.ok ? "✓" : "✗";
				html += "<div style='margin:2px 0;'><span style='color:" + col + "'>" + icon + "</span> ";
				html += "<span style='display:inline-block;width:100px;color:#dbe7f5;'>" + r.name + "</span>";
				html += "<span style='color:#a8b8c8;'>" + r.detail + "</span></div>";
			});
			html += "</div></details></div>";
		} catch (e) {
			html += "<div style='color:#ff9c9c;'>健康度检查异常：" + String(e).slice(0, 60) + "</div>";
		}

		/* ★ 选将推荐 */
		try {
			const me = game.me;
			if (me && me.identity) {
				const allChars = Object.keys(lib.character || {}).filter(function (id) {
					return !id.startsWith('_') && !lib.character[id].isHidden;
				});
				const recs = recommendChars(me.identity, allChars.slice(0, 50), 3);
				if (recs.length) {
					html += "<div style='padding:8px;background:rgba(127,227,160,0.05);border-left:3px solid #7fe3a0;border-radius:4px;margin-bottom:10px;'>";
					html += "<b style='color:#7fe3a0'>🎯 选将推荐（基于身份 " + me.identity + "）</b>";
					html += "<div style='font-size:11px;margin-top:4px;'>";
					recs.forEach(function (r) {
						html += "<div style='margin:3px 0;'>";
						html += "<span style='color:#ffd479'>" + r.rank + ".</span> ";
						html += "<span style='color:#dbe7f5;font-weight:500;'>" + r.name + "</span>";
						html += " <span style='color:#9ad8ff;font-size:10px;'>(" + (r.prof ? r.prof.role : '?') + " · 评分 " + r.score + ")</span>";
						html += "</div>";
					});
					html += "</div></div>";
				}
			}
		} catch (e) {}

		/* ★ 接管层状态 */
		try {
			const os = overrideStatus();
			if (os) {
				const layers = os.layers || {};
				const circuit = os.circuit || {};
				let layerHtml = "<div style='padding:8px;background:rgba(154,216,255,0.05);border-left:3px solid #9ad8ff;border-radius:4px;margin-bottom:10px;'>";
				layerHtml += "<b style='color:#9ad8ff'>🔧 接管层状态（硬接管 / 软接管双轨）</b>";
				layerHtml += "<div style='font-size:11px;margin-top:4px;'>";
				['use', 'respond', 'discard', 'compare'].forEach(function (k) {
					const L = layers[k] || {};
					const C = circuit[k] || {};
					const col = C.tripped ? '#ff9c9c' : (L.installed ? '#7fe3a0' : (L.enabled ? '#ffd479' : '#666'));
					const label = C.tripped ? '熔断中' : (L.installed ? '已安装' : (L.enabled ? '等待安装' : '未启用'));
					layerHtml += "<div style='margin:2px 0;'>";
					layerHtml += "<span style='display:inline-block;width:64px;color:#dbe7f5;'>" + k + "</span>";
					layerHtml += "<span style='display:inline-block;width:72px;color:" + col + ";'>" + label + "</span>";
					if (C.recentCount) layerHtml += "<span style='color:#666;font-size:10px;'>近异常 " + C.recentCount + " 次</span>";
					if (C.cooldownRemain) layerHtml += "<span style='color:#ff9c9c;font-size:10px;'>（冷却 " + Math.round(C.cooldownRemain / 1000) + "s）</span>";
					layerHtml += "</div>";
				});
				layerHtml += "<div style='font-size:10px;color:#666;margin-top:4px;'>· 硬接管挂掉后，软接管（aiOverride）自动兜底，不会让 AI 摆烂。</div>";
				layerHtml += "</div></div>";
				html += layerHtml;
			}
		} catch (e) {}
		const rr0 = getRound(); const ks = Object.keys(rr0);
		if (ks.length) {
			ks.forEach(function (k) { html += k + "：<b style='color:" + (rr0[k] >= 0 ? "#7fe3a0" : "#ff9c9c") + "'>" + (rr0[k] > 0 ? "+" : "") + rr0[k] + "</b><br>"; });
			html += "合计：" + Math.round(ks.reduce(function (s, k) { return s + rr0[k]; }, 0) * 100) / 100 + "<br>";
		} else { html += "进入对局后自动记分（异步延迟：成功得分）<br>"; }
		html += "<br><b>② 自写/第三方扩展识别（代码级收益分析）</b><br>";
		try {
			const sc = scanCharacters();
			try { const ar = buildAutoSkillRules(); html += "技能最佳策略：手动 " + Object.keys(SKILL_RULE).length + " + 自动 " + Object.keys(ar).length + " 条（以 ID 为键）<br>"; } catch (eA2) {}
			html += "识别武将 " + sc.total + " 名，其中含代码收益的 " + sc.ext + " 名：<br>";
			sc.cards.slice(0, 12).forEach(function (c) { html += "· " + c.id + "（体力" + c.hp + "）：" + c.tip + "<br>"; });
			if (sc.cards.length > 12) html += "…共 " + sc.cards.length + " 名<br>";
		} catch (eS) { html += "识别失败：" + String(eS) + "<br>"; }
		html += "<br><b>③ 通用策略（时机→策略，全模式通用）</b><br>";
		const stKeys = Object.keys(STRATEGY).slice(0, 14);
		stKeys.forEach(function (k) { html += "· " + k + "：" + STRATEGY[k].txt + "<br>"; });
		html += "<br><b>④ 时机价值表（源码提取，示例）</b><br>";
		["gameStart", "phaseDrawBegin", "phaseUseBegin", "damageAfter", "dying", "dieAfter", "phaseDiscardEnd", "turnOverAfter", "chooseToRespond", "gainMaxHpBegin"].forEach(function (k) {
			if (VAL_TIMING[k] !== undefined) html += "· " + k + "：" + (VAL_TIMING[k] > 0 ? "+" : "") + VAL_TIMING[k] + "分<br>";
		});
		html += "<br><b>⑥ 本局已触发行为（用于补充规则）</b><br>";
		try {
			const RECx = getREC(); const ek = Object.keys(RECx.effects || {}), ck = Object.keys(RECx.cards || {});
			if (ek.length || ck.length) {
				html += "效果触发：" + ek.map(function (k) { return k + "×" + RECx.effects[k]; }).join("、") + "<br>";
				html += "卡牌使用：" + ck.map(function (k) { return k + "×" + RECx.cards[k]; }).join("、") + "<br>";
			} else html += "暂无（进入对局后自动记录）<br>";
		} catch (eR) {}
		html += "<br><b>⑦ 决策可视化（策略命中 + 小模型概率 + 偏置）</b><br>";
		try {
			const md = modelDecision();
			if (md && !md.err) {
				if (md.rules) html += "策略命中：<b style='color:#7fe3a0;'>" + md.rules.action + "</b>（" + md.rules.reason + "）<br>";
				if (md.probs) {
					html += "决策概率：<br>" + probBarHtml(md.probs, md.labels);
					const top = Math.max.apply(null, md.probs), ti = md.probs.indexOf(top);
					html += "倾向：<b>" + md.labels[ti] + "</b>（" + Math.round(top * 100) + "%）<br>";
				}
			} else html += "模型决策不可用（进入对局后有效）<br>";
		} catch (eM) { html += "模型决策不可用<br>"; }
		html += "<br><b>⑧ 目标威胁评估（整合 rank 体系）</b><br>";
		try {
			const me2 = _status.currentPhase || (game.players && game.players[0]);
			if (me2) {
				(game.players || []).forEach(function (pp) {
					if (pp === me2 || !pp.alive) return;
					const th = threatOf(pp);
					const inf = identityOf(pp);
					const conf = confidenceOf(pp);
					const infTag = inf !== "unknown" ? "<span style='color:#ffd479'>[" + inf + " " + Math.round(conf * 100) + "%]</span>" : "<span style='color:#666'>[?]</span>";
					html += "· " + (pp.name || "?") + "：威胁 " + th + (isEnemyOf(me2, pp) ? "（敌）" : "（友）") + " " + infTag + "<br>";
				});
			} else html += "进入对局后评估<br>";
		} catch (eT) {}
		html += "<br><b>⑧b 武将技能配合策略（当前武将）</b><br>";
		try {
			const mc = _status.currentPhase || (game.players && game.players[0]);
			if (mc) {
				const cb = charComboOf(mc.name);
				if (cb) html += "· " + (mc.name || "?") + "：" + cb.style + "流——" + cb.advice + "<br>";
				else html += "· 进入对局后评估<br>";
			} else html += "· 进入对局后评估<br>";
		} catch (eC2) {}
		html += "<br><b>⑧b2 技能标签（本武将）</b><br>";
		try {
			const mc3 = _status.currentPhase || (game.players && game.players[0]);
			if (mc3) {
				const agg = aggregateSkillTags(mc3.skills || []);
				const fmt = function (v) { return Math.round(v * 100) + "%"; };
				html += "· 攻" + fmt(agg.atk) + " 爆" + fmt(agg.burst) + " 防" + fmt(agg.def) + " 控" + fmt(agg.ctrl) + " 辅" + fmt(agg.aux) + "<br>";
				html += "· 过牌" + fmt(agg.draw) + " 回复" + fmt(agg.sustain) + " 群体" + fmt(agg.aoe) + " 限定" + (agg.limit ? "有" : "无") + " 觉醒" + (agg.awaken ? "有" : "无") + "<br>";
				html += "· 消耗：血" + agg.cost.hp + " / 牌" + agg.cost.cards + "<br>";
			} else html += "· 进入对局后评估<br>";
		} catch (e) {}
		html += "<br><b>⑧c 局势感知 + 连招 + 记忆</b><br>";
		try {
			const mc2 = _status.currentPhase || (game.players && game.players[0]);
			if (mc2) {
				const st = situationFactor(mc2);
				const cmb = detectCombo(mc2);
				html += "· 局势：" + st.mode + "（基础节奏×" + st.tempo + "，" + st.desc + "）<br>";
				html += "· 节奏阶段：<b style='color:#ffd479'>" + (st.stage || "mid") + "</b>（" + (st.tempoDesc || "常规期") + "）｜ 进攻×" + (st.atkMul || 1) + " 保留×" + (st.keepMul || 1) + " 爆发×" + (st.burstMul || 1) + "<br>";
				html += "· 连招：" + (cmb.length ? cmb.map(function (c) { return c.name + "+" + c.bonus; }).join("、") : "暂无") + "<br>";
				html += "· 记忆：已观测攻击 " + Object.keys(getMEM().atk).length + " 目标，命中记录 " + Object.keys(getMEM().hit).length + " 目标<br>";
			} else html += "· 进入对局后评估<br>";
		} catch (eC3) {}
		html += "<br><b>⑧d 团队协同（集火 / 接力保护 / 技能联动）</b><br>";
		try {
			const mcTeam = _status.currentPhase || (game.players && game.players[0]);
			if (mcTeam) {
				const tp = teamPlan(mcTeam);
				if (tp.focus) {
					html += "· 集火目标：<b style='color:#ff9c9c'>" + tp.focus.name + "</b>（压力分 " + tp.focus.score + "）<br>";
				} else {
					html += "· 集火目标：暂无（队友尚未形成共同压力）<br>";
				}
				if (tp.protect) {
					html += "· 接力保护：<b style='color:#7fe3a0'>" + tp.protect.name + "</b>（保护分 " + tp.protect.score + "）<br>";
				} else {
					html += "· 接力保护：暂无紧急队友<br>";
				}
				if (tp.protectList && tp.protectList.length > 1) {
					html += "· 候选保护：";
					tp.protectList.slice(1, 4).forEach(function (x) { html += x.name + "(" + x.score + ") "; });
					html += "<br>";
				}
				if (tp.combos && tp.combos.length) {
					html += "· 技能联动：";
					tp.combos.forEach(function (c, i) {
						if (i >= 4) return;
						html += "【" + c.ally + "·" + c.skill + "】+" + c.bonus + " ";
					});
					html += "<br>";
				} else {
					html += "· 技能联动：暂无<br>";
				}
			} else html += "· 进入对局后评估<br>";
		} catch (eT) { html += "· 团队评估异常：" + String(eT).slice(0, 40) + "<br>"; }
		html += "<br><b>⑧e 位置与距离压力</b><br>";
		try {
			const mcSeat = _status.currentPhase || (game.players && game.players[0]);
			if (mcSeat) {
				const seat = seatPressure(mcSeat);
				const dp = distancePressure(mcSeat);
				html += "· 座位压力（未来 3 席，距离反比加权）：<b style='color:#ffd479'>" + seat.enemyPressure + "</b><br>";
				if (seat.nextEnemy) {
					html += "· 最近敌方下家：<b style='color:#ff9c9c'>" + (seat.nextEnemy.name || "?") + "</b>（第 " + seat.nextEnemyDist + " 席，乐/兵优先目标）<br>";
				} else {
					html += "· 最近敌方下家：无（未来 3 席无敌）<br>";
				}
				if (seat.prevEnemy) {
					html += "· 上家敌人：<b style='color:#ff9c9c'>" + (seat.prevEnemy.name || "?") + "</b>（防御牌保留 ×1.15）<br>";
				} else {
					html += "· 上家：非敌方（防御压力低）<br>";
				}
				html += "· 敌方距离分布：平均 <b>" + dp.avg + "</b>（近 " + dp.min + " / 远 " + dp.max + "，共 " + dp.count + " 人）<br>";
				try {
					const myHand = mcSeat.getCards ? mcSeat.getCards("h") : [];
					const mounts = myHand.filter(function (c) {
						try {
							const subs = get.subtypes ? get.subtypes(c) : [];
							return subs && (subs.indexOf("equip3") >= 0 || subs.indexOf("equip4") >= 0);
						} catch (e) { return false; }
					});
					if (mounts.length) {
						html += "· 手持坐骑动态价值：";
						mounts.forEach(function (c, i) {
							if (i >= 3) return;
							html += (c.name || "?") + "=" + mountValue(mcSeat, c) + " ";
						});
						html += "<br>";
					}
				} catch (e) {}
			} else {
				html += "· 进入对局后评估<br>";
			}
		} catch (eSeat) {
			html += "· 位置评估异常：" + String(eSeat).slice(0, 40) + "<br>";
		}
		html += "<br><b>⑧f 资源经济（手牌 / 装备 / 血量三种货币）</b><br>";
		try {
			const mcEcon = _status.currentPhase || (game.players && game.players[0]);
			if (mcEcon) {
				const eb = resourceBalance(mcEcon);
				const sv = sellHpValue(mcEcon);
				html += "· 手牌货币：<b style='color:#9ad8ff'>" + eb.handCount + "</b> 张，总价值 <b>" + eb.handValue + "</b><br>";
				html += "· 装备货币：<b style='color:#9ad8ff'>" + eb.equipCount + "</b> 件，总价值 <b>" + eb.equipValue + "</b><br>";
				html += "· 血量货币：<b style='color:" + (eb.hpRatio >= 0.7 ? "#7fe3a0" : (eb.hpRatio >= 0.4 ? "#ffd479" : "#ff9c9c")) + "'>" + eb.hp + "/" + eb.maxHp + "</b>（比率 " + Math.round(eb.hpRatio * 100) + "%）<br>";
				html += "· 综合价值：<b>" + eb.totalValue + "</b>（血量按 4 分/滴折算）<br>";
				html += "· 敌方拆牌压力：<b style='color:#ffd479'>" + Math.round((eb.strip.pressure) * 100) + "%</b>（预期损失 " + eb.strip.risk + " 分）<br>";
				html += "· 卖血汇率：1 HP ≈ <b style='color:#9ad8ff'>" + sv + "</b> 张牌（血量越低越贵）<br>";
			} else html += "· 进入对局后评估<br>";
		} catch (eEcon) {
			html += "· 经济评估异常：" + String(eEcon).slice(0, 40) + "<br>";
		}
		html += "<br><b>⑧g 对手风格表（博弈建模：从行为推断对手性格）</b><br>";
		try {
			const mcStyle = _status.currentPhase || (game.players && game.players[0]);
			if (mcStyle) {
				const alive = (game.players || []).filter(function (p) { return p.alive && p !== mcStyle; });
				if (!alive.length) {
					html += "· 无其他存活玩家<br>";
				} else {
					html += "<div style='font-size:11px;'>";
					html += "<span style='display:inline-block;width:60px;color:#9ad8ff'>玩家</span>";
					html += "<span style='display:inline-block;width:70px;color:#9ad8ff'>风格</span>";
					html += "<span style='display:inline-block;width:52px;color:#9ad8ff'>攻击</span>";
					html += "<span style='display:inline-block;width:52px;color:#9ad8ff'>援助</span>";
					html += "<span style='display:inline-block;width:52px;color:#9ad8ff'>记仇</span>";
					html += "<span style='display:inline-block;width:60px;color:#9ad8ff'>闪避修正</span>";
					html += "<span style='display:inline-block;width:60px;color:#9ad8ff'>来源</span><br>";
					alive.forEach(function (p) {
						const s = styleOf(p);
						const tagColor = s.tag === "aggressive" ? "#ff9c9c"
							: s.tag === "cautious" ? "#7fe3a0"
							: s.tag === "vengeful" ? "#ffd479"
							: s.tag === "balanced" ? "#9ad8ff" : "#666";
						const shanF = s.tag === "aggressive" ? "×0.88"
							: s.tag === "cautious" ? "×1.12"
							: s.tag === "vengeful" ? "×1.05" : "×1.00";
						let srcLabel = "本局", srcCol = "#7fe3a0";
						if (s.source === "stored") { srcLabel = "历史"; srcCol = "#ffd479"; }
						else if (s.source === "unknown") { srcLabel = "未知"; srcCol = "#666"; }
						html += "<span style='display:inline-block;width:60px'>" + (p.name || "?").slice(0, 4) + "</span>";
						html += "<span style='display:inline-block;width:70px;color:" + tagColor + "'>" + s.tag + "</span>";
						html += "<span style='display:inline-block;width:52px;color:#ff9c9c'>" + s.attacks + "</span>";
						html += "<span style='display:inline-block;width:52px;color:#7fe3a0'>" + s.aids + "</span>";
						html += "<span style='display:inline-block;width:52px;color:#ffd479'>" + Math.round(s.vengeful * 100) + "%</span>";
						html += "<span style='display:inline-block;width:60px;color:#9ad8ff'>" + shanF + "</span>";
						html += "<span style='display:inline-block;width:60px;color:" + srcCol + "'>" + srcLabel + "</span><br>";
					});
					html += "</div>";
					html += "· 说明：<span style='color:#ff9c9c'>激进</span> 留杀不留闪，优先集火；<span style='color:#7fe3a0'>保守</span> 留闪留桃，命中难；<span style='color:#ffd479'>记仇</span> 会反击打他的人。<br>";
					try {
						const st = storeStats();
						if (st) {
							html += "· 跨局记忆库：<b style='color:#ffd479'>" + st.entries + "</b> 位玩家，" + st.samples + " 条样本<br>";
						}
					} catch (e) {}
				}
			} else {
				html += "· 进入对局后评估<br>";
			}
		} catch (eStyle) {
			html += "· 风格评估异常：" + String(eStyle).slice(0, 40) + "<br>";
		}
		html += "<br><b>⑧i 行为观察矩阵（行=主动方，列=被动方；正=敌对，负=友好）</b><br>";
		try {
			const alivePlayers = (game.players || []).filter(function (p) { return p.alive; });
			if (alivePlayers.length < 2) html += "· 对局信息不足<br>";
			else {
				html += "<div style='font-size:11px;'>";
				html += "<span style='display:inline-block;width:60px;'></span>";
				alivePlayers.forEach(function (p) {
					html += "<span style='display:inline-block;width:52px;text-align:center;color:#9ad8ff'>" + (p.name || "?").slice(0, 4) + "</span>";
				});
				html += "<br>";
				alivePlayers.forEach(function (row) {
					html += "<span style='display:inline-block;width:60px;color:#9ad8ff'>" + (row.name || "?").slice(0, 4) + "</span>";
					alivePlayers.forEach(function (col) {
						if (row === col) {
							html += "<span style='display:inline-block;width:52px;text-align:center;color:#666'>—</span>";
						} else {
							const r = relationOf(row, col);
							const color = r > 1.5 ? "#ff9c9c" : (r < -1.5 ? "#7fe3a0" : "#9ad8ff");
							html += "<span style='display:inline-block;width:52px;text-align:center;color:" + color + "'>" + (r > 0 ? "+" : "") + Math.round(r * 10) / 10 + "</span>";
						}
					});
					html += "<br>";
				});
				html += "</div>";
				html += "<br>· 整体倾向：<br>";
				alivePlayers.forEach(function (p) {
					const h = hostilityOf(p);
					const f = friendlinessOf(p);
					html += "  · " + (p.name || "?") + "：敌对 <span style='color:#ff9c9c'>" + (Math.round(h * 10) / 10) + "</span> / 友好 <span style='color:#7fe3a0'>" + (Math.round(f * 10) / 10) + "</span><br>";
				});
			}
		} catch (e) {}
		html += "<br><b>⑧j 身份推理矩阵</b><br>";
		try {
			if (currentMode() !== "identity") {
				html += "· 仅身份局生效<br>";
			} else {
				const alivePlayers = (game.players || []).filter(function (p) { return p.alive; });
				html += "<div style='font-size:11px;'>";
				html += "<span style='display:inline-block;width:60px;color:#9ad8ff'>玩家</span>";
				html += "<span style='display:inline-block;width:60px;color:#9ad8ff'>推理</span>";
				html += "<span style='display:inline-block;width:52px;color:#9ad8ff'>反</span>";
				html += "<span style='display:inline-block;width:52px;color:#9ad8ff'>忠</span>";
				html += "<span style='display:inline-block;width:52px;color:#9ad8ff'>内</span><br>";
				alivePlayers.forEach(function (p) {
					const b = beliefOf(p) || { fan: 0, zhong: 0, nei: 0 };
					const inf = identityOf(p);
					const infColor = inf === "fan" ? "#ff9c9c" : (inf === "zhong" ? "#7fe3a0" : (inf === "nei" ? "#ffd479" : "#666"));
					html += "<span style='display:inline-block;width:60px'>" + (p.name || "?").slice(0, 4) + "</span>";
					html += "<span style='display:inline-block;width:60px;color:" + infColor + "'>" + inf + "</span>";
					html += "<span style='display:inline-block;width:52px;color:#ff9c9c'>" + Math.round(b.fan * 100) + "%</span>";
					html += "<span style='display:inline-block;width:52px;color:#7fe3a0'>" + Math.round(b.zhong * 100) + "%</span>";
					html += "<span style='display:inline-block;width:52px;color:#ffd479'>" + Math.round(b.nei * 100) + "%</span><br>";
				});
				html += "</div>";
			}
		} catch (e) {}
		html += "<br><b>⑩ 全决策点建议（技能/分支/目标）</b><br>";
		try {
			const adv = advice();
			if (adv) html += (adv.err ? ("· 建议错误：" + adv.err) : ("· 技能：" + (adv.skill || "无") + "（" + (adv.skillCond || "") + "）<br>· 分支：" + adv.branch + "<br>· 目标：" + (adv.target || "无") + "（威胁" + adv.targetThreat + "）")) + "<br>";
			else html += "· 进入对局后评估<br>";
		} catch (eA) {}
		html += "<br><b>⑨ 当前配置</b><br>";
		try {
			html += "决策模式=" + cfg("mode", "mix") + "；进攻偏置=" + cfg("atkBias", 1) + "；防守偏置=" + cfg("defBias", 1) + "；伤害倍率=" + cfg("dmgRate", 1) + "；摸牌倍率=" + cfg("drawRate", 1) + "；弃牌惩罚倍率=" + cfg("discardRate", 1) + "<br>";
			try {
				const preset = cfg("riskProfile", "custom");
				const PS = { aggressive: {agg:80,rsk:70,team:40}, balanced: {agg:50,rsk:50,team:50}, cautious: {agg:30,rsk:30,team:70}, loner: {agg:70,rsk:60,team:10}, guardian: {agg:30,rsk:20,team:90} };
				let agg, rsk, tea;
				if (preset !== "custom" && PS[preset]) { agg = PS[preset].agg; rsk = PS[preset].rsk; tea = PS[preset].team; }
				else {
					agg = Number(cfg("personalityAggression", 50)) || 50;
					rsk = Number(cfg("personalityRisk", 50)) || 50;
					tea = Number(cfg("personalityTeam", 50)) || 50;
				}
				const mcP = _status.currentPhase || (game.players && game.players[0]);
				let idMod = { agg: 0, rsk: 0, team: 0 };
				let idTag = "none";
				try {
					const md = (_status && _status.mode) || (get && get.mode ? get.mode() : "");
					if ((md === "identity" || md === "guozhan") && mcP && mcP.identity) {
						const IM = { zhu: {agg:-15,rsk:-10,team:10}, zhong: {agg:5,rsk:-5,team:15}, mingzhong: {agg:5,rsk:-5,team:15}, fan: {agg:15,rsk:10,team:5}, nei: {agg:5,rsk:15,team:-10} };
						if (IM[mcP.identity]) { idMod = IM[mcP.identity]; idTag = mcP.identity; }
					}
				} catch (eId) {}
				const effAgg = Math.max(0, Math.min(100, agg + idMod.agg));
				const effRsk = Math.max(0, Math.min(100, rsk + idMod.rsk));
				const effTea = Math.max(0, Math.min(100, tea + idMod.team));
				const bar3 = function (label, base, eff, color) {
					return "<div style='margin:3px 0;font-size:11px;'>" +
						"<span style='display:inline-block;width:52px;color:#9ad8ff;'>" + label + "</span>" +
						"<span style='display:inline-block;width:180px;height:10px;background:#14243c;border-radius:5px;overflow:hidden;vertical-align:middle;position:relative;'>" +
						"<span style='position:absolute;left:0;top:0;width:" + base + "%;height:100%;background:" + color + ";opacity:0.35;'></span>" +
						"<span style='position:absolute;left:0;top:0;width:" + eff + "%;height:100%;background:" + color + ";'></span>" +
						"</span>" +
						"<span style='margin-left:6px;color:#dbe7f5;'>" + eff +
						(base !== eff ? " <span style='color:#666;font-size:10px;'>（底" + base + "）</span>" : "") +
						"</span></div>";
				};
				const idLabel = idTag === "none" ? "" : "｜身份基线=" + idTag + "（" + (idMod.agg >= 0 ? "+" : "") + idMod.agg + " / " + (idMod.rsk >= 0 ? "+" : "") + idMod.rsk + " / " + (idMod.team >= 0 ? "+" : "") + idMod.team + "）";
				html += "<b style='color:#9ad8ff'>AI 性格三维（预设=" + preset + idLabel + "）：</b><br>";
				html += bar3("攻守", agg, effAgg, "#ff9c9c");
				html += bar3("冒险", rsk, effRsk, "#ffd479");
				html += bar3("团队", tea, effTea, "#7fe3a0");
				html += "<div style='font-size:10px;color:#666;'>· 深色条=应用身份后；浅色底=玩家设置。非身份局身份基线不生效。</div>";
				/* 分享字符串 */
				html += "<div style='margin-top:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;'>";
				html += "<span style='color:#666;font-size:11px;'>分享字符串：</span>";
				html += "<code id='djsc-share-code' style='flex:1;min-width:180px;padding:3px 6px;background:#0d1622;border:1px solid #2a3a52;border-radius:4px;color:#7fe3a0;font-size:11px;user-select:all;'>" + (exportPersonality() || "（导出失败）") + "</code>";
				html += "<button class='djsc-btn' data-act='copy-share' style='padding:3px 10px;border-radius:4px;border:1px solid #2a3a52;background:#14243c;color:#7fe3a0;cursor:pointer;font-size:11px;'>复制</button>";
				html += "<button class='djsc-btn' data-act='paste-share' style='padding:3px 10px;border-radius:4px;border:1px solid #2a3a52;background:#14243c;color:#ffd479;cursor:pointer;font-size:11px;'>导入</button>";
				html += "</div>";
				/* 模板市场 */
				html += "<div style='margin-top:6px;font-size:11px;'>";
				html += "<span style='color:#9ad8ff'>模板市场：</span>";
				html += "<select class='djsc-btn' data-act='apply-template' style='margin-left:6px;padding:3px 6px;border-radius:4px;border:1px solid #2a3a52;background:#14243c;color:#dbe7f5;font-size:11px;'>";
				html += "<option value=''>— 选择模板 —</option>";
				allTemplates().forEach(function (tp) {
					const label = tp.custom ? "★ " + tp.name : tp.name;
					html += "<option value='" + tp.key + "'>" + label + "：" + tp.desc + "</option>";
				});
				html += "</select>";
				html += "</div>";
				/* 自定义模板：保存 / 删除 */
				html += "<div style='margin-top:4px;font-size:11px;'>";
				html += "<span style='color:#9ad8ff'>自定义：</span>";
				html += "<input class='djsc-btn' data-act='tpl-name' placeholder='模板名' maxlength='12' style='width:90px;margin:0 4px;padding:2px 6px;border-radius:3px;border:1px solid #2a3a52;background:#0d1622;color:#dbe7f5;font-size:11px;' />";
				html += "<button class='djsc-btn' data-act='tpl-save' style='padding:2px 10px;border-radius:3px;border:1px solid #2a3a52;background:#14243c;color:#7fe3a0;cursor:pointer;font-size:11px;'>保存当前三维</button>";
				html += "<button class='djsc-btn' data-act='tpl-manage' style='padding:2px 10px;border-radius:3px;border:1px solid #2a3a52;background:#14243c;color:#ff9c9c;cursor:pointer;font-size:11px;margin-left:4px;'>管理</button>";
				html += "</div>";
				/* 性格雷达图 */
				try {
					html += "<div style='display:flex;justify-content:center;margin-top:6px;'>";
					html += radarChart(["攻守", "冒险", "团队"], [effAgg, effRsk, effTea], { size: 160 });
					html += "</div>";
				} catch (eRadar) {}
			} catch (eP) { html += "性格解析异常<br>"; }
		} catch (eC8) {}
		/* ★ 一键推荐配置 */
		try {
			html += "<div style='margin-top:8px;padding:8px;background:rgba(0,255,176,0.05);border-radius:6px;'>";
			html += "<b style='color:#7fe3a0'>🎯 一键推荐配置：</b><br>";
			html += "<div style='display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;'>";
			listRecommends().forEach(function (r) {
				html += "<button class='djsc-btn djsc-recommend' data-key='" + r.key + "' ";
				html += "style='padding:4px 10px;border-radius:4px;border:1px solid #2a3a52;background:#14243c;color:#7fe3a0;cursor:pointer;font-size:11px;' ";
				html += "title='" + r.desc + "'>" + r.name + "</button>";
			});
			html += "<button class='djsc-btn' data-act='snapshot-config' ";
			html += "style='padding:4px 10px;border-radius:4px;border:1px solid #2a3a52;background:#14243c;color:#9ad8ff;cursor:pointer;font-size:11px;'>导出当前配置</button>";
			html += "</div>";
			html += "</div>";
		} catch (eRec) {}
		html += "<br><b>⑨ 最近记分明细</b><br>";
		try {
			const raw = getScoreLog().slice(-10);
			/* 合并同 tag 的连续项；减分不写具体角色名，直接写阵营 */
			const merged = [];
			raw.forEach(function (sl) {
				const last = merged[merged.length - 1];
				if (last && last.tag === sl.tag && last.pts * sl.pts > 0) {
					last.pts += sl.pts;
				} else {
					merged.push({ char: sl.char, pts: sl.pts, tag: sl.tag });
				}
			});
			if (merged.length) merged.forEach(function (sl) {
				const isNeg = sl.pts < 0;
				/* 减分项：不写具体角色名，直接写阵营 */
				const charLabel = isNeg ? (sl.char && sl.char.indexOf('敌') >= 0 ? '敌方' : (sl.char && sl.char.indexOf('友') >= 0 ? '友方' : (sl.char || ''))) : sl.char;
				html += charLabel + " " + (sl.pts > 0 ? "+" : "") + Math.round(sl.pts * 100) / 100 + "（" + sl.tag + "）<br>";
			});
			else html += "暂无<br>";
		} catch (e) { html += "记分明细异常<br>"; }

		/* ============ ★ 模式策略状态 ============ */
		html += "<br><b>⑩z 模式策略状态（当前对局的决策偏好）</b><br>";
		try {
			const ms = window.__DJSC && window.__DJSC.modeStatus ? window.__DJSC.modeStatus() : null;
			const camps = window.__DJSC && window.__DJSC.camps ? window.__DJSC.camps() : null;
			if (!ms) {
				html += "· 探针未就绪<br>";
			} else if (ms.err) {
				html += "<span style='color:#ff9c9c'>· 异常：" + ms.err + "</span><br>";
			} else {
				html += "<div style='padding:6px 8px;background:rgba(154,216,255,0.05);border-radius:4px;margin:4px 0;'>";
				html += "<b style='color:#9ad8ff;'>当前模式：</b>";
				html += "<span style='color:" + (ms.hasStrategy ? '#7fe3a0' : '#ffd479') + ";font-weight:600;'>" + ms.mode + "</span>";
				html += "<span style='color:#a8b8c8;font-size:11px;margin-left:8px;'>" + ms.desc + "</span>";
				html += "</div>";
				if (camps && !camps.err) {
					html += "<div style='font-size:11px;margin-top:6px;'>";
					html += "<span style='display:inline-block;width:120px;color:#9ad8ff;'>玩家</span>";
					html += "<span style='color:#9ad8ff;'>阵营判断</span><br>";
					const CAMP_COLOR = {
						loyal: '#ffd479', rebel: '#ff9c9c', nei: '#9ad8ff',
						landlord: '#ff9c9c', farmer: '#7fe3a0',
						boss: '#ff9c9c', challenger: '#7fe3a0',
						me: '#7fe3a0', wei: '#5a9cf8', shu: '#ff7a7a',
						wu: '#7fe3a0', qun: '#ffd479', jin: '#b39ddb', yezin: '#888',
						unknown: '#666',
					};
					for (const name in camps) {
						const camp = camps[name];
						const col = CAMP_COLOR[camp] || '#a8b8c8';
						html += "<span style='display:inline-block;width:120px;color:#dbe7f5;'>" + name + "</span>";
						html += "<span style='color:" + col + ";font-weight:500;'>" + camp + "</span><br>";
					}
					html += "</div>";
				}
			}
		} catch (e) {
			html += "<span style='color:#ff9c9c'>· 读取异常：" + String(e).slice(0, 60) + "</span><br>";
		}

		html += "<br><b>⑪ 决策回放（最近 " + getDecisionLog().length + " 步的六层信号 + 候选分解）</b><br>";
		try {
			const logs = getDecisionLog();
			if (!logs || !logs.length) {
				html += "· 暂无记录（进入对局后自动记录，每次 AI 决策保存一步）<br>";
			} else {
				const recent = logs.slice(-5).reverse();
				recent.forEach(function (entry, idx) {
					const w = entry.winner || {};
					const L = entry.layers || {};
					const gapVal = (entry.candidates && entry.candidates.length >= 2)
					? Math.abs((entry.candidates[0].score || 0) - (entry.candidates[1].score || 0))
					: 99;
				html += "<div class='djsc-replay-card' data-gap='" + Math.round(gapVal * 100) / 100 + "' style='margin:8px 0;padding:6px 8px;border-left:3px solid #5a7aa8;background:rgba(255,255,255,0.02);'>";
					html += "<div style='color:#9ad8ff;font-size:12px;'>";
					html += "<b>#" + (logs.length - idx) + "</b> ";
					html += "轮 " + entry.round + " · " + entry.player + " · ";
					html += "<b style='color:#7fe3a0'>" + w.type + ":" + w.id + "</b>";
					if (w.score !== undefined) html += "（评分 " + w.score + "）";
					html += "</div>";
					html += "<div style='font-size:11px;color:#c8d8ea;margin:4px 0;'>";
					if (L.tempo) {
						const t = L.tempo;
						const col = t.stage === "early" ? "#9ad8ff" : t.stage === "mid" ? "#7fe3a0" : t.stage === "late" ? "#ffd479" : "#ff9c9c";
						html += "<span style='display:inline-block;margin-right:10px;'><span style='color:#666'>节奏</span> <span style='color:" + col + "'>" + t.stage + "</span>（" + t.mode + " ×" + t.baseTempo + "｜攻×" + t.atkMul + " 守×" + t.keepMul + "）</span>";
					}
					if (L.risk) {
						html += "<span style='display:inline-block;margin-right:10px;'><span style='color:#666'>性格</span> <span style='color:#9ad8ff'>" + L.risk.label + "</span>（攻×" + L.risk.atk + " 守×" + L.risk.def + "）</span>";
					}
					if (L.team) {
						const tm = L.team;
						html += "<span style='display:inline-block;margin-right:10px;'><span style='color:#666'>团队</span> ";
						if (tm.focus) html += "集火<span style='color:#ff9c9c'>" + tm.focus + "</span>(" + tm.focusScore + ") ";
						if (tm.protect) html += "保护<span style='color:#7fe3a0'>" + tm.protect + "</span>(" + tm.protectScore + ") ";
						if (tm.comboCount) html += "联动" + tm.comboCount + "条";
						html += "</span>";
					}
					if (L.seat) {
						const st = L.seat;
						html += "<span style='display:inline-block;margin-right:10px;'><span style='color:#666'>位置</span> 压力" + st.enemyPressure;
						if (st.nextEnemy) html += " 下家<span style='color:#ff9c9c'>" + st.nextEnemy + "</span>";
						if (st.prevEnemy) html += " 上家<span style='color:#ff9c9c'>" + st.prevEnemy + "</span>";
						html += "</span>";
					}
					if (L.econ) {
						const ec = L.econ;
						const hpCol = ec.hpRatio >= 0.7 ? "#7fe3a0" : ec.hpRatio >= 0.4 ? "#ffd479" : "#ff9c9c";
						html += "<span style='display:inline-block;margin-right:10px;'><span style='color:#666'>经济</span> 手" + ec.handCount + "张(" + ec.handValue + ") 装" + ec.equipCount + "件(" + ec.equipValue + ") <span style='color:" + hpCol + "'>HP" + ec.hp + "/" + ec.maxHp + "</span>";
						if (ec.stripPressure) html += " 拆压" + Math.round(ec.stripPressure * 100) + "%";
						html += "</span>";
					}
					if (L.style && L.style.tag) {
						const tagCol = L.style.tag === "aggressive" ? "#ff9c9c" : L.style.tag === "cautious" ? "#7fe3a0" : L.style.tag === "vengeful" ? "#ffd479" : "#9ad8ff";
						html += "<span style='display:inline-block;margin-right:10px;'><span style='color:#666'>博弈</span> 目标" + L.style.target + " <span style='color:" + tagCol + "'>" + L.style.tag + "</span></span>";
					}
					html += "</div>";
					if (entry.candidates && entry.candidates.length) {
						html += "<div style='font-size:11px;color:#a8b8c8;margin-top:5px;'>";
						html += "<span style='color:#666;display:block;margin-bottom:3px;'>候选评分（共 " + entry.candidates.length + " 项）：</span>";
						const cands = entry.candidates.slice(0, 6);
						const maxAbs = Math.max(1, Math.max.apply(null, cands.map(function (c) { return Math.abs_int(c.score || 0); })));
						cands.forEach(function (c) {
							const isWin = w && c.type === w.type && c.id === w.id;
							const pct = Math.round((Math.abs_int(c.score || 0) / maxAbs) * 100);
							const col = isWin ? "#7fe3a0" : (c.score > 0 ? "#9ad8ff" : "#666");
							const barW = isWin ? pct : pct * 0.85;
							html += "<div style='display:flex;align-items:center;gap:6px;margin:2px 0;'>";
							html += "<span style='width:60px;color:" + col + ";font-size:10px;'>" + c.type + "</span>";
							html += "<span style='width:86px;color:" + col + ";font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'>" + (c.id || "?") + "</span>";
							html += "<span style='flex:1;height:8px;background:#14243c;border-radius:4px;overflow:hidden;'>";
							html += "<span style='display:block;width:" + barW + "%;height:100%;background:" + col + ";'></span>";
							html += "</span>";
							html += "<span style='width:52px;text-align:right;color:" + col + ";font-size:10px;'>" + (c.score > 0 ? "+" : "") + c.score + "</span>";
							if (c.target) html += "<span style='color:#666;font-size:10px;'>→" + c.target + "</span>";
							html += "</div>";
						});
						if (entry.candidates.length > 6) html += "<div style='color:#666;font-size:10px;margin-top:2px;'>（另有 " + (entry.candidates.length - 6) + " 项未展示）</div>";
						if (entry.candidates.length >= 2) {
							const gap2 = (entry.candidates[0].score || 0) - (entry.candidates[1].score || 0);
							const gapCol = gap2 >= 3 ? "#7fe3a0" : gap2 <= 0.8 ? "#ffd479" : "#9ad8ff";
							const gapText = gap2 >= 3 ? "碾压胜出" : gap2 <= 0.8 ? "五五开" : "正常";
							html += "<div style='margin-top:3px;font-size:10px;color:" + gapCol + ";'>决策质量：" + gapText + "（差距 " + Math.round(gap2 * 100) / 100 + "）</div>";
						}
						/* 分组层级视图（默认隐藏，工具栏切换） */
						const groups = { skill: [], card: [], equip: [], other: [] };
						entry.candidates.forEach(function (c) {
							const t = c.type || "other";
							if (groups[t]) groups[t].push(c); else groups.other.push(c);
						});
						const groupLabels = { skill: "技能", card: "卡牌", equip: "装备", other: "其他" };
						const groupColors = { skill: "#ffd479", card: "#7fe3a0", equip: "#9ad8ff", other: "#a8b8c8" };
						html += "<div class='djsc-tree-group' style='display:none;margin-top:6px;'>";
						["skill", "card", "equip", "other"].forEach(function (g) {
							if (!groups[g].length) return;
							const maxS = Math.max.apply(null, groups[g].map(function (c) { return Math.abs_int(c.score || 0); })) || 1;
							const sumS = groups[g].reduce(function (s, c) { return s + _int(c.score || 0); }, 0);
							html += "<div style='padding:4px 6px;background:rgba(255,255,255,0.02);border-radius:3px;margin:3px 0;'>";
							html += "<div style='color:" + groupColors[g] + ";font-weight:500;'>" + groupLabels[g] + "（" + groups[g].length + " 项，合计 " + Math.round(sumS * 100) / 100 + "）</div>";
							groups[g].slice(0, 3).forEach(function (c) {
								const pct = Math.round((Math.abs_int(c.score || 0) / maxS) * 100);
								const isWin = w && c.type === w.type && c.id === w.id;
								html += "<div style='display:flex;align-items:center;gap:4px;margin:1px 0 1px 8px;'>";
								html += "<span style='width:80px;color:" + (isWin ? "#7fe3a0" : "#a8b8c8") + ";font-size:10px;'>" + (c.id || "?") + "</span>";
								html += "<span style='flex:1;height:6px;background:#14243c;border-radius:3px;overflow:hidden;'>";
								html += "<span style='display:block;width:" + pct + "%;height:100%;background:" + groupColors[g] + ";'></span>";
								html += "</span>";
								html += "<span style='width:42px;text-align:right;color:" + groupColors[g] + ";font-size:10px;'>" + (c.score > 0 ? "+" : "") + c.score + "</span>";
								html += "</div>";
							});
							if (groups[g].length > 3) html += "<div style='color:#666;font-size:10px;margin-left:8px;'>…另 " + (groups[g].length - 3) + " 项</div>";
							html += "</div>";
						});
						html += "</div>";
						html += "</div>";
					}
					html += "</div>";
				});
				html += "· <span style='color:#666'>说明：绿色=胜出项；可对照候选评分差距判断该决策是「接近五五开」还是「碾压胜出」。</span><br>";
				html += "<div style='text-align:right;font-size:11px;margin-top:4px;'>";
				html += "<span class='djsc-btn' data-act='export-decisions-json' style='display:inline-block;padding:2px 10px;border-radius:3px;border:1px solid #2a3a52;background:#14243c;color:#7fe3a0;cursor:pointer;font-size:11px;margin-right:4px;'>导出 JSON</span>";
				html += "<span class='djsc-btn' data-act='export-decisions-md' style='display:inline-block;padding:2px 10px;border-radius:3px;border:1px solid #2a3a52;background:#14243c;color:#ffd479;cursor:pointer;font-size:11px;'>导出 Markdown</span>";
				html += "<span class='djsc-btn' data-act='import-decisions' style='display:inline-block;padding:2px 10px;border-radius:3px;border:1px solid #2a3a52;background:#14243c;color:#9ad8ff;cursor:pointer;font-size:11px;margin-left:4px;'>导入回放</span>";
				html += "</div>";
			}
		} catch (e) {
			html += "· 决策回放异常：" + String(e).slice(0, 60) + "<br>";
		}
		html += "<br><span style='color:#9ad8ff;cursor:pointer;text-decoration:underline;' onclick='try{window.__DJSC.clearDecisionLog();alert(\"决策回放已清空\");}catch(e){}'>[清空决策回放]</span><br>";
		/* ============ ⑪c 策略总线 ============ */
		html += "<br><b>⑪c 策略总线（多层信号仲裁 + 决策链审计）</b><br>";
		try {
			html += buildStrategistHtml();
		} catch (e) {
			html += "<span style='color:#ff9c9c;'>策略总线面板异常：" + String(e).slice(0, 60) + "</span><br>";
		}
		/* ★ 决策解释器 */
		try {
			html += "<div style='margin-top:10px;padding:8px;background:rgba(154,216,255,0.03);border-radius:6px;'>";
			html += "<b style='color:#9ad8ff'>🔍 决策解释器（最近 3 步详细拆解）</b><br>";
			try {
				const exs = recentExplains(3);
				if (!exs.length) {
					html += "<div style='font-size:11px;color:#666;margin-top:4px;'>暂无决策（进入对局后自动记录）</div>";
				} else {
					exs.forEach(function (ex, i) {
						const e = ex.entry;
						html += "<div style='margin:6px 0;font-size:11px;'>";
						html += "<div style='color:#9ad8ff;'><b>#" + (i + 1) + "</b> 轮 " + (e.round || 0) + " · " + (e.player || "?") + "</div>";
						ex.lines.forEach(function (l) {
							html += "<div style='margin:2px 0 2px 8px;'>";
							html += "<span style='display:inline-block;width:20px;'>" + l.icon + "</span>";
							html += "<span style='display:inline-block;width:120px;color:#7fe3a0;font-size:10px;'>" + l.title + "</span>";
							html += "<span style='color:#dbe7f5;'>" + l.content + "</span>";
							html += "</div>";
						});
						if (ex.gapHtml) html += "<div style='margin-left:28px;'>" + ex.gapHtml + "</div>";
						html += "</div>";
					});
				}
			} catch (e) { html += "<div style='color:#ff9c9c;font-size:11px;'>解释器异常</div>"; }
			html += "</div>";
		} catch (e) {}

		/* ============ ⑪b 战术规划器 ============ */
		html += "<br><b>⑪b 战术规划器（多步连招 + 残局解）</b><br>";
		try {
			const me = _status.currentPhase || (game.players && game.players[0]);
			if (!me) {
				html += "· 进入对局后评估<br>";
			} else {
				const plan = planSequence(me);
				if (!plan) {
					html += "· 当前无规划（候选不足或超时）<br>";
				} else {
					if (plan.isKill) {
						html += "<div style='padding:6px 8px;background:rgba(255,51,0,0.1);border-left:3px solid #ff9c9c;border-radius:4px;margin:4px 0;'>";
						html += "<b style='color:#ff9c9c'>⚔ 残局解</b>（总伤害 " + plan.best.steps.reduce(function (s, x) { return s + (x.dmg || 0); }, 0) + "）<br>";
						html += "<span style='color:#dbe7f5;font-size:11px;'>";
						html += (plan.best.target ? plan.best.target.name + "：" : "");
						html += plan.best.steps.map(function (s) { return s.id; }).join(" → ");
						html += "</span></div>";
					} else {
						html += "<div style='font-size:11px;'>";
						html += "<span style='display:inline-block;width:56px;color:#9ad8ff'>排名</span>";
						html += "<span style='display:inline-block;width:88px;color:#9ad8ff'>动作</span>";
						html += "<span style='display:inline-block;width:56px;color:#9ad8ff'>基础分</span>";
						html += "<span style='display:inline-block;width:56px;color:#9ad8ff'>展望分</span>";
						html += "<span style='color:#9ad8ff'>总分</span><br>";
						(plan.all || []).slice(0, 5).forEach(function (s, i) {
							const isTop = i === 0;
							const col = isTop ? "#7fe3a0" : "#a8b8c8";
							html += "<span style='display:inline-block;width:56px;color:" + col + "'>" + (i + 1) + ".</span>";
							html += "<span style='display:inline-block;width:88px;color:" + col + "'>" + (s.action && s.action.id || '?') + "</span>";
							html += "<span style='display:inline-block;width:56px'>" + _int(s.baseScore || 0) + "</span>";
							html += "<span style='display:inline-block;width:56px;color:#ffd479'>+" + _int(s.futureScore || 0) + "</span>";
							html += "<span style='color:" + col + ";font-weight:500;'>" + _int(s.total) + "</span><br>";
						});
						html += "</div>";
						html += "<div style='font-size:10px;color:#666;margin-top:4px;'>· 展望分 = 这一步打开后续可能的价值（连招/控制/击杀窗口）</div>";
					}
				}
			}
		} catch (e) {
			html += "· 规划器异常：" + String(e).slice(0, 60) + "<br>";
		}

		/* ============ ⑫ 技能代码矩阵 ============ */
		html += "<br><b>⑫ 当前武将技能拆解（点击按钮展开详情）</b><br>";
		try {
			const mcSkill = _status.currentPhase || (game.players && game.players[0]);
			if (!mcSkill) {
				html += "· 进入对局后评估<br>";
			} else {
				const mySkills = mcSkill.skills || [];
				if (!mySkills.length) {
					html += "· 当前武将无技能<br>";
				} else {
					html += "<div style='display:flex;flex-direction:column;gap:8px;margin-top:8px;'>";
					mySkills.forEach(function (sid, idx) {
						const p = skillProfileOf(sid);
						if (!p) {
							html += "<div class='djsc-menu-config-btn' style='padding:12px 16px;background:#1a2a44;border:1px solid #2a3a52;border-radius:8px;cursor:default;opacity:0.6;'>";
							html += "<div style='font-size:14px;color:#666;'>" + sid + "（分析失败）</div>";
							html += "</div>";
							return;
						}
						const netCol = p.profit.base > 0 ? "#7fe3a0" : (p.profit.base < 0 ? "#ff9c9c" : "#888");
						const riskCol = p.profit.risk >= 0.5 ? "#ff9c9c" : (p.profit.risk >= 0.3 ? "#ffd479" : "#7fe3a0");
						const name = (lib.translate && lib.translate[sid]) || sid;
						const branchCount = (skillBranchesOf(sid) || { branches: [] }).branches.length;
						const stageInfo = skillStagesOf(sid);
						const hasStages = stageInfo && (stageInfo.cost.ops.length || stageInfo.effect.ops.length || stageInfo.after.ops.length);
						const interactionCount = (skillInteractionOf(sid) || { interactions: [] }).interactions.length;

						/* 技能按钮 */
						html += "<div class='djsc-menu-config-btn djsc-skill-btn' data-idx='" + idx + "' style='padding:14px 18px;background:linear-gradient(135deg,#1a2a44,#14243c);border:1px solid #2a3a52;border-radius:10px;cursor:pointer;transition:all 0.2s;'>";
						html += "<div style='display:flex;justify-content:space-between;align-items:center;'>";
						html += "<div style='flex:1;'>";
						html += "<div style='font-size:15px;font-weight:600;color:#dbe7f5;margin-bottom:4px;'>" + name + "</div>";
						html += "<div style='font-size:11px;color:#9ad8ff;'>" + p.timing.phase + " · " + p.targets.category + "</div>";
						html += "</div>";
						html += "<div style='text-align:right;'>";
						html += "<div style='font-size:16px;font-weight:600;color:" + netCol + ";'>" + (p.profit.base > 0 ? "+" : "") + p.profit.base + "</div>";
						html += "<div style='font-size:10px;color:#666;'>净收益</div>";
						html += "</div>";
						html += "</div>";
						/* 标签 */
						html += "<div style='display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;'>";
						if (p.profit.cost > 0) html += "<span style='padding:2px 8px;background:rgba(255,156,156,0.15);color:#ff9c9c;border-radius:4px;font-size:10px;'>代价 -" + p.profit.cost + "</span>";
						if (p.profit.risk >= 0.3) html += "<span style='padding:2px 8px;background:rgba(255,212,121,0.15);color:" + riskCol + ";border-radius:4px;font-size:10px;'>风险 " + Math.round(p.profit.risk * 100) + "%</span>";
						if (branchCount > 0) html += "<span style='padding:2px 8px;background:rgba(154,216,255,0.15);color:#9ad8ff;border-radius:4px;font-size:10px;'>分支 " + branchCount + "</span>";
						if (hasStages) html += "<span style='padding:2px 8px;background:rgba(127,227,160,0.15);color:#7fe3a0;border-radius:4px;font-size:10px;'>多段</span>";
						if (interactionCount > 0) html += "<span style='padding:2px 8px;background:rgba(255,212,121,0.15);color:#ffd479;border-radius:4px;font-size:10px;'>联动 " + interactionCount + "</span>";
						html += "</div>";
						html += "</div>";

						/* 技能详情（默认隐藏） */
						html += "<div class='djsc-skill-detail' data-idx='" + idx + "' style='display:none;margin-top:6px;padding:12px;background:rgba(0,0,0,0.2);border-radius:8px;border-left:3px solid #9ad8ff;'>";

						/* ★ 八维度摘要 */
						try {
							const multi = p.profit && p.profit.multi;
							if (multi) {
								const d = multi.dims;
								html += "<div style='display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;'>";
								const dimCard = function (label, val, mul) {
									return "<span style='padding:3px 8px;background:rgba(154,216,255,0.12);" +
										"border-radius:4px;font-size:10px;color:#9ad8ff;'>" +
										label + " <b>" + val + "</b> <span style='color:#ffd479'>×" + mul + "</span></span>";
								};
								html += dimCard('对象', d.object, ({
									self: 1.0, team: 1.2, enemy: 1.0, multiEnemy: 1.35,
									multiTeam: 1.15, all: 0.85, dying: 1.4,
								})[d.object] || 1.0);
								html += dimCard('范围', d.range, ({ single: 1.0, few: 1.25, many: 1.45, all: 1.55 })[d.range] || 1.0);
								html += dimCard('时机', d.timing, ({
									dying: 1.6, damageAfter: 1.3, damaged: 1.2, chooseToRespond: 1.2,
									phaseUse: 1.0, passive: 0.85, die: 0.3,
								})[d.timing] || 1.0);
								html += dimCard('频率', d.frequency, ({
									limit: 2.0, awaken: 1.8, perRound: 1.5, perTurn: 1.0,
									frequent: 1.1, passive: 1.15, locked: 1.05,
								})[d.frequency] || 1.0);
								html += dimCard('风险', d.risk, ({ none: 1.0, judge: 0.75, compare: 0.85 })[d.risk] || 1.0);
								html += dimCard('持续', d.duration, ({
									instant: 1.0, turn: 1.15, round: 1.25, game: 1.5, forever: 1.8,
								})[d.duration] || 1.0);
								html += "</div>";

								/* ★ 效果明细 */
								const effs = multi.breakdown.filter(function (b) { return b.kind === 'effect'; });
								if (effs.length) {
									html += "<div style='margin-bottom:8px;'>";
									html += "<div style='font-size:11px;color:#7fe3a0;margin-bottom:3px;font-weight:600;'>✅ 效果明细</div>";
									effs.forEach(function (b) {
										const col = b.score >= 0 ? '#7fe3a0' : '#ff9c9c';
										html += "<div style='font-size:11px;color:#a8b8c8;padding:3px 6px;'>" +
											"<span style='color:#9ad8ff;display:inline-block;width:120px;'>" + b.label + "</span>" +
											"<span style='display:inline-block;width:60px;'>" + b.raw + "</span>" +
											"<span style='color:#666;display:inline-block;width:40px;'>×" + b.coeff + "</span>" +
											"<span style='color:" + col + ";font-weight:600;'>" + (b.score >= 0 ? '+' : '') + b.score + "</span>" +
											"</div>";
									});
									html += "</div>";
								}

								/* ★ 成本明细 */
								const csts = multi.breakdown.filter(function (b) { return b.kind === 'cost'; });
								if (csts.length) {
									html += "<div style='margin-bottom:8px;'>";
									html += "<div style='font-size:11px;color:#ff9c9c;margin-bottom:3px;font-weight:600;'>❌ 成本明细</div>";
									csts.forEach(function (b) {
										html += "<div style='font-size:11px;color:#a8b8c8;padding:3px 6px;'>" +
											"<span style='color:#9ad8ff;display:inline-block;width:120px;'>" + b.label + "</span>" +
											"<span style='display:inline-block;width:60px;'>" + b.raw + "</span>" +
											"<span style='color:#666;display:inline-block;width:40px;'>×" + b.coeff + "</span>" +
											"<span style='color:#ff9c9c;font-weight:600;'>" + b.score + "</span>" +
											"</div>";
									});
									html += "</div>";
								}

								/* ★ 综合公式 */
								html += "<div style='padding:6px 8px;background:rgba(255,212,121,0.05);border-radius:4px;font-size:11px;color:#dbe7f5;'>";
								html += "<span style='color:#666'>综合：</span>";
								html += "(" + multi.effectScore + " + " + multi.costScore + ") × " + multi.mul + " = " + multi.raw;
								if (multi.clamped) {
									html += " <span style='color:#ffd479'>⚠ 封顶 → " + multi.final + "</span>";
								} else {
									html += " <span style='color:#7fe3a0;font-weight:600'>→ " + multi.final + "</span>";
								}
								html += "</div>";
							}
						} catch (e) {}

						/* 条件分支 */
						try {
							const br = skillBranchesOf(sid);
							if (br && br.branches.length) {
								html += "<div style='margin-top:8px;'>";
								html += "<div style='font-size:11px;color:#9ad8ff;margin-bottom:4px;font-weight:600;'>📍 条件分支</div>";
								br.branches.forEach(function (b) {
									const col = b.risky ? "#ff9c9c" : b.limited ? "#ffd479" : "#7fe3a0";
									html += "<div style='font-size:11px;color:#a8b8c8;padding:4px 8px;background:rgba(255,255,255,0.03);border-radius:4px;margin-bottom:4px;'>";
									html += "<span style='color:" + col + ";font-weight:600;'>" + b.cond + "</span>";
									html += " <span style='color:" + col + ";'>+" + b.bonus + "</span>";
									if (b.risky) html += " <span style='color:#ff9c9c;font-size:10px;'>⚠ 高风险</span>";
									if (b.limited) html += " <span style='color:#ffd479;font-size:10px;'>★ 限定技</span>";
									html += "</div>";
								});
								html += "</div>";
							}
						} catch (e) {}
						html += "</div>";
					});
					html += "</div>";
					html += "<div style='font-size:10px;color:#666;margin-top:8px;'>· 点击技能按钮展开详情 · 净收益 &gt; 0 的技能进入决策候选 · 风险 ≥50% 残局自动降权</div>";
				}
			}
		} catch (e) {
			html += "· 矩阵异常：" + String(e).slice(0, 60) + "<br>";
		}

		/* ============ ⑬ 战报归档 ============ */
		html += "<br><b>⑬ 战报归档（最近 30 局历史记录）</b><br>";
		try {
			const stats = archiveStats();
			if (!stats.count) {
				html += "· 暂无归档记录（完成一局对局后自动保存）<br>";
			} else {
				html += "<div style='display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 8px 0;font-size:11px;'>";
				const stat = function (label, val, color) {
					return "<div style='flex:1;min-width:70px;padding:6px;background:rgba(255,255,255,0.04);border-radius:4px;text-align:center;'>" +
						"<div style='color:#9ad8ff;font-size:10px;'>" + label + "</div>" +
						"<div style='color:" + (color || "#dbe7f5") + ";font-size:14px;font-weight:600;'>" + val + "</div>" +
						"</div>";
				};
				html += stat("总局数", stats.count, "#9ad8ff");
				html += stat("胜/负/平", stats.wins + "/" + stats.loses + "/" + stats.draws, "#7fe3a0");
				html += stat("平均积分", stats.avgScore, stats.avgScore >= 0 ? "#7fe3a0" : "#ff9c9c");
				html += stat("趋势", (stats.trend >= 0 ? "+" : "") + stats.trend, stats.trend >= 0 ? "#7fe3a0" : "#ff9c9c");
				html += "</div>";
				const games = getArchive().slice(-12);
				const scores12 = games.map(function (g) { return g.myScore; });
				html += "<div style='margin:4px 0;'>" + lineChart(scores12, { width: 340, height: 90, color: "#7fe3a0" }) + "</div>";
				html += "<div style='font-size:11px;margin-top:8px;'>";
				html += "<span style='display:inline-block;width:76px;color:#9ad8ff'>时间</span>";
				html += "<span style='display:inline-block;width:58px;color:#9ad8ff'>模式</span>";
				html += "<span style='display:inline-block;width:44px;color:#9ad8ff'>身份</span>";
				html += "<span style='display:inline-block;width:58px;color:#9ad8ff'>结果</span>";
				html += "<span style='display:inline-block;width:56px;color:#9ad8ff'>积分</span>";
				html += "<span style='display:inline-block;width:56px;color:#9ad8ff'>决策</span>";
				html += "<span style='color:#9ad8ff'>质量(碾/常/胶)</span><br>";
				const recentA = getArchive().slice().reverse().slice(0, 8);
				recentA.forEach(function (g) {
					const vCol = g.verdict === "win" ? "#7fe3a0" : g.verdict === "lose" ? "#ff9c9c" : "#ffd479";
					const sCol = g.myScore >= 0 ? "#7fe3a0" : "#ff9c9c";
					html += "<span style='display:inline-block;width:76px;color:#a8b8c8'>" + fmtTime(g.ts) + "</span>";
					html += "<span style='display:inline-block;width:58px'>" + g.mode + "</span>";
					html += "<span style='display:inline-block;width:44px;color:#9ad8ff'>" + (g.myIdentity || "—") + "</span>";
					html += "<span style='display:inline-block;width:58px;color:" + vCol + "'>" + g.verdict + "</span>";
					html += "<span style='display:inline-block;width:56px;color:" + sCol + "'>" + (g.myScore > 0 ? "+" : "") + g.myScore + "</span>";
					html += "<span style='display:inline-block;width:56px'>" + g.decisionSteps + "</span>";
					html += "<span style='color:#a8b8c8'>" + (g.quality.crush || 0) + "/" + (g.quality.normal || 0) + "/" + (g.quality.close || 0) + "</span>";
					/* 详情按钮（按时间戳反查原始索引） */
					const origIdx = (function () {
						const all = getArchive();
						for (let i = all.length - 1; i >= 0; i--) {
							if (all[i].ts === g.ts) return i;
						}
						return -1;
					})();
					html += " <span class='djsc-btn djsc-archive-detail' data-idx='" + origIdx + "' style='display:inline-block;padding:1px 8px;border-radius:3px;border:1px solid #2a3a52;background:#14243c;color:#9ad8ff;cursor:pointer;font-size:10px;margin-left:6px;'>详情</span>";
					html += "<br>";
				});
				html += "</div>";
			}
		} catch (e) {
			html += "· 归档读取异常：" + String(e).slice(0, 60) + "<br>";
		}

		/* ============ ⑭ 技能反馈修正 ============ */
		html += "<br><b>⑭ 技能反馈修正（AI 随对局自动学习）</b><br>";
		try {
			const fstats = getFeedbackStats();
			const ftotal = feedbackCount();
			if (!ftotal) {
				html += "· 尚未积累反馈样本（需完成对局并使用技能才会触发）<br>";
			} else {
				html += "· 已追踪技能：<b style='color:#9ad8ff'>" + ftotal + "</b> 个<br>";
				html += "· <span style='color:#666;font-size:11px;'>修正公式：实际积分 ÷ 预测积分，钳到 [0.5, 1.5]；样本 ≥3 且偏差 ≥0.15 才生效</span><br>";
				html += "<div style='font-size:11px;margin-top:4px;'>";
				html += "<span style='display:inline-block;width:96px;color:#9ad8ff'>技能</span>";
				html += "<span style='display:inline-block;width:64px;color:#9ad8ff'>修正比</span>";
				html += "<span style='display:inline-block;width:56px;color:#9ad8ff'>样本</span>";
				html += "<span style='color:#9ad8ff'>状态</span><br>";
				fstats.slice(0, 10).forEach(function (s) {
					const name = (lib.translate && lib.translate[s.skill]) || s.skill;
					const col = s.ratio > 1.05 ? "#7fe3a0" : s.ratio < 0.95 ? "#ff9c9c" : "#a8b8c8";
					const badge = s.active
						? (s.ratio > 1 ? "<span style='color:#7fe3a0'>↑ 预测偏保守</span>" : "<span style='color:#ff9c9c'>↓ 预测偏乐观</span>")
						: "<span style='color:#666'>未生效</span>";
					html += "<span style='display:inline-block;width:96px;color:#dbe7f5'>" + name + "</span>";
					html += "<span style='display:inline-block;width:64px;color:" + col + "'>×" + s.ratio + "</span>";
					html += "<span style='display:inline-block;width:56px'>" + s.samples + "</span>";
					html += "<span>" + badge + "</span><br>";
				});
				if (fstats.length > 10) html += "…（另有 " + (fstats.length - 10) + " 个技能）<br>";
				html += "</div>";
			}
		} catch (e) {
			html += "· 反馈读取异常：" + String(e).slice(0, 60) + "<br>";
		}

		/* ============ ⑮ 下回合预测 ============ */
		html += "<br><b>⑮ 下回合预测（AI 先见之明）</b><br>";
		try {
			const mcFc = _status.currentPhase || (game.players && game.players[0]);
			if (!mcFc) {
				html += "· 进入对局后评估<br>";
			} else {
				const fc = forecastSummary(mcFc);
				const inc = fc.incoming;
				const riskCol = inc.killRisk ? "#ff9c9c"
					: inc.selfRisk >= 0.6 ? "#ff9c9c"
					: inc.selfRisk >= 0.3 ? "#ffd479"
					: "#7fe3a0";
				html += "<div style='display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 8px 0;font-size:11px;'>";
				const card = function (label, val, color) {
					return "<div style='flex:1;min-width:82px;padding:6px;background:rgba(255,255,255,0.04);border-radius:4px;text-align:center;'>" +
						"<div style='color:#9ad8ff;font-size:10px;'>" + label + "</div>" +
						"<div style='color:" + (color || "#dbe7f5") + ";font-size:14px;font-weight:600;'>" + val + "</div>" +
						"</div>";
				};
				html += card("下回合压力", inc.total, riskCol);
				html += card("自伤风险", Math.round(inc.selfRisk * 100) + "%", riskCol);
				html += card("血量", inc.hp, "#9ad8ff");
				html += card("风险等级", fc.advice.slice(0, 4), riskCol);
				html += "</div>";
				if (inc.byEnemy && inc.byEnemy.length) {
					html += "<div style='font-size:11px;margin-top:4px;'>";
					html += "<span style='display:inline-block;width:88px;color:#9ad8ff'>威胁者</span>";
					html += "<span style='display:inline-block;width:64px;color:#9ad8ff'>预期伤害</span>";
					html += "<span style='color:#9ad8ff'>血量</span><br>";
					inc.byEnemy.slice(0, 5).forEach(function (e, i) {
						const col = i === 0 ? "#ff9c9c" : (i === 1 ? "#ffd479" : "#a8b8c8");
						html += "<span style='display:inline-block;width:88px;color:" + col + "'>" + e.name + "</span>";
						html += "<span style='display:inline-block;width:64px;color:" + col + "'>" + e.impact + "</span>";
						html += "<span style='color:#a8b8c8'>" + e.hp + "</span><br>";
					});
					html += "</div>";
				} else {
					html += "· 敌方威胁榜：暂无<br>";
				}
				if (fc.team && fc.team.length) {
					html += "<div style='font-size:11px;margin-top:6px;'>";
					html += "<span style='color:#ffd479;'>⚠ 队友风险：</span>";
					fc.team.slice(0, 4).forEach(function (t) {
						html += "<span style='display:inline-block;margin-right:10px;color:#ffd479;'>" +
							t.name + "（" + Math.round(t.risk * 100) + "% 濒死）</span>";
					});
					html += "</div>";
				}
				html += "<div style='margin-top:6px;padding:6px 8px;background:rgba(255,255,255,0.02);border-left:3px solid " + riskCol + ";border-radius:3px;font-size:11px;'>";
				html += "<b style='color:" + riskCol + "'>AI 行动建议：</b>" + fc.advice;
				html += "</div>";
			}
		} catch (e) {
			html += "· 预测异常：" + String(e).slice(0, 60) + "<br>";
		}

		/* ============ ⑯ 归档统计分析 ============ */
		html += "<br><b>⑯ 归档统计分析（长期表现洞察）</b><br>";
		try {
			const st = fullArchiveStats();
			if (!st.basic.count) {
				html += "· 尚未积累归档（至少完成 1 局后生效）<br>";
			} else {
				html += "<div style='font-size:11px;margin-bottom:6px;'>";
				html += "<b style='color:#9ad8ff'>出牌频率 Top10（跨局）：</b><br>";
				if (st.topCards.length) {
					html += barChart(st.topCards.map(function (c) { return { label: c.card, value: c.count }; }));
				} else html += "<span style='color:#666;font-size:11px;'>无数据</span>";
				html += "</div>";
				html += "<div style='font-size:11px;margin-bottom:6px;'>";
				html += "<b style='color:#9ad8ff'>身份胜率：</b><br>";
				for (const id in st.byIdentity) {
					const e = st.byIdentity[id];
					const col = e.winRate >= 60 ? "#7fe3a0" : e.winRate >= 40 ? "#ffd479" : "#ff9c9c";
					html += "<span style='display:inline-block;min-width:78px;color:#9ad8ff'>" + id + "</span>";
					html += "<span style='display:inline-block;width:56px;color:" + col + "'>" + e.winRate + "%</span>";
					html += "<span style='color:#a8b8c8'>" + e.total + " 局（胜" + e.wins + "/负" + e.loses + "/平" + e.draws + "）均分 " + e.avgScore + "</span><br>";
				}
				html += "</div>";
				html += "<div style='font-size:11px;margin-bottom:6px;'>";
				html += "<b style='color:#9ad8ff'>模式胜率：</b><br>";
				for (const m in st.byMode) {
					const e = st.byMode[m];
					const col = e.winRate >= 60 ? "#7fe3a0" : e.winRate >= 40 ? "#ffd479" : "#ff9c9c";
					html += "<span style='display:inline-block;min-width:78px;color:#9ad8ff'>" + m + "</span>";
					html += "<span style='display:inline-block;width:56px;color:" + col + "'>" + e.winRate + "%</span>";
					html += "<span style='color:#a8b8c8'>" + e.total + " 局，均分 " + e.avgScore + "</span><br>";
				}
				html += "</div>";
			}
		} catch (e) {
			html += "· 统计异常：" + String(e).slice(0, 60) + "<br>";
		}

		/* ★ ⑯b 性能监控 */
		try {
			html += "<br><b>⑯b 性能监控（最近决策耗时）</b><br>";
			const ps = perfStats();
			const hist = perfHistory();
			if (Object.keys(ps).length) {
				html += "<div style='font-size:11px;'>";
				html += "<span style='display:inline-block;width:140px;color:#9ad8ff'>阶段</span>";
				html += "<span style='display:inline-block;width:56px;color:#9ad8ff'>次数</span>";
				html += "<span style='display:inline-block;width:64px;color:#9ad8ff'>平均(ms)</span>";
				html += "<span style='display:inline-block;width:64px;color:#9ad8ff'>最大(ms)</span>";
				html += "<span style='color:#9ad8ff'>最近(ms)</span><br>";
				for (const k in ps) {
					const s = ps[k];
					const col = s.avg > 100 ? "#ff9c9c" : s.avg > 30 ? "#ffd479" : "#7fe3a0";
					html += "<span style='display:inline-block;width:140px'>" + k + "</span>";
					html += "<span style='display:inline-block;width:56px'>" + s.count + "</span>";
					html += "<span style='display:inline-block;width:64px;color:" + col + "'>" + s.avg + "</span>";
					html += "<span style='display:inline-block;width:64px;color:" + col + "'>" + s.max + "</span>";
					html += "<span style='color:#a8b8c8'>" + s.last + "</span><br>";
				}
				html += "</div>";
				if (hist.length) {
					html += "<div style='margin-top:6px;'><b style='color:#9ad8ff'>最近决策耗时曲线：</b><br>";
					html += lineChart(hist.slice(-20).map(function (h) { return h.dt; }), { width: 340, height: 70, color: "#ffd479" });
					html += "</div>";
				}
			} else {
				html += "· 尚无数据（进入对局后自动采样）<br>";
			}
		} catch (e) { html += "· 性能读取异常<br>"; }

		/* ★ ⑯c 自适应难度 */
		try {
			html += "<br><b>⑯c 自适应难度</b><br>";
			const ad = adaptiveStatus();
			if (!ad.enabled) {
				html += "· 未启用（配置里开启）<br>";
			} else {
				const col = Math.abs(ad.shift) < 0.01 ? "#a8b8c8"
					: ad.shift > 0 ? "#ff9c9c" : "#7fe3a0";
				const label = Math.abs(ad.shift) < 0.01 ? "标准"
					: ad.shift > 0 ? "AI 加强" : "AI 放水";
				html += "· 当前状态：<b style='color:" + col + "'>" + label + "</b>";
				html += "（偏移 " + (ad.shift >= 0 ? "+" : "") + Math.round(ad.shift * 100) + "%）<br>";
				html += "· 机制：最近 5 局赢多 → AI 加强；输多 → AI 放水<br>";
			}
		} catch (e) {}

		/* ============ ⑰ 对手记忆库 ============ */
		html += "<br><b>⑰ 对手记忆库（per-player 追踪）</b><br>";
		try {
			const pstats = getPlayerMemoryStats();
			if (!pstats.length) {
				html += "· 尚无样本（联机遇同一玩家 3 次以上才生效）<br>";
			} else {
				html += "<div style='font-size:11px;'>";
				html += "<span style='display:inline-block;width:110px;color:#9ad8ff'>玩家</span>";
				html += "<span style='display:inline-block;width:64px;color:#9ad8ff'>主标签</span>";
				html += "<span style='display:inline-block;width:56px;color:#9ad8ff'>置信度</span>";
				html += "<span style='color:#9ad8ff'>样本</span><br>";
				pstats.slice(0, 8).forEach(function (s) {
					const col = s.tag === "aggressive" ? "#ff9c9c" : s.tag === "cautious" ? "#7fe3a0" : s.tag === "vengeful" ? "#ffd479" : "#9ad8ff";
					html += "<span style='display:inline-block;width:110px;color:#dbe7f5'>" + s.key + "</span>";
					html += "<span style='display:inline-block;width:64px;color:" + col + "'>" + s.tag + "</span>";
					html += "<span style='display:inline-block;width:56px;color:#9ad8ff'>" + Math.round(s.conf * 100) + "%</span>";
					html += "<span style='color:#a8b8c8'>" + s.samples + "</span><br>";
				});
				html += "</div>";
			}
		} catch (e) {
			html += "· 记忆库异常：" + String(e).slice(0, 60) + "<br>";
		}

		/* ============ ⑱ AI 统计对比 ============ */
		html += "<br><b>⑱ AI 统计对比（本局各 AI 决策风格）</b><br>";
		try {
			const agg = aggregateByPlayer(getDecisionLog(), (function () { try { return getREC().cards; } catch (e) { return {}; } })());
			html += buildComparisonHtml(agg);
			const cardTotals = Object.keys(agg).map(function (k) { return { value: agg[k].totalCardUse }; });
			if (cardTotals.length) {
				html += "<div style='display:flex;justify-content:center;margin-top:6px;'>";
				html += donutChart(cardTotals, { size: 100 });
				html += "</div>";
				html += "<div style='text-align:center;font-size:10px;color:#666;margin-top:2px;'>各 AI 出牌数占比</div>";
			}
		} catch (e) {
			html += "· 对比异常：" + String(e).slice(0, 60) + "<br>";
		}

		/* ============ ⑲ AI 协作设置 ============ */
		html += "<br><b>⑲ AI 队友性格（协作模式）</b><br>";
		try {
			const ais = (game.players || []).filter(function (p) { return p && p !== game.me && p.alive !== false; });
			if (!ais.length) {
				html += "· 当前无 AI 队友<br>";
			} else {
				let stored = {};
				try { stored = JSON.parse(localStorage.getItem("无名AI_allyPersonalities") || "{}"); } catch (e) {}
				html += "<div style='font-size:11px;'>";
				ais.forEach(function (p) {
					const pk = p.nickname || p.uid || p.name1 || p.name || "?";
					const cur = stored[pk];
					const tplName = cur ? (cur.name || "自定义") : "（默认）";
					html += "<div style='margin:4px 0;display:flex;align-items:center;gap:6px;'>";
					html += "<span style='min-width:74px;color:#dbe7f5;'>" + (p.name || "?") + "</span>";
					html += "<span style='min-width:110px;color:#9ad8ff;font-size:10px;'>" + (cur ? ("当前:" + tplName + (cur.role ? " / " + cur.role : "") + " " + cur.agg + "/" + cur.rsk + "/" + cur.tea) : "（默认）") + "</span>";
					html += "<select class='djsc-btn djsc-ally-tpl' data-pk='" + pk + "' style='padding:2px 6px;border-radius:3px;border:1px solid #2a3a52;background:#14243c;color:#dbe7f5;font-size:10px;'>";
					html += "<option value=''>— 模板 —</option>";
					PERSONALITY_TEMPLATES.forEach(function (tp) {
						html += "<option value='" + tp.key + "' " + (cur && cur.name === tp.name ? "selected" : "") + ">" + tp.name + "</option>";
					});
					html += "<option value='__clear__'>清除</option>";
					html += "</select>";
					html += "<select class='djsc-btn djsc-ally-role' data-pk='" + pk + "' style='padding:2px 6px;border-radius:3px;border:1px solid #2a3a52;background:#14243c;color:#ffd479;font-size:10px;'>";
					html += "<option value=''>— 分工 —</option>";
					[["attack", "主攻"], ["aux", "辅助"], ["control", "控场"], ["defense", "防守"], ["balanced", "均衡"]].forEach(function (r) {
						html += "<option value='" + r[0] + "' " + (cur && cur.role === r[0] ? "selected" : "") + ">" + r[1] + "</option>";
					});
					html += "</select>";
					html += "</div>";
				});
				html += "</div>";
				html += "<div style='font-size:10px;color:#666;margin-top:3px;'>· 指定后该 AI 将使用模板性格，覆盖身份自动匹配与全局设置。</div>";
			}
		} catch (e) {
			html += "· 协作设置异常：" + String(e).slice(0, 60) + "<br>";
		}

		/* ============ ⑳ 配置档案 ============ */
		html += "<br><b>⑳ 配置档案（多套配置一键切换）</b><br>";
		try {
			const pf = listProfiles();
			html += "<div style='font-size:11px;'>";
			if (pf.active) html += "· 当前档案：<b style='color:#7fe3a0'>" + pf.active + "</b><br>";
			else html += "· 当前档案：（未命名）<br>";
			if (pf.list.length) {
				html += "<div style='margin-top:4px;'>";
				pf.list.forEach(function (p) {
					const isActive = p.name === pf.active;
					const col = isActive ? "#7fe3a0" : "#9ad8ff";
					const padTs = (function () {
						try {
							const d = new Date(p.ts);
							return (d.getMonth() + 1) + "-" + d.getDate() + " " + d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes();
						} catch (e) { return "?"; }
					})();
					html += "<div style='margin:3px 0;display:flex;align-items:center;gap:6px;'>";
					html += "<span style='min-width:100px;color:" + col + ";'>" + (isActive ? "★ " : "") + p.name + "</span>";
					html += "<span style='color:#666;min-width:88px;font-size:10px;'>" + padTs + " · " + p.keys.length + " 项</span>";
					html += "<span class='djsc-btn djsc-prof-load' data-name='" + p.name + "' style='padding:1px 8px;border-radius:3px;border:1px solid #2a3a52;background:#14243c;color:#7fe3a0;cursor:pointer;font-size:10px;'>载入</span>";
					html += "<span class='djsc-btn djsc-prof-rename' data-name='" + p.name + "' style='padding:1px 8px;border-radius:3px;border:1px solid #2a3a52;background:#14243c;color:#9ad8ff;cursor:pointer;font-size:10px;'>重命名</span>";
					html += "<span class='djsc-btn djsc-prof-del' data-name='" + p.name + "' style='padding:1px 8px;border-radius:3px;border:1px solid #2a3a52;background:#14243c;color:#ff9c9c;cursor:pointer;font-size:10px;'>删除</span>";
					html += "</div>";
				});
				html += "</div>";
			} else html += "· 尚无档案<br>";
			html += "<div style='margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;'>";
			html += "<span class='djsc-btn' data-act='prof-save' style='padding:2px 10px;border-radius:3px;border:1px solid #2a3a52;background:#14243c;color:#7fe3a0;cursor:pointer;font-size:11px;'>保存当前为档案</span>";
			html += "<span class='djsc-btn' data-act='prof-export' style='padding:2px 10px;border-radius:3px;border:1px solid #2a3a52;background:#14243c;color:#ffd479;cursor:pointer;font-size:11px;'>导出全部 JSON</span>";
			html += "<span class='djsc-btn' data-act='prof-import' style='padding:2px 10px;border-radius:3px;border:1px solid #2a3a52;background:#14243c;color:#9ad8ff;cursor:pointer;font-size:11px;'>导入 JSON</span>";
			html += "</div></div>";
		} catch (e) {
			html += "· 档案异常：" + String(e).slice(0, 60) + "<br>";
		}

		/* ★ 分段渲染：先渲染上半部分（①~⑨），再异步渲染下半部分（⑩~⑳） */
		try {
			const splitMark = '<br><b>⑩ ';
			const idx = html.indexOf(splitMark);
			if (idx > 0) {
				const part1 = html.slice(0, idx);
				const part2 = html.slice(idx);
				d.innerHTML = wrapSections(part1);
				bindPanelInteractions(d);
				dlg.appendChild(d);

				/* ★ 全局排版已用 CSS 控制，不用 JS 后处理 */
				try {
					if (isMobile) {
						setTimeout(function () {
							const closeBtn = document.createElement('div');
							closeBtn.textContent = '✕ 关闭面板';
							closeBtn.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:100000;background:#1E90FF;color:#fff;padding:8px 16px;border-radius:20px;font-size:14px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.5);';
							closeBtn.addEventListener('touchstart', function (e) {
								e.preventDefault();
								try { dlg.close(); } catch (err) {}
								try { closeBtn.remove(); } catch (err) {}
							});
							closeBtn.addEventListener('click', function () {
								try { dlg.close(); } catch (err) {}
								try { closeBtn.remove(); } catch (err) {}
							});
							document.body.appendChild(closeBtn);
						}, 200);
					}
				} catch (e) {}

				const render2 = function () {
					try {
						d.innerHTML = wrapSections(part1 + part2);
						bindPanelInteractions(d);
					} catch (e) {}
				};
				if (typeof window !== 'undefined' && window.requestIdleCallback) {
					window.requestIdleCallback(render2, { timeout: 800 });
				} else {
					setTimeout(render2, 30);
				}
			} else {
				html = wrapSections(html);
				d.innerHTML = html;
				bindPanelInteractions(d);
				dlg.appendChild(d);
			}
		} catch (e) {
			try {
				html = wrapSections(html);
				d.innerHTML = html;
				bindPanelInteractions(d);
				dlg.appendChild(d);
			} catch (e2) {}
		}
		try {
			const jump = document.createElement("div");
			jump.style.cssText = "text-align:center;margin-top:8px;";
			jump.innerHTML = "<span style='color:#9ad8ff;cursor:pointer;text-decoration:underline;' onclick='try{window.__DJSC.report();}catch(e){}'>[打开结算战报]</span>";
			dlg.appendChild(jump);
		} catch (e) {}

		/* ★ 手机端：把固定宽度 inline-block 表格改成 flex 布局 */
		try {
			if (isMobile) {
				const spans = d.querySelectorAll("span[style*='display:inline-block']");
				spans.forEach(function (s) {
					const style = s.getAttribute('style') || '';
					if (!/width:\s*\d+px/.test(style)) return;
					s.style.display = 'inline-block';
					s.style.width = 'auto';
					s.style.minWidth = '40px';
					s.style.marginRight = '4px';
					s.style.fontSize = '11px';
				});
				const lines = d.querySelectorAll("div[style*='font-size:11px'], div[style*='font-size:10px']");
				lines.forEach(function (el) {
					el.style.lineHeight = '1.8';
				});
				const svgs = d.querySelectorAll("svg");
				svgs.forEach(function (svg) {
					const w = parseInt(svg.getAttribute('width')) || 0;
					if (w > window.innerWidth - 40) {
						svg.style.maxWidth = '100%';
						svg.style.height = 'auto';
					}
				});
			}
		} catch (e) {}
	} catch (e) {}
}

/* ================= 响应弹窗兜底（托管时接管 AI 响应决策，防弹窗卡死对局） ================= */
let _dlgSeen = null, _dlgTime = 0;
let _dlgIv = null;
function startDialogGuard() {
	try {
		if (typeof window === "undefined" || window.__DJSC_DLG) return;
		window.__DJSC_DLG = true;
		_dlgIv = setInterval(function () {
			try {
				if (cfg("decisionScore", true) === false) return;
				const dlg = _status && _status.event && _status.event._dialog;
				if (!dlg || !dlg.querySelector) return;
				const txt = String(dlg.textContent || "");
				/* 白名单：仅处理无害提示（跳过动画/知道了），绝不代选"不/取消"（避免AI决策被破坏） */
				if (!/跳过动画|知道了|确定.*提示|提示.*确定/.test(txt)) return;
				const btns = dlg.querySelectorAll(".button, .menubutton, .buttons > div");
				let target = null;
				for (const b of btns) {
					try {
						const bt = (b.textContent || "").trim();
						if (!bt || bt.length > 12) continue;
						if (bt === "知道了" || bt === "确定" || /^跳过/.test(bt)) { target = b; break; }
					} catch (e) {}
				}
				if (!target) return;
				const key = txt.slice(0, 40);
				if (_dlgSeen === key && Date.now() - _dlgTime < 1200) return;
				_dlgSeen = key; _dlgTime = Date.now();
				target.click();
				try { if (typeof game === "object" && game.log) game.log("【模型决策】自动响应：" + (target.textContent || "").trim() + "（托管接管，防弹窗卡死）"); } catch (eL) {}
			} catch (e) {}
		}, 1200);
	} catch (e) {}
}



function stopDialogGuard() {
	if (_dlgIv) {
		try { clearInterval(_dlgIv); } catch (e) {}
		_dlgIv = null;
	}
	/* 释放哨兵位，允许后续重新 startDialogGuard */
	try {
		if (typeof window !== "undefined") delete window.__DJSC_DLG;
	} catch (e) {}
}

/* ================= 调试桥（window.__DJSC，供面板/外部调用） ================= */
let _bridgeInstalled = false;
function installDebugBridge() {
	try {
		if (_bridgeInstalled) return;
		_bridgeInstalled = true;
		/* ★ 修复：不要覆盖已有 __DJSC，而是合并 */
		window.__DJSC = window.__DJSC || {};
		Object.assign(window.__DJSC, {
			round: function () { try { return JSON.parse(JSON.stringify(getRound())); } catch (e) { return {}; } },
			log: function () { try { return JSON.parse(JSON.stringify(getScoreLog().slice(-30))); } catch (e) { return []; } },
			reset: function () { try { resetRound(); return "ok"; } catch (e) { return "ERR:" + e; } },
			valCard: function (id) { return VAL_CARD[id] || null; },
			valEffect: function (k) { return VAL_EFFECT[k]; },
			valTiming: function (k) { return VAL_TIMING[k]; },
			strategy: function (k) { return STRATEGY[k] || null; },
			gainOf: function (id) { try { return codeGainOf(id); } catch (e) { return null; } },
			scan: function () { try { return scanCharacters(); } catch (e) { return { err: String(e) }; } },
			tagsOf: function (sid) { try { return skillTagsOf(sid); } catch (e) { return null; } },
			aggTags: function (skills) { try { return aggregateSkillTags(skills || []); } catch (e) { return null; } },
			scanReset: function () { try { importScanReset(); return "ok"; } catch (e) { return "ERR:" + e; } },
			clearGainCache: function () { try { importClearGainCache(); return "ok"; } catch (e) { return "ERR:" + e; } },
			model: function () { try { return modelDecision(); } catch (e) { return { err: String(e) }; } },
			features: function () { try { return miniFeatures(); } catch (e) { return null; } },
			rec: function () { try { return JSON.parse(JSON.stringify(getREC())); } catch (e) { return {}; } },
			advice: function () { try { return advice(); } catch (e) { return null; } },
			bestAction: function () { try { return bestAction(); } catch (e) { return null; } },
			/* ★ 牌堆记忆调试接口 */
			deckTotal: function () { try { return totalRemaining(); } catch (e) { return 0; } },
			deckSuit: function (suit) { try { return suitRemaining(suit); } catch (e) { return 0; } },
			deckCard: function (name) { try { return cardRemaining(name); } catch (e) { return 0; } },
			deckSnapshot: function () { try { return deckSnapshot(); } catch (e) { return {}; } },
			/* ★ 牌堆模式调试接口 */
			deckAutoDetect: function () { try { deckAutoDetect(); return 'ok'; } catch (e) { return 'ERR:' + e; } },
			deckSetMode: function (mode, base) { try { deckSetMode(mode, base); return 'ok'; } catch (e) { return 'ERR:' + e; } },
			deckGetMode: function () { try { return deckGetMode(); } catch (e) { return null; } },
			deckInitialCounts: function () { try { return deckInitialCounts(); } catch (e) { return {}; } },
			deckModes: function () { try { return deckAvailableModes(); } catch (e) { return []; } },
			/* ★ 牌堆预测调试接口 */
			deckPredict: function () {
				try {
					return {
						lebuEscape: lebuEscapeRate(),
						bingliangEscape: bingliangEscapeRate(),
						shandianHit: shandianHitRate(),
						baguaSuccess: baguaSuccessRate(),
						expectDraw: expectDrawValue(2),
					};
				} catch (e) { return { err: String(e) }; }
			},
			cardValue: function (id, me) { try { return cardValueOf({ name: id }, me || null); } catch (e) { return null; } },
			enemiesOf: function (char) { try { return enemiesOf(char); } catch (e) { return []; } },
			/* ★ 训练数据调试接口 */
			trainBufferSize: function () { try { return trainStats(); } catch (e) { return -1; } },
			trainBufferClear: function () { try { trainClearBuffer(); return 'ok'; } catch (e) { return 'ERR:' + e; } },
			trainExport: function () { try { return trainExportAndDownload(); } catch (e) { return 'ERR:' + e; } },
			recReset: function () { try { importRecReset(); return "ok"; } catch (e) { return "ERR:" + e; } },
			/* ★ 训练数据导出接口 */
			trainExportAndDownload: function () { try { return trainExportAndDownload(); } catch (e) { return { ok: false, err: String(e) }; } },
			trainClearBuffer: function () { try { return trainClearBuffer(); } catch (e) { return { ok: false, err: String(e) }; } },
			trainStats: function () { try { return trainStats(); } catch (e) { return { games: 0, samples: 0 }; } },
			openPanel: function () { try { openScoreDetailPanel(); } catch (e) {} },
			openHealthPanel: function () { try { openHealthPanel(); } catch (e) {} },
			openScorePanel: function () { try { openScoreDetailPanel(); } catch (e) {} },
			openPlanPanel: function () { try { openPlanPanel(); } catch (e) {} },
			openFeedbackPanel: function () { try { openFeedbackPanel(); } catch (e) {} },
			openArchivePanel: function () { try { openArchivePanel(); } catch (e) {} },
			openRecommendPanel: function () { try { openRecommendPanel(); } catch (e) {} },
			openConfigPanel: function () { try { openConfigPanel(); } catch (e) {} },
			openMemoryPanel: function () { try { openMemoryPanel(); } catch (e) {} },
			openSkillPanel: function () { try { openSkillPanel(); } catch (e) {} },
			openOverridePanel: function () { try { openOverridePanel(); } catch (e) {} },
			openSkillBreakdownPanel: function () { try { openSkillBreakdownPanel(); } catch (e) {} },
			openSkillCustomPanel: function () { try { openSkillCustomPanel(); } catch (e) {} },
			openSmartPanel: function () { try { openSmartPanel(); } catch (e) {} },
			verifyGain: function (id) { try { return codeGainOf(id); } catch (e) { return null; } },
			isOver: function () { try { return isGameOver(); } catch (e) { return false; } },
			/* ★ 模式策略状态探针 */
			mode: function () {
				try {
					const m = get.mode ? get.mode() : (_status && _status.mode);
					return m || 'unknown';
				} catch (e) { return 'unknown'; }
			},
			camps: function () {
				try {
					const out = {};
					const mode = (get.mode ? get.mode() : (_status && _status.mode)) || 'unknown';
					game.players.forEach(function (p) {
						let camp = 'unknown';
						if (p.identity === 'zhu') camp = 'loyal';
						else if (p.identity === 'zhong' || p.identity === 'mingzhong') camp = 'loyal';
						else if (p.identity === 'fan') camp = 'rebel';
						else if (p.identity === 'nei') camp = 'nei';
						else if (mode === 'guozhan') camp = p.group || 'unknown';
						else if (mode === 'doudizhu') camp = p.isZhu ? 'landlord' : 'farmer';
						else camp = String(p.identity || p.group || 'unknown');
						out[p.name1 || p.name || '?'] = camp;
					});
					return out;
				} catch (e) { return { err: String(e) }; }
			},
			modeStatus: function () {
				try {
					const mode = (get.mode ? get.mode() : (_status && _status.mode)) || 'unknown';
					const strategies = {
						identity: '身份局（主/忠/反/内）',
						guozhan: '国战（势力+野心家）',
						doudizhu: '斗地主（地主/农民）',
						boss: 'BOSS战（BOSS/挑战者）',
						versus: '对战（红/蓝队）',
						single: '单挑（1v1）',
						chess: '棋局',
						stone: '水淹七军',
					};
					return {
						mode: mode,
						desc: strategies[mode] || '未知模式（使用通用策略）',
						hasStrategy: !!strategies[mode],
					};
				} catch (e) { return { err: String(e) }; }
			},
			/* 决策回放 / 跨局记忆 / 战报探针 */
			/* ★ AI 接管层专用：记录 bestAction 结果（去重） */
			logBestAction: function (player, ba) {
				try {
					if (!player || !ba) return "skip";
					const pname = player.name || player.name1 || "?";
					const entry = {
						ts: Date.now(),
						round: (function () {
							try {
								if (_status && typeof _status.roundNumber === "number") return _status.roundNumber;
								if (typeof game === "object" && typeof game.roundNumber === "number") return game.roundNumber;
							} catch (e) {}
							return 0;
						})(),
						player: pname,
						layers: {
							tempo: { mode: "auto", stage: "mid", baseTempo: 1, atkMul: 1, keepMul: 1, burstMul: 1, desc: "接管层" },
							risk: { label: "auto", atk: 1, def: 1, safe: 1 },
							team: { focus: null, focusScore: 0, protect: null, protectScore: 0, comboCount: 0 },
							seat: { enemyPressure: 0, nextEnemy: null, prevEnemy: null },
							econ: { handCount: 0, handValue: 0, equipCount: 0, equipValue: 0, hp: 0, maxHp: 1, hpRatio: 0, totalValue: 0, stripPressure: 0 },
							style: { target: null, tag: null },
							forecast: { incomingTotal: 0, selfRisk: 0, killRisk: 0, topEnemy: null, teamRisk: [], advice: "" },
							multiturn: { overall: "stable", r1: null, r3: null, advice: "" },
						},
						candidates: ba.candidates ? ba.candidates.slice(0, 6) : [],
						winner: {
							type: ba.action === "D" ? "card" : (ba.action === "F" ? "skill" : (ba.action === "E" ? "equip" : "end")),
							id: ba.rule || "?",
							score: ba.score || 0,
							reason: (ba.reason || "").slice(0, 120),
						},
					};
					/* 通过内部函数写入 engine 的 DECISION_LOG */
					try {
						if (typeof window.__DJSC_appendDecision === "function") {
							window.__DJSC_appendDecision(entry);
						}
					} catch (e2) {}
					return "ok";
				} catch (e) { return "ERR:" + e; }
			},
			decisionLog: function () { try { return JSON.parse(JSON.stringify(getDecisionLog())); } catch (e) { return []; } },
			clearDecisionLog: function () { try { clearDecisionLog(); return "ok"; } catch (e) { return "ERR:" + e; } },
			memory: function () { try { return storeStats(); } catch (e) { return null; } },
			resetMemory: function () { try { resetStore(); return "ok"; } catch (e) { return "ERR:" + e; } },
			exportMemory: function () { try { return exportStore(); } catch (e) { return { err: String(e) }; } },
			importMemory: function (data, mode) { try { return importStore(data, mode || "merge"); } catch (e) { return { ok: false, err: String(e) }; } },
			clearMemory: function () { try { return clearStore(); } catch (e) { return { ok: false, err: String(e) }; } },
			report: function () { try { showReport(true); return "ok"; } catch (e) { return "ERR:" + e; } },
			reportHtml: function () { try { return buildReportHtml(); } catch (e) { return ""; } },
			/* 技能矩阵 / 性格 / 归档探针 */
			skillProfile: function (sid) { try { return skillProfileOf(sid); } catch (e) { return null; } },
			skillBreakdown: function (sid) {
				try { return skillProfitBreakdown(sid); } catch (e) { return null; }
			},
			skillBreakdownText: function (sid) {
				try { return renderSkillBreakdownText(sid); } catch (e) { return 'ERR:' + e; }
			},
			skillQuadrants: function (sid) {
				try {
					const br = skillProfitBreakdown(sid);
					return {
						byQuadrant: br.byQuadrant,
						affectCount: br.affectCount,
						total: br.total,
					};
				} catch (e) { return { err: String(e) }; }
			},
			skillScope: function (sid) {
				try {
					const br = skillProfitBreakdown(sid);
					return {
						scope: br.scope,
						scopeLabel: br.scopeLabel,
						scopeCount: br.scopeCount,
						scopeHits: br.scopeHits,
					};
				} catch (e) { return { err: String(e) }; }
			},
			overrideStats: function () {
				try { return getOverrideStats(); } catch (e) { return {}; }
			},
			resetOverrideStats: function () {
				try { resetOverrideStats(); return 'ok'; } catch (e) { return 'ERR:' + e; }
			},
			skillSource: function (sid) {
				try {
					const sk = lib.skill && lib.skill[sid];
					if (!sk) return '（技能不存在）';
					/* 直接调用内部 _collectSource 函数（需要在 skills.js 里导出） */
					if (typeof window.__DJSC_COLLECT_SOURCE === 'function') {
						return window.__DJSC_COLLECT_SOURCE(sk, sid);
					}
					return '（未挂载扫描函数）';
				} catch (e) { return 'ERR:' + e; }
			},
			matrixOf: function (p) {
				try {
					const tgt = p || game.me;
					const out = {};
					((tgt && tgt.skills) || []).forEach(function (sid) {
						try { out[sid] = skillProfileOf(sid); } catch (e) {}
					});
					return out;
				} catch (e) { return null; }
			},
			personality: function (p) {
				try {
					const preset = cfg("riskProfile", "custom");
					const PS = { aggressive: {agg:80,rsk:70,team:40}, balanced: {agg:50,rsk:50,team:50}, cautious: {agg:30,rsk:30,team:70}, loner: {agg:70,rsk:60,team:10}, guardian: {agg:30,rsk:20,team:90} };
					let agg, rsk, tea;
					if (preset !== "custom" && PS[preset]) { agg = PS[preset].agg; rsk = PS[preset].rsk; tea = PS[preset].team; }
					else {
						agg = Number(cfg("personalityAggression", 50)) || 50;
						rsk = Number(cfg("personalityRisk", 50)) || 50;
						tea = Number(cfg("personalityTeam", 50)) || 50;
					}
					let idMod = { agg: 0, rsk: 0, team: 0 };
					let idTag = "none";
					try {
						const md = (_status && _status.mode) || (get && get.mode ? get.mode() : "");
						if ((md === "identity" || md === "guozhan") && p && p.identity) {
							const IM = { zhu: {agg:-15,rsk:-10,team:10}, zhong: {agg:5,rsk:-5,team:15}, mingzhong: {agg:5,rsk:-5,team:15}, fan: {agg:15,rsk:10,team:5}, nei: {agg:5,rsk:15,team:-10} };
							if (IM[p.identity]) { idMod = IM[p.identity]; idTag = p.identity; }
						}
					} catch (eId) {}
					return {
						preset, identity: idTag, idMod,
						raw: { agg: agg, rsk: rsk, tea: tea },
						eff: {
							agg: Math.max(0, Math.min(100, agg + idMod.agg)),
							rsk: Math.max(0, Math.min(100, rsk + idMod.rsk)),
							tea: Math.max(0, Math.min(100, tea + idMod.team)),
						},
					};
				} catch (e) { return null; }
			},
			archive: function () { try { return getArchive(); } catch (e) { return []; } },
			archiveStats: function () { try { return archiveStats(); } catch (e) { return null; } },
			clearArchive: function () { try { clearArchive(); return "ok"; } catch (e) { return "ERR:" + e; } },
			archiveDetail: function (idx) { try { return getGameDecisions(Number(idx) || 0); } catch (e) { return null; } },
			exportArchive: function () { try { return exportArchiveJson(); } catch (e) { return "{}"; } },
			fullStats: function () { try { return fullArchiveStats(); } catch (e) { return null; } },
			feedback: function () { try { return getFeedbackStats(); } catch (e) { return []; } },
			feedbackCount: function () { try { return feedbackCount(); } catch (e) { return 0; } },
			resetFeedback: function () { try { resetFeedback(); return "ok"; } catch (e) { return "ERR:" + e; } },
			styleConf: function (tag) { try { return getTagConf(tag); } catch (e) { return 1; } },
			resetStyleFeedback: function () { try { resetStyleFeedback(); return "ok"; } catch (e) { return "ERR:" + e; } },
			multiturn: function (p) { try { return multiTurnForecast(p || game.me); } catch (e) { return null; } },
			forecast: function (p) { try { return forecastSummary(p || game.me); } catch (e) { return null; } },
			incoming: function (p) { try { return incomingPressure(p || game.me); } catch (e) { return null; } },
			templates: function () { try { return PERSONALITY_TEMPLATES; } catch (e) { return []; } },
			applyTemplate: function (key) {
				try {
					const t = findTemplate(key);
					if (!t) return { ok: false, err: "未找到模板" };
					lib.config["extension_无名AI_riskProfile"] = "custom";
					lib.config["extension_无名AI_personalityAggression"] = t.agg;
					lib.config["extension_无名AI_personalityRisk"] = t.rsk;
					lib.config["extension_无名AI_personalityTeam"] = t.tea;
					game.saveConfig("extension_无名AI_riskProfile", "custom");
					game.saveConfig("extension_无名AI_personalityAggression", t.agg);
					game.saveConfig("extension_无名AI_personalityRisk", t.rsk);
					game.saveConfig("extension_无名AI_personalityTeam", t.tea);
					return { ok: true, template: t };
				} catch (e) { return { ok: false, err: String(e) }; }
			},
			exportPersonality: function () { try { return exportPersonality(); } catch (e) { return null; } },
			importPersonality: function (s) { try { return importPersonality(s); } catch (e) { return { ok: false, err: String(e) }; } },
			/* 行为观察探针 */
			obs: function () { try { return JSON.parse(JSON.stringify(getObs())); } catch (e) { return {}; } },
			obsOf: function (p) { try { return explainObs(p || game.me); } catch (e) { return null; } },
			relation: function (a, b) { try { return relationOf(a || game.me, b); } catch (e) { return 0; } },
			stance: function (a, b) { try { return observedStance(a || game.me, b); } catch (e) { return "neutral"; } },
			hostility: function (p) { try { return hostilityOf(p || game.me); } catch (e) { return 0; } },
			friendliness: function (p) { try { return friendlinessOf(p || game.me); } catch (e) { return 0; } },
			resetObs: function () { try { var m = getObs(); for (var k in m) delete m[k]; return "ok"; } catch (e) { return "ERR:" + e; } },
			/* 身份推理探针 */
			identityRead: function (p) { try { return identityOf(p || game.me); } catch (e) { return "unknown"; } },
			belief: function (p) { try { return beliefOf(p || game.me); } catch (e) { return null; } },
			explainIdentity: function (p) { try { return explainIdentity(p || game.me); } catch (e) { return null; } },
			updateBelief: function () { try { updateBelief(); return "ok"; } catch (e) { return "ERR:" + e; } },
			selfCheck: function () {
				try {
					const out = { ok: [], fail: [] };
					const probes = {
						detectCombo: function () { return typeof detectCombo === "function"; },
						advice: function () { return typeof advice === "function"; },
						bestAction: function () { return typeof bestAction === "function"; },
						modelDecision: function () { return typeof modelDecision === "function"; },
						threatOf: function () { return typeof threatOf === "function"; },
						charComboOf: function () { return typeof charComboOf === "function"; },
						situationFactor: function () { return typeof situationFactor === "function"; },
						cardValueOf: function () { return typeof cardValueOf === "function"; },
						scanCharacters: function () { return typeof scanCharacters === "function"; },
					};
					for (const k in probes) {
						try { (probes[k]() ? out.ok : out.fail).push(k); }
						catch (e) { out.fail.push(k + "(throw)"); }
					}
					return out;
				} catch (e) { return { err: String(e) }; }
			},
			/* 十八~二十二步新增探针 */
			playerMemory: function () { try { return getPlayerMemoryStats(); } catch (e) { return []; } },
			resetPlayerMemory: function () { try { resetPlayerMemory(); return "ok"; } catch (e) { return "ERR:" + e; } },
			customTemplates: function () { try { return listCustomTemplates(); } catch (e) { return []; } },
			charts: function () { try { return { line: typeof lineChart, bar: typeof barChart, radar: typeof radarChart, donut: typeof donutChart }; } catch (e) { return null; } },
			aiStats: function () { try { return aggregateByPlayer(getDecisionLog(), getREC().cards); } catch (e) { return null; } },
			lang: function () { try { return { cur: lib.config["extension_无名AI_lang"] || "zh", avail: availableLangs() }; } catch (e) { return null; } },
			setLang: function (l) { try { return setLang(l); } catch (e) { return false; } },
			autoplay: function (n) { try { return startAutoplay(n || 3); } catch (e) { return { ok: false, err: String(e) }; } },
			autoplayStop: function () { try { return stopAutoplay(); } catch (e) { return { ok: false, err: String(e) }; } },
			autoplayStatus: function () { try { return autoplayStatus(); } catch (e) { return null; } },
			autoplayReport: function () { try { showAutoplayReport(); return "ok"; } catch (e) { return "ERR:" + e; } },
			batchAutoplay: function (c) { try { return startBatchAutoplay(c || []); } catch (e) { return { ok: false, err: String(e) }; } },
			batchStatus: function () { try { return batchStatus(); } catch (e) { return null; } },
			branches: function (sid) { try { return skillBranchesOf(sid); } catch (e) { return null; } },
			checkBranch: function (trig) { try { return checkBranch(trig, game.me, null); } catch (e) { return false; } },
			stages: function (sid) { try { return skillStagesOf(sid); } catch (e) { return null; } },
			netEffect: function (sid) { try { return skillNetEffect(sid); } catch (e) { return 0; } },
			interactions: function (sid) { try { return skillInteractionOf(sid); } catch (e) { return null; } },
			exportDecisionsJson: function () { try { return exportDecisionsJson(); } catch (e) { return "{}"; } },
			exportDecisionsMd: function () { try { return exportDecisionsMarkdown(); } catch (e) { return ""; } },
			importDecisions: function (json) { try { return parseDecisionsJson(json); } catch (e) { return { ok: false, err: String(e) }; } },
			showImported: function (json) { try { const r = parseDecisionsJson(json); if (r.ok) { showImportedDecisions(r); return "ok"; } return r.err; } catch (e) { return "ERR:" + e; } },
			collapseState: function () {
				try {
					const out = {};
					Object.keys(localStorage).forEach(function (k) { if (k.indexOf("无名AI_panelCollapse_") === 0) out[k.replace("无名AI_panelCollapse_", "")] = localStorage.getItem(k); });
					return out;
				} catch (e) { return {}; }
			},
			resetCollapse: function () {
				try {
					const keys = Object.keys(localStorage).filter(function (k) { return k.indexOf("无名AI_panelCollapse_") === 0; });
					keys.forEach(function (k) { localStorage.removeItem(k); });
					return keys.length;
				} catch (e) { return 0; }
			},
			allyPersonalities: function () { try { return JSON.parse(localStorage.getItem("无名AI_allyPersonalities") || "{}"); } catch (e) { return {}; } },
			setAllyPersonality: function (pk, agg, rsk, tea, name) {
				try {
					if (!pk) return { ok: false, err: "playerKey 为空" };
					const stored = JSON.parse(localStorage.getItem("无名AI_allyPersonalities") || "{}");
					if (agg === null) { delete stored[pk]; }
					else { stored[pk] = { agg: agg, rsk: rsk, tea: tea, name: name || "自定义", ts: Date.now() }; }
					localStorage.setItem("无名AI_allyPersonalities", JSON.stringify(stored));
					return { ok: true, all: stored };
				} catch (e) { return { ok: false, err: String(e) }; }
			},
			setAllyRole: function (pk, role) {
				try {
					if (!pk || !role) return { ok: false, err: "参数缺失" };
					const stored = JSON.parse(localStorage.getItem("无名AI_allyPersonalities") || "{}");
					if (!stored[pk]) stored[pk] = { agg: 50, rsk: 50, tea: 50, name: "默认", ts: Date.now() };
					stored[pk].role = role;
					localStorage.setItem("无名AI_allyPersonalities", JSON.stringify(stored));
					return { ok: true, all: stored };
				} catch (e) { return { ok: false, err: String(e) }; }
			},
			profiles: function () { try { return listProfiles(); } catch (e) { return null; } },
			saveProfile: function (name) {
				try {
					const snap = {
						riskProfile: lib.config["extension_无名AI_riskProfile"],
						personalityAggression: lib.config["extension_无名AI_personalityAggression"],
						personalityRisk: lib.config["extension_无名AI_personalityRisk"],
						personalityTeam: lib.config["extension_无名AI_personalityTeam"],
					};
					return saveProfile(name, snap);
				} catch (e) { return { ok: false, err: String(e) }; }
			},
			loadProfile: function (name) { try { return loadProfile(name); } catch (e) { return { ok: false, err: String(e) }; } },
			deleteProfile: function (name) { try { return deleteProfile(name); } catch (e) { return { ok: false, err: String(e) }; } },
			exportProfiles: function () { try { return exportProfilesJson(); } catch (e) { return "{}"; } },
			importProfiles: function (json, mode) { try { return importProfilesJson(json, mode || "merge"); } catch (e) { return { ok: false, err: String(e) }; } },
			resetProfiles: function () { try { resetProfiles(); return "ok"; } catch (e) { return "ERR:" + e; } },
			logLevel: function (v) { if (v === undefined) return getLogLevel(); setLogLevel(v); return "ok"; },
			/* ★ 技能源码探针 */
			skillSource: function (ids) { try { return showSkillSource(ids); } catch (e) { return 'ERR:' + e; } },
			/* ★ 问题反馈联系群探针 */
			showFeedbackGroup: function () { try { return showFeedbackGroup(); } catch (e) { return 'ERR:' + e; } },
			/* ★ 数据导出探针 */
			exportAll: function () { try { return exportAll(); } catch (e) { return { err: String(e) }; } },
			exportAllJson: function (pretty) { try { return exportAllJson(pretty); } catch (e) { return '{"err":"' + String(e) + '"}'; } },
			exportModule: function (key) { try { const fn = exporters[key]; return fn ? fn() : null; } catch (e) { return { err: String(e) }; } },
			exportModules: function () { try { return Object.keys(exporters); } catch (e) { return []; } },
			/* ★ 文件下载探针 */
			exportAllFile: function (pretty) { try { return exportAllFile(pretty); } catch (e) { return false; } },
			exportModuleFile: function (key, label) { try { return exportModuleFile(key, label); } catch (e) { return false; } },
			downloadFile: function (filename, content, mime) { try { return downloadFile(filename, content, mime); } catch (e) { return false; } },
			conflicts: function () { try { return selfCheck(); } catch (e) { return null; } },
			decisionFeedback: function () { try { return getDecisionFeedbackStats(); } catch (e) { return []; } },
			resetDecisionFeedback: function () { try { resetDecisionFeedback(); return "ok"; } catch (e) { return "ERR:" + e; } },
			perf: function () { try { return perfStats(); } catch (e) { return {}; } },
			perfReset: function () { try { perfReset(); return "ok"; } catch (e) { return "ERR:" + e; } },
			health: function () { try { return healthCheck(); } catch (e) { return null; } },
			/* ★ 策略总线探针 */
			strategist: function () {
				try {
					return {
						stats: getStrategistStats(),
						last: getStrategistLast(),
						log: getStrategistAuditLog(20),
					};
				} catch (e) { return { err: String(e) }; }
			},
			strategistEnable: function (v) {
				try { setStrategistEnabled(v); return "ok"; } catch (e) { return "ERR:" + e; }
			},
			strategistClear: function () {
				try { clearStrategistAudit(); return "ok"; } catch (e) { return "ERR:" + e; }
			},
			strategistStats: function () {
				try { return getStrategistStats(); } catch (e) { return null; }
			},
			strategistReset: function () {
				try { resetStrategistStats(); return "ok"; } catch (e) { return "ERR:" + e; }
			},
			strategistHtml: function () {
				try { return buildStrategistHtml(); } catch (e) { return "ERR:" + e; }
			},
			recommendChars: function (ids) { try { return recommendChars((game.me && game.me.identity) || 'zhu', ids || [], 5); } catch (e) { return []; } },
			adaptive: function () { try { return adaptiveStatus(); } catch (e) { return null; } },
			resetAdaptive: function () { try { return import('./adaptive.js').then(function (m) { m.resetAdaptive && m.resetAdaptive(); return "ok"; }); } catch (e) { return "ERR:" + e; } },
			plan: function () {
				try {
					const me = _status.currentPhase || (game.players && game.players[0]);
					return me ? planSequence(me) : null;
				} catch (e) { return null; }
			},
			debugPanel: function () {
				try {
					const shell = window.__DJSC_SHELL;
					const dlg = window.__DJSC_PANEL;
					const result = {
						windowSize: { w: window.innerWidth, h: window.innerHeight },
					};
					if (shell) {
						const cs = getComputedStyle(shell);
						result.shell = {
							position: cs.position,
							left: cs.left,
							top: cs.top,
							width: cs.width,
							height: cs.height,
							transform: cs.transform,
							parent: shell.parentNode && shell.parentNode.tagName,
						};
					} else {
						result.shell = '不存在';
					}
					if (dlg) {
						const cs = getComputedStyle(dlg);
						result.dlg = {
							position: cs.position,
							width: cs.width,
							height: cs.height,
							transform: cs.transform,
						};
					} else {
						result.dlg = '不存在';
					}
					return result;
				} catch (e) { return "ERR:" + e; }
			},
			overrideStatus: function () { try { return overrideStatus(); } catch (e) { return null; } },
			resetCircuit: function () { try { resetCircuit(); return "ok"; } catch (e) { return "ERR:" + e; } },
			/* ★ 导出所有面板数据 */
			exportAll: function () {
				try {
					const me = _status.currentPhase || (game.players && game.players[0]);
					const data = {
						exportTime: new Date().toISOString(),
						version: '4.53.3',
						/* 基础状态 */
						round: (typeof round === 'function' ? round() : getRound()),
						currentPlayer: me ? (me.name || me.name1) : null,
						gameMode: (typeof get !== 'undefined' && get.mode ? get.mode() : null),
						/* 决策日志 */
						decisionLog: typeof getDecisionLog === 'function' ? getDecisionLog().slice(-50) : [],
						/* 技能拆解 */
						skillBreakdown: me ? ((me.skills || []).map(function (sid) {
							try {
								return {
									skillId: sid,
									name: (lib.translate && lib.translate[sid]) || sid,
									breakdown: typeof skillProfitBreakdown === 'function' ? skillProfitBreakdown(sid) : null,
									tags: typeof skillTagsOf === 'function' ? skillTagsOf(sid) : null,
								};
							} catch (e) { return { skillId: sid, err: String(e) }; }
						})) : [],
						/* 策略总线 */
						strategist: typeof getStrategistStats === 'function' ? {
							stats: getStrategistStats(),
							last: typeof getStrategistLast === 'function' ? getStrategistLast() : null,
							log: typeof getStrategistAuditLog === 'function' ? getStrategistAuditLog(50) : [],
						} : null,
						/* 接管层状态 */
						override: typeof overrideStatus === 'function' ? overrideStatus() : null,
						/* 性能统计 */
						perf: typeof perfStats === 'function' ? perfStats() : null,
						/* 健康检查 */
						health: typeof healthCheck === 'function' ? healthCheck() : null,
						/* 行为观察 */
						obs: typeof getObs === 'function' ? getObs() : null,
						/* 身份推理 */
						identity: me && typeof identityOf === 'function' ? {
							player: me.name || me.name1,
							identity: identityOf(me),
							belief: typeof beliefOf === 'function' ? beliefOf(me) : null,
						} : null,
						/* 性格配置 */
						personality: me && typeof personality === 'function' ? personality(me) : null,
						/* 玩家列表 */
						players: (game.players || []).map(function (p) {
							return {
								name: p.name || p.name1,
								hp: p.hp,
								maxHp: p.maxHp,
								identity: p.identity || 'unknown',
								alive: p.alive !== false,
								skills: p.skills || [],
							};
						}),
					};

					/* ★ 新增：收集所有显示"无"的技能的代码和描述 */
					const emptySkills = [];
					try {
						if (me && me.skills) {
							me.skills.forEach(function (sid) {
								try {
									const br = typeof skillProfitBreakdown === 'function' ? skillProfitBreakdown(sid) : null;
									const tags = typeof skillTagsOf === 'function' ? skillTagsOf(sid) : null;
									/* 判断是否显示"无"：正收益为空且负收益为空 */
									const isEmpty = (!br || (!br.positive.length && !br.negative.length)) ||
													(!tags || (tags.__source === 'empty'));
									if (isEmpty) {
										/* 获取技能完整定义 */
										const sk = lib.skill && lib.skill[sid];
										let skillCode = '';
										let skillDescription = '';
										try {
											if (sk) {
												/* 把技能对象转成可读文本 */
												skillDescription = (lib.translate && lib.translate[sid + '_info']) || (lib.translate && lib.translate[sid]) || '';
												/* 提取技能的关键字段 */
												const fields = {};
												if (sk.trigger) fields.trigger = typeof sk.trigger === 'object' ? Object.keys(sk.trigger) : sk.trigger;
												if (sk.mod) fields.mod = typeof sk.mod === 'object' ? Object.keys(sk.mod) : sk.mod;
												if (sk.ai) fields.ai = typeof sk.ai === 'object' ? Object.keys(sk.ai) : sk.ai;
												if (sk.viewAs) fields.viewAs = sk.viewAs;
												if (sk.enable) fields.enable = sk.enable;
												if (sk.filter) fields.filter = typeof sk.filter === 'function' ? 'function' : sk.filter;
												if (sk.onstart) fields.onstart = typeof sk.onstart === 'function' ? 'function' : sk.onstart;
												if (sk.retain) fields.retain = sk.retain;
												if (sk.limit) fields.limit = sk.limit;
												if (sk.awaken) fields.awaken = sk.awaken;
												if (sk.forced) fields.forced = sk.forced;
												if (sk.zhuSkill) fields.zhuSkill = sk.zhuSkill;
												skillCode = JSON.stringify(fields, null, 2);
											}
										} catch (eCode) {
											skillCode = '获取技能代码失败：' + String(eCode);
										}
										emptySkills.push({
											skillId: sid,
											name: (lib.translate && lib.translate[sid]) || sid,
											description: skillDescription,
											code: skillCode,
											tags: tags,
											breakdown: br,
										});
									}
								} catch (e) {}
							});
						}
					} catch (e) {}
					data.emptySkillsDetail = emptySkills;

					return JSON.stringify(data, null, 2);
				} catch (e) { return JSON.stringify({ err: String(e) }); }
			},
			exportAllAndDownload: function () {
				try {
					const json = window.__DJSC.exportAll();
					/* 用本体方法：复制到剪贴板 */
					if (typeof game.copy === "function") {
						game.copy(json, "面板数据 JSON 已复制到剪贴板（" + Math.round(json.length / 1024) + " KB）", "复制失败");
					} else {
						alert("面板数据 JSON 长度：" + Math.round(json.length / 1024) + " KB");
					}
					return {
						ok: true,
						size: Math.round(json.length / 1024) + ' KB',
						emptySkillsCount: JSON.parse(json).emptySkillsDetail ? JSON.parse(json).emptySkillsDetail.length : 0,
					};
				} catch (e) { return { ok: false, err: String(e) }; }
			},
			/* ★ 导入面板数据 */
			importAll: function (jsonStr, mode) {
				try {
					const data = JSON.parse(jsonStr);
					const modeStr = mode || 'overwrite'; // overwrite | merge
					let imported = 0;
					let skipped = 0;

					/* 导入决策日志 */
					if (data.decisionLog && Array.isArray(data.decisionLog)) {
						try {
							const existing = typeof getDecisionLog === 'function' ? getDecisionLog() : [];
							if (modeStr === 'overwrite') {
								typeof clearDecisionLog === 'function' && clearDecisionLog();
								data.decisionLog.forEach(function (item) {
									try { typeof addDecisionLog === 'function' && addDecisionLog(item); imported++; } catch (e) { skipped++; }
								});
							} else {
								/* 合并：只导入新的 */
								const existingKeys = new Set(existing.map(function (x) { return x.round + '_' + x.time; }));
								data.decisionLog.forEach(function (item) {
									const key = item.round + '_' + item.time;
									if (!existingKeys.has(key)) {
										try { typeof addDecisionLog === 'function' && addDecisionLog(item); imported++; } catch (e) { skipped++; }
									} else { skipped++; }
								});
							}
						} catch (e) {}
					}

					/* 导入策略总线统计 */
					if (data.strategist && data.strategist.stats) {
						try {
							if (typeof importStrategistStats === 'function') {
								importStrategistStats(data.strategist.stats, modeStr);
								imported++;
							}
						} catch (e) {}
					}

					/* 导入玩家记忆 */
					if (data.players && Array.isArray(data.players)) {
						try {
							/* 这里可以扩展导入玩家记忆 */
						} catch (e) {}
					}

					return { ok: true, imported: imported, skipped: skipped, mode: modeStr };
				} catch (e) { return { ok: false, err: String(e) }; }
			},
			importAllFromFile: function (mode) {
				try {
					const input = document.createElement('input');
					input.type = 'file';
					input.accept = '.json';
					input.onchange = function (e) {
						const file = e.target.files[0];
						if (!file) return;
						const reader = new FileReader();
						reader.onload = function (ev) {
							try {
								const result = window.__DJSC.importAll(ev.target.result, mode);
								if (result.ok) {
									alert('导入成功：' + result.imported + ' 项，跳过 ' + result.skipped + ' 项（模式：' + result.mode + '）');
								} else {
									alert('导入失败：' + result.err);
								}
							} catch (err) {
								alert('导入失败：' + err.message);
							}
						};
						reader.readAsText(file);
					};
					input.click();
					return 'ok';
				} catch (e) { return 'ERR:' + e; }
			},
			/* ★ 选将评分系统 */
			charStore: function () {
				try {
					var CS_KEY = "无名AI_charUsage_v2";
					var STORE_VERSION = 2;
					var MAX_ENTRIES_PER_MODE = 50;
					var MAX_SAMPLES = 100;
					var BATCH_SIZE = 2;

					function loadStore() {
						try {
							var raw = localStorage.getItem(CS_KEY);
							if (raw) {
								var obj = JSON.parse(raw);
								if (obj && obj.v === STORE_VERSION && obj.modes) return obj;
							}
						} catch (e) {}
						return { v: STORE_VERSION, modes: {} };
					}

					function saveStore(s) {
						try { localStorage.setItem(CS_KEY, JSON.stringify(s)); } catch (e) {}
					}

					function currentMode() {
						try {
							if (typeof _status !== 'undefined' && _status && _status.mode) return String(_status.mode);
						} catch (e) {}
						try {
							if (typeof game !== 'undefined' && game && game.getMode) return String(game.getMode());
						} catch (e) {}
						return "identity";
					}

					function computeCharDims(charName) {
						var dims = {
							skillPower: 0, attack: 0, defense: 0, control: 0,
							support: 0, burst: 0, sustain: 0, teamwork: 0,
							solo: 0, difficulty: 0
						};
						try {
							if (typeof lib === 'undefined' || !lib.character) return dims;
							var cd = lib.character[charName];
							if (!cd || !cd.skills) return dims;
							var sc = cd.skills.length;
							if (sc === 0) return dims;

							for (var i = 0; i < sc; i++) {
								var sn = cd.skills[i];
								var prof = null;
								try {
									if (window.__DJSC && window.__DJSC.skillProfile) prof = window.__DJSC.skillProfile(sn);
								} catch (e) {}
								if (!prof) continue;

								if (typeof prof.final === 'number') dims.skillPower += prof.final;
								if (prof.dims) {
									for (var d in prof.dims) {
										if (typeof dims[d] === 'number' && typeof prof.dims[d] === 'number') {
											dims[d] += prof.dims[d];
										}
									}
								}
							}

							for (var key in dims) {
								dims[key] = Math.round((dims[key] / sc) * 100) / 100;
							}
						} catch (e) {}
						return dims;
					}

					function updateCharStats(charName, won, gameScore) {
						try {
							if (!charName) return null;
							var mode = currentMode();
							var store = loadStore();
							if (!store.modes[mode]) store.modes[mode] = {};
							var m = store.modes[mode];

							if (!m[charName]) {
								m[charName] = {
									games: 0, wins: 0,
									avgScore: 0,
									pendingN: 0, pendingSum: 0,
									dimsSum: {}, dimsN: 0,
									lastSeen: 0
								};
							}
							var rec = m[charName];

							rec.pendingN += 1;
							rec.pendingSum += (gameScore || 0);
							rec.games += 1;
							if (won) rec.wins += 1;

							var dims = computeCharDims(charName);
							for (var d in dims) {
								if (typeof dims[d] === 'number') {
									rec.dimsSum[d] = (rec.dimsSum[d] || 0) + dims[d];
								}
							}
							rec.dimsN += 1;

							if (rec.pendingN >= BATCH_SIZE) {
								var batchAvg = rec.pendingSum / rec.pendingN;
								var histGames = rec.games - rec.pendingN;
								if (histGames <= 0) {
									rec.avgScore = batchAvg;
								} else {
									rec.avgScore = (rec.avgScore * histGames + batchAvg * rec.pendingN) / (histGames + rec.pendingN);
								}
								rec.avgScore = Math.round(rec.avgScore * 100) / 100;
								rec.pendingN = 0;
								rec.pendingSum = 0;
							}

							if (rec.dimsN > 0) {
								var newDims = {};
								for (var d2 in rec.dimsSum) {
									newDims[d2] = Math.round((rec.dimsSum[d2] / rec.dimsN) * 100) / 100;
								}
								rec.dims = newDims;
							}

							if (rec.games > MAX_SAMPLES) {
								rec.games = MAX_SAMPLES;
								rec.wins = Math.min(rec.wins, MAX_SAMPLES);
							}

							rec.lastSeen = Date.now();

							var names = Object.keys(m);
							if (names.length > MAX_ENTRIES_PER_MODE) {
								names.sort(function (a, b) { return (m[b].lastSeen || 0) - (m[a].lastSeen || 0); });
								for (var i = MAX_ENTRIES_PER_MODE; i < names.length; i++) delete m[names[i]];
							}

							saveStore(store);
							return rec;
						} catch (e) { return null; }
					}

					function getTopChars(mode, limit) {
						limit = limit || MAX_ENTRIES_PER_MODE;
						var store = loadStore();
						var modeData = store.modes[mode || currentMode()] || {};
						var list = [];
						for (var name in modeData) {
							var rec = modeData[name];
							if (!rec) continue;
							list.push({
								name: name,
								score: rec.avgScore || 0,
								games: rec.games || 0,
								wins: rec.wins || 0,
								winRate: rec.games > 0 ? Math.round((rec.wins / rec.games) * 100) / 100 : 0,
								dims: rec.dims || {}
							});
						}
						list.sort(function (a, b) { return b.score - a.score; });
						return list.slice(0, limit);
					}

					function getCharRecord(charName, mode) {
						var store = loadStore();
						var m = store.modes[mode || currentMode()] || {};
						return m[charName] || null;
					}

					function getAllModeStats() {
						var store = loadStore();
						var result = {};
						for (var mode in store.modes) {
							result[mode] = { charCount: Object.keys(store.modes[mode]).length };
						}
						return result;
					}

					function clearMode(mode) {
						var store = loadStore();
						if (mode) delete store.modes[mode];
						else store.modes = {};
						saveStore(store);
					}

					return {
						update: updateCharStats,
						top: getTopChars,
						get: getCharRecord,
						allModes: getAllModeStats,
						clear: clearMode,
						currentMode: currentMode,
						dimsOf: computeCharDims
					};
				} catch (e) { return { err: String(e) }; }
			},
		});
		} catch (e) {}

		/* ★ 挂载内部方法供 aiOverride 调用 */
		try {
			if (typeof window !== 'undefined') {
				window.__DJSC_appendDecision = appendDecision;
			}
		} catch (e) {}

		/* ★ 游戏结束自动统计（从 engine.js 移过来，确保 game 已初始化） */
		try {
			if (typeof game !== 'undefined' && game.on) {
				game.on("gameOver", function() {
					try {
						if (!game.me || !game.me.name1) return;
						var won = false;
						try {
							if (game.winner) {
								won = (game.winner === game.me.identity || game.winner === "me");
							}
						} catch(e){}
						var gameScore = 0;
						try {
							if (window.__DJSC && window.__DJSC.report) {
								var r = window.__DJSC.report();
								if (r && typeof r.score === 'number') gameScore = r.score;
							}
						} catch(e){}
						if (window.__DJSC && window.__DJSC.charStore) {
							window.__DJSC.charStore().update(game.me.name1, won, gameScore);
						}
					} catch(e){}
				});
			}
		} catch(e) {}
}
function uninstallDebugBridge() {
	try { delete window.__DJSC; } catch (e) {}
	try { delete window.__DJSC_appendDecision; } catch (e) {}
	_bridgeInstalled = false;
}
function importClearGainCache() { try { clearGainCache(); } catch (e) {} }
function importScanReset() {
	try { scanCharacters._cache = null; } catch (e) {}
	try { window.__SCAN_CACHE = null; } catch (e) {}
}
function importRecReset() {
	try { const REC2 = getREC(); REC2.effects = {}; REC2.cards = {}; REC2.timings = {}; REC2.log = []; } catch (e) {}
}

/* ================= 导出 ================= */
export { 
	openScorePanel, 
	openScoreDetailPanel,
	openPlanPanel,
	openFeedbackPanel,
	openArchivePanel,
	openRecommendPanel,
	openConfigPanel,
	openMemoryPanel,
	openSkillPanel,
	openOverridePanel,
	openSkillBreakdownPanel,
	openSkillCustomPanel,
	openHealthPanel,
	installDebugBridge, 
	uninstallDebugBridge, 
	startDialogGuard, 
	stopDialogGuard 
};
