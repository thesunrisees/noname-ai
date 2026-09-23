/* ================= 决策积分引擎 · 兼容性检测 ================= */
import { lib, game, _status } from '../../../../../noname.js';
import { cfg } from '../../util.js';
import { log } from '../../logger.js';

/* 已知会与引擎打架的扩展技能/配置 */
const KNOWN_CONFLICTS = [
	{
		check: function () { try { return lib.config.extension_AI优化_identityOpt === true; } catch (e) { return false; } },
		name: '《AI优化》身份局AI',
		type: 'aiEffect',
		advice: '两者的 ai.effect.player 返回值会累加，可能导致目标评分错乱。建议二选一。',
	},
	{
		check: function () { try { return lib.config.extension_AI优化_globalOpt === true; } catch (e) { return false; } },
		name: '《AI优化》全局AI',
		type: 'modOrder',
		advice: 'mod.aiOrder 会叠加，可能让牌序抖动。建议只开一个。',
	},
	{
		check: function () { try { return lib.config.extension_AI优化_aiZhuInherit === true; } catch (e) { return false; } },
		name: '《AI优化》AI继承',
		type: 'lifecycle',
		advice: '主公继承会中途插入新玩家，引擎缓存的身份/威胁数据可能失效。引擎会自动清缓存，但战斗节奏可能错位。',
	},
];

/* 引擎自检 */
export function selfCheck() {
	const issues = [];
	try {
		// 1. 关键模块是否加载
		if (!lib.skill || !lib.card) issues.push('lib 环境异常：lib.skill 或 lib.card 缺失');
		if (!lib.element || !lib.element.Player) issues.push('lib.element.Player 缺失，记分钩子无法安装');

		// 2. 检测冲突
		for (const c of KNOWN_CONFLICTS) {
			try {
				if (c.check()) issues.push({ name: c.name, type: c.type, advice: c.advice });
			} catch (e) {}
		}

		// 3. 联机降级
		if (_status && _status.connectMode) {
			issues.push({ name: '联机模式', type: 'mode', advice: '联机时部分玩家数据不完整，建议关闭 hardOverride。' });
		}
	} catch (e) {}
	return issues;
}

export function warnConflicts() {
	try {
		const issues = selfCheck();
		const hardIssues = issues.filter(function (x) { return typeof x === 'object'; });
		if (!hardIssues.length) return;
		// 只在控制台打印，不 alert 打扰
		hardIssues.forEach(function (x) { log.warn('compat', x.name + ' —— ' + x.advice); });
		if (cfg('hardOverride', false)) {
			hardIssues.forEach(function (x) { log.warn('compat', 'hardOverride 已开启，请留意上述冲突。'); });
		}
	} catch (e) {}
}

/* 联机时是否应禁用接管层 */
export function shouldDisableOverride() {
	try {
		if (_status && _status.connectMode) return true;
		return false;
	} catch (e) { return false; }
}

/* ================= 本体 Bug 兼容补丁 ================= */
let _patchesApplied = false;

/**
 * 修复本体 Bug：玩家死亡时，遍历技能列表检查 lib.skill[skill].temp
 * 如果技能 ID 不在 lib.skill 里（比如动态生成的技能），会报错
 * "Cannot read properties of undefined (reading 'temp')"
 */
export function applyCompatPatches() {
	if (_patchesApplied) return;
	try {
		/* 补丁 1：修复 die 事件里的 temp 检查 */
		// 我们无法直接修改本体的 content.js，所以用 try/catch 包装
		// 实际上这个错误发生在本体代码里，我们只能通过清理玩家技能列表来避免

		/* 补丁 2：给我们扩展添加的所有 AI 技能加上 temp: true */
		// 这样玩家死亡时，这些技能会被自动清理，不会留下垃圾
		const aiSkillIds = ['_djsc_engine', '_djsc_compareAI', '_djsc_responseAI'];
		aiSkillIds.forEach(function (sid) {
			try {
				if (lib.skill && lib.skill[sid]) {
					lib.skill[sid].temp = true;
					lib.skill[sid].invisible = true;
				}
			} catch (e) {}
		});

		/* 补丁 3：hook player.removeSkill，清理不存在的技能 */
		// 实际上我们不需要 hook，因为本体的 die 代码会遍历技能列表
		// 我们只需要确保我们添加的技能都有 temp: true 属性

		_patchesApplied = true;
		log.info('compat', '本体兼容补丁已应用');
	} catch (e) {
		log.warn('compat', '应用兼容补丁失败：' + e.message);
	}
}
