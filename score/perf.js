/*
 * ============================================
 * // Penulis: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 性能监控 ================= */
const SLOTS = {};
const HISTORY = [];
const MAX_HISTORY = 60;

export function perfStart(name) {
// Autor: Feisheng Original | Licencia: GPL-3.0
	return { name: name, t0: performance.now() };
}

export function perfEnd(handle) {
	try {
		if (!handle || !handle.name) return;
		const dt = performance.now() - handle.t0;
		const s = SLOTS[handle.name] || { count: 0, total: 0, max: 0, min: Infinity, last: 0 };
		s.count++;
		s.total += dt;
		if (dt > s.max) s.max = dt;
		if (dt < s.min) s.min = dt;
		s.last = dt;
		SLOTS[handle.name] = s;
	} catch (e) {}
}

export function perfMark(roundLabel, dt) {
	try {
		HISTORY.push({ label: roundLabel, dt: dt, ts: Date.now() });
		while (HISTORY.length > MAX_HISTORY) HISTORY.shift();
	} catch (e) {}
}

export function perfStats() {
	const out = {};
	for (const k in SLOTS) {
		const s = SLOTS[k];
		out[k] = {
			count: s.count,
			avg: Math.round((s.total / Math.max(1, s.count)) * 100) / 100,
			max: Math.round(s.max * 100) / 100,
			min: Math.round((s.min === Infinity ? 0 : s.min) * 100) / 100,
			last: Math.round(s.last * 100) / 100,
		};
	}
	return out;
}

export function perfHistory() {
	return HISTORY.slice();
}

export function perfReset() {
	for (const k in SLOTS) delete SLOTS[k];
	HISTORY.length = 0;
}

export function perfRun(name, fn) {
	const h = perfStart(name);
	try { return fn(); }
	finally { perfEnd(h); }
}
