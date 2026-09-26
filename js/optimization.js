/*
 * ============================================
 * // Wydawca: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

import { lib, game, ui, get, _status } from './utils.js';

/**
 * @卡牌无名AI
 */
export function initAICardOpt() {
// Author: Feisheng Original | License: GPL-3.0
	lib.skill._aiyh_cardAiOpt = {
		mode: ['identity'],
		silent: true,
		unique: true,
		charlotte: true,
		superCharlotte: true,
		trigger: { global: 'gameStart' },
		filter(event, player) {
			return player === game.me;
		},
		async content(event, trigger, player) {
			/* 首次执行时保存本体原函数引用 */
			if (!lib.card.huogong.__djsc_origContent) {
				lib.card.huogong.__djsc_origContent = lib.card.huogong.content;
			}
			const __origHuogongContent = lib.card.huogong.__djsc_origContent;
			lib.card.huogong.content = async function (event, trigger, player) {
				/* ★ 直接走本体流程，避免 API 兼容性问题 */
				return await __origHuogongContent.call(this, event, trigger, player);
			};
			/* ★ 暴露覆写信号给策略总线 */
			function _exposeOverride(cardId, score, reason, weight) {
				try {
					if (!lib.card || !lib.card[cardId]) return;
					lib.card[cardId].__djsc_override = {
						score: score,
						weight: weight || 1.2,
						reason: reason,
						ts: Date.now(),
					};
				} catch (e) {}
			}
			const optimizeCards = {
// 顺手牵羊
shunshou: {
    wuxie(target, card, player, viewer) {
        if (!target.countCards('hej') || get.attitude(viewer, player._trueMe || player) > 0) {
            return 0;
        }
    },
    basic: {
        order: 7.5,
        useful(card, i) {
            return 8 / (3 + i);
        },
        value(card, player) {
            let max = 0;
            game.countPlayer((cur) => {
                max = Math.max(max, lib.card.shunshou.ai.result.target(player, cur) * get.attitude(player, cur));
            });
            if (max <= 0) return 2;
            return 0.53 * max;
        },
    },

    trigger: {
        player: "chooseCardBegin"
    },
    filter(event, player) {
        return event.card?.name === "shunshou" && get.position(event.link) === "h";
    },
    async content(event, trigger, player) {
        trigger.set("visible", false);
    },
    nopop: true,
    silent: true,
    button(button) {
        const { player, target } = get.event();
        if (!lib.filter.canBeGained(button.link, player, target)) {
            return 0;
        }
        const att = get.attitude(player, target),
            pos = get.position(button.link),
            name = get.name(button.link);
        let val = get.value(button.link, player) / 60,
            btv = get.buttonValue(button);

        if (pos === 'h') {
            return att > 0 ? -1 : 1;
        }
        if (pos === 'j') {
            let viewAs = button.link.viewAs;
            if (viewAs === 'lebu') {
                let needs = target.needsToDiscard(2);
                btv *= 20 + 0.2 * needs;
            } else if (viewAs === 'shandian' || viewAs === 'fulei') {
                btv /= 2;
            }
        }
        if (att > 0) {
            btv = -btv;
        }
        if (pos !== 'e') {
            return btv + val;
        }
        const subs = get.subtypes(button.link);
        if (subs.includes('equip1')) {
            return (btv * Math.min(3.6, target.hp)) / 3;
        }
        if (subs.includes('equip2')) {
            if (name === 'baiyin' && pos === 'e' && target.isDamaged()) {
                let by = 1 - 0.2 * Math.min(5, target.hp);
                return get.sgn(get.recoverEffect(target, player, player)) * by;
            }
            return 1.57 * btv + val;
        }
        if (
            att <= 0 &&
            (subs.includes('equip3') || subs.includes('equip4')) &&
            (player.hasSkill('shouli') || player.hasSkill('psshouli'))
        ) {
            return 0;
        }
        if (
            subs.includes('equip3') &&
            !game.hasPlayer((cur) => {
                if (get.attitude(cur, target) >= 0) return false;
                return (
                    get.distance(cur, target) === 2 || get.distance(cur, target, 'attack') - cur.getAttackRange() === 1
                );
            })
        ) {
            return 0.4 * btv + val;
        }
        if (subs.includes('equip4')) {
            return btv / 2 + val;
        }
        return btv + val;
    },
    result: {
        player(player, target) {
            const hs = target.getGainableCards(player, 'h');
            const es = target.getGainableCards(player, 'e');
            const js = target.getGainableCards(player, 'j');
            const att = get.attitude(player, target);
            if (att < 0) {
                if (!hs.length && !es.length && !js.length) return 0;
            } else if (att > 1) {
                return es.some((card) => get.value(card, target) <= 0) ||
                    js.some((card) => {
                        var cardj = card.viewAs ? { name: card.viewAs } : card;
                        return cardj.name === 'xumou_jsrg' ? false : get.effect(target, cardj, target, player) < 0;
                    })
                    ? 1.5
                    : 0;
            }
            return 1;
        },
        target(player, target) {
            const hs = target.getGainableCards(player, 'h');
            const es = target.getGainableCards(player, 'e');
            const js = target.getGainableCards(player, 'j');
            const att = get.attitude(player, target);


            if (att <= 0) {
                if (hs.length > 0) return -1.5;
                /* ★ 敌方只有白银且受伤 → 顺走会帮敌人回血 */
                let onlyDamagedBaiyin = false;
                try {
                    if (es.length === 1 && js.length === 0) {
                        const only = es[0];
                        const cardj = only.viewAs ? { name: only.viewAs } : only;
                        if (cardj.name === 'baiyin' && target.isDamaged && target.isDamaged()) {
                            onlyDamagedBaiyin = true;
                        }
                    }
                } catch (e) {}
                if (onlyDamagedBaiyin) return 0;
                const __r = es.length || js.length ? -1.5 : 1.5;
                try { _exposeOverride('shunshou', __r, 'shunshou.target', 1.2); } catch (e) {}
                return __r;
            }

            if (
                js.some((card) => {
                    var cardj = card.viewAs ? { name: card.viewAs } : card;
                    return cardj.name === 'xumou_jsrg'
                        ? false
                        : cardj.name === 'lebu' && get.effect(target, cardj, target, target) < 0;
                })
            ) {
                return 10;
            }
            if (
                es.some((card) => {
                    const cardj = card.viewAs ? { name: card.viewAs } : card;
                    return cardj.name === 'baiyin';
                })
            ) {
                if (target.maxHp > target.hp && target.hp === 1) return 5;
            }
            if (
                es.some((card) => {
                    const cardj = card.viewAs ? { name: card.viewAs } : card;
                    return cardj.name !== 'baiyin' && get.value(cardj, target) <= 0;
                })
            ) {
                return 2;
            }
            return es.some((card) => get.value(card, target) <= 0) ||
                js.some((card) => {
                    var cardj = card.viewAs ? { name: card.viewAs } : card;
                    return cardj.name === 'xumou_jsrg' ? false : get.effect(target, cardj, target, target) < 0;
                })
                ? 1.5
                : -1.5;
        },
    },
    tag: { loseCard: 1, gain: 1 },
},


// 过河拆桥
guohe: {
    wuxie(target, card, player, viewer, status) {
        if (
            !target.countCards('hej') ||
            status * get.attitude(viewer, player._trueMe || player) > 0 ||
            (target.hp > 2 &&
                !target.hasCard((i) => {
                    let val = get.value(i, target),
                        subtypes = get.subtypes(i);
                    if (val < 8 && target.hp < 2 && !subtypes.includes('equip2') && !subtypes.includes('equip5')) {
                        return false;
                    }
                    return val > 3 + Math.min(5, target.hp);
                }, 'e') &&
                target.countCards('h') * _status.event.getRand('guohe_wuxie') > 1.57)
        ) {
            return 0;
        }
    },
    basic: {
        order: 9,
        useful(card, i) {
            return 10 / (3 + i);
        },
        value(card, player) {
            let max = 0;
            game.countPlayer((cur) => {
                const hasPriorityEquip = cur
                    .getEquips('e')
                    .some(
                        (eq) =>
                            get.subtypes(eq).includes('equip3') ||
                            get.subtypes(eq).includes('equip2') ||
                            get.subtypes(eq).includes('equip1')
                    );
                const hasPriorityHand = cur.hasCard((c) => get.name(c) === 'shan' || get.name(c) === 'tao', 'h');
                const weight = hasPriorityEquip ? 1.5 : hasPriorityHand ? 1.2 : 1;
                max = Math.max(max, lib.card.guohe.ai.result.target(player, cur) * get.attitude(player, cur) * weight);
            });
            if (max <= 0) {
                return 5;
            }
            return 0.42 * max;
        },
    },
    trigger: {
        player: "chooseCardBegin"
    },
    filter(event, player) {
        return event.card?.name === "guohe" && get.position(event.link) === "h";
    },
    async content(event, trigger, player) {
        trigger.set("visible", false);
    },
    nopop: true,
    silent: true,
    yingbian(card, player, targets, viewer) {
        if (get.attitude(viewer, player) <= 0) {
            return 0;
        }
        if (
            game.hasPlayer(
                (current) =>
                    !targets.includes(current) &&
                    lib.filter.targetEnabled2(card, player, current) &&
                    get.effect(current, card, player, player) > 0
            )
        ) {
            return 6;
        }
        return 0;
    },
    button(button) {
        const player = _status.event.player,
            target = _status.event.target;
        if (!lib.filter.canBeDiscarded(button.link, player, target)) {
            return 0;
        }
        let att = get.attitude(player, target),
            val = get.buttonValue(button),
            pos = get.position(button.link),
            name = get.name(button.link),
            subtypes = get.subtypes(button.link);

        if (pos === 'h') {
            return att > 0 ? -1 : 1; 
        }

        if (pos === 'j') {
            let viewAs = button.link.viewAs;
            if (viewAs === 'lebu') {
                let needs = target.needsToDiscard(2);
                val *= 1.08 + 0.2 * needs;
            } else if (viewAs === 'shandian' || viewAs === 'fulei') {
                val /= 2;
            }
            return att > 0 ? -val : val;
        }
        if (pos === 'e') {
            if (subtypes.includes('equip3')) {
                val *= 3.2;
            } else if (subtypes.includes('equip2')) {
                val *= 2.1;
                if (name === 'baiyin' && target.isDamaged()) {
                    let by = 3 - 0.6 * Math.min(5, target.hp);
                    val = get.sgn(get.recoverEffect(target, player, player)) * by;
                }
            } else if (subtypes.includes('equip1')) {
                val = val * Math.min(3.6, target.hp) * 0.6;
            } else if (subtypes.includes('equip6')) {
                val *= 1.0;
            } else if (subtypes.includes('equip4')) {
                val /= 2;
            }
            if (att > 0) val = -val;
            if (
                att <= 0 &&
                (subtypes.includes('equip3') || subtypes.includes('equip4')) &&
                (player.hasSkill('shouli') || player.hasSkill('psshouli'))
            ) {
                return 0;
            }
            if (subtypes.includes('equip3')) {
                if (
                    !game.hasPlayer((cur) => {
                        if (get.attitude(cur, target) >= 0) return false;
                        return (
                            get.distance(cur, target) === 2 ||
                            get.distance(cur, target, 'attack') - cur.getAttackRange() === 1
                        );
                    })
                ) {
                    return 0.4 * val;
                }
                return val * 3.2;
            }
            return val;
        }
        return att > 0 ? -val : val;
    },
    result: {
        target(player, target) {
            const att = get.attitude(player, target);
            const hs = target.getDiscardableCards(player, 'h');
            const es = target.getDiscardableCards(player, 'e');
            const js = target.getDiscardableCards(player, 'j');
            if (!hs.length && !es.length && !js.length) return 0;
            if (att > 0) {
                /* 友方：拆掉他身上的负面判定 / 废装备 / 触发型装备才是好事
                 * —— 与 shunshou.result.target 的判定保持一致 */
                let best = -1.5;
                js.forEach(function (c) {
                    const cardj = c.viewAs ? { name: c.viewAs } : c;
                    if (cardj.name === 'xumou_jsrg') return;
                    if (cardj.name === 'lebu' && get.effect(target, cardj, target, target) < 0) {
                        best = Math.max(best, 10);   // 拆友方乐 → 救命
                    } else if (cardj.name === 'bingliang' && get.effect(target, cardj, target, target) < 0) {
                        best = Math.max(best, 6);    // 拆友方兵 → 帮出牌
                    } else if (cardj.name === 'shandian' || cardj.name === 'fulei') {
                        best = Math.max(best, 3);    // 拆友方雷 → 防炸
                    }
                });
                es.forEach(function (c) {
                    const cardj = c.viewAs ? { name: c.viewAs } : c;
                    /* 白银狮子：友方受损时被拆 → 触发回血 → 好事 */
                    if (cardj.name === 'baiyin' && target.isDamaged && target.isDamaged()) {
                        best = Math.max(best, 4);
                    } else if (get.value(c, target) <= 0) {
                        best = Math.max(best, 2);    // 拆友方废装备
                    }
                });
                try { _exposeOverride('guohe', best, 'guohe.target 友方救援', 1.2); } catch (e) {}
                return best;
            } else {
                /* ★ 敌方分支：检查是否有"拆掉反而帮敌人"的陷阱 */
                let hasBaiyin = false;
                try {
                    hasBaiyin = es.some(function (c) {
                        const cardj = c.viewAs ? { name: c.viewAs } : c;
                        return cardj.name === 'baiyin' && target.isDamaged && target.isDamaged();
                    });
                } catch (e) {}

                /* 敌方受伤时白银被拆 → 触发回血 → 负收益。
                 * 除非该白银是敌方唯一的装备且敌方无其它收益牌，
                 * 否则 AI 应避免拆白银。 */
                if (hasBaiyin && hs.length === 0 && es.length === 1) {
                    /* 敌方只有白银 → 拆它是负收益 */
                    return 0;
                }
                if (hasBaiyin && (hs.length > 0 || es.length > 1)) {
                    /* 敌方还有其它牌 → 优先拆其它牌，白银降权 */
                    return -0.5;
                }
                /* 常规：拆敌方是收益 */
                return -1.5;
            }
        },
    },
},

				// 诸葛连弩
				zhuge: {
					order() {
						return get.order({ name: 'sha' }) - 0.1;
					},
					equipValue(card, player) {
						if (player._zhuge_temp) return 1;
						player._zhuge_temp = true;
						const result = (function () {
							if (
								!game.hasPlayer(
									(current) =>
										get.distance(player, current) <= 1 &&
										player.canUse('sha', current) &&
										get.effect(current, { name: 'sha' }, player, player) > 0
								)
							) {
								return 1;
							}
							if (player.hasSha() && _status.currentPhase === player) {
								if ((player.getEquip('zhuge') && player.countUsed('sha')) || player.getCardUsable('sha') === 0) {
									return 10;
								}
							}
							let num = player.countCards('hs', 'sha');
							return num > 1 ? 6 + num : 3 + num;
						})();
						delete player._zhuge_temp;
						return result;
					},
					basic: {
						equipValue: 5,
						order(card, player) {
							if (player.countUsed('sha') <= 10 && player.getCardUsable('sha') <= 10) {
								if (
									player.countCards('hs', 'sha') > 0 &&
									player.countUsed('sha') <= player.getCardUsable('sha') &&
									game.hasPlayer(
										(current) =>
											get.distance(player, current) <= 1 &&
											player.canUse('sha', current) &&
											get.effect(current, { name: 'sha' }, player, player) > 0
									)
								) {
									return 1;
								}
							}
							const equipValue = get.equipValue(card, player) / 20;
							return player && player.hasSkillTag('reverseEquip') ? 8.5 - equipValue : 8 + equipValue;
						},
						useful: 2,
						value(card, player, index, method) {
							if (player.getCardUsable('sha') <= 10) {
								if (
									game.hasPlayer(
										(current) =>
											get.distance(player, current) <= 1 &&
											player.canUse('sha', current) &&
											get.effect(current, { name: 'sha' }, player, player) > 0
									)
								) {
									let num = player.countCards('hs', 'sha') - player.getCardUsable('sha');
									if (num > 0) {
										if (player.isPhaseUsing()) return 30;
										return 5 * num;
									}
								}
							}
							if (!player.getCards('e').includes(card) && !player.canEquip(card, true)) return 0.01;
							const info = get.info(card),
								current = player.getEquip(info.subtype),
								value = current && card != current && get.value(current, player);
							let equipValue = info.ai.equipValue || info.ai.basic.equipValue;
							if (typeof equipValue === 'function') {
								if (method === 'raw') return equipValue(card, player);
								if (method === 'raw2') return equipValue(card, player) - value;
								return Math.max(0.1, equipValue(card, player) - value);
							}
							if (typeof equipValue !== 'number') equipValue = 0;
							if (method === 'raw') return equipValue;
							if (method === 'raw2') return equipValue - value;
							return Math.max(0.1, equipValue - value);
						},
					},
					tag: { valueswap: 1 },
				},
				// 火攻
				huogong: {
					wuxie(target, card, player, viewer, status) {
						if (get.attitude(viewer, player._trueMe || player) > 0) return 0;
						if (status * get.attitude(viewer, target) * get.effect(target, card, player, target) >= 0) return 0;
						if (_status.event.getRand('huogong_wuxie') * 4 > player.countCards('h')) return 0;
					},
					basic: { order: 9.2, value: [3, 1], useful: 0.6 },
					result: {
						player(player) {
							const nh = player.countCards('h');
							if (nh <= player.hp && nh <= 4 && _status.event.name === 'chooseToUse') {
								if (
									typeof _status.event.filterCard === 'function' &&
									_status.event.filterCard(new lib.element.VCard({ name: 'huogong' }), player, _status.event)
								) {
									return -10;
								}
								if (_status.event.skill) {
									let viewAs = get.info(_status.event.skill).viewAs;
									if (viewAs === 'huogong' || viewAs?.name === 'huogong') {
										return -10;
									}
								}
							}
							return 0;
						},
						target(player, target) {
							if (target.hasSkill('huogong2') || target.countCards('h') === 0) return 0;
							if (player.countCards('h') <= 1) return 0;
							if (
								_status.event.player === player &&
								target.isAllCardsKnown(player) &&
								!target.countCards('h', (card) => player.countCards('h', (card2) => get.suit(card2) === get.suit(card)))
							) {
								return 0;
							}
							if (target === player) {
								if (
									typeof _status.event.filterCard === 'function' &&
									_status.event.filterCard(new lib.element.VCard({ name: 'huogong' }), player, _status.event)
								) {
									return -1.15;
								}
								if (_status.event.skill) {
									var viewAs = get.info(_status.event.skill).viewAs;
									if (viewAs === 'huogong' || (viewAs && viewAs.name === 'huogong')) {
										return -1.15;
									}
								}
								return 0;
							}
							/* ★ 火攻目标评估：花色多样性 × 击杀窗口 × 目标手牌状态 × 横置加成 */
							let base = -1.15;

							/* ① 使用者手牌的花色多样性 → 缩放成功率
							 *    1 种花色 → 目标容易避开 → 成功率低
							 *    4 种花色 → 目标无处可躲 → 成功率高
							 *    方向：多样性越高，base 绝对值越大（火攻越值得）
							 */
							try {
								const suitCount = { spade: 0, heart: 0, club: 0, diamond: 0 };
								player.getCards('h').forEach(function (c) {
									const s = get.suit(c);
									if (suitCount[s] !== undefined) suitCount[s]++;
								});
								const uniqueSuits = Object.keys(suitCount).filter(function (k) {
									return suitCount[k] > 0;
								}).length;
								const diversity = uniqueSuits / 4;   // 0.25 ~ 1.0
								base *= (0.7 + 0.3 * diversity);
							} catch (e) {}

							/* ② 击杀窗口：HP=1 时火攻直接带走 */
							const hp = target.hp || 0;
							if (hp <= 1) base -= 2.0;
							else if (hp <= 2) base -= 0.5;

							/* ③ 目标手牌状态：
							 *    手牌少 → 目标展示无选择余地 → 火攻更稳
							 *    手牌多 → 目标可选避开我方花色 → 成功率略降
							 */
							const tgtHand = target.countCards('h');
							if (tgtHand <= 1) base -= 0.3;
							else if (tgtHand >= 4) base += 0.2;

							/* ④ 横置目标：火攻是火焰伤害 → 连锁传导 */
							try {
								if (target.isLinked && target.isLinked()) {
									let enemyLink = 0, allyLink = 0;
									for (const p of (game.players || [])) {
										if (!p || p === target || p === player) continue;
										if (p.alive === false || !p.isLinked || !p.isLinked()) continue;
										try {
											if (p.hasSkillTag('nofire') || p.hasSkillTag('nodamage')) continue;
										} catch (e) {}
										const att = get.attitude(player, p);
										if (att < 0) enemyLink++;
										else if (att > 0) allyLink++;
									}
									/* 火攻 base 是负值（越负越值），敌方横置 → 更负 */
									base -= enemyLink * 0.8;
									base += allyLink * 0.8;
								}
							} catch (eChain) {}

							/* ⑤ 藤甲：火伤 +1，火攻收益提升；青釭剑无视藤甲 */
							try {
								const hasQinggang = !!player.getEquip('qinggang');
								if (!hasQinggang) {
									const hasTengjia = target.getEquips('e').some(function (eq) {
										return get.name(eq) === 'tengjia';
									});
									if (hasTengjia) {
										/* 火攻对藤甲 = 2 点伤害 → 意愿增强 */
										base -= 1.0;
									}
								}
							} catch (e) {}

							/* ⑥ 白银狮子：伤害上限 1 点 → 火攻伤害收益减半 */
							try {
								const hasQinggang = !!player.getEquip('qinggang');
								if (!hasQinggang) {
									const hasBaiyin = target.getEquips('e').some(function (eq) {
										return get.name(eq) === 'baiyin';
									});
									if (hasBaiyin) {
										/* 白银单独存在时无影响，与藤甲同时存在时抵消藤甲加成 */
										const hasTengjia = target.getEquips('e').some(function (eq) {
											return get.name(eq) === 'tengjia';
										});
										if (hasTengjia) base += 0.5;
									}
								}
							} catch (e) {}

							return base;
						},
					},
					tag: { damage: 1, fireDamage: 1, natureDamage: 1, norepeat: 1 },
				},
				// 铁索连环
				tiesuo: {
					wuxie(target, card, player, viewer, status) {
						if (
							status * get.attitude(viewer, player._trueMe || player) > 0 ||
							target.hasSkillTag('noLink') ||
							target.hasSkillTag('nodamage') ||
							target.hasSkillTag('nofire') ||
							target.hasSkillTag('nothunder')
						) {
							return 0;
						}
						if (
							get.damageEffect(target, player, viewer, 'thunder') >= 0 ||
							get.damageEffect(target, player, viewer, 'fire') >= 0
						) {
							return 0;
						}
						if (target.hp + target.hujia > 2 && target.mayHaveShan(viewer, 'use')) {
							return 0;
						}
					},
					basic: {
						order(card, i) {
							if (
								game.countPlayer(
									(current) =>
										!(current.hasSkillTag('noLink') || current.hasSkillTag('nodamage')) &&
										!(current.hasSkillTag('nofire') && current.hasSkillTag('nothunder'))
								) < 2
							) {
								return 0;
							}
							const player = get.event().player;
							/* ★ 统计手里所有属性伤害牌（火攻/闪电/火杀/雷杀/其它带属性 viewAs 的牌） */
							let natureCount = 0;
							try {
								player.getCards('h').forEach(function (c) {
									let hasN = false;
									try {
										const n = get.name(c, player);
										if (n === 'huogong' || n === 'shandian') hasN = true;
										else if (game.hasNature && (game.hasNature(c, 'fire') || game.hasNature(c, 'thunder'))) hasN = true;
										/* 技能 viewAs 的属性杀（如武圣红牌当杀但无属性，不计算；
										 * 火计/炎爆等技能产生的火伤会在此处被 game.hasNature 覆盖） */
									} catch (e) {}
									if (hasN) natureCount++;
								});
							} catch (e) {}
							/* 属性伤害牌越多 → 铁索越值（这是"准备爆发"的核心） */
							if (natureCount >= 2) return 9.5;
							if (natureCount >= 1) return 8.5;
							/* 无属性伤害：作为连锁准备仍有价值，但优先级降低 */
							return 6.5;
						},
						useful: 1.2,
						value: [4, 2],
					},
					result: {
						target(player, target) {
							if (target.hasSkillTag('link') || target.hasSkillTag('noLink')) return 0;
							let curs = game.filterPlayer(
								(current) =>
									!(current.hasSkillTag('noLink') || current.hasSkillTag('nodamage')) &&
									!(current.hasSkillTag('nofire') && current.hasSkillTag('nothunder'))
							);
							if (curs.length < 2) return 0;
							let f = target.hasSkillTag('nofire'),
								t = target.hasSkillTag('nothunder'),
								res = 0.9;
							if ((f && t) || target.hasSkillTag('nodamage')) return 0;
							if (f || t) res = 0.45;
							if (!f && target.getEquip('tengjia')) res *= 2;
							if (!target.isLinked()) res = -res;
							if (ui.selected.targets.length) return res;
							let fs = 0,
								es = 0;
							curs.forEach((i) => {
								const atti = get.attitude(player, i);
								atti > 0 ? fs++ : atti < 0 && es++;
							});
							const att = get.attitude(player, target);
							if ((att <= 0 && es < 2) || (att > 0 && fs < 2)) {
								return 0;
							}

							/* ★ 动态缩放：AI 手里有属性伤害时，横置敌人的价值大幅提升 */
							if (att <= 0 && !target.isLinked()) {
								let hasNature = false;
								try {
									hasNature = player.getCards('h').some(function (c) {
										const n = get.name(c, player);
										if (n === 'huogong' || n === 'shandian') return true;
										if (game.hasNature && (game.hasNature(c, 'fire') || game.hasNature(c, 'thunder'))) return true;
										return false;
									});
								} catch (e) {}
								if (hasNature) {
									/* 横置敌人 + 有属性伤害 → 意愿更强 */
									res *= 1.4;
									/* 已有横置敌人 → 连锁网更大，再加权 */
									let linkedOther = 0;
									for (const p of (game.players || [])) {
										if (!p || p === target || p === player) continue;
										if (!p.isLinked || !p.isLinked()) continue;
										if (get.attitude(player, p) < 0) linkedOther++;
									}
									if (linkedOther > 0) res *= (1 + 0.15 * linkedOther);
								} else {
									/* 无属性伤害 → 横置敌人价值降低（暂时用不上，浪费牌） */
									res *= 0.7;
								}
							}

							return res;
						},
					},
					tag: { multitarget: 1, multineg: 1, norepeat: 1 },
				},
				// 桃
				tao: {
					viewHandcard: true,
					skillTagFilter(player, tag, arg) {
						if (arg && get.attitude(player, arg) <= 0) return false;
						return true;
					},
					basic: {
						order(card, player) {
							return player.hasSkillTag('pretao') ? 9 : 2;
						},
						useful(card, i) {
							const player = _status.event.player;
							if (
								!lib.filter.cardEnabled(card, player, 'forceEnable') ||
								!game.checkMod(card, player, 'unchanged', 'cardEnabled2', player)
							) {
								return 2 / (1 + i);
							}
							let fs = game.filterPlayer((current) => get.attitude(player, current) > 0 && current.hp <= 2),
								damaged = 0,
								needs = 0;
							fs.forEach((f) => {
								if (f.hp > 3 || !lib.filter.cardSavable(card, player, f)) return;
								f.hp > 1 ? damaged++ : needs++;
							});
							if (needs && damaged) return 5 * needs + 3 * damaged;
							if (needs + damaged > 1 || player.hasSkillTag('maixie')) return 8;
							if (player.hp / player.maxHp < 0.7) return 7 + Math.abs(player.hp / player.maxHp - 0.5);
							if (needs) return 7;
							if (damaged) return Math.max(3, 7.8 - i);
							return Math.max(1, 7.2 - i);
						},
						value(card, player) {
							let fs = game.filterPlayer((current) => get.attitude(_status.event.player, current) > 0),
								damaged = 0,
								needs = 0;
							fs.forEach((f) => {
								if (!player.canUse('tao', f)) return;
								f.hp <= 1 ? needs++ : f.hp === 2 && damaged++;
							});
							if ((needs && damaged) || player.hasSkillTag('maixie')) return Math.max(9, 5 * needs + 3 * damaged);
							if (needs || damaged > 1) return 8;
							if (damaged) return 7.5;
							return Math.max(5, 9.2 - player.hp);
						},
					},
					calculatePeachEnough(player, target, excludeCard) {
						if (!target || target !== _status.event.dying) return true;

						let need = Math.max(1, 1 - target.hp);
						if (need <= 0) return true;

						// 统计当前玩家可使用的桃（排除当前牌）
						need -= player.countCards(
							'hs',
							(c) =>
								c !== excludeCard &&
								get.name(c) === 'tao' &&
								lib.filter.cardEnabled(c, player, 'forceEnable') &&
								lib.filter.cardSavable(c, player, target)
						);
						if (need <= 0) return true;

						// 统计濒死者自己的桃酒（排除当前牌）
						if (player !== target) {
							need -= target.countCards('hs', (c) => {
								if (c === excludeCard) return false;
								const name = get.name(c);
								return (name === 'tao' || name === 'jiu') && lib.filter.cardSavable(c, target, target);
							});
							if (need <= 0) return true;
						}

						// 统计其他友方玩家的桃
						const friends = game.filterPlayer((f) => f !== player && f !== target && get.attitude(f, target) > 0);
						for (let f of friends) {
							need -= f.countCards('hs', (c) => get.name(c) === 'tao' && lib.filter.cardEnabled(c, f, 'forceEnable'));
							if (need <= 0) return true;
						}
						return false;
					},
					result: {
						target(player, target, card) {
							const isEnough = lib.card.tao.ai.calculatePeachEnough(player, target, card);
							if (!isEnough) return 0;
							return target.hasSkillTag('maixie') ? 3 : 2;
						},
						target_use(player, target, card) {
							const dyingRole = _status.event.dying;
							if (dyingRole && target === dyingRole) {
								let ownIdentity = player.identity;
								if (
									(ownIdentity === 'zhong' && target.identity === 'zhu') ||
									// (ownIdentity === 'fan' && target.identity === 'fan') ||
									(ownIdentity === 'nei' && target === player)
								) {
									return 10;
								}
							}
							const isEnough = lib.card.tao.ai.calculatePeachEnough(player, target, card);
							if (!isEnough) return 0;
							let mode = get.mode();
							const taos = player.getCards(
								'hs',
								(i) => get.name(i) === 'tao' && lib.filter.cardEnabled(i, target, 'forceEnable')
							);
							if (target !== dyingRole) {
								if (
									!player.isPhaseUsing() ||
									player.needsToDiscard(0, (i) => !player.canIgnoreHandcard(i) && taos.includes(i)) ||
									player.hasSkillTag('nokeep', true, { card, target }, true)
								) {
									return 2;
								}
								let min = 8.1 - (4.5 * player.hp) / player.maxHp,
									nd = player.needsToDiscard(
										0,
										(i) => !player.canIgnoreHandcard(i) && (taos.includes(i) || get.value(i) >= min)
									),
									keep = nd ? 0 : 2;
								if (
									nd > 2 ||
									(taos.length > 1 && (nd > 1 || (nd && player.hp < 1 + taos.length))) ||
									(target.identity === 'zhu' &&
										(nd || target.hp < 3) &&
										(mode === 'identity' || mode === 'versus' || mode === 'chess')) ||
									!player.hasFriend()
								) {
									return 2;
								}
								if (
									game.hasPlayer(
										(current) =>
											player !== current &&
											current.identity === 'zhu' &&
											current.hp < 3 &&
											(mode === 'identity' || mode === 'versus' || mode === 'chess') &&
											get.attitude(player, current) > 0
									)
								) {
									keep = 3;
								} else if (nd === 2 || player.hp < 2) return 2;
								if (nd === 2 && player.hp <= 1) return 2;
								if (keep === 3) return 0;
								if (taos.length <= player.hp / 2) keep = 1;
								if (
									keep &&
									game.countPlayer((current) => {
										if (
											player !== current &&
											current.hp < 3 &&
											player.hp > current.hp &&
											get.attitude(player, current) > 2
										) {
											keep += player.hp - current.hp;
											return true;
										}
										return false;
									}) &&
									keep > 2
								)
									return 0;
								return 2;
							}
							if (target.isZhu2() || target === game.boss) return 2;
							if (player !== target) {
								if (target.hp < 0 && taos.length + target.hp <= 0) return 0;
								if (Math.abs(get.attitude(player, target)) < 1) return 0;
							}
							if (!player.getFriends().length) return 2;
							let tri = _status.event.getTrigger(),
								num = game.countPlayer(
									(current) =>
										get.attitude(current, target) > 0 &&
										current.countCards(
											'hs',
											(i) => get.name(i) === 'tao' && lib.filter.cardEnabled(i, target, 'forceEnable')
										)
								),
								dis = 1,
								t = _status.currentPhase || game.me;
							while (t !== target) {
								const att = get.attitude(player, t);
								att < -2 ? dis++ : att < 1 && (dis += 0.45);
								t = t.next;
							}
							if (mode === 'identity') {
								if (tri && tri.name === 'dying') {
									if (target.identity === 'fan') {
										if (
											(!tri.source && player !== target) ||
											(tri.source && tri.source !== target && player.getFriends().includes(tri.source.identity))
										) {
											return num > dis ||
												(player === target && player.countCards('hs', { type: 'basic' }) > 1.6 * dis)
												? 2
												: 0;
										}
									} else if (
										tri.source &&
										tri.source.isZhu &&
										(target.identity === 'zhong' || target.identity === 'mingzhong') &&
										(tri.source.countCards('he') > 2 ||
											(player === tri.source && player.hasCard((i) => i.name !== 'tao', 'he')))
									) {
										return 2;
									}
								}
								if (
									player.identity === 'zhu' &&
									player.hp <= 1 &&
									player !== target &&
									taos.length + player.countCards('hs', 'jiu') <=
										Math.min(
											dis,
											game.countPlayer((current) => current.identity === 'fan')
										)
								) {
									return 0;
								}
							} else if (
								mode === 'stone' &&
								target.isMin() &&
								player !== target &&
								tri &&
								tri.name === 'dying' &&
								player.side === target.side &&
								tri.source !== target.getEnemy()
							) {
								return 0;
							}
							return 2;
						},
					},
					tag: { recover: 1, save: 1 },
				},
				// 桃园结义
				taoyuan: {
					basic: {
						order(item, player) {
							let allyLoseHp = 0,
								enemyLoseHp = 0;
							game.countPlayer((current) => {
								if (!current.isIn()) return;
								const att = get.attitude(player, current);
								const loseHp = current.getDamagedHp();
								att > 0 ? (allyLoseHp += loseHp) : att < 0 && (enemyLoseHp += loseHp);
							});
							return game.hasPlayer((current) => current.hp <= 1 && get.attitude(player, current) > 0) ||
								allyLoseHp > enemyLoseHp
								? 10
								: 1;
						},
						useful: [3, 1],
						value: 0,
					},
					result: {
						player(player) {
							let allyLoseHp = 0,
								enemyLoseHp = 0;
							game.countPlayer((current) => {
								if (!current.isIn()) return;
								const att = get.attitude(player, current);
								const loseHp = current.getDamagedHp();
								att > 0 ? (allyLoseHp += loseHp) : att < 0 && (enemyLoseHp += loseHp);
							});
							const hasAllyLowHp = game.hasPlayer((current) => current.hp <= 1 && get.attitude(player, current) > 0);
							return hasAllyLowHp || allyLoseHp > enemyLoseHp ? 1 : -1;
						},
						target(player, target) {
							return target.hp < target.maxHp ? 2 : 0;
						},
					},
					tag: { recover: 0.5, multitarget: 1 },
				},
				//杀牌
				sha: {
     basic: {
         useful: [5, 3, 1],
         value: [5, 3, 1],
     },
     result: {
         target(player, target, card, isLink) {
             const hasRenwang = target.getEquips('e').some(equip => get.name(equip) === 'renwang');
             const hasQinggang = !!player.getEquip('qinggang');
             const isBlackSha = get.color(card) === 'black';
             if (hasRenwang && !hasQinggang && isBlackSha) {
                 return 0;
             }

             /* ★ 藤甲：普通伤害免疫，火伤 +1，雷伤正常
              *   - 普通杀 → 0（无效）
              *   - 火杀 → eff 额外 -1（多打 1 点）
              *   - 雷杀 → 正常
              *   青釭剑无视防具，跳过此检查 */
             let tengjiaFireBonus = 0;
             try {
                 /* 优先用本体 API；兜底字符串比较 */
                 let hasTengjia = false;
                 try {
                     hasTengjia = target.hasSkillTag && target.hasSkillTag('tengjia');
                 } catch (e) {}
                 if (!hasTengjia) {
                     try {
                         hasTengjia = target.getCards('e').some(function (eq) {
                             return get.name(eq) === 'tengjia';
                         });
                     } catch (e) {}
                 }
                 if (hasTengjia && !hasQinggang) {
                     const natures = game.natureList ? game.natureList(card) : [];
                     const isFire = natures.indexOf('fire') >= 0;
                     const isThunder = natures.indexOf('thunder') >= 0;
                     if (isFire) {
                         tengjiaFireBonus = -1;   // 火伤 +1 → 更值
                     } else if (!isThunder) {
                         return 0;                 // 普通伤害 → 无效
                     }
                 }
             } catch (e) {}

             let eff = -1.5,
                 odds = 1.35,
                 num = 1;
             eff += tengjiaFireBonus;
             if (isLink) {
                 eff = isLink.eff || -2;
                 odds = isLink.odds || 0.65;
                 num = isLink.num || 1;
                 if (
                     num > 1 &&
                     target.hasSkillTag("filterDamage", null, {
                         player: player,
                         card: card,
                         jiu: player.hasSkill("jiu"),
                     })
                 ) {
                     num = 1;
                 }
                 return odds * eff * num;
             }
            /* ★ 击杀奖励：对敌方 HP ≤ 1 的目标，杀的价值大幅提升。
             * 击杀价值 = 1 点伤害 + 战略收益（去掉一个敌人 + 概率带走他的手牌）。
             * 下游用 attitude × eff 求收益，敌方 attitude 为负 → eff 更负 = 收益更大。 */
            const att = get.attitude(player, target);
            const hp = target.hp || 0;
            if (att < 0) {
                if (hp <= 1) eff -= 2.0;      // HP=1：击杀窗口
                else if (hp <= 2) eff -= 0.7; // HP=2：接近击杀（酒杀/连环可斩）
            }
            /* 友方目标：误伤惩罚已经在 ai.effect 里处理，这里不额外加 */
             if (
                 player.hasSkill("jiu") ||
                 player.hasSkillTag("damageBonus", true, {
                     target: target,
                     card: card,
                 })
             ) {
                 if (
                     target.hasSkillTag("filterDamage", null, {
                         player: player,
                         card: card,
                         jiu: player.hasSkill("jiu"),
                     })
                 ) {
                     eff = -0.5;
                 } else {
                     num = 2;
                     eff = get.attitude(player, target) > 0 ? -7 : -4;
                 }
             }
             if (
                 !player.hasSkillTag(
                     "directHit_ai",
                     true,
                     { target: target, card: card },
                     true
                 )
             ) {
                 odds -= 0.7 * target.mayHaveShan(player, "use", true, "odds");
             }

             /* ★ 白银狮子：伤害上限 1 点（大于 1 的伤害降到 1）
              *   青釭剑无效白银（无视防具）
              *   → 酒杀/属性杀的加成被抵消 */
             try {
                 const hasBaiyin = target.getEquips('e').some(function (eq) {
                     return get.name(eq) === 'baiyin';
                 });
                 if (hasBaiyin && !hasQinggang) {
                     /* 当前 eff 已包含伤害收益（-1.5 或 -4 等），
                      * 白银把高伤害压成 1 → 收益向 -1.5 靠拢 */
                     if (eff < -2.0) {
                         eff = (eff + (-1.5)) / 2;
                     }
                 }
             } catch (e) {}

             const __result = odds * eff;
             try {
                 const parts = [];
                 if (att < 0 && hp <= 1) parts.push('击杀窗口');
                 else if (att < 0 && hp <= 2) parts.push('接近击杀');
                 if (hasRenwang) parts.push('仁王');
                 if (tengjiaFireBonus < 0) parts.push('藤甲+火');
                 if (hasQinggang) parts.push('青釭');
                 _exposeOverride('sha', eff,
                     'sha.target' + (parts.length ? ': ' + parts.join('/') : '') +
                     '（' + __result.toFixed(2) + '）', 1.2);
             } catch (e) {}
             return __result;
         },
     },
     tag: {
         respond: 1,
         respondShan: 1,
         damage(card) {
             if (game.hasNature(card, "poison")) return;
             return 1;
         },
         natureDamage(card) {
             if (game.hasNature(card, "linked")) return 1;
         },
         fireDamage(card) {
             if (game.hasNature(card, "fire")) return 1;
         },
         thunderDamage(card) {
             if (game.hasNature(card, "thunder")) return 1;
         },
         poisonDamage(card) {
             if (game.hasNature(card, "poison")) return 1;
         },
     },
 },
 
 // ============ 南蛮入侵（身份局不误伤队友） ============
 nanman: {
     ...(lib.card.nanman.ai || {}),
     wuxie(target, card, player, viewer, status) {
         if (get.attitude(viewer, player._trueMe || player) > 0) return 0;
         if (get.attitude(viewer, target) > 0) {
             if (target.countCards('hs', 'sha') > 0) return 0;
         }
     },
     basic: {
        order(item, player) {
            /* 加 HP 加权：HP=1 的友方风险权重 3，满血敌人收益权重 1 */
            let allyRisk = 0, enemyGain = 0;
            game.countPlayer(function (cur) {
                if (!cur.isIn()) return;
                if (cur.countCards("hs", "sha") > 0) return;   // 有杀 → 消耗一张，不计风险/收益
                const hp = cur.hp || 0;
                const w = hp <= 1 ? 3 : (hp <= 2 ? 2 : 1);
                const att = get.attitude(player, cur);
                if (att > 0 && cur !== player) allyRisk += w;
                else if (att < 0) enemyGain += w;
            });
            /* 自身风险（南蛮也打自己） */
            if (player.countCards("hs", "sha") === 0) {
                const hp = player.hp || 0;
                allyRisk += hp <= 1 ? 3 : (hp <= 2 ? 2 : 1);
            }
            const net = enemyGain - allyRisk;
            if (net >= 3) return 9;      // 大赚
            if (net >= 1) return 6;      // 小赚
            if (net <= -2) return 1;     // 亏本：压制优先级
            return 3;                    // 均势
        },
         useful: [3, 1],
         value: 4,
     },
     result: {
         player(player) {
             let mine = 0, theirs = 0;
             game.countPlayer(function (cur) {
                 if (!cur.isIn()) return;
                 if (cur.countCards('hs', 'sha') > 0) return;   // 有杀 → 打出，不受伤
                 const hp = cur.hp || 0;
                 const w = hp <= 1 ? 3 : (hp <= 2 ? 2 : 1.5);
                 if (get.attitude(player, cur) < 0) theirs += w;
                 else mine += w;    // 含玩家自身（原代码漏算）
             });
             return theirs - mine;
         },
         target(player, target) {
             if (target.hasSkillTag('nodamage')) return 0;
             /* ★ 藤甲：南蛮是普通伤害 → 无效 */
             try {
                 /* 优先用本体 API；兜底字符串比较 */
                 let hasTengjia = false;
                 try {
                     hasTengjia = target.hasSkillTag && target.hasSkillTag('tengjia');
                 } catch (e) {}
                 if (!hasTengjia) {
                     try {
                         hasTengjia = target.getCards('e').some(function (eq) {
                             return get.name(eq) === 'tengjia';
                         });
                     } catch (e) {}
                 }
                 if (hasTengjia) return 0;
             } catch (e) {}
             /* 从 target 视角，南蛮=伤害（负收益）。不区分敌友——
              * 方向由下游 × attitude 处理：
              *   敌方没杀 → 负值 × 负态度 = 正收益 ✅
              *   友方没杀 → 负值 × 正态度 = 负收益 ✅（避让）
              * HP 加权让 AI 区分"灭队级"和"轻微误伤"。 */
             if (target.countCards('hs', 'sha') > 0) return -0.3;
             const hp = target.hp || 0;
             const __result = hp <= 1 ? -3 : (hp <= 2 ? -2 : -1.5);
             try {
                 _exposeOverride('nanman', __result,
                     'nanman.target HP=' + hp + (target.countCards('hs','sha') > 0 ? '/有杀' : ''),
                     1.0);
             } catch (e) {}
             return __result;
         },
     },
     tag: { damage: 1, multitarget: 1, respondSha: 1 },
 },

 // ============ 万箭齐发 ============
 wanjian: {
     ...(lib.card.wanjian.ai || {}),
     basic: {
         order(item, player) {
             let allyRisk = 0, enemyGain = 0;
             game.countPlayer(function (cur) {
                 if (!cur.isIn()) return;
                 if (cur.countCards('hs', 'shan') > 0) return;
                 const hp = cur.hp || 0;
                 const w = hp <= 1 ? 3 : (hp <= 2 ? 2 : 1);
                 const att = get.attitude(player, cur);
                 if (att > 0 && cur !== player) allyRisk += w;
                 else if (att < 0) enemyGain += w;
             });
             if (player.countCards('hs', 'shan') === 0) {
                 const hp = player.hp || 0;
                 allyRisk += hp <= 1 ? 3 : (hp <= 2 ? 2 : 1);
             }
             const net = enemyGain - allyRisk;
             if (net >= 3) return 9;
             if (net >= 1) return 6;
             if (net <= -2) return 1;
             return 3;
         },
         useful: [3, 1],
         value: 4,
     },
     result: {
         player(player) {
             let mine = 0, theirs = 0;
             game.countPlayer(function (cur) {
                 if (!cur.isIn()) return;
                 if (cur.countCards('hs', 'shan') > 0) return;
                 const hp = cur.hp || 0;
                 const w = hp <= 1 ? 3 : (hp <= 2 ? 2 : 1.5);
                 if (get.attitude(player, cur) < 0) theirs += w;
                 else mine += w;
             });
             return theirs - mine;
         },
         target(player, target) {
             if (target.hasSkillTag('nodamage')) return 0;
             /* ★ 藤甲：万箭是普通伤害 → 无效 */
             try {
                 /* 优先用本体 API；兜底字符串比较 */
                 let hasTengjia = false;
                 try {
                     hasTengjia = target.hasSkillTag && target.hasSkillTag('tengjia');
                 } catch (e) {}
                 if (!hasTengjia) {
                     try {
                         hasTengjia = target.getCards('e').some(function (eq) {
                             return get.name(eq) === 'tengjia';
                         });
                     } catch (e) {}
                 }
                 if (hasTengjia) return 0;
             } catch (e) {}
             if (target.countCards('hs', 'shan') > 0) return -0.3;
             const hp = target.hp || 0;
             const __result = hp <= 1 ? -3 : (hp <= 2 ? -2 : -1.5);
             try {
                 _exposeOverride('wanjian', __result,
                     'wanjian.target HP=' + hp + (target.countCards('hs','shan') > 0 ? '/有闪' : ''),
                     1.0);
             } catch (e) {}
             return __result;
         },
     },
     tag: { damage: 1, multitarget: 1, respondShan: 1 },
 },

 // ============ 借刀杀人 ============
 jiedao: {
     ...(lib.card.jiedao.ai || {}),
     basic: {
         order(item, player) {
             /* 基础 order */
             let order = 5.5;
             try {
                 /* 敌方有武器且血量低 → 借刀价值高 */
                 let bestTargetVal = 0;
                 game.countPlayer(function (cur) {
                     if (!cur || cur === player || cur.alive === false) return;
                     if (get.attitude(player, cur) >= 0) return;   /* 只借敌人 */
                     const hasWeapon = cur.getCards('e').some(function (e) {
                         try {
                             const subs = get.subtypes(e);
                             return subs && subs.indexOf('equip1') >= 0;
                         } catch (e) { return false; }
                     });
                     if (!hasWeapon) return;
                     if (cur.countCards('hs', 'sha') === 0) return;
                     let val = 1;
                     try {
                         const hp = cur.hp || 0;
                         if (hp <= 2) val += 1;
                         const wpn = cur.getEquip('equip1');
                         const wnm = wpn ? get.name(wpn) : '';
                         if (wnm === 'zhuge') val += 1.5;
                         else if (wnm === 'qinglong' || wnm === 'qilin') val += 0.8;
                     } catch (e) {}
                     if (val > bestTargetVal) bestTargetVal = val;
                 });
                 if (bestTargetVal === 0) return 1;   /* 无合适目标 → 压到最低 */
                 order += bestTargetVal * 0.5;
             } catch (e) {}
             return order;
         },
         useful: [2, 1],
         value: 3,
     },
     result: {
         player(player) {
             /* 整体评估：能否形成"借敌之刀"的收益 */
             let enemyWithWeaponAndSha = 0;
             let enemyWeaponValue = 0;
             game.countPlayer(function (cur) {
                 if (!cur || cur === player || cur.alive === false) return;
                 if (get.attitude(player, cur) >= 0) return;
                 const hasWeapon = cur.getCards('e').some(function (e) {
                     try {
                         const subs = get.subtypes(e);
                         return subs && subs.indexOf('equip1') >= 0;
                     } catch (e) { return false; }
                 });
                 if (!hasWeapon) return;
                 if (cur.countCards('hs', 'sha') === 0) return;
                 enemyWithWeaponAndSha++;
                 try {
                     const wpn = cur.getEquip('equip1');
                     if (wpn) {
                         const v = get.equipValue(wpn, cur) || get.value(wpn, cur) || 0;
                         enemyWeaponValue += v;
                     }
                 } catch (e) {}
             });
             if (enemyWithWeaponAndSha === 0) return -2;
             let score = enemyWithWeaponAndSha * 1.5;
             score += Math.min(2, enemyWeaponValue * 0.1);
             return score;
         },
         target(player, target) {
             const att = get.attitude(player, target);
             /* 友方 / 中立：不借（避免消耗队友资源或招惹中立） */
             if (att >= 0) return 0;
             /* 敌方：检查是否值得借 */
             const hasWeapon = target.getCards('e').some(function (e) {
                 try {
                     const subs = get.subtypes(e);
                     return subs && subs.indexOf('equip1') >= 0;
                 } catch (e) { return false; }
             });
             if (!hasWeapon) return 0;
             if (target.countCards('hs', 'sha') === 0) return 0;

             /* 从 target 视角：被借刀是负收益（消耗杀或失去武器） */
             let base = -1.5;
             try {
                 const wpn = target.getEquip('equip1');
                 if (wpn) {
                     const wnm = get.name(wpn) || '';
                     if (wnm === 'zhuge') base -= 1.5;         /* 连弩最贵 */
                     else if (wnm === 'qinglong') base -= 0.8;  /* 青龙刀 */
                     else if (wnm === 'qilin') base -= 0.6;     /* 麒麟弓 */
                     else if (wnm === 'qinggang') base -= 0.5;  /* 青釭剑 */
                 }
             } catch (e) {}

             /* 目标手里杀少 → 陷入"杀队友还是失武器"两难 → 更负 */
             const shaN = target.countCards('hs', 'sha');
             if (shaN === 1) base -= 0.5;
             else if (shaN >= 3) base += 0.3;   /* 杀多 → 可以放弃杀保武器 */

             return base;
         },
     },
     tag: { loseCard: 1, respondSha: 1 },
 },

 // ============ 乐不思蜀 ============
 lebu: {
     ...(lib.card.lebu.ai || {}),
     basic: {
         order(item, player) {
             /* ★ 尊重本体 order：以本体值为基准，叠加残局倍率 */
             let base = 5.5;
             try {
                 const orig = lib.card.lebu.ai && lib.card.lebu.ai.basic && lib.card.lebu.ai.basic.order;
                 if (typeof orig === 'function') {
                     const v = orig(item, player);
                     if (typeof v === 'number' && v > 0) base = v;
                 }
             } catch (e) {}
             const alive = (game.players || []).filter(function (p) { return p.alive !== false; }).length;
             const endgameMul = alive <= 4 ? 1.6 : (alive <= 6 ? 1.25 : 1.0);
             return base * endgameMul;
         },
         useful: [2, 1],
         value: 3,
     },
     result: {
         player(player) {
             /* 使用者视角：敌方被乐是收益，友方被乐是损失 */
             let score = 0;
             for (const p of (game.players || [])) {
                 if (!p || p === player || p.alive === false) continue;
                 const att = get.attitude(player, p);
                 if (att < 0) {
                     const hc = p.countCards ? p.countCards('h') : 0;
                     const hp = p.hp || 0;
                     /* 手牌多 + 血多 = 被跳出牌损失大 */
                     score += (1.5 + Math.min(1, hc * 0.1) + hp * 0.1) * 2;
                 } else if (att > 0) {
                     score -= 1.5;   /* 友方被乐是纯损失 */
                 }
             }
             return score;
         },
         target(player, target) {
             /* 被乐对被乐者总是负收益（方向由 attitude 在下游判定） */
             if (target.hasSkillTag && target.hasSkillTag('nodamage')) return 0;
             let resist = 0;
             try {
                 /* 自身有改判能力 */
                 if (target.hasSkill && (target.hasSkill('guicai') || target.hasSkill('guidao'))) {
                     resist += 0.4;
                 }
                 /* 目标的盟友中有改判者 */
                 for (const p of (game.players || [])) {
                     if (!p || p === target || p.alive === false) continue;
                     if (get.attitude(p, target) > 0 && p.hasSkill &&
                         (p.hasSkill('guicai') || p.hasSkill('guidao'))) {
                         resist += 0.3;
                         break;
                     }
                 }
             } catch (e) {}
             const base = 1.5 * Math.max(0.3, 1 - resist);
             /* 手牌多的目标被乐损失更大 */
             const hc = target.countCards ? target.countCards('h') : 0;
             return -(base + Math.min(0.5, hc * 0.1));
         },
     },
     tag: { judge: 1 },
 },

 // ============ 兵粮寸断 ============
 bingliang: {
     ...(lib.card.bingliang.ai || {}),
     basic: {
         order(item, player) {
             /* ★ 尊重本体 order：以本体值为基准，叠加残局倍率 */
             let base = 4.5;
             try {
                 const orig = lib.card.bingliang.ai && lib.card.bingliang.ai.basic && lib.card.bingliang.ai.basic.order;
                 if (typeof orig === 'function') {
                     const v = orig(item, player);
                     if (typeof v === 'number' && v > 0) base = v;
                 }
             } catch (e) {}
             const alive = (game.players || []).filter(function (p) { return p.alive !== false; }).length;
             const endgameMul = alive <= 4 ? 1.4 : (alive <= 6 ? 1.15 : 1.0);
             return base * endgameMul;
         },
         useful: [2, 1],
         value: 2.5,
     },
     result: {
         player(player) {
             let score = 0;
             for (const p of (game.players || [])) {
                 if (!p || p === player || p.alive === false) continue;
                 const att = get.attitude(player, p);
                 if (att < 0) {
                     /* 敌方手牌少时跳摸牌收益降低（本来就不缺牌）；
                      * 手牌多时收益高（断了补给线） */
                     const hc = p.countCards ? p.countCards('h') : 0;
                     score += (0.8 + Math.min(0.8, (5 - hc) * 0.1)) * 2;
                 } else if (att > 0) {
                     score -= 1.0;
                 }
             }
             return score;
         },
         target(player, target) {
             if (target.hasSkillTag && target.hasSkillTag('nodamage')) return 0;
             let resist = 0;
             try {
                 if (target.hasSkill && (target.hasSkill('guicai') || target.hasSkill('guidao'))) {
                     resist += 0.4;
                 }
                 for (const p of (game.players || [])) {
                     if (!p || p === target || p.alive === false) continue;
                     if (get.attitude(p, target) > 0 && p.hasSkill &&
                         (p.hasSkill('guicai') || p.hasSkill('guidao'))) {
                         resist += 0.3;
                         break;
                     }
                 }
             } catch (e) {}
             const base = 1.0 * Math.max(0.3, 1 - resist);
             return -base;
         },
     },
     tag: { judge: 1 },
 },

// ============ 决斗 ============
juedou: {
    ...(lib.card.juedou.ai || {}),
    basic: {
        order(item, player) {
            /* ★ 尊重本体 order：以本体值为基准，叠加扩展加成 */
            let base = 4.5;
            try {
                const orig = lib.card.juedou.ai && lib.card.juedou.ai.basic && lib.card.juedou.ai.basic.order;
                if (typeof orig === 'function') {
                    const v = orig(item, player);
                    if (typeof v === 'number' && v > 0) base = v;
                }
            } catch (e) {}
            /* 叠加扩展的动态加成 */
            try {
                const hasLowHpEnemy = game.hasPlayer(function (p) {
                    if (!p || p === player || p.alive === false) return false;
                    if (get.attitude(player, p) >= 0) return false;
                    return (p.hp || 0) <= 1;
                });
                if (hasLowHpEnemy && player.countCards('hs', 'sha') > 0) base += 3;
                if (player.countCards('hs', 'sha') === 0) base -= 2.5;
            } catch (e) {}
            return base;
        },
        useful: [4, 2],
        value: [4, 2],
    },
    result: {
        player(player) {
            /* 使用者视角：自己手里的杀决定决斗胜率 */
            const mySha = player.countCards('hs', 'sha');
            /* 无杀 → 决斗立刻输（对手出杀后就轮到自己出杀，出不起） */
            if (mySha === 0) return -1;

            /* 手里杀多 → 决斗赢面大 */
            let score = 1 + Math.min(2, mySha * 0.3);

            /* 击杀窗口：敌方 HP ≤ 1 → 一次决斗必杀 */
            try {
                const hasLowHpEnemy = game.hasPlayer(function (p) {
                    if (!p || p === player || p.alive === false) return false;
                    if (get.attitude(player, p) >= 0) return false;
                    return (p.hp || 0) <= 1;
                });
                if (hasLowHpEnemy) score += 3;
            } catch (e) {}

            /* 自身 HP 低 → 决斗可能反噬（决斗输了受伤） */
            try {
                if ((player.hp || 0) <= 2) score -= 1.5;
                else if ((player.hp || 0) <= 3) score -= 0.5;
            } catch (e) {}

            return score;
        },
        target(player, target) {
            const att = get.attitude(player, target);
            const tgtSha = target.countCards('hs', 'sha');
            const tgtHand = target.countCards('h');
            const hp = target.hp || 0;

            /* 从 target 视角：被决斗是负收益（伤害）*/
            let base = -1.5;
            if (tgtSha === 0 && tgtHand <= 2) {
                /* 手里基本没牌且没杀 → 决斗几乎必成 */
                base = -3;
            } else if (tgtSha === 0) {
                /* 没杀但有其它牌 → 决斗仍会成，但对手可能用其它方式应对 */
                base = -2.3;
            } else if (tgtSha >= 2) {
                /* 手里杀多 → 决斗可能被反杀 */
                base = -1.0;
            }

            /* ③ 血量修正：HP ≤ 1 时决斗是必杀 */
            if (hp <= 1) base -= 1.5;
            else if (hp <= 2) base -= 0.5;

            return base;
        },
    },
    tag: { damage: 1, respondSha: 1 },
},

// ============ 无中生有 ============
wuzhong: {
    ...(lib.card.wuzhong.ai || {}),
    basic: {
        order(item, player) {
            /* 手牌少 → 无中价值高 */
            const handN = player.countCards ? player.countCards('h') : 0;
            if (handN <= 2) return 9.0;
            if (handN <= 4) return 7.5;
            return 6.0;
        },
        useful: [4, 2],
        value: 5,
    },
    result: {
        player(player) {
            /* 纯收益牌，对自己总是正收益 */
            const handN = player.countCards ? player.countCards('h') : 0;
            /* 手牌越少收益越高 */
            return 3.0 + Math.max(0, 4 - handN);
        },
    },
    tag: { drawCard: 1 },
},

// ============ 五谷丰登 ============
wugu: {
    ...(lib.card.wugu.ai || {}),
    basic: {
        order(item, player) {
            /* 友方多 → 五谷价值高 */
            let allyN = 0;
            for (const p of (game.players || [])) {
                if (!p || p === player || p.alive === false) continue;
                if (get.attitude(player, p) > 0) allyN++;
            }
            if (allyN >= 3) return 8.0;
            if (allyN >= 1) return 6.5;
            return 4.0;
        },
        useful: [3, 1],
        value: 3,
    },
    result: {
        player(player) {
            let score = 0;
            for (const p of (game.players || [])) {
                if (!p || p === player || p.alive === false) continue;
                const att = get.attitude(player, p);
                if (att > 0) score += 1.5;   /* 友方摸牌是收益 */
                else if (att < 0) score -= 0.8;  /* 敌方摸牌是损失 */
            }
            return score;
        },
    },
    tag: { drawCard: 1 },
},

// ============ 闪电 ============
shandian: {
    ...(lib.card.shandian.ai || {}),
    basic: {
        order(item, player) {
            /* 残局闪电价值高（人少容易劈到关键人物） */
            const alive = (game.players || []).filter(function (p) { return p.alive !== false; }).length;
            if (alive <= 4) return 5.0;
            return 2.5;
        },
        useful: [1, 0],
        value: 2,
    },
    result: {
        player(player) {
            /* 闪电是高风险牌，对自己也是负收益 */
            return -1.0;
        },
        target(player, target) {
            /* 闪电对目标是高风险（负收益） */
            if (target.hasSkillTag && target.hasSkillTag('nodamage')) return 0;
            /* 目标有改判技能 → 风险降低 */
            let resist = 0;
            try {
                if (target.hasSkill && (target.hasSkill('guicai') || target.hasSkill('guidao'))) {
                    resist += 0.6;
                }
            } catch (e) {}
            return -2.0 * Math.max(0.3, 1 - resist);
        },
    },
    tag: { judge: 1, thunderDamage: 1 },
},

// ============ 酒 ============
jiu: {
    ...(lib.card.jiu.ai || {}),
    basic: {
        order(item, player) {
            /* ★ 尊重本体 order：以本体值为基准，叠加扩展加成 */
            let base = 2;
            try {
                const orig = lib.card.jiu.ai && lib.card.jiu.ai.basic && lib.card.jiu.ai.basic.order;
                if (typeof orig === 'function') {
                    const v = orig(item, player);
                    if (typeof v === 'number' && v > 0) base = v;
                }
            } catch (e) {}
            /* 叠加扩展的动态加成 */
            try {
                const hasZhuge = !!player.getEquip('zhuge');
                const shaN = player.countCards('hs', 'sha');
                if (hasZhuge && shaN >= 2) base += 2.5;
                else if (hasZhuge && shaN >= 1) base += 1.0;
            } catch (e) {}
            try {
                if (player.countCards('hs', 'sha') === 1) base += 0.8;
            } catch (e) {}
            return base;
        },
        useful: [4, 2],
        value: 3,
    },
    result: {
        player(player) {
            /* 使用者视角：喝酒后能不能形成有效输出 */
            let score = 0;

            /* ① 击杀窗口：敌方有 HP≤2 的目标，酒杀一发改 2 点 */
            try {
                const hasLowHpEnemy = game.hasPlayer(function (p) {
                    if (!p || p === player || p.alive === false) return false;
                    if (get.attitude(player, p) >= 0) return false;
                    return (p.hp || 0) <= 2;
                });
                if (hasLowHpEnemy) score += 3;
            } catch (e) {}

            /* ② 连弩加持：有连弩时酒价值更高（后续可连续输出） */
            try {
                if (player.getEquip('zhuge') && player.countCards('hs', 'sha') >= 2) {
                    score += 2;
                }
            } catch (e) {}

            /* ③ 唯一杀：手里只有 1 张杀，酒增值 */
            try {
                if (player.countCards('hs', 'sha') === 1) score += 1;
            } catch (e) {}

            /* ④ 手里无杀：酒的进攻价值为零，但保留有自救价值 → 返回 0 */
            try {
                if (player.countCards('hs', 'sha') === 0) score -= 3;
            } catch (e) {}

            return score;
        },
        target(player, target) {
            if (target.hasSkillTag('nodamage')) return 0;
            const att = get.attitude(player, target);
            /* 从 target 视角：被酒杀伤害翻倍 */
            const hp = target.hp || 0;
            if (att < 0) {
                /* 敌方：HP 越低，酒杀威胁越大 */
                if (hp <= 1) return -4;
                if (hp <= 2) return -2.5;
                return -1.5;
            }
            /* 友方：误伤加重 */
            return -1.5;
        },
    },
    tag: { damage: 1, buff: 1 },
},


			};

			Object.keys(optimizeCards).forEach((cardName) => {
				if (!lib.card[cardName]) return;
				const orig = lib.card[cardName].ai || {};
				const over = optimizeCards[cardName] || {};
				const merged = { ...orig, ...over };
				/* basic / result / tag 做「浅合并」而不是整体替换：
				 * 保留本体未被覆盖的子键，让本体的动态策略继续生效——
				 * 例如 sha.basic.order（本体为连弩/武圣/龙胆等动态调整优先级）、
				 *      tao.result.target_use（本体对濒死救援的身份判定）。 */
				['basic', 'result', 'tag'].forEach(function (k) {
					if (over[k] && orig[k] &&
						typeof orig[k] === 'object' && !Array.isArray(orig[k]) &&
						typeof over[k] === 'object' && !Array.isArray(over[k])) {
						merged[k] = { ...orig[k], ...over[k] };
					}
				});
				lib.card[cardName].ai = merged;
			});

			// 打印加载日志
			const loadedCards = Object.keys(optimizeCards).map((cardId) => ({
				cardId: cardId,
				cardName: get.translation(cardId) || cardId,
			}));
			console.log('[AI出牌逻辑] 卡牌优化加载完成：', loadedCards);
		},
	};
	lib.skill._aiyh_cardAiOpt_guohe = {
		trigger: {
			player: 'chooseToUse',
		},
		filter(event, player) {
			return event.card?.name === 'guohe' && get.mode() === 'identity' && player !== game.me;
		},
		silent: true,
		charlotte: true,
		superCharlotte: true,
		async content(event, trigger, player) {
			player.storage.guohe_viewhand = game.players;
			player
				.when('useCardEnd')
				.filter((evt) => evt.card?.name === 'guohe')
				.step(async () => {
					delete player.storage.guohe_viewhand;
				});
		},
		ai: {
			viewHandcard: true,
			skillTagFilter(player, tag, arg) {
				if (player.storage.guohe_viewhand?.includes(arg)) {
					return get.attitude(player, arg) <= 0;
				}
				return false;
			},
		},
	};
}
