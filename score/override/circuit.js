/*
 * ============================================
 * // Author: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 熔断器（按层分桶） =================
 * 设计目标：
 *   ① 每层独立熔断，互不影响
 *   ② severity: 'fatal' 立即熔断 | 'warn' 累计 3 次熔断
 *   ③ 冷却 30 秒后自动恢复
 *   ④ global 层兜底：任意层熔断同步触发全局
// Автор: Фэйшэн Оригинал | Лицензия: GPL-3.0
 */
import { lib, game } from '../../../../noname.js';
import { log } from '../logger.js';

const TRIP_THRESHOLD = 3;
const TRIP_WINDOW = 10000;
const COOLDOWN = 30000;
const MAX_TRIP_HISTORY = 20;

const LAYERS = ['use', 'respond', 'discard', 'compare', 'global'];

const BUCKETS = {};
LAYERS.forEach(function (k) {
	BUCKETS[k] = { trips: [], trippedAt: 0, totalTrips: 0 };
});

function _bucket(layer) {
	return BUCKETS[layer] || BUCKETS.global;
}

function _isBucketTripped(layer) {
	try {
		const b = _bucket(layer);
		if (!b.trippedAt) return false;
		if (Date.now() - b.trippedAt > COOLDOWN) {
			b.trippedAt = 0;
			b.trips = [];
			return false;
		}
		return true;
	} catch (e) { return false; }
}

export function trip(layer, reason, severity) {
	try {
		if (!layer) layer = 'global';
		if (!severity) severity = 'warn';
		const now = Date.now();
		const b = _bucket(layer);

		b.trips.push({ reason: reason, severity: severity, ts: now });
		while (b.trips.length > MAX_TRIP_HISTORY) b.trips.shift();

		const recent = b.trips.filter(function (t) { return now - t.ts < TRIP_WINDOW; });
		const fatalCount = recent.filter(function (t) { return t.severity === 'fatal'; }).length;
		const shouldTrip = fatalCount >= 1 || recent.length >= TRIP_THRESHOLD;

		if (shouldTrip && !_isBucketTripped(layer)) {
			b.trippedAt = now;
			b.totalTrips++;
			try { log.warn('circuit', '[' + layer + '] 熔断：' + reason + '（近 ' + recent.length + ' 次）'); } catch (e) {}
			try {
				if (game && typeof game.log === 'function') {
					game.log('【决策积分】⚠ 层 ' + layer + ' 已熔断，' + (COOLDOWN / 1000) + ' 秒后恢复');
				}
			} catch (e) {}
			if (layer !== 'global') {
				try { trip('global', '层 ' + layer + ' 熔断', 'warn'); } catch (e) {}
			}
		}
	} catch (e) {}
}

export function isTripped(layer) {
	try {
		if (_isBucketTripped('global')) return true;
		if (!layer) return false;
		return _isBucketTripped(layer);
	} catch (e) { return false; }
}

export function resetCircuit(layer) {
	try {
		if (layer) {
			const b = _bucket(layer);
			b.trips = [];
			b.trippedAt = 0;
			log.info('circuit', '层 ' + layer + ' 熔断已复位');
		} else {
			LAYERS.forEach(function (k) {
				BUCKETS[k].trips = [];
				BUCKETS[k].trippedAt = 0;
			});
			log.info('circuit', '所有熔断器已复位');
		}
	} catch (e) {}
}

export function circuitStatus() {
	try {
		const out = {};
		LAYERS.forEach(function (k) {
			const b = BUCKETS[k];
			out[k] = {
				tripped: _isBucketTripped(k),
				totalTrips: b.totalTrips,
				recentCount: b.trips.length,
				cooldownRemain: b.trippedAt ? Math.max(0, COOLDOWN - (Date.now() - b.trippedAt)) : 0,
				lastReason: b.trips.length ? b.trips[b.trips.length - 1].reason : null,
			};
		});
		return out;
	} catch (e) { return {}; }
}
