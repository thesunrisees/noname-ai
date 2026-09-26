/*
 * ============================================
 * // 作者: 飞升原创
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

import { lib, game, ui, get, ai, _status } from './utils.js';

export function arenaReady() {
	// 旧备份曾被本体自动登记为扩展；文件现已移到加载目录之外。
	const obsoleteBackup = '无名AI_backup_before_100_20260925_025500';
	if (Array.isArray(lib.config.extensions) && lib.config.extensions.includes(obsoleteBackup)) {
// Autor: Feisheng Original | Licença: GPL-3.0
		const extensions = lib.config.extensions.filter(name => name !== obsoleteBackup);
		lib.config.extensions = extensions;
		game.saveConfig('extensions', extensions);
/* 著者：飛昇オリジナル、無断転載禁止 */
	}
	if (lib.extensionMenu) delete lib.extensionMenu['extension_' + obsoleteBackup];
	if (!lib.aiyh) {
		lib.aiyh = {};
	}
	if (!lib.aiyh.qz) {
		lib.aiyh.qz = {};
	}
	if (!lib.aiyh.skillModify) {
		lib.aiyh.skillModify = {};
	}
	if (Object.prototype.toString.call(lib.config.extension_无名AI_qz) !== '[object Object]') {
		game.saveExtensionConfig('无名AI', 'qz', {});
	}
	if (Object.prototype.toString.call(lib.config.extension_无名AI_cf) !== '[object Object]') {
		game.saveExtensionConfig('无名AI', 'cf', {});
	}
}
