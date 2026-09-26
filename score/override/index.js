/*
 * ============================================
 * // Penulis: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 接管层统一入口 =================
 * 逐层安装：
 *   - hardOverride 开启才安装
 *   - 每层独立判断熔断状态（熔断层跳过）
 *   - 10 秒定时器自动重试熔断层（冷却结束后自动恢复）
 */
import { installUseOverride, uninstallUseOverride } from './use.js';
import { installRespondOverride, uninstallRespondOverride } from './respond.js';
import { installDiscardOverride, uninstallDiscardOverride } from './discard.js';
import { installCompareOverride, uninstallCompareOverride } from './compare.js';
import { resetCircuit, circuitStatus, isTripped } from './circuit.js';
import { cfg } from '../util.js';
import { log } from '../logger.js';

let _installed = false;
const _installedLayers = { use: false, respond: false, discard: false, compare: false };
let _retryIv = null;

function _layerEnabled(layer) {
	try {
		if (cfg('hardOverride', true) === false) return false;
		const v = cfg('override_' + layer, true);
		return v !== false;
	} catch (e) { return false; }
}

function _tryInstallLayer(layer, installFn) {
	try {
		if (!_layerEnabled(layer)) return false;
		if (isTripped(layer)) {
			log.info('override', '[' + layer + '] 熔断中，跳过安装');
			return false;
		}
		if (_installedLayers[layer]) return true;
		installFn();
		_installedLayers[layer] = true;
		return true;
	} catch (e) {
		log.warn('override', '[' + layer + '] 安装失败：' + String(e).slice(0, 80));
		return false;
	}
}

function _startRetryTimer() {
	if (_retryIv) return;
	_retryIv = setInterval(function () {
		try {
			if (cfg('hardOverride', true) === false) return;
			retryOverrideLayers();
		} catch (e) {}
	}, 10000);
}

function _stopRetryTimer() {
	if (_retryIv) {
		try { clearInterval(_retryIv); } catch (e) {}
		_retryIv = null;
	}
}

export function installOverrideLayers() {
	try {
		if (cfg('hardOverride', true) === false) {
			log.info('override', 'hardOverride 未开启，跳过接管层');
			return;
		}
		let ok = 0;
		if (_tryInstallLayer('use', installUseOverride)) ok++;
		if (_tryInstallLayer('respond', installRespondOverride)) ok++;
		if (_tryInstallLayer('discard', installDiscardOverride)) ok++;
		if (_tryInstallLayer('compare', installCompareOverride)) ok++;

		if (ok > 0) {
			_installed = true;
			_startRetryTimer();
			log.info('override', '接管层已安装 ' + ok + '/4（use/respond/discard/compare）');
		}
	} catch (e) {
		try { console.error('[决策积分] installOverrideLayers 失败：', e); } catch (e2) {}
	}
}

/** 逐层重试（熔断冷却后自动调用） */
export function retryOverrideLayers() {
	try {
		if (!_installed) return;
		if (cfg('hardOverride', true) === false) return;
		if (!_installedLayers.use     && !isTripped('use'))     _tryInstallLayer('use', installUseOverride);
		if (!_installedLayers.respond && !isTripped('respond')) _tryInstallLayer('respond', installRespondOverride);
		if (!_installedLayers.discard && !isTripped('discard')) _tryInstallLayer('discard', installDiscardOverride);
		if (!_installedLayers.compare && !isTripped('compare')) _tryInstallLayer('compare', installCompareOverride);
	} catch (e) {}
}

export function uninstallOverrideLayers() {
	try {
		_stopRetryTimer();
		try { uninstallUseOverride(); }     catch (e) {}
		try { uninstallRespondOverride(); } catch (e) {}
		try { uninstallDiscardOverride(); } catch (e) {}
		try { uninstallCompareOverride(); } catch (e) {}
		resetCircuit();
		_installed = false;
		_installedLayers.use = false;
		_installedLayers.respond = false;
		_installedLayers.discard = false;
		_installedLayers.compare = false;
		log.info('override', '接管层已全部卸载');
	} catch (e) {}
}

export function overrideStatus() {
	try {
		return {
			installed: _installed,
			circuit: circuitStatus(),
			layers: {
				use:     { enabled: _layerEnabled('use'),     installed: _installedLayers.use },
				respond: { enabled: _layerEnabled('respond'), installed: _installedLayers.respond },
				discard: { enabled: _layerEnabled('discard'), installed: _installedLayers.discard },
				compare: { enabled: _layerEnabled('compare'), installed: _installedLayers.compare },
			},
		};
	} catch (e) { return null; }
}

/* ================= 接管层运行统计 ================= */
export function getOverrideStats() {
	try {
		const raw = (_status && _status.djsc_overrideStats) || null;
		if (!raw) {
			return {
				use: { endTurn: 0, pass: 0, 'pass-limited': 0, error: 0, timeout: 0 },
				respond: { allow: 0, block: 0 },
				discard: { check: 0 },
				compare: { pass: 0 },
			};
		}
		return JSON.parse(JSON.stringify(raw));
	} catch (e) { return {}; }
}

export function resetOverrideStats() {
	try {
		if (_status) {
			_status.djsc_overrideStats = { use: {}, respond: {}, discard: {}, compare: {} };
		}
	} catch (e) {}
}

export { resetCircuit, circuitStatus, isTripped };
