import { lib, game, ui, get, ai, _status } from './js/utils.js';
import { arenaReady } from './js/arenaReady.js';
import { config } from './js/config.js';
import { content } from './js/content.js';
import { precontent } from './js/precontent.js';
import { help } from './js/help.js';
import { installScoreEngine, uninstallScoreEngine, isScoreEngineEnabled } from './score/index.js';

const extensionInfo = await lib.init.promises.json(`${lib.assetURL}extension/无名AI/info.json`);
let extensionPackage = {
	name: '无名AI',
	arenaReady,
	content,
	precontent,
	config,
	help,
	package: {},
	files: {},
	css: ['./css/AIjinjiang.css'],
};
Object.keys(extensionInfo)
	.filter((key) => key !== 'name')
	.forEach((key) => {
		extensionPackage.package[key] = extensionInfo[key];
	});

/* ★ 整合：原 content 钩子后初始化决策积分引擎（可配置开关） */
const _content = extensionPackage.content;
extensionPackage.content = function (config, pack) {
	try { if (typeof _content === 'function') _content(config, pack); } catch (e) {}
	try {
		if (isScoreEngineEnabled()) {
			installScoreEngine();
		}
	} catch (e) {}
};

/* ★ 卸载时清理决策积分引擎 */
const _uninstall = extensionPackage.uninstall;
extensionPackage.uninstall = function () {
	try { uninstallScoreEngine(); } catch (e) {}
	try { if (typeof _uninstall === 'function') _uninstall(); } catch (e) {}
};

export let type = 'extension';
export default extensionPackage;
