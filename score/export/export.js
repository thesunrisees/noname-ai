/* ================= 决策积分引擎 · 全量数据导出 =================
 * 用途：一键把引擎所有运行时数据导出为 JSON，便于存档/分析/反馈 bug。
 * 依赖：所有模块的公开查询接口（不涉及内部状态）。
 */
import { lib, game, get, _status } from '../../../noname.js';
import { getRound, getScoreLog, getREC, getDecisionLog, getMEM } from '../core/engine.js';
import { skillProfitBreakdown, skillTagsOf, skillProfileOf, _collectSource } from '../skill/skills.js';
import { getObs, explainObs, hostilityOf, friendlinessOf, styleOf } from '../strategy/observer.js';
import { identityOf, confidenceOf, beliefOf, explainIdentity, currentMode } from '../identity/identity.js';
import { getStats as getStrategistStats, getAuditLog as getStrategistAuditLog, getLastDecision as getStrategistLast } from '../strategy/strategist.js';
import { getFeedbackStats as getSkillFeedbackStats, feedbackCount } from '../feedback/feedback.js';
import { getDecisionFeedbackStats } from '../feedback/decisionFeedback.js';
import { getStyleFeedbackStats, getPlayerMemoryStats } from '../feedback/styleFeedback.js';
import { getArchive, archiveStats, fullArchiveStats } from './archive.js';
import { storeStats, exportStore } from '../strategy/memory.js';
import { perfStats, perfHistory } from '../misc/perf.js';
import { healthCheck } from '../selfcheck/health.js';
import { adaptiveStatus } from '../learning/adaptive.js';
import { selfCheck } from '../core/compat.js';
import { listProfiles, profileCount } from '../misc/profiles.js';
import { listCustomTemplates } from '../misc/templates.js';
import { planSequence } from '../strategy/planner.js';
import { cfg } from '../core/util.js';

/* ---------- 工具 ---------- */
function _safe(fn, fallback) {
	try { return fn(); } catch (e) { return fallback !== undefined ? fallback : null; }
}

function _deepClone(obj) {
	try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return null; }
}

function _roundNum() {
	try {
		if (_status && typeof _status.roundNumber === 'number') return _status.roundNumber;
		if (typeof game === 'object' && typeof game.roundNumber === 'number') return game.roundNumber;
		if (typeof game === 'object' && typeof game.round === 'number') return game.round;
	} catch (e) {}
	return 0;
}

function _modeName() {
	try {
		if (get && typeof get.mode === 'function') return get.mode();
		if (_status && _status.mode) return _status.mode;
	} catch (e) {}
	return 'unknown';
}

/* ---------- 导出：环境信息 ---------- */
function _exportEnv() {
	return {
		exportTime: new Date().toISOString(),
		version: lib.version || 'unknown',
		mode: _modeName(),
		round: _roundNum(),
		connectMode: !!(_status && _status.connectMode),
		screen: { width: window.innerWidth, height: window.innerHeight },
		touchscreen: !!lib.config.touchscreen,
	};
}

/* ---------- 导出：当前对局 ---------- */
function _exportGame() {
	try {
		const players = (game.players || []).map(function (p) {
			return {
				name: p.name || p.name1 || '?',
				name1: p.name1 || '',
				name2: p.name2 || '',
				identity: p.identity || '',
				hp: p.hp,
				maxHp: p.maxHp,
				alive: p.alive !== false,
				turnedOver: p.isTurnedOver ? p.isTurnedOver() : false,
				linked: p.isLinked ? p.isLinked() : false,
				skills: (p.skills || []).slice(),
				handCount: p.countCards ? p.countCards('h') : 0,
				equipCount: p.countCards ? p.countCards('e') : 0,
				judgeCount: p.countCards ? p.countCards('j') : 0,
			};
		});
		return {
			currentPlayer: (_status && _status.currentPhase) ? (_status.currentPhase.name || '?') : null,
			me: game.me ? (game.me.name || game.me.name1) : null,
			meIdentity: game.me ? game.me.identity : null,
			zhu: game.zhu ? (game.zhu.name || game.zhu.name1) : null,
			playerCount: players.length,
			players: players,
		};
	} catch (e) { return { err: String(e) }; }
}

/* ---------- 导出：技能拆解 ---------- */
function _exportSkillBreakdown() {
	try {
		const out = [];
		const players = game.players || [];
		players.forEach(function (p) {
			(p.skills || []).forEach(function (sid) {
				try {
					const br = skillProfitBreakdown(sid);
					const tags = skillTagsOf(sid);
					const sk = lib.skill && lib.skill[sid];
					const source = sk ? _collectSource(sk, sid) : '';
					out.push({
						player: p.name || p.name1 || '?',
						skillId: sid,
						name: (lib.translate && lib.translate[sid]) || sid,
						breakdown: br,
						tags: tags,
						/* ★ 新增：完整扫描源码（递归扫描的结果） */
						source: source,
						sourceLength: source.length,
					});
				} catch (e) {}
			});
		});
		return out;
	} catch (e) { return []; }
}

/* ---------- 导出：技能代码矩阵（我的武将） ---------- */
function _exportMySkillMatrix() {
	try {
		const me = game.me;
		if (!me) return null;
		const out = {};
		(me.skills || []).forEach(function (sid) {
			try {
				const prof = skillProfileOf(sid);
				if (prof) out[sid] = prof;
			} catch (e) {}
		});
		return out;
	} catch (e) { return null; }
}

/* ---------- 导出：策略总线 ---------- */
function _exportStrategist() {
	return {
		stats: _safe(getStrategistStats, {}),
		last: _safe(getStrategistLast, null),
		log: _safe(function () { return getStrategistAuditLog(50); }, []),
	};
}

/* ---------- 导出：接管层状态 ---------- */
function _exportOverride() {
	try {
		const mod = lib.__djsc_overrideModule;
		if (!mod || typeof mod.overrideStatus !== 'function') return null;
		return mod.overrideStatus();
	} catch (e) { return null; }
}

/* ---------- 导出：反馈数据 ---------- */
function _exportFeedback() {
	return {
		skill: _safe(getSkillFeedbackStats, []),
		skillCount: _safe(feedbackCount, 0),
		decision: _safe(getDecisionFeedbackStats, []),
		style: _safe(getStyleFeedbackStats, []),
		playerMemory: _safe(getPlayerMemoryStats, []),
	};
}

/* ---------- 导出：归档统计 ---------- */
function _exportArchive() {
	return {
		count: _safe(function () { return getArchive().length; }, 0),
		basic: _safe(archiveStats, {}),
		full: _safe(fullArchiveStats, {}),
		recent: _safe(function () {
			return getArchive().slice(-10).map(function (g) {
				return {
					ts: g.ts, mode: g.mode, identity: g.myIdentity,
					score: g.myScore, verdict: g.verdict,
					rounds: g.roundCount, decisions: g.decisionSteps,
					quality: g.quality, topCards: g.topCards,
				};
			});
		}, []),
	};
}

/* ---------- 导出：行为观察 ---------- */
function _exportObserver() {
	try {
		const obs = getObs();
		const out = {};
		for (const k in obs) {
			const e = obs[k];
			out[k] = {
				hostile: Math.round(e.hostile * 100) / 100,
				friendly: Math.round(e.friendly * 100) / 100,
				attacks: e.attacks,
				aids: e.aids,
				attackedBy: e.attackedBy,
				aidedBy: e.aidedBy,
			};
		}
		return out;
	} catch (e) { return {}; }
}

/* ---------- 导出：身份推理 ---------- */
function _exportIdentity() {
	try {
		if (currentMode() !== 'identity') return { mode: currentMode(), enabled: false };
		const out = { mode: 'identity', enabled: true, players: {} };
		(game.players || []).forEach(function (p) {
			const key = p.name || p.name1 || '?';
			out.players[key] = {
				realIdentity: p.identity,
				inferred: identityOf(p),
				confidence: confidenceOf(p),
				belief: beliefOf(p),
				hostility: hostilityOf(p),
				friendliness: friendlinessOf(p),
				style: styleOf(p),
			};
		});
		return out;
	} catch (e) { return { err: String(e) }; }
}

/* ---------- 导出：决策日志 ---------- */
function _exportDecisionLog() {
	try {
		return getDecisionLog().map(function (e) {
			const L = e.layers || {};
			return {
				ts: e.ts,
				round: e.round,
				player: e.player,
				layers: L,
				winner: e.winner,
				candidates: (e.candidates || []).slice(0, 8),
			};
		});
	} catch (e) { return []; }
}

/* ---------- 导出：性能监控 ---------- */
function _exportPerf() {
	return {
		stats: _safe(perfStats, {}),
		history: _safe(perfHistory, []),
	};
}

/* ---------- 导出：配置快照 ---------- */
function _exportConfig() {
	try {
		const keys = [
			'decisionScore', 'mode', 'atkBias', 'defBias',
			'wAtkCard', 'wDefCard', 'wOpportunityMul', 'wFocusMul',
			'wSeatPressure', 'wForecastMul', 'wComboBonus', 'wRiskCard',
			'decisionFeedback', 'responseAI', 'broadcastAI', 'compareAI',
			'adaptiveDifficulty', 'enablePlanner', 'plannerDepth',
			'hardOverride', 'override_use', 'override_respond',
			'override_discard', 'override_compare',
			'dmgRate', 'drawRate', 'discardRate',
			'personalityAggression', 'personalityRisk', 'personalityTeam',
			'riskProfile', 'autoIdentityMatch',
			'crossGameMemory', 'skillFeedback', 'styleFeedback',
			'showReport', 'archiveGames', 'showLog', 'persist',
			'lang',
		];
		const out = {};
		keys.forEach(function (k) {
			const v = lib.config['extension_无名AI_' + k];
			if (v !== undefined) out[k] = v;
		});
		return out;
	} catch (e) { return {}; }
}

/* ---------- 导出：档案与模板 ---------- */
function _exportProfiles() {
	return {
		profiles: _safe(listProfiles, { list: [] }),
		profileCount: _safe(profileCount, 0),
		customTemplates: _safe(listCustomTemplates, []),
	};
}

/* ---------- 导出：自适应难度 ---------- */
function _exportAdaptive() {
	return _safe(adaptiveStatus, {});
}

/* ---------- 导出：健康检查 ---------- */
function _exportHealth() {
	return _safe(healthCheck, {});
}

/* ---------- 导出：兼容性自检 ---------- */
function _exportCompat() {
	return _safe(selfCheck, {});
}

/* ---------- 导出：空技能详解 ---------- */
function _exportEmptySkills() {
	try {
		const out = [];
		const seen = {};
		(game.players || []).forEach(function (p) {
			(p.skills || []).forEach(function (sid) {
				if (seen[sid]) return;
				seen[sid] = true;
				try {
					const br = skillProfitBreakdown(sid);
					const tags = skillTagsOf(sid);
					/* 只收"无正收益 + 无负收益 + 无 AI 辅助"的"
					 * 即完全空白的技能，帮助诊断漏识别 */
					if (br.posSum === 0 && br.negSum === 0 && !br.isPureAI && !br.isRuleOnly) {
						const sk = lib.skill[sid];
						out.push({
							skillId: sid,
							name: (lib.translate && lib.translate[sid]) || sid,
							description: (lib.translate && lib.translate[sid + '_info']) || '',
							code: sk ? _safe(function () {
								/* 把技能的键和值的类型列出，便于定位 */
								const summary = {};
								for (const k in sk) {
									const v = sk[k];
									if (typeof v === 'function') summary[k] = 'function';
									else if (Array.isArray(v)) summary[k] = v;
									else if (typeof v === 'object' && v) summary[k] = Object.keys(v);
									else summary[k] = v;
								}
								return summary;
							}, null) : null,
							tags: tags,
							breakdown: br,
						});
					}
				} catch (e) {}
			});
		});
		return out;
	} catch (e) { return []; }
}

/* ---------- 主入口：全量导出 ---------- */
export function exportAll() {
	try {
		return {
			exportTime: new Date().toISOString(),
			version: lib.version || 'unknown',
			environment: _exportEnv(),
			config: _exportConfig(),
			game: _exportGame(),
			round: _deepClone(getRound()) || {},
			scoreLog: _deepClone(getScoreLog().slice(-100)) || [],
			rec: _deepClone(getREC()) || {},
			decisionLog: _exportDecisionLog(),
			skillBreakdown: _exportSkillBreakdown(),
			mySkillMatrix: _exportMySkillMatrix(),
			strategist: _exportStrategist(),
			override: _exportOverride(),
			feedback: _exportFeedback(),
			archive: _exportArchive(),
			observer: _exportObserver(),
			identity: _exportIdentity(),
			memory: _safe(storeStats, {}),
			memoryFull: _safe(exportStore, { v: 1, players: {} }),
			perf: _exportPerf(),
			health: _exportHealth(),
			compat: _exportCompat(),
			adaptive: _exportAdaptive(),
			profiles: _exportProfiles(),
			emptySkillsDetail: _exportEmptySkills(),
		};
	} catch (e) {
		return { err: String(e), exportTime: new Date().toISOString() };
	}
}

/* ---------- 导出为 JSON 字符串 ---------- */
export function exportAllJson(pretty) {
	try {
		const data = exportAll();
		return JSON.stringify(data, null, pretty !== false ? 2 : 0);
	} catch (e) { return '{"err":"' + String(e).replace(/"/g, '\\"') + '"}'; }
}

/* ---------- 导出指定模块 ---------- */
export const exporters = {
	env: _exportEnv,
	config: _exportConfig,
	game: _exportGame,
	round: function () { return _deepClone(getRound()) || {}; },
	scoreLog: function () { return _deepClone(getScoreLog().slice(-100)) || []; },
	rec: function () { return _deepClone(getREC()) || {}; },
	decisionLog: _exportDecisionLog,
	skillBreakdown: _exportSkillBreakdown,
	mySkillMatrix: _exportMySkillMatrix,
	strategist: _exportStrategist,
	override: _exportOverride,
	feedback: _exportFeedback,
	archive: _exportArchive,
	observer: _exportObserver,
	identity: _exportIdentity,
	perf: _exportPerf,
	health: _exportHealth,
	compat: _exportCompat,
	adaptive: _exportAdaptive,
	profiles: _exportProfiles,
	emptySkills: _exportEmptySkills,
	/* ★ 新增：完整记忆库（所有武将风格的详细数据） */
	memoryFull: function () { return _safe(exportStore, { v: 1, players: {} }); },
};

/* ============================================================
 * ★ 文件下载（兼容桌面端 / 移动端）
 * ============================================================ */

/**
 * 触发浏览器下载文件
 * @param {string} filename  文件名（含扩展名）
 * @param {string} content   文件内容（字符串）
 * @param {string} mime      MIME 类型，默认 application/json
 * @returns {boolean}        是否成功触发
 */
export function downloadFile(filename, content, mime) {
	try {
		if (typeof content !== 'string') content = String(content);
		mime = mime || 'application/json;charset=utf-8';

		/* 优先：本体自带的下载工具（若存在） */
		try {
			if (game && typeof game.download === 'function') {
				game.download(filename, content);
				return true;
			}
		} catch (e) {}

		/* 主方案：Blob + a.download */
		try {
			const blob = new Blob([content], { type: mime });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			a.style.display = 'none';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			/* 延迟释放，避免某些浏览器下载未开始就失效 */
			setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 3000);
			return true;
		} catch (e) {}

		/* 兜底：data URI */
		try {
			const dataUri = 'data:' + mime + ',' + encodeURIComponent(content);
			const a2 = document.createElement('a');
			a2.href = dataUri;
			a2.download = filename;
			a2.style.display = 'none';
			document.body.appendChild(a2);
			a2.click();
			document.body.removeChild(a2);
			return true;
		} catch (e) {}

		return false;
	} catch (e) {
		return false;
	}
}

/**
 * 生成时间戳后缀（用于文件名）
 * @returns {string} 形如 20260919_143025
 */
export function _tsSuffix() {
	try {
		const d = new Date();
		const pad = function (n) { return n < 10 ? '0' + n : '' + n; };
		return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate())
			+ '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
	} catch (e) { return String(Date.now()); }
}

/**
 * 直接下载全量数据为 JSON 文件
 * @param {boolean} [pretty] 是否美化（默认 true）
 * @returns {boolean} 是否成功触发下载
 */
export function exportAllFile(pretty) {
	try {
		const json = exportAllJson(pretty !== false);
		const filename = '无名AI_全量导出_' + _tsSuffix() + '.json';
		return downloadFile(filename, json, 'application/json;charset=utf-8');
	} catch (e) {
		return false;
	}
}

/**
 * 下载指定模块为 JSON 文件
 * @param {string} key       模块 key（exporters 的键）
 * @param {string} [label]   中文标签（用于文件名）
 * @returns {boolean} 是否成功触发下载
 */
export function exportModuleFile(key, label) {
	try {
		const fn = exporters[key];
		if (typeof fn !== 'function') return false;
		const data = fn();
		const json = JSON.stringify(data, null, 2);
		const safeLabel = (label || key).replace(/[\\/:*?"<>|]/g, '_');
		const filename = '无名AI_' + safeLabel + '_' + _tsSuffix() + '.json';
		return downloadFile(filename, json, 'application/json;charset=utf-8');
	} catch (e) {
		return false;
	}
}

/**
 * 批量下载（多个模块各自生成文件）
 * @param {Array<{key:string, label:string}>} modules
 * @returns {number} 成功触发下载的数量
 */
export function exportBatchFiles(modules) {
	try {
		if (!Array.isArray(modules) || !modules.length) return 0;
		let ok = 0;
		/* 依次触发下载，间隔 400ms 避免浏览器限流 */
		modules.forEach(function (m, i) {
			setTimeout(function () {
				try {
					if (exportModuleFile(m.key, m.label)) ok++;
				} catch (e) {}
			}, i * 400);
		});
		return modules.length;
	} catch (e) {
		return 0;
	}
}

/**
 * 下载任意文本文件（用于导出 Markdown / CSV 等）
 * @param {string} filename
 * @param {string} content
 * @param {string} mime
 */
export function downloadTextFile(filename, content, mime) {
	return downloadFile(filename, content, mime || 'text/plain;charset=utf-8');
}
