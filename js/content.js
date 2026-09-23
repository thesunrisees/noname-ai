import { lib, game, ui, get, ai, _status } from './utils.js';

export function content(config, pack) {
	const cssPath = lib.assetURL + 'extension/无名AI/css/AIjinjiang.css';
	lib.init.css(cssPath.slice(0, cssPath.lastIndexOf('/')), cssPath.split('/').pop().slice(0, -4));
	/* ★ 手机端：告知 CSS 是手机 */
	try {
		const isMobile = lib.config.touchscreen || window.innerWidth <= 768;
		if (isMobile) {
			document.documentElement.classList.add('djsc-mobile');
		}
	} catch (e) {}
}
