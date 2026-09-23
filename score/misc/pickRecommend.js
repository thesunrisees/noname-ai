/* ================= 决策积分引擎 · 选将推荐（融合历史评分） ================= */
import { lib, game, get, ui } from '../../../noname.js';
import { codeGainAllOf } from '../skill/skills.js';
import { profileOf } from './profile.js';

const IDENTITY_PREFER = {
	zhu:       { role: ['def', 'aux', 'ctrl'], priority: 'survive', desc: '主公优先站场/辅助型' },
	zhong:     { role: ['aux', 'def', 'atk'], priority: 'support', desc: '忠臣优先辅助主公' },
	mingzhong: { role: ['aux', 'def', 'atk'], priority: 'support', desc: '明忠优先辅助' },
	fan:       { role: ['atk', 'hybrid', 'ctrl'], priority: 'kill', desc: '反贼优先爆发输出' },
	nei:       { role: ['hybrid', 'ctrl', 'def'], priority: 'balance', desc: '内奸优先均衡控场' },
};

/* ★ 从 charStore 读历史评分（按当前模式隔离，charStore 内部会自动取 mode） */
function _getHistoryRecord(charId) {
	try {
		if (typeof window === 'undefined' || !window.__DJSC || !window.__DJSC.charStore) return null;
		return window.__DJSC.charStore().get(charId);
	} catch (e) { return null; }
}

/* ★ 历史权重：样本越多，历史越可信 */
function _historyWeight(samples) {
	if (!samples || samples <= 0) return 0;
	if (samples < 3) return 0.15;
	if (samples < 6) return 0.3;
	if (samples < 10) return 0.45;
	return 0.6;
}

/* 基础评分：技能组合评估（保留原逻辑） */
function _baseScore(charId, identity) {
	try {
		const pref = IDENTITY_PREFER[identity] || IDENTITY_PREFER.zhu;
		const prof = profileOf(charId);
		if (!prof) return 0;
		let s = 0;
		const idx = pref.role.indexOf(prof.role);
		if (idx === 0) s += 3;
		else if (idx === 1) s += 2;
		else if (idx === 2) s += 1;
		s += (prof.priority || 0.5) * 2;
		if (identity === 'zhu') {
			s += (1 - (prof.fragile || 0.5)) * 3;
		}
		if (identity === 'fan') {
			s += (prof.aggression || 0.5) * 3;
		}
		try {
			const ch = lib.character[charId];
			if (ch) {
				const skills = Array.isArray(ch) ? (ch[3] || []) : (ch.skills || []);
				const g = codeGainAllOf({ skills: skills });
				s += Math.min(3, (g.net || 0) * 0.5);
			}
		} catch (e) {}
		return s;
	} catch (e) { return 0; }
}

/* ★ 融合评分：基础 + 历史 */
function _scoreChar(charId, identity) {
	const base = _baseScore(charId, identity);
	const hist = _getHistoryRecord(charId);

	if (!hist || !hist.games || hist.games <= 0) {
		return { score: Math.round(base * 100) / 100, base: Math.round(base * 100) / 100, hist: 0, samples: 0, winRate: 0 };
	}

	/* 历史分标准化：
	 *   charStore 的 avgScore 是每局积分（约 ±15）
	 *   归一化到 0~5，和基础分（约 0~8）同量级 */
	const rawScore = (typeof hist.avgScore === 'number') ? hist.avgScore : 0;
	const histScore = Math.max(0, Math.min(5, (rawScore + 5) / 4));

	/* 胜率加分 */
	const games = hist.games || 0;
	const wins = hist.wins || 0;
	const wr = games > 0 ? wins / games : 0;
	let wrBonus = 0;
	if (wr >= 0.6) wrBonus = 1.2;
	else if (wr > 0.5) wrBonus = 0.6;
	else if (wr < 0.3) wrBonus = -0.5;

	const w = _historyWeight(games);
	const combined = base * (1 - w) + (histScore + wrBonus) * w;

	return {
		score: Math.round(combined * 100) / 100,
		base: Math.round(base * 100) / 100,
		hist: Math.round(histScore * 100) / 100,
		samples: games,
		winRate: Math.round(wr * 100) / 100,
	};
}

export function recommendChars(identity, charList, topN) {
	try {
		if (!Array.isArray(charList) || !charList.length) return [];

		const scored = charList.map(function (id) {
			return { id: id, r: _scoreChar(id, identity) };
		});

		scored.sort(function (a, b) { return b.r.score - a.r.score; });

		return scored.slice(0, topN || 3).map(function (x, i) {
			return {
				id: x.id,
				score: x.r.score,
				base: x.r.base,
				hist: x.r.hist,
				samples: x.r.samples,
				winRate: x.r.winRate,
				rank: i + 1,
				name: get.translation(x.id) || x.id,
				prof: profileOf(x.id),
			};
		});
	} catch (e) { return []; }
}

export function buildPickHtml(charList) {
	try {
		const me = game.me;
		if (!me || !me.identity) return '';
		const recs = recommendChars(me.identity, charList, 3);
		if (!recs.length) return '';
		let h = "<div style='padding:6px;background:rgba(127,227,160,0.08);border-radius:6px;font-size:12px;'>";
		h += "<b style='color:#7fe3a0'>🎯 引擎推荐（身份 " + me.identity + "，融合历史评分）：</b><br>";
		recs.forEach(function (r) {
			h += "<div style='margin:3px 0;'>";
			h += "<span style='color:#ffd479'>" + r.rank + ".</span> ";
			h += "<span style='color:#dbe7f5;font-weight:500;'>" + r.name + "</span>";
			h += " <span style='color:#9ad8ff;font-size:11px;'>（总分 " + r.score + " = 基础 " + r.base + " + 历史 " + r.hist;
			if (r.samples > 0) {
				h += "，胜率 " + Math.round(r.winRate * 100) + "%（" + r.samples + "局）";
			}
			h += "）</span>";
			h += "</div>";
		});
		h += "</div>";
		return h;
	} catch (e) { return ''; }
}

let _hooked = false;
export function installPickRecommend() {
	if (_hooked) return;
	try {
		_hooked = true;
	} catch (e) {}
}
