/* ================= 决策积分引擎 · 自适应难度 =================
 * 根据玩家近期胜负自动调整 AI 强度。
 * 数据来源：战报归档（archive.js）。
 * 全部通过临时改写 config 值实现，不写回 localStorage。
 */
import { lib, game } from '../../../noname.js';
import { cfg } from './util.js';
import { log } from './logger.js';
import { getArchive } from './archive.js';

const WINDOW = 5;
const TRIGGER_WIN = 3;
const TRIGGER_LOSE = 3;
const MAX_SHIFT = 0.3;

let _currentShift = 0;
let _originalAtkBias = null;
let _originalDefBias = null;
let _originalAgg = null;
let _applied = false;

function _analyze() {
	try {
		const archive = getArchive();
		if (!archive || archive.length < WINDOW) return 0;
		const recent = archive.slice(-WINDOW);
		let wins = 0, loses = 0;
		let avgScore = 0;
		recent.forEach(function (g) {
			if (g.verdict === 'win') wins++;
			else if (g.verdict === 'lose') loses++;
			/* ★ 扩写：考虑平均得分 */
			if (g.score !== undefined) avgScore += g.score;
		});
		avgScore = avgScore / recent.length;
		const score = wins - loses;
		if (score >= TRIGGER_WIN) {
			/* ★ 扩写：如果赢得很轻松（平均分很高），加大难度提升 */
			if (avgScore >= 10) return 1.5;
			return 1;
		}
		if (score <= -TRIGGER_LOSE) {
			/* ★ 扩写：如果输得很惨（平均分很低），降低难度更多 */
			if (avgScore <= -10) return -1.5;
			return -1;
		}
		return 0;
	} catch (e) { return 0; }
}

function _applyShift(shift) {
	try {
		if (Math.abs(shift) < 0.01) {
			_restore();
			return;
		}
		if (!_applied) {
			_originalAtkBias = lib.config['extension_无名AI_atkBias'];
			_originalDefBias = lib.config['extension_无名AI_defBias'];
			_originalAgg = lib.config['extension_无名AI_personalityAggression'];
			_applied = true;
		}
		const baseAtk = _originalAtkBias !== undefined ? _originalAtkBias : 1;
		const baseDef = _originalDefBias !== undefined ? _originalDefBias : 1;
		const baseAgg = _originalAgg !== undefined ? _originalAgg : 50;

		lib.config['extension_无名AI_atkBias'] = baseAtk + shift * MAX_SHIFT;
		lib.config['extension_无名AI_defBias'] = baseDef - shift * MAX_SHIFT * 0.5;
		lib.config['extension_无名AI_personalityAggression'] = Math.max(0, Math.min(100, baseAgg + shift * MAX_SHIFT * 50));
		_currentShift = shift;
	} catch (e) {}
}

function _restore() {
	try {
		if (!_applied) return;
		if (_originalAtkBias !== undefined) lib.config['extension_无名AI_atkBias'] = _originalAtkBias;
		if (_originalDefBias !== undefined) lib.config['extension_无名AI_defBias'] = _originalDefBias;
		if (_originalAgg !== undefined) lib.config['extension_无名AI_personalityAggression'] = _originalAgg;
		_currentShift = 0;
		_applied = false;
	} catch (e) {}
}

export function updateAdaptive() {
	try {
		if (cfg('adaptiveDifficulty', false) === false) {
			_restore();
			return;
		}
		const signal = _analyze();
		_applyShift(signal);
		log.info('adaptive', '难度自适应：信号=' + signal + '，偏移=' + _currentShift.toFixed(2));
	} catch (e) {}
}

export function adaptiveStatus() {
	return {
		shift: _currentShift,
		applied: _applied,
		enabled: cfg('adaptiveDifficulty', false) !== false,
	};
}

export function resetAdaptive() {
	_restore();
}
