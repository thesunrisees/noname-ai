/*
 * ============================================
 * // Auteur: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 公共工具（叶子模块，无业务依赖） ================= */
import { lib, get } from '../../../noname.js';

/* 统一配置读取：优先 extension_无名AI_*，回退 extension_决策积分引擎_*，最后默认值 */
export function cfg(k, d) {
	try {
// Autor: Feisheng Original | Lizenz: GPL-3.0
		if (lib.config["extension_无名AI_" + k] !== undefined) return lib.config["extension_无名AI_" + k];
		if (lib.config["extension_决策积分引擎_" + k] !== undefined) return lib.config["extension_决策积分引擎_" + k];
		return d;
	} catch (e) { return d; }
}

/* try 包裹，异常时返回默认值 */
export function safe(f, d) {
	try { return f(); } catch (e) { return d; }
}

/* 武将显示名（带翻译兜底） */
export function nameOf(p) {
	return safe(function () {
		/* 取一个字符串型 id，不信任 p.name 的类型 */
		let id = "";
		if (typeof p.name === "string") id = p.name;
		else if (typeof p.name1 === "string") id = p.name1;
		else if (typeof p.name2 === "string") id = p.name2;
		if (!id) return "?";
		const t = get.translation(id);
		return (typeof t === "string" && t) || id || "?";
	}, "?");
}

/* 记分用的稳定 key（当前直接用显示名，与 nameOf 等价） */
export function keyOf(p) {
	return nameOf(p);
}

/* 判断是否为玩家对象（避免对 GameEvent / Card 等误判） */
export function isObj(p) {
	return p && typeof p === "object" && p.hp !== undefined;
}

/* ================= 共享 proto.addSkill 监听器 ================= */
let _addSkillHooked = false;
const _newPlayerCallbacks = new Set();

/**
 * 注册一个回调：每当有新玩家加入（addSkill 被调用）时触发。
 * 多个模块可通过此接口注册，避免各自包 proto。
 * @param {function(Player):void} cb
 * @returns {function} 取消注册的函数
 */
export function onPlayerSkillInjected(cb) {
	if (typeof cb !== 'function') return function () {};
	_newPlayerCallbacks.add(cb);
	_installAddSkillHook();
	return function () { _newPlayerCallbacks.delete(cb); };
}

function _installAddSkillHook() {
	if (_addSkillHooked) return;
	try {
		const proto = lib.element && lib.element.Player && lib.element.Player.prototype;
		if (!proto || typeof proto.addSkill !== 'function') return;
		const orig = proto.addSkill;
		proto.addSkill = function () {
			const r = orig.apply(this, arguments);
			try {
				const self = this;
				_newPlayerCallbacks.forEach(function (cb) {
					try { cb(self); } catch (e) {}
				});
			} catch (e) {}
			return r;
		};
		_addSkillHooked = true;
	} catch (e) {}
}
