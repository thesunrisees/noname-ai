/* ================= 决策积分引擎 · 日志分级 ================= */
import { game } from '../../../../../noname.js';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
let _level = 1;   // 默认 info
const _prefix = '【决策积分】';

export function setLogLevel(lv) {
	if (typeof lv === 'string' && LEVELS[lv] !== undefined) _level = LEVELS[lv];
	else if (typeof lv === 'number') _level = lv;
}
export function getLogLevel() { return _level; }

function _emit(level, tag, msg) {
	try {
		if (LEVELS[level] < _level) return;
		if (typeof game !== 'object' || typeof game.log !== 'function') return;
		game.log(_prefix + (tag ? '[' + tag + '] ' : '') + msg);
	} catch (e) {}
}

export const log = {
	debug: (tag, msg) => _emit('debug', tag, msg),
	info:  (tag, msg) => _emit('info',  tag, msg),
	warn:  (tag, msg) => _emit('warn',  tag, msg),
	error: (tag, msg) => _emit('error', tag, msg),
};
