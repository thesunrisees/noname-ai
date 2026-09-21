import { lib, game, ui, get, ai, _status } from './utils.js';

export function arenaReady() {
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
