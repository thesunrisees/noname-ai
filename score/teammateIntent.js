/* ================= 决策积分引擎 · 队友意图理解 =================
 * 理解队友的出牌意图，配合
 * 比如：队友拆乐 → 知道他要解乐
 * 队友装连弩 → 知道他要爆发，给他喂牌
 */
import { lib, game, get, _status } from '../../../noname.js';

/* ================= 意图识别缓存 ================= */
const _intentCache = new Map();
let _cacheRound = -1;

function _roundKey() {
	try {
		if (_status && typeof _status.roundNumber === "number") return _status.roundNumber;
		if (typeof game === "object" && typeof game.roundNumber === "number") return game.roundNumber;
	} catch (e) {}
	return 0;
}

function _syncCache() {
	const r = _roundKey();
	if (r !== _cacheRound) {
		_cacheRound = r;
		_intentCache.clear();
	}
}

/* ================= 1. 队友出牌意图识别 =================
 * 根据队友出的牌，判断他想干什么
 */
export function analyzeTeammateIntent(player, card) {
	try {
		if (!player || !card) return { type: 'unknown', confidence: 0 };

		const id = get.name(card, player);
		const key = id + '_' + (player.name1 || player.name || '?');
		if (_intentCache.has(key)) return _intentCache.get(key);

		let intent = { type: 'unknown', confidence: 0, details: {} };

		/* === 锦囊类意图 === */
		switch (id) {
			case 'shunshou':
				/* 顺手牵羊：拿判定区 → 解延时锦囊 */
				if (card.target && card.target.judges && card.target.judges.length > 0) {
					intent = {
						type: 'removeDelay',
						confidence: 0.9,
						details: { target: card.target.name, action: '解延时锦囊' }
					};
				} else {
					intent = {
						type: 'steal',
						confidence: 0.7,
						details: { target: card.target ? card.target.name : '?', action: '偷牌' }
					};
				}
				break;

			case 'guohe':
				/* 过河拆桥：拆判定区 → 解延时锦囊 */
				if (card.target && card.target.judges && card.target.judges.length > 0) {
					intent = {
						type: 'removeDelay',
						confidence: 0.9,
						details: { target: card.target.name, action: '拆延时锦囊' }
					};
				} else if (card.target && card.target.countCards && card.target.countCards('e') > 0) {
					intent = {
						type: 'breakEquip',
						confidence: 0.8,
						details: { target: card.target.name, action: '拆装备' }
					};
				} else {
					intent = {
						type: 'breakHand',
						confidence: 0.6,
						details: { target: card.target ? card.target.name : '?', action: '拆手牌' }
					};
				}
				break;

			case 'lebu':
			case 'bingliang':
				/* 乐不思蜀/兵粮寸断：贴给敌人 → 控制 */
				if (card.target) {
					intent = {
						type: 'controlEnemy',
						confidence: 0.9,
						details: { target: card.target.name, action: id === 'lebu' ? '上乐' : '上兵' }
					};
				}
				break;

			case 'nanman':
			case 'wanjian':
				intent = {
					type: 'aoe',
					confidence: 0.8,
					details: { action: id === 'nanman' ? '南蛮入侵' : '万箭齐发' }
				};
				break;

			case 'wuxie':
				intent = {
					type: 'counter',
					confidence: 0.9,
					details: { action: '无懈可击' }
				};
				break;
		}

		/* === 装备类意图 === */
		if (['zhuge', 'qinggang', 'qinglong', 'zhangba', 'gudingdao', 'bagua', 'tengjia'].indexOf(id) >= 0) {
			if (id === 'zhuge') {
				intent = {
					type: 'comboSetup',
					confidence: 0.9,
					details: { action: '装连弩（准备一波）' }
				};
			} else if (id === 'bagua' || id === 'tengjia') {
				intent = {
					type: 'defenseSetup',
					confidence: 0.8,
					details: { action: id === 'bagua' ? '装八卦（防御）' : '装藤甲（防火）' }
				};
			} else {
				intent = {
					type: 'equip',
					confidence: 0.7,
					details: { action: '装备武器' }
				};
			}
		}

		/* === 伤害类意图 === */
		if (['sha', 'juedou', 'huogong'].indexOf(id) >= 0) {
			intent = {
				type: 'attack',
				confidence: 0.8,
				details: { target: card.target ? card.target.name : '?', action: '攻击' }
			};
		}

		/* === 回复类意图 === */
		if (id === 'tao') {
			intent = {
				type: 'heal',
				confidence: 0.9,
				details: { target: card.target ? card.target.name : player.name, action: '回复' }
			};
		}

		_intentCache.set(key, intent);
		return intent;
	} catch (e) {
		return { type: 'unknown', confidence: 0 };
	}
}

/* ================= 2. 队友行为序列分析 =================
 * 分析队友最近的行为，判断他的整体策略
 */
export function analyzeTeammateStrategy(player) {
	try {
		if (!player) return { strategy: 'unknown', confidence: 0 };

		/* 获取最近的行为记录 */
		const actions = player._djsc_actions || [];
		if (actions.length === 0) return { strategy: 'unknown', confidence: 0 };

		let attackCount = 0;
		let defenseCount = 0;
		let controlCount = 0;
		let supportCount = 0;

		actions.forEach(function (a) {
			if (['sha', 'juedou', 'huogong', 'nanman', 'wanjian'].indexOf(a.id) >= 0) attackCount++;
			if (['shan', 'tao', 'wuxie', 'bagua', 'tengjia'].indexOf(a.id) >= 0) defenseCount++;
			if (['lebu', 'bingliang', 'shunshou', 'guohe', 'tiesuo'].indexOf(a.id) >= 0) controlCount++;
			if (['tao', 'wuxie', 'wuzhong'].indexOf(a.id) >= 0) supportCount++;
		});

		const total = actions.length;
		const attackRatio = attackCount / total;
		const defenseRatio = defenseCount / total;
		const controlRatio = controlCount / total;
		const supportRatio = supportCount / total;

		let strategy = 'balanced';
		if (attackRatio > 0.5) strategy = 'aggressive';
		else if (defenseRatio > 0.5) strategy = 'defensive';
		else if (controlRatio > 0.4) strategy = 'control';
		else if (supportRatio > 0.4) strategy = 'support';

		return {
			strategy: strategy,
			confidence: Math.max(attackRatio, defenseRatio, controlRatio, supportRatio),
			details: {
				attack: attackRatio,
				defense: defenseRatio,
				control: controlRatio,
				support: supportRatio,
			}
		};
	} catch (e) {
		return { strategy: 'unknown', confidence: 0 };
	}
}

/* ================= 3. 队友配合建议 =================
 * 根据队友的意图，给出配合建议
 */
export function teammateCoordination(me, teammate) {
	try {
		if (!me || !teammate) return [];

		const suggestions = [];

		/* 获取队友的策略 */
		const strategy = analyzeTeammateStrategy(teammate);

		/* === 队友在准备连弩一波 → 喂牌 === */
		if (strategy.strategy === 'aggressive' && teammate.getCards('h').length > 0) {
			const hasZhuge = teammate.hasEquip && teammate.hasEquip('zhuge');
			if (hasZhuge) {
				suggestions.push({
					type: 'feedSha',
					priority: 0.9,
					desc: '队友有连弩，给他喂杀帮他一波'
				});
			}
		}

		/* === 队友在解延时锦囊 → 帮忙无懈 === */
		/* 这个需要实时看，在面板里展示 */

		/* === 队友血量低 → 留桃救他 === */
		if ((teammate.hp || 0) <= 1) {
			suggestions.push({
				type: 'keepTao',
				priority: 0.8,
				desc: '队友血量低，留桃救他'
			});
		}

		/* === 队友装备差 → 给他拆装备 === */
		if (teammate.countCards && teammate.countCards('e') === 0) {
			suggestions.push({
				type: 'breakEnemyEquip',
				priority: 0.6,
				desc: '队友没装备，帮他拆敌人装备'
			});
		}

		return suggestions.sort(function (a, b) { return b.priority - a.priority; });
	} catch (e) {
		return [];
	}
}

/* ================= 4. 记录队友行为 =================
 * 在 hook 里调用，记录队友的每一步
 */
export function recordTeammateAction(player, card) {
	try {
		if (!player || !card) return;

		if (!player._djsc_actions) player._djsc_actions = [];

		const id = get.name(card, player);
		player._djsc_actions.push({
			id: id,
			round: _status.roundNumber || 0,
			time: Date.now(),
		});

		/* 只保留最近 10 条 */
		if (player._djsc_actions.length > 10) {
			player._djsc_actions.shift();
		}
	} catch (e) {}
}
