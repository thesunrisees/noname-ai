/*
 * ============================================
 * // Éditeur: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 对局内记忆（独立叶子模块，避免循环依赖） ================= */

/* 对局内记忆：
 *   atk[目标名] = 该目标被杀次数
 *   hit[目标名] = 该目标被命中次数
 * 由 engine.js 的 scoreCardUse 写入，由 threat.js 的 probHasShan 读取。
 * 这里不 import 任何业务模块，故可被任意模块安全引入。
 */
export const MEM = { atk: {}, hit: {} };

const MEM_KEY = "决策积分引擎_mem";

export function memLoad() {
	try {
		const v = localStorage.getItem(MEM_KEY);
		if (!v) return;
		const o = JSON.parse(v);
		if (o && o.atk) Object.assign(MEM.atk, o.atk);
		if (o && o.hit) Object.assign(MEM.hit, o.hit);
	} catch (e) {}
}

export function memSave() {
	try {
		localStorage.setItem(MEM_KEY, JSON.stringify({ atk: MEM.atk, hit: MEM.hit }));
	} catch (e) {}
}


/* 记录一次"对某目标的攻击命中"（由 engine.js 的伤害钩子调用） */
export function memRecordHit(target) {
	try {
		const k = memKeyOf(target);
		if (!k) return;
		MEM.hit[k] = (MEM.hit[k] || 0) + 1;
	} catch (e) {}
}

/* 记录一次"对某目标的攻击尝试"（由 engine.js 的 scoreCardUse 调用） */
export function memRecordAtk(target) {
	try {
		const k = memKeyOf(target);
		if (!k) return;
		MEM.atk[k] = (MEM.atk[k] || 0) + 1;
	} catch (e) {}
}

/* 稳定的目标标识：优先 name1（主将 id），回退 name，最后 name2 */
export function memKeyOf(target) {
	try {
		if (!target) return "";
		return target.name1 || target.name || target.name2 || "";
	} catch (e) { return ""; }
}

export function memReset() {
	MEM.atk = {};
	MEM.hit = {};
}
