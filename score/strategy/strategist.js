/* ================= 决策积分引擎 · 局内策略总线 =================
 * 职责：
 *   ① 收集：从各模块收集对同一决策的信号
 *   ② 仲裁：分层加权融合 + 冲突检测
 *   ③ 审计：记录完整决策链
 *   ④ 暴露：通过 _status / window.__DJSC / 面板
 *
 * 设计约束：
 *   - 只读：不修改任何 lib/game/player 状态
 *   - 可选：开关关闭时 0 开销
 *   - 有界：审计日志 ≤ 200 条，单次决策 ≤ 20 层信号
 *   - 无副作用：任何异常返回 null，不阻断
 *   - 性能：单次仲裁 < 8ms（含所有收集器）
 */
import { lib, game, get, _status } from '../../../noname.js';
import { cfg } from '../core/util.js';
import { log } from '../core/logger.js';

/* ================= 状态 ================= */
const STATE = {
	enabled: true,
	maxAudit: 200,
	maxSignals: 20,
	timeoutMs: 8,
	auditLog: [],
	lastDecision: null,
	stats: {
		arbitrations: 0,
		conflicts: 0,
		timeouts: 0,
		errors: 0,
		totalLatency: 0,
		maxLatency: 0,
	},
};

/* ================= 默认权重表 ================= */
const DEFAULT_WEIGHTS = {
	engine: 1.5,
	skillProfile: 1.0,
	cardOverride: 1.2,
	responseAI: 1.5,
	compareAI: 1.3,
	aiOverride: 1.2,
	custom: 1.0,
};

/* ================= 注册表 ================= */
const _collectors = new Map();
const _auditHandlers = new Set();

/**
 * 注册一个信号收集器
 * @param {string} source 模块名（用于权重查找）
 * @param {function(Player, Object, Object): Array|Object|null} collector
 * @param {Object} [opts] { weight, priority }
 * @returns {function} 卸载函数
 */
export function registerCollector(source, collector, opts) {
	try {
		if (typeof collector !== 'function') return function () {};
		_collectors.set(source, {
			fn: collector,
			weight: (opts && opts.weight) || DEFAULT_WEIGHTS[source] || 1.0,
			priority: (opts && opts.priority) || 5,
			ts: Date.now(),
		});
		return function () { _collectors.delete(source); };
	} catch (e) { return function () {}; }
}

/**
 * 注册审计回调（面板/日志）
 */
export function onAudit(cb) {
	try {
		if (typeof cb !== 'function') return function () {};
		_auditHandlers.add(cb);
		return function () { _auditHandlers.delete(cb); };
	} catch (e) { return function () {}; }
}

/* ================= 主入口 ================= */
export function strategize(player, event, ctx) {
	if (!STATE.enabled) return null;
	if (!player || !event) return null;
	try {
		const t0 = performance.now();
		const deadline = t0 + STATE.timeoutMs;

		/* ① 收集信号 */
		const signals = _collectSignals(player, event, ctx, deadline);
		if (!signals.length) return null;

		/* ② 仲裁 */
		const result = _arbitrate(signals, player, event, ctx);
		if (!result) return null;

		/* ③ 审计 */
		const latency = Math.round((performance.now() - t0) * 100) / 100;
		const record = {
			ts: Date.now(),
			round: (_status && _status.roundNumber) || 0,
			player: player.name || player.name1 || '?',
			event: event.name || '?',
			signals: signals,
			result: result,
			latency: latency,
			conflict: result.conflict,
		};
		_recordAudit(record);
		STATE.lastDecision = record;
		STATE.stats.arbitrations++;
		STATE.stats.totalLatency += latency;
		if (latency > STATE.stats.maxLatency) STATE.stats.maxLatency = latency;
		if (record.conflict) STATE.stats.conflicts++;

		/* ④ 通知订阅者 */
		_notifySubscribers(record);

		return result;
	} catch (e) {
		STATE.stats.errors++;
		try { log.warn('strategist', '仲裁异常: ' + String(e).slice(0, 60)); } catch (e2) {}
		return null;
	}
}

/* ================= 1. 收集 ================= */
function _collectSignals(player, event, ctx, deadline) {
	const signals = [];
	try {
		/* 按优先级排序（高优先级先执行，超时时保留关键信号） */
		const sorted = Array.from(_collectors.entries())
			.sort(function (a, b) { return (b[1].priority || 5) - (a[1].priority || 5); });

		for (const [source, entry] of sorted) {
			if (signals.length >= STATE.maxSignals) break;
			if (performance.now() > deadline) {
				STATE.stats.timeouts++;
				break;
			}
			try {
				const result = entry.fn(player, event, ctx);
				if (!result) continue;
				const arr = Array.isArray(result) ? result : [result];
				arr.forEach(function (s) {
					if (s && typeof s.score === 'number' && isFinite(s.score)) {
						signals.push({
							source: source,
							type: s.type || 'other',
							score: Math.max(-10, Math.min(10, s.score)),
							weight: s.weight !== undefined ? s.weight : entry.weight,
							reason: s.reason || '',
							meta: s.meta || null,
							cardId: s.cardId || null,
							skillId: s.skillId || null,
							target: s.target || null,
						});
					}
				});
			} catch (e) {
				STATE.stats.errors++;
			}
		}
	} catch (e) {}
	return signals;
}

/* ================= 2. 仲裁 ================= */
function _arbitrate(signals, player, event, ctx) {
	try {
		if (!signals.length) return null;

		/* 按 type 分组 */
		const byType = {};
		signals.forEach(function (s) {
			const t = s.type;
			if (!byType[t]) byType[t] = [];
			byType[t].push(s);
		});

		/* 冲突检测 */
		let conflict = false;
		const conflictTypes = [];
		for (const type in byType) {
			const arr = byType[type];
			const posW = arr.filter(function (s) { return s.score > 1; })
				.reduce(function (a, s) { return a + s.weight; }, 0);
			const negW = arr.filter(function (s) { return s.score < -1; })
				.reduce(function (a, s) { return a + s.weight; }, 0);
			if (posW >= 0.5 && negW >= 0.5) {
				conflict = true;
				conflictTypes.push(type);
			}
		}

		/* 加权平均 */
		let totalScore = 0;
		let totalWeight = 0;
		let topSignal = null;
		signals.forEach(function (s) {
			const w = s.weight;
			totalScore += s.score * w;
			totalWeight += Math.abs(w);
			if (!topSignal || Math.abs(s.score * w) > Math.abs(topSignal.score * topSignal.weight)) {
				topSignal = s;
			}
		});
		const avgScore = totalWeight > 0 ? totalScore / totalWeight : 0;

		/* 动作分级 */
		let action = 'pass';
		if (avgScore >= 3) action = 'strong-do';
		else if (avgScore >= 1) action = 'do';
		else if (avgScore <= -3) action = 'strong-avoid';
		else if (avgScore <= -1) action = 'avoid';

		return {
			action: action,
			score: Math.round(avgScore * 100) / 100,
			topSource: topSignal ? topSignal.source : null,
			topReason: topSignal ? topSignal.reason : '',
			conflict: conflict,
			conflictTypes: conflictTypes,
			signalCount: signals.length,
			byType: Object.keys(byType),
		};
	} catch (e) { return null; }
}

/* ================= 3. 审计 ================= */
function _recordAudit(record) {
	try {
		STATE.auditLog.push(record);
		while (STATE.auditLog.length > STATE.maxAudit) STATE.auditLog.shift();
	} catch (e) {}
}

function _notifySubscribers(record) {
	try {
		_auditHandlers.forEach(function (cb) {
			try { cb(record); } catch (e) {}
		});
	} catch (e) {}
}

/* ================= 4. 内置收集器：engine ================= */
registerCollector('engine', function (player, event, ctx) {
	try {
		const ba = (_status && _status.djsc_lastBest) || ctx;
		if (!ba || !ba.action) return null;
		const actionMap = { 'B': 0, 'C': -1, 'D': 3, 'F': 2, 'E': 1 };
		const score = actionMap[ba.action] || 0;
		if (Math.abs(score) < 0.1) return null;
		return {
			type: 'action',
			score: score,
			weight: 1.5,
			reason: '引擎: ' + (ba.reason || '').slice(0, 60),
			meta: { rule: ba.rule, target: ba.target, action: ba.action },
			target: ba.target || null,
		};
	} catch (e) { return null; }
}, { priority: 9 });

/* ================= 4.2 技能画像信号 ================= */
registerCollector('skillProfile', function (player, event, ctx) {
	try {
		const sid = (event && event.skill) || (ctx && ctx.skillId);
		if (!sid) return null;
		/* 动态导入避免顶层循环依赖 */
		let prof = null;
		try {
			const skillsMod = lib.__djsc_skillsModule;
			if (skillsMod && skillsMod.skillProfileOf) prof = skillsMod.skillProfileOf(sid);
		} catch (e) {}
		if (!prof) return null;
		const cls = prof.classify;
		if (!cls || !cls.primary) return null;

		const base = prof.profit.base || 0;
		const cost = prof.profit.cost || { net: 0 };
		const net = base - (cost.net || 0);
		if (Math.abs(net) < 0.5) return null;

		return {
			type: 'skill',
			score: net,
			weight: 1.0,
			reason: '技能 ' + sid + ' (' + cls.primary + ', 净' + net.toFixed(1) + ')',
			meta: {
				skillId: sid,
				primary: cls.primary,
				secondary: cls.secondary,
				base: base,
				cost: cost.net,
				source: prof.tags && prof.tags.__source,
			},
			skillId: sid,
		};
	} catch (e) { return null; }
}, { priority: 7 });

/* ================= 4.3 卡牌覆写信号 ================= */
registerCollector('cardOverride', function (player, event, ctx) {
	try {
		const card = event && event.card;
		if (!card) return null;
		const id = (get.name ? get.name(card, player) : card.name) || '';
		if (!id) return null;
		const cardMeta = lib.card && lib.card[id];
		if (!cardMeta || !cardMeta.__djsc_override) return null;
		const ov = cardMeta.__djsc_override;
		if (typeof ov.score !== 'number') return null;
		/* 超时保护：超过 1000ms 的旧信号作废 */
		if (ov.ts && (Date.now() - ov.ts) > 1000) return null;
		return {
			type: 'card',
			score: ov.score,
			weight: ov.weight || 1.2,
			reason: '卡牌覆写: ' + (ov.reason || id).slice(0, 60),
			meta: Object.assign({ cardId: id }, ov),
			cardId: id,
		};
	} catch (e) { return null; }
}, { priority: 6 });

/* ================= 4.4 响应 AI 信号 ================= */
registerCollector('responseAI', function (player, event, ctx) {
	try {
		if (!event || !event.name) return null;
		if (event.name !== 'chooseToRespond' && event.name !== 'chooseToDiscard') return null;
		const resp = _status && _status.djsc_lastResponse;
		if (!resp || typeof resp.score !== 'number') return null;
		/* 超时保护 */
		if (resp.ts && (Date.now() - resp.ts) > 1000) return null;
		return {
			type: 'response',
			score: resp.score,
			weight: 1.5,
			reason: '响应: ' + (resp.reason || '').slice(0, 60),
			meta: resp,
		};
	} catch (e) { return null; }
}, { priority: 8 });

/* ================= 4.5 拼点 AI 信号 ================= */
registerCollector('compareAI', function (player, event, ctx) {
	try {
		if (!event || event.name !== 'chooseToCompare') return null;
		const cmp = _status && _status.djsc_lastCompare;
		if (!cmp || typeof cmp.bonus !== 'number') return null;
		if (cmp.ts && (Date.now() - cmp.ts) > 1000) return null;
		return {
			type: 'compare',
			score: cmp.bonus,
			weight: 1.3,
			reason: '拼点: ' + (cmp.reason || '').slice(0, 60),
			meta: cmp,
		};
	} catch (e) { return null; }
}, { priority: 8 });

/* ================= 4.6 原生 AI 接管信号 ================= */
registerCollector('aiOverride', function (player, event, ctx) {
	try {
		const ba = (_status && _status.djsc_lastBest) || ctx;
		if (!ba || !ba.target) return null;
		const tgt = ba.target;
		if (!event || !event.targets || !event.targets.length) return null;
		const match = event.targets.some(function (t) {
			return t && ((t.name1 || t.name) === tgt);
		});
		if (!match) return null;
		return {
			type: 'target',
			score: 2.5,
			weight: 1.2,
			reason: '引擎目标匹配: ' + tgt,
			meta: { target: tgt },
			target: tgt,
		};
	} catch (e) { return null; }
}, { priority: 5 });

/* ================= 探针与开关 ================= */
export function getStats() {
	try {
		const count = STATE.stats.arbitrations || 1;
		return {
			enabled: STATE.enabled,
			arbitrations: STATE.stats.arbitrations,
			conflicts: STATE.stats.conflicts,
			timeouts: STATE.stats.timeouts,
			errors: STATE.stats.errors,
			avgLatency: Math.round((STATE.stats.totalLatency / count) * 100) / 100,
			maxLatency: STATE.stats.maxLatency,
			auditSize: STATE.auditLog.length,
			collectors: _collectors.size,
			subscribers: _auditHandlers.size,
		};
	} catch (e) { return {}; }
}

export function getAuditLog(n) {
	try {
		if (!n) return STATE.auditLog.slice();
		return STATE.auditLog.slice(-n);
	} catch (e) { return []; }
}

export function getLastDecision() {
	return STATE.lastDecision;
}

export function clearAudit() {
	try {
		STATE.auditLog = [];
		STATE.lastDecision = null;
	} catch (e) {}
}

export function setEnabled(v) {
	STATE.enabled = !!v;
}

export function isEnabled() {
	return STATE.enabled;
}

export function resetStats() {
	try {
		STATE.stats = {
			arbitrations: 0, conflicts: 0, timeouts: 0, errors: 0,
			totalLatency: 0, maxLatency: 0,
		};
	} catch (e) {}
}

/* ================= 安装/卸载 ================= */
export function installStrategist() {
	try {
		if (_status) _status.djsc_strategist = STATE;
		log.info('strategist', '策略总线已安装 (' + _collectors.size + ' 个收集器)');
	} catch (e) {}
}

export function uninstallStrategist() {
	try {
		_collectors.clear();
		_auditHandlers.clear();
		STATE.auditLog = [];
		STATE.lastDecision = null;
		STATE.enabled = false;
		if (_status) delete _status.djsc_strategist;
	} catch (e) {}
}

/* ================= 面板 HTML ================= */
export function buildStrategistHtml() {
	try {
		const stats = getStats();
		const recent = STATE.auditLog.slice(-10).reverse();
		const w = function (v) { return Math.round(v * 100) / 100; };

		let h = "<div style='font-size:12px;color:#dbe7f5;line-height:1.7;'>";
		/* 状态卡片 */
		h += "<div style='display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;'>";
		const card = function (label, val, color) {
			return "<div style='flex:1;min-width:76px;padding:8px;background:rgba(255,255,255,0.04);border-radius:6px;text-align:center;'>" +
				"<div style='font-size:11px;color:#9ad8ff;margin-bottom:3px;'>" + label + "</div>" +
				"<div style='font-size:16px;font-weight:600;color:" + (color || "#dbe7f5") + ";'>" + val + "</div>" +
				"</div>";
		};
		h += card("状态", stats.enabled ? "开" : "关", stats.enabled ? "#7fe3a0" : "#ff9c9c");
		h += card("仲裁次数", stats.arbitrations, "#9ad8ff");
		h += card("冲突", stats.conflicts, stats.conflicts > 0 ? "#ffd479" : "#a8b8c8");
		h += card("超时", stats.timeouts, stats.timeouts > 0 ? "#ff9c9c" : "#a8b8c8");
		h += card("平均耗时", stats.avgLatency + "ms",
			stats.avgLatency > 5 ? "#ff9c9c" : stats.avgLatency > 2 ? "#ffd479" : "#7fe3a0");
		h += card("收集器", stats.collectors, "#7fe3a0");
		h += "</div>";

		/* 开关按钮 */
		h += "<div style='margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap;'>";
		h += "<button class='djsc-btn' data-act='strategist-toggle' style='padding:3px 10px;border-radius:4px;border:1px solid #2a3a52;background:#14243c;color:" + (stats.enabled ? '#ff9c9c' : '#7fe3a0') + ";cursor:pointer;font-size:11px;'>" + (stats.enabled ? '关闭总线' : '开启总线') + "</button>";
		h += "<button class='djsc-btn' data-act='strategist-clear' style='padding:3px 10px;border-radius:4px;border:1px solid #2a3a52;background:#14243c;color:#a8b8c8;cursor:pointer;font-size:11px;'>清空审计</button>";
		h += "<button class='djsc-btn' data-act='strategist-reset' style='padding:3px 10px;border-radius:4px;border:1px solid #2a3a52;background:#14243c;color:#a8b8c8;cursor:pointer;font-size:11px;'>重置统计</button>";
		h += "</div>";

		/* 最近决策链 */
		if (!recent.length) {
			h += "<div style='color:#666;font-size:11px;margin-top:6px;'>尚无决策记录（进入对局后自动记录）</div>";
		} else {
			h += "<b style='color:#9ad8ff'>最近决策链 (" + recent.length + "/" + STATE.auditLog.length + ")</b><br>";
			recent.forEach(function (r) {
				const actionColors = {
					'strong-do': '#7fe3a0', 'do': '#9ad8ff',
					'avoid': '#ffd479', 'strong-avoid': '#ff9c9c', 'pass': '#888',
				};
				const col = actionColors[r.result.action] || '#888';

				h += "<div style='margin:6px 0;padding:6px 8px;border-left:3px solid " + col + ";background:rgba(255,255,255,0.02);border-radius:3px;'>";
				h += "<div style='color:" + col + ";font-size:11px;'>";
				h += "轮 " + r.round + " · " + r.player + " · " + r.event;
				h += " → <b>" + r.result.action + "</b>";
				h += "（" + r.result.score + "，耗时 " + r.latency + "ms）";
				if (r.conflict) h += " <span style='color:#ff9c9c'>⚠冲突</span>";
				h += "</div>";
				r.signals.forEach(function (s) {
					const sCol = s.score >= 1 ? '#7fe3a0' : s.score <= -1 ? '#ff9c9c' : '#a8b8c8';
					h += "<div style='font-size:10px;color:#a8b8c8;margin-left:8px;margin-top:2px;'>";
					h += "<span style='color:#666;display:inline-block;width:88px;'>[" + s.source + "]</span>";
					h += "<span style='color:" + sCol + ";display:inline-block;width:42px;'>" + (s.score > 0 ? '+' : '') + w(s.score) + "</span>";
					h += "<span style='color:#666;display:inline-block;width:40px;'>×" + w(s.weight) + "</span>";
					h += (s.reason || '').slice(0, 80);
					h += "</div>";
				});
				h += "</div>";
			});
		}
		h += "</div>";
		return h;
	} catch (e) { return "<div style='color:#ff9c9c'>策略总线面板异常: " + String(e).slice(0, 60) + "</div>"; }
}
