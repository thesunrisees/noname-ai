/* ================= 卡牌优化器 · 覆写信号暴露 =================
 * 作用：hook 各牌的 result.target，在原函数返回后写入 __djsc_override
 * 让 bestAction 能读到 optimization 的精细评分
 */
import { lib, game, ui, get, ai, _status } from '../../../noname.js';
import { log } from '../core/logger.js';
import { suitRemaining } from '../card/deckMemory.js';
import { lebuEscapeRate, bingliangEscapeRate, shandianHitRate, cardRarity } from '../card/deckPredict.js';

/* ================= 暴露函数 ================= */
function _exposeOverride(cardId, score, reason, weight, player) {
    try {
        if (!lib.card || !lib.card[cardId]) return;
        lib.card[cardId].__djsc_override = {
            score: score,
            reason: reason || '',
            weight: weight || 1.2,
            player: player ? (player.name1 || player.name || '?') : null,
            ts: Date.now(),
        };
    } catch (e) {}
}

/* ================= Hook 各牌 result.target ================= */
const HOOKED_CARDS = [
    { id: 'wanjian', weight: 1.0, reason: '万箭齐发' },
    { id: 'huogong', weight: 1.2, reason: '火攻' },
    { id: 'tao', weight: 1.5, reason: '桃' },
    { id: 'juedou', weight: 1.2, reason: '决斗' },
    { id: 'shunshou', weight: 1.2, reason: '顺手牵羊' },
    { id: 'guohe', weight: 1.2, reason: '过河拆桥' },
    { id: 'nanman', weight: 1.0, reason: '南蛮入侵' },
    { id: 'sha', weight: 1.2, reason: '杀' },
    { id: 'jiu', weight: 1.0, reason: '酒' },
    { id: 'lebu', weight: 1.0, reason: '乐不思蜀' },
    { id: 'bingliang', weight: 1.0, reason: '兵粮寸断' },
];

function installOptimizationHooks() {
    try {
        HOOKED_CARDS.forEach(function (cfg) {
            const cardMeta = lib.card && lib.card[cfg.id];
            if (!cardMeta) return;
            if (!cardMeta.result) cardMeta.result = {};
            if (cardMeta.result.__djsc_hooked) return;

            const origTarget = cardMeta.result.target;
            if (typeof origTarget !== 'function') return;

            cardMeta.result.target = function (player, target) {
                try {
                    const result = origTarget.call(this, player, target);

                    /* ★ 桃特殊处理：只在真有救援价值时给分 */
                    if (cfg.id === 'tao') {
                        let score = 0;
                        const dying = _status.event && _status.event.dying;
                        if (dying && dying === target) score = 5.0;
                        else if (target === player) score = 1.5;
                        else if (get.attitude(player, target) > 0) score = 1.0;
                        _exposeOverride(cfg.id, score, cfg.reason + '.' + (dying === target ? 'dying' : 'normal'), cfg.weight, player);
                        return result;
                    }

                    /* ★ 南蛮/万箭残局阈值 */
                    if (cfg.id === 'nanman' || cfg.id === 'wanjian') {
                        let score = (typeof result === 'number') ? result : 0;

                        /* 藤甲：AOE 无效 */
                        try {
                            let hasTengjia = false;
                            try { hasTengjia = target.hasSkillTag && target.hasSkillTag('tengjia'); } catch (e) {}
                            if (!hasTengjia) {
                                try {
                                    hasTengjia = target.getCards('e').some(function (eq) {
                                        return get.name(eq) === 'tengjia';
                                    });
                                } catch (e) {}
                            }
                            if (hasTengjia) {
                                _exposeOverride(cfg.id, 0, cfg.reason + '.tengjia', cfg.weight, player);
                                return 0;
                            }
                        } catch (e) {}

                        /* 残局倍率：场上 ≤4 人时，AOE 伤害的边际价值大幅提升 */
                        try {
                            const alive = (game.players || []).filter(function (p) {
                                return p && p.alive !== false;
                            }).length;
                            let threshold = 1.0;
                            if (alive <= 2) threshold = 1.8;
                            else if (alive <= 4) threshold = 1.4;
                            else if (alive <= 6) threshold = 1.15;
                            score = score * threshold;
                        } catch (e) {}

                        score = Math.round(score * 100) / 100;
                        _exposeOverride(cfg.id, score, cfg.reason + '.endgame', cfg.weight, player);
                        return score;
                    }

                    /* ★ 乐不思蜀：牌堆感知逃脱率 */
                    if (cfg.id === 'lebu') {
                        let score = (typeof result === 'number') ? result : 0;
                        const escape = lebuEscapeRate();
                        const escapeMul = 1 + (0.25 - escape) * 1.6;
                        score = score * escapeMul;
                        score = Math.round(score * 100) / 100;
                        _exposeOverride(cfg.id, score, cfg.reason + '.逃脱率' + Math.round(escape * 100) + '%', cfg.weight, player);
                        return score;
                    }

                    /* ★ 兵粮寸断：牌堆感知逃脱率 */
                    if (cfg.id === 'bingliang') {
                        let score = (typeof result === 'number') ? result : 0;
                        const escape = bingliangEscapeRate();
                        const escapeMul = 1 + (0.25 - escape) * 1.6;
                        score = score * escapeMul;
                        score = Math.round(score * 100) / 100;
                        _exposeOverride(cfg.id, score, cfg.reason + '.逃脱率' + Math.round(escape * 100) + '%', cfg.weight, player);
                        return score;
                    }

                    /* ★ 闪电：牌堆感知命中率 */
                    if (cfg.id === 'shandian') {
                        let score = (typeof result === 'number') ? result : 0;
                        const hitRate = shandianHitRate();
                        const hitMul = 1 + (hitRate - 0.1) * 3;
                        let resist = 0;
                        try {
                            if (target.hasSkill && (target.hasSkill('guicai') || target.hasSkill('guidao'))) {
                                resist += 0.6;
                            }
                        } catch (e) {}
                        score = score * Math.max(0.3, 1 - resist) * hitMul;
                        score = Math.round(score * 100) / 100;
                        _exposeOverride(cfg.id, score, cfg.reason + '.命中率' + Math.round(hitRate * 100) + '%', cfg.weight, player);
                        return score;
                    }

                    /* ★ 杀：牌堆感知稀缺度 */
                    if (cfg.id === 'sha') {
                        let score = (typeof result === 'number') ? result : 0;
                        const shaRemain = cardRarity('sha');
                        if (shaRemain < 0.5) {
                            score = score * 1.2;
                        }
                        score = Math.round(score * 100) / 100;
                        _exposeOverride(cfg.id, score, cfg.reason + '.稀缺度' + Math.round(shaRemain * 100) + '%', cfg.weight, player);
                        return score;
                    }

                    /* 写入覆写信号 */
                    if (typeof result === 'number' && result !== 0) {
                        _exposeOverride(cfg.id, result, cfg.reason + '.target', cfg.weight, player);
                    }
                    return result;
                } catch (e) {
                    return origTarget.call(this, player, target);
                }
            };
            cardMeta.result.__origTarget = origTarget;
            cardMeta.result.__djsc_hooked = true;
        });
        log.info('optimization', '已 hook ' + HOOKED_CARDS.length + ' 张牌的 result.target');
        /* ★ 同时 hook shunshou/guohe 的 button 函数 */
        installButtonHooks();
    } catch (e) {
        log.info('optimization', 'hook 失败: ' + String(e).slice(0, 80));
    }
}

function uninstallOptimizationHooks() {
    try {
        HOOKED_CARDS.forEach(function (cfg) {
            const cardMeta = lib.card && lib.card[cfg.id];
            if (!cardMeta || !cardMeta.result) return;
            if (!cardMeta.result.__djsc_hooked) return;
            /* 恢复原函数 */
            if (cardMeta.result.__origTarget) {
                cardMeta.result.target = cardMeta.result.__origTarget;
                delete cardMeta.result.__origTarget;
            }
            delete cardMeta.result.__djsc_hooked;
        });
    } catch (e) {}
}

/* ================= 导出 ================= */
export { installOptimizationHooks, uninstallOptimizationHooks, _exposeOverride, installButtonHooks };

/* ================= ★ hook shunshou/guohe 的 button 函数（已知牌检测） ================= */
function installButtonHooks() {
    try {
        /* 顺手牵羊 */
        const shunshou = lib.card && lib.card.shunshou;
        if (shunshou && shunshou.button && !shunshou.button.__djsc_hooked) {
            const origButton = shunshou.button;
            shunshou.button = function (button) {
                try {
                    const { player, target } = get.event();
                    const pos = get.position(button.link);
                    if (pos === 'h') {
                        /* ★ 已明知的牌优先顺走 */
                        let isKnown = false;
                        try {
                            const known = player.getKnownCards ? player.getKnownCards(target) : [];
                            isKnown = known.indexOf(button.link) >= 0;
                        } catch (e) {}
                        /* ★ 牌堆剩余：某种花色的牌快用完了 → 目标手上该花色可能是最后几张 → 优先顺走 */
                        let scarcityBonus = 0;
                        try {
                            const short = { 'heart':'h', 'diamond':'d', 'club':'c', 'spade':'s' }[button.link.suit];
                            if (short) {
                                const remain = suitRemaining(short);
                                if (remain <= 3) scarcityBonus = 1.5;
                                else if (remain <= 6) scarcityBonus = 0.8;
                                else if (remain <= 10) scarcityBonus = 0.3;
                            }
                        } catch (e) {}

                        const att = get.attitude(player, target);
                        if (att <= 0) {
                            /* 敌方：已知 → 更高分 */
                            return (isKnown ? 3 : 1) + scarcityBonus;
                        } else {
                            /* 友方：已知 → 更不建议顺 */
                            return (isKnown ? -2 : -1);
                        }
                    }
                } catch (e) {}
                return origButton.call(this, button);
            };
            shunshou.button.__djsc_hooked = true;
            shunshou.button.__origButton = origButton;
        }

        /* 过河拆桥 */
        const guohe = lib.card && lib.card.guohe;
        if (guohe && guohe.button && !guohe.button.__djsc_hooked) {
            const origButton = guohe.button;
            guohe.button = function (button) {
                try {
                    const player = _status.event.player;
                    const target = _status.event.target;
                    const pos = get.position(button.link);
                    if (pos === 'h') {
                        /* ★ 已明知的牌优先拆 */
                        let isKnown = false;
                        try {
                            const known = player.getKnownCards ? player.getKnownCards(target) : [];
                            isKnown = known.indexOf(button.link) >= 0;
                        } catch (e) {}
                        /* ★ 牌堆剩余：某种花色的牌快用完了 → 目标手上该花色可能是最后几张 → 优先拆走 */
                        let scarcityBonus = 0;
                        try {
                            const short = { 'heart':'h', 'diamond':'d', 'club':'c', 'spade':'s' }[button.link.suit];
                            if (short) {
                                const remain = suitRemaining(short);
                                if (remain <= 3) scarcityBonus = 1.5;
                                else if (remain <= 6) scarcityBonus = 0.8;
                                else if (remain <= 10) scarcityBonus = 0.3;
                            }
                        } catch (e) {}

                        const att = get.attitude(player, target);
                        if (att <= 0) {
                            /* 敌方：已知 → 更高分 */
                            return (isKnown ? 3 : 1) + scarcityBonus;
                        } else {
                            /* 友方：已知 → 更不建议拆 */
                            return (isKnown ? -2 : -1);
                        }
                    }
                } catch (e) {}
                return origButton.call(this, button);
            };
            guohe.button.__djsc_hooked = true;
            guohe.button.__origButton = origButton;
        }

        log.info('optimization', '已 hook shunshou/guohe 的 button 函数');
    } catch (e) {
        log.info('optimization', 'button hook 失败: ' + String(e).slice(0, 80));
    }
}
