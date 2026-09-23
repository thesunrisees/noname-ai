/* ================= 决策积分引擎 · 身份推理可视化 =================
 * 面板上显示 AI 对每个玩家的身份推理结果
 * 现在有身份推理，但没有可视化
 */
import { lib, game, get, _status } from '../../../../../noname.js';

/* ================= 身份推理缓存 ================= */
const _idCache = new Map();
let _cacheRound = -1;

function _roundKey() {
	try {
		if (_status && typeof _status.roundNumber === "number") return _status.roundNumber;
		if (typeof game === "object" && typeof game.roundNumber === "number") return game.roundNumber;
	} catch (e) {}
	return 0;
}

function _syncCache() {
	const r = _roundKey();
	if (r !== _cacheRound) {
		_idCache.clear();
	}
}

/* ================= 1. 身份推理 =================
 * 根据玩家行为，推理他的身份
 */
export function inferIdentity(player) {
	try {
		_syncCache();
		const key = 'id_' + (player.name1 || player.name || '?');
		if (_idCache.has(key)) return _idCache.get(key);

		/* 基础：从 get.attitude 拿 */
		let attitude = 0;
		try {
			attitude = get.attitude(game.me, player);
		} catch (e) {}

		let identity = 'unknown';
		let confidence = 0.5;

		/* === 身份局 === */
		if (attitude > 0.5) {
			identity = 'ally';
			confidence = 0.8;
		} else if (attitude < -0.5) {
			identity = 'enemy';
			confidence = 0.8;
		} else {
			identity = 'unknown';
			confidence = 0.3;
		}

		/* === 从行为进一步推理 === */
		const actions = player._djsc_actions || [];
		if (actions.length > 0) {
			let attackCount = 0;
			let supportCount = 0;

			actions.forEach(function (a) {
				if (['sha', 'juedou', 'huogong', 'nanman', 'wanjian'].indexOf(a.id) >= 0) attackCount++;
				if (['tao', 'wuxie', 'wuzhong'].indexOf(a.id) >= 0) supportCount++;
			});

			const total = actions.length;
			const attackRatio = attackCount / total;
			const supportRatio = supportCount / total;

			/* 攻击多 → 可能是反贼/忠臣 */
			if (attackRatio > 0.5) {
				if (identity === 'enemy') {
					identity = 'fan';  /* 反贼 */
					confidence = 0.7;
				} else if (identity === 'ally') {
					identity = 'zhong';  /* 忠臣 */
					confidence = 0.7;
				}
			}

			/* 辅助多 → 可能是内奸/忠臣 */
			if (supportRatio > 0.4) {
				if (identity === 'unknown') {
					identity = 'nei';  /* 内奸 */
					confidence = 0.6;
				}
			}
		}

		const result = {
			identity: identity,
			confidence: Math.round(confidence * 100) / 100,
			attitude: attitude,
		};

		_idCache.set(key, result);
		return result;
	} catch (e) {
		return { identity: 'unknown', confidence: 0.5, attitude: 0 };
	}
}

/* ================= 2. 身份描述 ================= */
export function describeIdentity(identity) {
	try {
		const map = {
			'zhu': { label: '主公', color: 'gold' },
			'zhong': { label: '忠臣', color: 'blue' },
			'fan': { label: '反贼', color: 'red' },
			'nei': { label: '内奸', color: 'purple' },
			'ally': { label: '队友', color: 'green' },
			'enemy': { label: '敌人', color: 'red' },
			'unknown': { label: '未知', color: 'gray' },
		};
		return map[identity] || map.unknown;
	} catch (e) {
		return { label: '未知', color: 'gray' };
	}
}

/* ================= 3. 全员身份概览 ================= */
export function getAllIdentities(me) {
	try {
		const players = game.players || [];
		const result = [];

		players.forEach(function (p) {
			if (!p || p.alive === false) return;

			const id = inferIdentity(p);
			const desc = describeIdentity(id.identity);

			result.push({
				name: p.name || p.name1 || '?',
				identity: id.identity,
				identityLabel: desc.label,
				color: desc.color,
				confidence: id.confidence,
				attitude: id.attitude,
			});
		});

		return result;
	} catch (e) {
		return [];
	}
}

/* ================= 4. 身份推理面板数据 ================= */
export function identityPanelData(me) {
	try {
		const all = getAllIdentities(me);

		return {
			players: all,
			myIdentity: me.identity || 'unknown',
			myIdentityLabel: describeIdentity(me.identity || 'unknown').label,
		};
	} catch (e) {
		return { players: [], myIdentity: 'unknown', myIdentityLabel: '未知' };
	}
}
