/* ================= 决策积分引擎 · 延迟评估优化 =================
 * 目前是 600ms 固定延迟
 * 可以改成更智能的：等队友技能触发完再评估
 * 比如：等郭嘉遗计摸完牌再评估
 */
import { lib, game, get, _status } from '../../../noname.js';

/* ================= 智能延迟评估 ================= */

/* ================= 1. 判断是否需要更长延迟 =================
 * 如果队友有卖血技能 → 需要更长延迟
 */
export function needLongDelay(me, target) {
	try {
		if (!me || !target) return false;

		/* 检查 target 是否有卖血技能 */
		const sellHpSkills = ['yiji', 'fankui', 'ganglie', 'kuanggu'];

		for (let i = 0; i < sellHpSkills.length; i++) {
			const skill = sellHpSkills[i];
			if (target.hasSkill && target.hasSkill(skill)) {
				return true;  /* 需要更长延迟 */
			}
		}

		return false;
	} catch (e) {
		return false;
	}
}

/* ================= 2. 获取智能延迟时间 =================
 * 返回：需要延迟的时间（ms）
 */
export function getSmartDelay(me, target) {
	try {
		/* 基础延迟：600ms */
		let delay = 600;

		/* 如果有卖血技能 → 加 400ms */
		if (needLongDelay(me, target)) {
			delay += 400;
		}

		/* 如果有判定技能 → 加 300ms */
		try {
			if (target.hasSkill && (target.hasSkill('lebu') || target.hasSkill('bingliang'))) {
				delay += 300;
			}
		} catch (e) {}

		return delay;
	} catch (e) {
		return 600;
	}
}

/* ================= 3. 等待技能触发完成 =================
 * 轮询检查：等队友技能触发完再评估
 */
export function waitForSkills(me, target, callback) {
	try {
		if (!me || !target || !callback) return;

		const delay = getSmartDelay(me, target);

		/* 延迟后执行回调 */
		setTimeout(function () {
			try {
				callback();
			} catch (e) {}
		}, delay);
	} catch (e) {}
}

/* ================= 4. 检查技能是否已触发 ================= */
export function checkSkillTriggered(player, skillName) {
	try {
		if (!player || !skillName) return false;

		/* 检查 _status.event 里有没有这个技能 */
		if (_status && _status.event) {
			const event = _status.event;
			if (event.skill && event.skill === skillName) return true;
		}

		return false;
	} catch (e) {
		return false;
	}
}
