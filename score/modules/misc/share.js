/* ================= 决策积分引擎 · 性格配置分享 =================
 * 把三维性格 + 预设编码为一段短字符串，方便复制 / 粘贴 / 分享。
 * 格式：DJSC1:<preset>:<agg>:<rsk>:<tea>:<crc>
 */
import { lib, game } from '../../../../../noname.js';

const PREFIX = "DJSC1";
const VALID_PRESETS = ["custom", "aggressive", "balanced", "cautious", "loner", "guardian"];

function _crc16(str) {
	let crc = 0xFFFF;
	for (let i = 0; i < str.length; i++) {
		crc ^= str.charCodeAt(i);
		for (let j = 0; j < 8; j++) {
			if (crc & 1) crc = (crc >> 1) ^ 0xA001;
			else crc >>= 1;
		}
	}
	return (crc & 0xFFFF).toString(16).padStart(4, "0");
}

function _readCurrent() {
	const cfg = function (k, d) {
		try {
			return lib.config["extension_无名AI_" + k] !== undefined ? lib.config["extension_无名AI_" + k] : d;
		} catch (e) { return d; }
	};
	const preset = cfg("riskProfile", "custom");
	const agg = Math.max(0, Math.min(100, Number(cfg("personalityAggression", 50)) || 50));
	const rsk = Math.max(0, Math.min(100, Number(cfg("personalityRisk", 50)) || 50));
	const tea = Math.max(0, Math.min(100, Number(cfg("personalityTeam", 50)) || 50));
	return { preset, agg, rsk, tea };
}

function _writeConfig(data) {
	try {
		lib.config["extension_无名AI_riskProfile"] = data.preset;
		game.saveConfig("extension_无名AI_riskProfile", data.preset);
		lib.config["extension_无名AI_personalityAggression"] = data.agg;
		game.saveConfig("extension_无名AI_personalityAggression", data.agg);
		lib.config["extension_无名AI_personalityRisk"] = data.rsk;
		game.saveConfig("extension_无名AI_personalityRisk", data.rsk);
		lib.config["extension_无名AI_personalityTeam"] = data.tea;
		game.saveConfig("extension_无名AI_personalityTeam", data.tea);
		return true;
	} catch (e) { return false; }
}

export function exportPersonality() {
	try {
		const cur = _readCurrent();
		const body = cur.preset + ":" + cur.agg + ":" + cur.rsk + ":" + cur.tea;
		const crc = _crc16(body);
		return PREFIX + ":" + body + ":" + crc;
	} catch (e) { return null; }
}

export function importPersonality(str) {
	try {
		if (typeof str !== "string") return { ok: false, err: "输入为空" };
		const s = str.trim();
		const parts = s.split(":");
		if (parts.length !== 6) return { ok: false, err: "格式错误：应为 6 段（DJSC1:preset:agg:rsk:tea:crc）" };
		if (parts[0] !== PREFIX) return { ok: false, err: "前缀错误：应以 " + PREFIX + " 开头" };
		const preset = parts[1];
		if (VALID_PRESETS.indexOf(preset) < 0) return { ok: false, err: "未知预设：" + preset };
		const agg = parseInt(parts[2], 10);
		const rsk = parseInt(parts[3], 10);
		const tea = parseInt(parts[4], 10);
		if (isNaN(agg) || isNaN(rsk) || isNaN(tea)) return { ok: false, err: "三维数值不是整数" };
		if (agg < 0 || agg > 100 || rsk < 0 || rsk > 100 || tea < 0 || tea > 100) {
			return { ok: false, err: "三维数值超出 0~100 范围" };
		}
		const body = preset + ":" + agg + ":" + rsk + ":" + tea;
		const expected = _crc16(body);
		if (expected !== parts[5]) return { ok: false, err: "校验和不匹配（可能粘贴时丢字符）" };
		const ok = _writeConfig({ preset, agg, rsk, tea });
		if (!ok) return { ok: false, err: "写入配置失败（lib.config 不可写）" };
		return { ok: true, data: { preset, agg, rsk, tea } };
	} catch (e) {
		return { ok: false, err: "解析异常：" + String(e).slice(0, 60) };
	}
}

export function verifyPersonality(str) {
	try {
		if (typeof str !== "string") return { ok: false, err: "输入为空" };
		const parts = str.trim().split(":");
		if (parts.length !== 6 || parts[0] !== PREFIX) return { ok: false, err: "格式错误" };
		const preset = parts[1];
		if (VALID_PRESETS.indexOf(preset) < 0) return { ok: false, err: "未知预设" };
		const body = preset + ":" + parts[2] + ":" + parts[3] + ":" + parts[4];
		return { ok: _crc16(body) === parts[5], data: { preset, agg: +parts[2], rsk: +parts[3], tea: +parts[4] } };
	} catch (e) { return { ok: false, err: String(e) }; }
}

export function copyToClipboard(str) {
	try {
		if (typeof game.copy === "function") return game.copy(str, "性格配置已复制到剪贴板", "复制失败");
		const ta = document.createElement("textarea");
		ta.value = str;
		ta.style.position = "fixed";
		ta.style.left = "-9999px";
		document.body.appendChild(ta);
		ta.focus(); ta.select();
		const ok = document.execCommand("copy");
		document.body.removeChild(ta);
		alert(ok ? "性格配置已复制到剪贴板" : "复制失败");
		return ok;
	} catch (e) { return false; }
}
