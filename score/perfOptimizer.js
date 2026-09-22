/* ================= 决策积分引擎 · 性能优化 =================
 * 目前有些计算可能重复了
 * 可以加更多缓存
 */
import { lib, game, get, _status } from '../../../noname.js';

/* ================= 全局缓存 ================= */
const _globalCache = new Map();
let _cacheRound = -1;

/* ================= 1. 回合同步 ================= */
function _roundKey() {
	try {
		if (_status && typeof _status.roundNumber === "number") return _status.roundNumber;
		if (typeof game === "object" && typeof game.roundNumber === "number") return game.roundNumber;
	} catch (e) {}
	return 0;
}

function _syncRound() {
	const r = _roundKey();
	if (r !== _cacheRound) {
		_cacheRound = r;
		_globalCache.clear();
	}
}

/* ================= 2. 通用缓存函数 ================= */
export function cached(key, computeFn) {
	try {
		_syncRound();
		if (_globalCache.has(key)) return _globalCache.get(key);

		const value = computeFn();
		_globalCache.set(key, value);
		return value;
	} catch (e) {
		return computeFn ? computeFn() : null;
	}
}

/* ================= 3. 清空所有缓存 ================= */
export function clearAllCache() {
	_globalCache.clear();
	_cacheRound = -1;
}

/* ================= 4. 缓存统计 ================= */
export function cacheStats() {
	try {
		return {
			cacheSize: _globalCache.size,
			cacheRound: _cacheRound,
		};
	} catch (e) {
		return { cacheSize: 0, cacheRound: 0 };
	}
}

/* ================= 5. 性能监控 ================= */
let _perfStart = 0;
let _perfEnd = 0;

export function perfStart() {
	_perfStart = Date.now();
}

export function perfEnd() {
	_perfEnd = Date.now();
	return _perfEnd - _perfStart;
}

export function perfReport() {
	try {
		const ms = perfEnd();
		return {
			ms: ms,
			ok: ms < 100,  /* 100ms 以内算正常 */
		};
	} catch (e) {
		return { ms: 0, ok: false };
	}
}
