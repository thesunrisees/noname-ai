/*
 * ============================================
 * // Wydawca: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

import { lib, game, ui, get, ai, _status } from './utils.js';
import { initAICardOpt } from './optimization.js';
import './afunction.js';

export function precontent(config, pack) {
	{
// Autor: Feisheng Original | Licença: GPL-3.0
		// 本体版本检测
		let noname = lib.version
				.split('.')
				.slice(1)
				.map((i) => Number(i)),
			min = [11, 1],
			status = false;
		while (noname.length < min.length) {
			noname.push(0);
		}
		for (let i = 0; i < min.length; i++) {
			if (noname[i] < min[i]) {
				status = '您的无名杀版本太低';
				break;
			}
			if (noname[i] > min[i]) {
				break;
			}
		}
		if (typeof status === 'string') {
			alert(status + '，为避免版本不兼容产生不必要的问题，已为您关闭《无名AI》，稍后重启游戏');
			game.saveExtensionConfig('无名AI', 'decisionScore', false);
			game.reload();
		}
	}

	initAICardOpt();
	lib.skill._aiyh_firstKs = {
		available(mode) {
			if (_status.connectMode && !game.me) {
				return;
			}
			const configs = ['neiKey', 'findZhong'];
			let obj = { noScope: true };
			for (let name of configs) {
				obj[name] = lib.config[`extension_无名AI_${name}`];
			}
			game.broadcastAll((obj) => {
				lib.skill._aiyh_firstKs.toLoad(obj);
			}, obj);
		},
		toLoad(configs) {
			if (!_status.postReconnect.aiyh_configs) {
				_status.postReconnect.aiyh_configs = [lib.skill._aiyh_firstKs.toLoad, { ...configs }];
			}
			if (!_status.aiyh_configs) {
				_status.aiyh_configs = {};
			}
			for (let name in configs) {
				_status.postReconnect.aiyh_configs[1][name] = configs[name];
				_status.aiyh_configs[name] = configs[name];
			}
		},
		trigger: { global: 'gameStart' },
		silent: true,
		unique: true,
		firstDo: true,
		charlotte: true,
		superCharlotte: true,
		async content(event, trigger, player) {
			if (!_status.aiyh_firstDo) {
				_status.aiyh_firstDo = true;
				const updateSkillThreaten = (skillId, value) => {
					if (!value) {
						return;
					}
					// 更新技能威胁度
					if (!lib.skill[skillId]) {
						lib.skill[skillId] = { ai: { threaten: value } };
					} else if (!lib.skill[skillId].ai) {
						lib.skill[skillId].ai = { threaten: value };
					} else {
						lib.skill[skillId].ai.threaten = value;
					}
				};
				// 配置技能威胁度
				for (const skillId in lib.config.extension_无名AI_cf) {
					updateSkillThreaten(skillId, lib.config.extension_无名AI_cf[skillId]);
				}
				// 自动补充技能威胁度
				const processMode = 'off';
				if (processMode === 'pj' || processMode === 'pz') {
					const list = _status.connectMode ? get.charactersOL() : get.gainableCharacters();
					for (const charId of list) {
						const charInfo = lib.character[charId];
						if (!charInfo || charInfo.length < 4) {
							continue;
						}

						// 设置稀有度权重
						let allValue;
						if (processMode === 'pj') {
							// 根据评级补充
							const { rank } = lib;
							if (rank.bp.includes(charId)) {
								allValue = 1.4;
							} else if (rank.am.includes(charId)) {
								allValue = 1.8;
							} else if (rank.b.includes(charId)) {
								allValue = 1.2;
							} else if (rank.a.includes(charId)) {
								allValue = 2.4;
							} else if (rank.bm.includes(charId)) {
								// 跳过该角色
								continue;
							} else if (rank.ap.includes(charId)) {
								allValue = 2.7;
							} else if (rank.c.includes(charId)) {
								allValue = 0.8;
							} else if (rank.s.includes(charId)) {
								allValue = 3.2;
							} else if (rank.d.includes(charId)) {
								allValue = 0.6;
							} else {
								continue;
							}
						} else {
							// 根据品质补充
							const rarity = game.getRarity(charId);
							if (rarity === 'rare') {
								allValue = 1.2;
							} else if (rarity === 'epic') {
								allValue = 1.8;
							} else if (rarity === 'legend') {
								allValue = 2.4;
							} else if (rarity === 'junk') {
								allValue = 0.8;
							} else {
								continue;
							}
						}

						// 处理角色技能
						const skills = charInfo[3].filter((skillId) => !lib.skill[skillId]?.juexingji);

						if (skills.length > 0) {
							const baseThreat = Math.pow(allValue, 1 / skills.length);
							for (const skillId of skills) {
								const skill = lib.skill[skillId];
								// 仅在威胁度未定义时设置
								if (!skill?.ai?.threaten) {
									const finalThreat = skill?.ai?.maixie_defend ? 0.8 * baseThreat : baseThreat;
									updateSkillThreaten(skillId, finalThreat);
								}
							}
						}
					}
				}
			}
			player.addSkill('aiyh_gjcx_qj');

			// 身份局专属AI
			if (get.mode() === 'identity' && !['zhong', 'purple'].includes(_status.mode)) {
				if (player.identity === 'nei') {
					player.addSkill(['gjcx_neiAi', 'gjcx_neiAi_expose', 'gjcx_neiAi_damage']);
				}
				if (player === game.zhu) {
					player.addSkill('gjcx_zhuAi');
				}
			}
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (get.itemtype(target) !== 'player') {
						return;
					}
					let base1 = 1;
					if (typeof lib.aiyh.qz[target.name] === 'number') {
						base1 = lib.aiyh.qz[target.name];
					} else if (typeof lib.config.extension_无名AI_qz[target.name] === 'number') {
						base1 = lib.config.extension_无名AI_qz[target.name];
					}
					if (target.name2 === undefined) {
						return base1;
					}
					if (typeof lib.aiyh.qz[target.name2] === 'number') {
						return base1 + lib.aiyh.qz[target.name2];
					}
					if (typeof lib.config.extension_无名AI_qz[target.name2] === 'number') {
						return base1 + lib.config.extension_无名AI_qz[target.name2];
					}
					return base1;
				},
			},
		},
	};

	// AI不砍队友
	lib.skill._aiyh_holdFire = {
		silent: true,
		unique: true,
		charlotte: true,
		superCharlotte: true,
		ai: {
			effect: {
				player(card, player, target) {
					/* 配置未初始化（旧存档）：走安全默认值，不抑制 */
					const holdFireCfg = lib.config.extension_无名AI_holdFire;
					if (holdFireCfg === undefined) return;
					if (
						holdFireCfg === 'off' ||
						player._holdFire_temp ||
						get.itemtype(target) !== 'player' ||
						player === game.me
					) {
						return;
					}
					if (
						get.tag(card, 'damage') &&
						card.name !== 'huogong' &&
						(!lib.config.extension_无名AI_ntAoe || get.info(card)?.selectTarget !== -1) &&
						get.attitude(player, target) > 0
					) {
						let num = 0;
						if (holdFireCfg === 'ph') num = player.hp;
						else {
							num = parseInt(holdFireCfg, 10);
							/* 非法值（如用户手改）：退化为阈值 1 */
							if (!Number.isFinite(num) || num < 0) num = 1;
						}
						if (target.hp > num) {
							return;
						}
						player._holdFire_temp = true;
						let eff = get.effect(target, card, player, player);
						delete player._holdFire_temp;
						/* 从使用者视角看，对友方出伤害牌 → eff < 0；此时应抑制 */
						if (eff < 0) {
							return [1, 0, 1, -1 - eff];
						}
					}
				},
			},
		},
	};
	if (true) {
		/** 全局AI */
		lib.skill.aiyh_gjcx_qj = {
			mod: {
				aiOrder: (player, card, num) => {
					if (!player._aiyh_order_temp && num > 0 && get.itemtype(card) === 'card' && get.position(card) !== 'e') {
						if (get.type(card) === 'equip') {
							for (let i of get.subtypes(card)) {
								if (!player.hasEnabledSlot(i)) return num;
							}
							player._aiyh_order_temp = true;
							let sub = get.subtype(card),
								dis = player.needsToDiscard(),
								equipValue = get.equipValue(card, player);
							if (!player.isEmpty(sub) && !player.hasSkillTag('noe')) {
								let ec = player.getEquips(sub).reduce((val, carde) => {
									if (lib.filter.canBeReplaced(carde, player)) return Math.min(val, get.equipValue(carde, player));
								}, 20);
								if (equipValue - ec <= 1.2 * Math.max(0, 2 - dis)) {
									delete player._aiyh_order_temp;
									return 0;
								}
								if (card.name !== 'zhuge') num /= 5;
							}
						}
						delete player._aiyh_order_temp;
						if (get.name(card, player) !== 'sha') return Math.max(0.01, num - ((get.number(card) || 0) - 6) / 200);
					}
				},
				aiUseful: (player, card, num) => {
					if (num > 0 && get.itemtype(card) === 'card') {
						if (get.type(card) === 'equip')
							for (let i of get.subtypes(card)) {
								if (!player.hasEnabledSlot(i)) return 0;
							}
						num += ((get.number(card) || 0) - 6) / 100;
						if (get.name(card, player) === 'sha') {
							let nature = get.natureList(card);
							if (nature.includes('fire')) num += 0.08;
							if (nature.includes('thunder')) num += 0.05;
							if (nature.includes('ice')) num += 0.18;
							if (nature.includes('stab')) num += 0.25;
						}
						return Math.max(0.01, num);
					}
				},
				aiValue: (player, card, num) => {
					if (!player._aiyh_value_temp && num > 0 && get.itemtype(card) === 'card') {
						if (get.type(card) === 'equip')
							for (let i of get.subtypes(card)) {
								if (!player.hasEnabledSlot(i)) return 0.01 * num;
							}
						num += ((get.number(card) || 0) - 6) / 50;
						if (get.name(card, player) === 'sha') {
							let nature = get.natureList(card);
							if (nature.includes('fire')) num += 0.18;
							if (nature.includes('thunder')) num += 0.1;
							if (nature.includes('ice')) num += 0.36;
							if (nature.includes('stab')) num += 0.5;
						}
						return Math.max(0.01, num);
					}
				},
			},
			charlotte: true,
			superCharlotte: true,
		};
		// 防酒杀AI
		lib.skill._aiyh_reserved_shan = {
			silent: true,
			locked: true,
			unique: true,
			charlotte: true,
			superCharlotte: true,
			ai: {
				effect: {
					player: (card, player, target) => {
						if (typeof card !== 'object' || player.hp <= 1 || get.name(card, player) !== 'shan') return;
						const par = _status.event.getParent(2);
						if (par?.player.hasCard('jiu', 'hs') && par.player.mayHaveSha(player, 'use')) {
							return 'zeroplayertarget';
						}
					},
				},
			},
		};
	}

	{
		// 盲狙AI
		lib.skill._noScopeSkill = {
			trigger: { player: 'phaseZhunbeiBegin' },
			filter(event, player) {
				return _status.aiyh_configs.noScope && player.phaseNumber === 1 && (player === game.zhu || player.identity === 'zhong');
			},
			silent: true,
			unique: true,
			charlotte: true,
			superCharlotte: true,
			mode: ['identity'],
			async content(event, trigger, player) {
				player.addTempSkill('aiMangju');
			},
		};
		lib.skill.aiMangju = {
			// 盲狙
			forced: true,
			unique: true,
			popup: false,
			silent: true,
			charlotte: true,
			superCharlotte: true,
			mode: ['identity'],
			ai: {
				effect: {
					player(card, player, target, current) {
						let name = get.name(card, player);
						if (get.tag(card, 'damage') && Math.abs(get.attitude(player, target)) < 0.5) {
							if (name === 'juedou') return [1, player.countCards('hs') / 400];
							if (name === 'huogong') return [1, player.countCards('h') / 200];
							if (name === 'sha' && !game.hasNature(card)) {
								if (
									(target.hasSkill('tengjia3') || target.hasSkill('rw_tengjia4')) &&
									!(player.getEquip('qinggang') || player.getEquip('zhuque'))
								)
									return 'zeroplayertarget';
							}
							if (
								name === 'sha' &&
								get.color(card) === 'black' &&
								(target.hasSkill('renwang_skill') || target.hasSkill('rw_renwang_skill'))
							) {
								if (!player.getEquip('qinggang')) return 'zeroplayertarget';
							}
							if (get.attitude(player, target) === 0) return [1, 0.005];
						}
						if (
							name === 'guohe' ||
							name === 'shunshou' ||
							name === 'lebu' ||
							name === 'bingliang' ||
							name === 'caomu' ||
							name === 'zhujinqiyuan' ||
							name === 'caochuanjiejian' ||
							name === 'toulianghuanzhu'
						) {
							if (get.attitude(player, target) === 0) return [1, 0.01];
						}
					},
				},
			},
		};
	}

	if (true) {
		// 身份局AI
		lib.skill.gjcx_zhuAi = {
			trigger: { global: 'zhuUpdate' },
			silent: true,
			forced: true,
			unique: true,
			popup: false,
			charlotte: true,
			superCharlotte: true,
			async content(event, trigger, player) {
				const target = game.findPlayer((current) => {
					return current === game.zhu;
				});
				player.removeSkill('gjcx_zhuAi');
				target.addSkill('gjcx_zhuAi');
			},
			ai: {
				effect: {
					player(card, player, target) {
						if (
							typeof card !== 'object' ||
							player._aiyh_zhuAi_temp ||
							player.hasSkill('aiMangju') ||
							get.itemtype(target) !== 'player'
						)
							return;
						player._aiyh_zhuAi_temp = true;
						let att = get.attitude(player, target),
							name = get.name(card, player);
						delete player._aiyh_zhuAi_temp;
						if (Math.abs(att) < 1 && player.needsToDiscard()) {
							if (
								(get.tag(card, 'damage') &&
									name !== 'huogong' &&
									name !== 'juedou' &&
									(target.hp > 1 || player.hasSkillTag('jueqing', false, target))) ||
								name === 'lebu' ||
								name === 'bingliang' ||
								name === 'fudichouxin'
							) {
								return [1, 0.8];
							}
						}
					},
					target(card, player, target) {
						if (typeof card !== 'object' || target._zhuCx_temp || get.itemtype(player) !== 'player') return 1;
						target._zhuCx_temp = true;
						let eff = get.effect(target, card, player, target);
						delete target._zhuCx_temp;
						if (!eff) return;
						if (get.tag(card, 'damage')) return [1, -Math.min(3, 0.8 * target.getDamagedHp()) - 0.6];
						if (get.name(card) === 'lebu' || get.name(card) === 'bingliang') return [1, -0.8];
					},
				},
			},
		};
		lib.skill.gjcx_neiAi = {
			init() {
				game.countPlayer((current) => {
					current.storage.gjcx_neiAi = current.maxHp;
				});
			},
			trigger: {
				global: ['phaseUseBegin', 'changeHp', 'dieAfter', 'zhuUpdate', 'changeIdentity'],
			},
			silent: true,
			forced: true,
			forceDie: true,
			unique: true,
			popup: false,
			priority: -1,
			charlotte: true,
			superCharlotte: true,
			mode: ['identity'],
			filter(event, player) {
				return !player.hasSkill('gjcx_neiAi_nojump') && !player.hasSkill('gjcx_neiAi_suspend');
			},
			async content(event, trigger, player) {
				player.removeSkill('gjcx_neiJiang');
				player.removeSkill('gjcx_neiZhong');
				player.removeSkill('gjcx_neiFan');
				let end = false;
				if (player.identity !== 'nei' || game.players.length <= 2) {
					player.removeSkill('gjcx_neiAi');
					player.removeSkill('gjcx_neiAi_damage');
					player.removeSkill('gjcx_neiAi_expose');
					end = true;
				}
				if (
					trigger.name === 'die' &&
					!game.hasPlayer((current) => {
						return current.identity === 'fan';
					})
				) {
					player.removeSkill('gjcx_neiAi_damage');
					player.addSkill('gjcx_neiAi_nojump');
					end = true;
				}
				if (end) return;
				let zs = game.filterPlayer((current) => {
					return current.identity === 'zhu' || current.identity === 'zhong' || current.identity === 'mingzhong';
				});
				let fs = game.filterPlayer((current) => {
					return current.identity === 'fan';
				});
				let all = 0,
					mine = 0;
				for (let i of game.players) {
					let sym,
						base1 = 1,
						base2 = 0,
						temp = 0;
					if (i === player || zs.includes(i)) sym = 1;
					else if (fs.includes(i)) sym = -1;
					else continue;
					if (i.hp > 0) {
						if (typeof lib.aiyh.qz[i.name] === 'number') base1 = lib.aiyh.qz[i.name];
						if (lib.config.extension_无名AI_takeQz && game.purifySFConfig) {
							let sfc = get.purifySFConfig(lib.config[get.sfConfigName(i.identity)], lib.config.extension_无名AI_min)[
									i.name
								],
								sl = 0.5;
							if (sfc && typeof sfc.sl === 'number') sl = sfc.sl;
							if (sl < 0.4) base1 = 0.6 + sl;
							else if (sl < 0.8) base1 = 2 * sl + 0.2;
							else base1 = 3 * sl - 0.6;
						} else if (typeof lib.config.extension_无名AI_qz[i.name] === 'number')
							base1 = lib.config.extension_无名AI_qz[i.name];
						else if (false) {
							let rank = lib.rank;
							if (rank.bp.includes(i.name)) base1 = 1.4;
							else if (rank.am.includes(i.name)) base1 = 1.8;
							else if (rank.b.includes(i.name)) base1 = 1.2;
							else if (rank.a.includes(i.name)) base1 = 2.4;
							else if (rank.ap.includes(i.name)) base1 = 2.7;
							else if (rank.c.includes(i.name)) base1 = 0.8;
							else if (rank.s.includes(i.name)) base1 = 3.2;
							else if (rank.d.includes(i.name)) base1 = 0.6;
						}
						lib.aiyh.qz[i.name] = base1;
						if (i.name2 !== undefined) {
							if (typeof lib.aiyh.qz[i.name2] === 'number') base2 = lib.aiyh.qz[i.name2];
							if (lib.config.extension_无名AI_takeQz && game.purifySFConfig) {
								let sfc = get.purifySFConfig(lib.config[get.sfConfigName(i.identity)], lib.config.extension_无名AI_min)[
										i.name2
									],
									sl = 0.5;
								if (sfc && typeof sfc.sl === 'number') sl = sfc.sl;
								if (sl < 0.4) base2 = 0.6 + sl;
								else if (sl < 0.8) base2 = 2 * sl + 0.2;
								else base2 = 3 * sl - 0.6;
							} else if (typeof lib.config.extension_无名AI_qz[i.name2] === 'number')
								base2 = lib.config.extension_无名AI_qz[i.name2];
							else if (false) {
								let rank = lib.rank;
								if (rank.bp.includes(i.name2)) base2 = 1.4;
								else if (rank.am.includes(i.name2)) base2 = 1.8;
								else if (rank.b.includes(i.name2)) base2 = 1.2;
								else if (rank.a.includes(i.name2)) base2 = 2.4;
								else if (rank.ap.includes(i.name2)) base2 = 2.7;
								else if (rank.c.includes(i.name2)) base2 = 0.8;
								else if (rank.s.includes(i.name2)) base2 = 3.2;
								else if (rank.d.includes(i.name2)) base2 = 0.6;
							}
							lib.aiyh.qz[i.name2] = base2;
						}
						if (base2) base1 = (base1 + base2) / 2;
						if (i.isTurnedOver()) base1 -= 0.28;
						if (i.storage.gjcx_neiAi && i.storage.gjcx_neiAi !== i.maxHp) {
							if (i.maxHp > i.storage.gjcx_neiAi) {
								if (i.hp > i.storage.gjcx_neiAi)
									temp += ((1 + (i.maxHp - i.storage.gjcx_neiAi) / 10) * base1 * i.hp) / i.maxHp;
								else temp += (base1 * i.hp) / i.storage.gjcx_neiAi;
							} else temp += (base1 * i.hp) / Math.min(5, i.storage.gjcx_neiAi);
						} else temp += (base1 * i.hp) / i.maxHp;
					}
					temp += (i.countCards('hes') - i.countCards('j') * 1.6) / 10;
					if (player === i) mine = temp * Math.sqrt(base1);
					else all += sym * temp;
				}
				if (Math.abs(all) < mine && game.zhu.hp > 2 && zs.length > 1) player.addSkill('gjcx_neiJiang');
				else if (all > -0.06) {
					if (all > 0.36 * mine) player.addSkill('gjcx_neiFan');
					else if (fs.length - zs.length > 1) player.addSkill('gjcx_neiZhong');
					else player.addSkill('gjcx_neiJiang');
				} else player.addSkill('gjcx_neiZhong');
			},
			group: 'gjcx_neiAi_clear',
			subSkill: {
				clear: {
					trigger: {
						global: ['zhuUpdate', 'changeIdentity'],
					},
					silent: true,
					firstDo: true,
					charlotte: true,
					superCharlotte: true,
					async content() {
						lib.aiyh.qz = {};
					},
					sub: true,
				},
				damage: {
					mode: ['identity'],
					trigger: { player: 'useCard1' },
					filter(event, player) {
						return get.tag(event.card, 'damage');
					},
					direct: true,
					unique: true,
					lastDo: true,
					charlotte: true,
					superCharlotte: true,
					async content(event, trigger, player) {
						player.addTempSkill('gjcx_neiAi_suspend', { player: 'useCardAfter' });
					},
				},
				expose: {
					mode: ['identity'],
					trigger: { player: 'useCard1' },
					filter(event, player) {
						return !player.identityShown && typeof player.ai.shown === 'number' && player.ai.shown;
					},
					silent: true,
					forced: true,
					unique: true,
					popup: false,
					charlotte: true,
					superCharlotte: true,
					async content(event, trigger, player) {
						if (player.ai.shown >= 0.95 || get.attitude(game.zhu, player) < 0) player.removeSkill('gjcx_neiAi_expose');
						else if (trigger.card.name === 'tao') {
							for (let i of trigger.targets) {
								if (player === i) continue;
								if (get.attitude(game.zhu, i) > 0) player.ai.shown -= 0.5;
								else if (i.identity === 'fan') player.ai.shown = 0.99;
							}
						} else if (
							trigger.targets &&
							trigger.targets.length === 1 &&
							player !== trigger.targets[0] &&
							!player.hasSkill('gjcx_neiZhong') &&
							!player.hasSkill('gjcx_neiJiang') &&
							get.attitude(game.zhu, trigger.targets[0]) * get.effect(trigger.targets[0], trigger.card, player, game.zhu) <
								0
						) {
							player.removeSkill('gjcx_neiAi_expose');
							player.ai.shown = 0.99;
						} else if (!player.hasSkill('gjcx_neiFan')) player.ai.shown -= 0.03;
					},
				},
				suspend: {
					charlotte: true,
					superCharlotte: true,
				},
				nojump: {
					charlotte: true,
					superCharlotte: true,
				},
			},
		};
		lib.skill.gjcx_neiZhong = {
			silent: true,
			forced: true,
			unique: true,
			popup: false,
			charlotte: true,
			superCharlotte: true,
			mode: ['identity'],
			ai: {
				effect: {
					player(card, player, target) {
						if (typeof card !== 'object' || player._aiyh_neiZhong_temp || get.itemtype(target) !== 'player') return 1;
						player._aiyh_neiZhong_temp = true;
						let eff = get.effect(target, card, player, player),
							name = get.name(card, player);
						delete player._aiyh_neiZhong_temp;
						if (!eff) return;
						if ((get.tag(card, 'damage') && name !== 'huogong') || name === 'lebu' || name === 'bingliang') {
							if (target.identity === 'zhu') return [1, -3];
							if (target.ai.shown < 0.95 && get.attitude(game.zhu, target) <= 0) {
								if (player.needsToDiscard()) return [1, 0.5];
								return [0, 0];
							}
							if (target.identity !== 'fan') return [1, -2];
							return [1, 0.9];
						}
						if (name === 'tao') {
							if (
								target === player ||
								target === game.zhu ||
								(_status.event.dying && player.countCards('hs', 'tao') + _status.event.dying.hp <= 0)
							)
								return 1;
							if (target.identity !== 'fan' && game.zhu.hp > 1 && player.hp > 2) return [1, 0.8];
							return [1, -2];
						}
					},
				},
			},
		};
		lib.skill.gjcx_neiFan = {
			silent: true,
			forced: true,
			unique: true,
			popup: false,
			charlotte: true,
			superCharlotte: true,
			mode: ['identity'],
			ai: {
				effect: {
					player(card, player, target) {
						if (typeof card !== 'object' || player._aiyh_neiFan_temp || get.itemtype(target) !== 'player') return;
						player._aiyh_neiFan_temp = true;
						let eff = get.effect(target, card, player, player),
							name = get.name(card, player);
						delete player._aiyh_neiFan_temp;
						if (!eff) return;
						if ((get.tag(card, 'damage') && name !== 'huogong') || name === 'lebu' || name === 'bingliang') {
							if (
								target.identity === 'zhu' &&
								(target.hp < 2 ||
									game.hasPlayer((current) => {
										return current.identity === 'zhong' || current.identity === 'mingzhong';
									}))
							)
								return [1, -3];
							if (target.identity === 'fan') return [1, -2];
							if (target.ai.shown < 0.95) {
								if (player.needsToDiscard()) return [1, 0.5];
								return [0, 0];
							}
							return [1, 0.9];
						}
						if (name === 'tao') {
							if (
								target === player ||
								target === game.zhu ||
								(_status.event.dying && player.countCards('hs', 'tao') + _status.event.dying.hp <= 0)
							)
								return;
							if (target.identity === 'fan' && game.zhu.hp > 1 && player.hp > 2) return [1, 1.6];
							return [1, -2];
						}
					},
				},
			},
		};
		lib.skill.gjcx_neiJiang = {
			silent: true,
			forced: true,
			unique: true,
			popup: false,
			charlotte: true,
			superCharlotte: true,
			mode: ['identity'],
			ai: {
				effect: {
					player(card, player, target) {
						if (typeof card !== 'object' || get.itemtype(target) !== 'player') return;
						let name = get.name(card);
						if ((get.tag(card, 'damage') && name !== 'huogong') || name === 'lebu' || name === 'bingliang') {
							if (target.identity === 'zhu') return [1, -3];
							if (!player.needsToDiscard()) return [0, 0];
							return [1, -0.5];
						}
						if (name === 'tao') {
							if (target === player && game.zhu.hp > 2) return [1, 0.9];
							if (target === player || target === game.zhu) return;
							return [1, -2];
						}
						if (name === 'jiu' && player.hp > 0) return [0, 0];
					},
				},
			},
		};



	}

}
