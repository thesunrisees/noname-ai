/* ================= 决策积分引擎 · 一键推荐配置 ================= */
import { lib, game } from '../../../../../noname.js';

const RECOMMEND_PRESETS = {
	stable: {
		name: '稳定型（推荐新手）',
		desc: '保守进攻，留牌优先，AI 失误率最低',
		config: {
			riskProfile: 'cautious',
			personalityAggression: 40,
			personalityRisk: 30,
			personalityTeam: 70,
			atkBias: 0.9,
			defBias: 1.2,
			wAtkCard: 0.9,
			wDefCard: 1.2,
			wRiskCard: 0.7,
			responseAI: true,
			hardOverride: false,
			decisionFeedback: true,
		},
	},
	balanced: {
		name: '均衡型（默认）',
		desc: '攻守平衡，各维度都启用',
		config: {
			riskProfile: 'balanced',
			personalityAggression: 50,
			personalityRisk: 50,
			personalityTeam: 50,
			atkBias: 1,
			defBias: 1,
			wAtkCard: 1,
			wDefCard: 1,
			wRiskCard: 1,
			responseAI: true,
			hardOverride: false,
			decisionFeedback: true,
		},
	},
	aggressive: {
		name: '进攻型（AI 更凶）',
		desc: '进攻倾向拉满，AI 主动压血、集火残血',
		config: {
			riskProfile: 'aggressive',
			personalityAggression: 80,
			personalityRisk: 70,
			personalityTeam: 40,
			atkBias: 1.3,
			defBias: 0.8,
			wAtkCard: 1.2,
			wDefCard: 0.8,
			wRiskCard: 1.3,
			responseAI: true,
			hardOverride: true,
			decisionFeedback: true,
		},
	},
	fullOverride: {
		name: '完全接管（实验）',
		desc: '开启 hardOverride，AI 按引擎结论出牌',
		config: {
			riskProfile: 'balanced',
			personalityAggression: 50,
			personalityRisk: 50,
			personalityTeam: 50,
			atkBias: 1,
			defBias: 1,
			wAtkCard: 1,
			wDefCard: 1,
			wRiskCard: 1,
			responseAI: true,
			hardOverride: true,
			decisionFeedback: true,
		},
	},
};

export function listRecommends() {
	return Object.keys(RECOMMEND_PRESETS).map(function (k) {
		const p = RECOMMEND_PRESETS[k];
		return { key: k, name: p.name, desc: p.desc, keys: Object.keys(p.config) };
	});
}

export function applyRecommend(key) {
	try {
		const p = RECOMMEND_PRESETS[key];
		if (!p) return { ok: false, err: '未找到预设：' + key };
		let applied = 0;
		for (const k in p.config) {
			try {
				lib.config['extension_无名AI_' + k] = p.config[k];
				game.saveConfig('extension_无名AI_' + k, p.config[k]);
				applied++;
			} catch (e) {}
		}
		return { ok: true, applied: applied, name: p.name };
	} catch (e) { return { ok: false, err: String(e) }; }
}

export function snapshotCurrent() {
	try {
		const snap = {};
		const keys = [
			'riskProfile', 'personalityAggression', 'personalityRisk', 'personalityTeam',
			'atkBias', 'defBias', 'wAtkCard', 'wDefCard', 'wRiskCard', 'wOpportunityMul',
			'wFocusMul', 'wSeatPressure', 'wForecastMul', 'wComboBonus',
			'responseAI', 'hardOverride', 'decisionFeedback', 'skillFeedback', 'styleFeedback',
		];
		keys.forEach(function (k) {
			const v = lib.config['extension_无名AI_' + k];
			if (v !== undefined) snap[k] = v;
		});
		return snap;
	} catch (e) { return {}; }
}
