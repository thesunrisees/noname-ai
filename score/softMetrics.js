/*
 * ============================================
 * // Author: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 决策积分引擎 · 软指标学习 =================
 * 把所有硬编码的阈值/权重改成软指标：
 *   ① 卡牌基础价值（现在是硬编码的 use/resp）
 *   ② 局势调整系数（现在是硬编码的 0.6/1.5/2.0）
 *   ③ 目标价值系数（现在是硬编码的 +0.6/+3）
 *   ④ 时机调整系数（现在是硬编码的 0.7/1.15）
 * 全部改成：初始值 + 对局反馈自动微调
 */
import { log } from './logger.js';

/* ================= 存储 ================= */
const STORE_KEY = 'djsc_soft_metrics_v1';
const VERSION = 1;
let STORE = { v: VERSION, metrics: {} };
let _loaded = false;
let _totalLearned = 0;  /* ★ 总学习次数计数器 */

function _load() {
    try {
        if (_loaded) return;
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) {
            const obj = JSON.parse(raw);
            if (obj && obj.v === VERSION) STORE = obj;
        }
        _loaded = true;
    } catch (e) { _loaded = true; }
}
function _save() {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(STORE));
    } catch (e) {}
}

/* ================= 指标定义（初始值 + 学习率） ================= */
const METRIC_DEFS = {
    /* 卡牌基础价值（初始值） */
    card_use_sha: { init: 2.0, lr: 0.05 },
    card_use_shan: { init: 1.0, lr: 0.05 },
    card_use_tao: { init: 2.0, lr: 0.05 },
    card_use_jiudou: { init: 2.0, lr: 0.05 },
    card_use_nanman: { init: 3.0, lr: 0.05 },
    card_use_wanqian: { init: 3.0, lr: 0.05 },
    card_use_wuzhong: { init: 2.0, lr: 0.05 },

    /* 局势调整系数（初始值） */
    endgame_mul: { init: 1.5, lr: 0.03 },        // 残局系数
    early_mul: { init: 1.2, lr: 0.03 },          // 早期系数
    myLowHp_mul: { init: 1.3, lr: 0.03 },        // 自己残血系数
    tgtLowHp_mul: { init: 1.5, lr: 0.03 },       // 目标残血系数
    fewHand_mul: { init: 1.6, lr: 0.03 },         // 手牌少系数

    /* 目标价值系数（初始值） */
    tgtLowHp_bonus: { init: 1.0, lr: 0.04 },     // 目标残血加分
    tgtManyHand_bonus: { init: 0.6, lr: 0.04 },  // 目标多牌加分
    tgtHighHp_penalty: { init: -0.3, lr: 0.04 }, // 目标满血减分

    /* 时机调整系数（初始值） */
    shanProb_high_mul: { init: 0.7, lr: 0.03 },      // 对手有闪→杀价值降
    wuxieProb_high_mul: { init: 1.15, lr: 0.03 },    // 对手有无懈→我也要有
    scarcity_high_mul: { init: 1.3, lr: 0.03 },       // 稀缺→价值升

    /* 正负行为软指标（难度大，先做简化版） */
    ally_attack_penalty: { init: -50, lr: 1.0 },      // 打队友惩罚（调高到-50分，主忠互殴惩罚变高）
    enemy_attack_bonus: { init: 10, lr: 1.0 },         // 打敌人加分（初始+10分，模型自己学）
    ally_attack_endgame: { init: -80, lr: 1.0 },       // 残局打队友惩罚更重（调高到-80分）
    enemy_attack_lowhp: { init: 15, lr: 1.0 },         // 打残血敌人加分更多 */

    /* 忠臣保护主公加分（新增） */
    protect_zhugong_bonus: { init: 30, lr: 1.0 },      // 忠臣保护主公加分（+30分）
    zhugong_under_threat: { init: 20, lr: 1.0 },       // 主公受威胁时（忠臣有+20分防御/救援权重）
    zhong_attack_zhu_penalty: { init: -30, lr: 1.0 },  // 忠臣打主公：轻罚（-30分，剩下让模型判断）

    /* ★ 阵亡+明置身份策略（新增，初始值小，剩下让模型学） */
    dead_fan_bonus: { init: 2, lr: 0.5 },               // 确定是反贼→打他有额外加分（初始+2，模型自己学）
    dead_zhong_penalty: { init: -5, lr: 0.5 },         // 确定是忠臣→打他有额外惩罚（初始-5，模型自己学）

    /* ★ 技能标签权重（新增） */
    tag_draw_bonus: { init: 1.2, lr: 0.05 },          // 摸牌类技能权重
    tag_recover_bonus: { init: 1.3, lr: 0.05 },       // 回复类技能权重
    tag_attack_bonus: { init: 1.1, lr: 0.05 },        // 攻击类技能权重
    tag_defense_bonus: { init: 1.1, lr: 0.05 },       // 防御类技能权重
    tag_control_bonus: { init: 1.4, lr: 0.05 },       // 控制类技能权重
    tag_utility_bonus: { init: 1.0, lr: 0.05 },       // 辅助类技能权重
    tag_burst_bonus: { init: 1.5, lr: 0.05 },         // 爆发类技能权重
    tag_survival_bonus: { init: 1.2, lr: 0.05 },       // 生存类技能权重

    /* ★ 判定区权重（新增） */
    judge_delay_target_bonus: { init: 2.0, lr: 0.05 }, // 有判定牌的目标→拆/顺加分
    judge_self_penalty: { init: -1.5, lr: 0.05 },     // 自己有判定牌→需要优先解

    /* ★ 身份推断权重（新增） */
    identity_atk_zhu_weight: { init: 0.5, lr: 0.02 },   // 打主公→反贼倾向权重
    identity_aid_zhu_weight: { init: 0.5, lr: 0.02 },   // 救主公→忠臣倾向权重
    identity_kill_zhong_weight: { init: 0.2, lr: 0.02 }, // 杀忠臣→反贼倾向权重
    identity_save_zhu_weight: { init: 0.15, lr: 0.02 }, // 救主公→忠臣倾向权重
    identity_equip_atk_weight: { init: 0.1, lr: 0.02 }, // 进攻装备→反贼倾向
    identity_equip_def_weight: { init: 0.1, lr: 0.02 },  // 防御装备→忠臣倾向

    /* ★ AI工具集成权重（新增） */
    threaten_bonus: { init: 1.15, lr: 0.05 },           // 嘲讽高→优先打
    maixie_penalty: { init: 0.75, lr: 0.05 },           // 卖血将→少打
    deathskill_penalty: { init: 0.85, lr: 0.05 },       // 亡语技能→少杀
    unequip_bonus: { init: 1.1, lr: 0.05 },            // 无视防具→打他更有效
    zhuskill_bonus: { init: 1.1, lr: 0.05 },            // 有主公技→可能是主公/忠臣

    /* ★ 内奸判断权重（新增） */
    nei_early_attack_fan: { init: 0.1, lr: 0.03 },      // 前期打反贼→可能是内奸
    nei_early_save_zhu: { init: 0.05, lr: 0.03 },     // 前期救主公→可能是内奸
    nei_late_attack_zhu: { init: 0.3, lr: 0.03 },      // 后期打主公→一定是内奸
    nei_early_no_attack_fan: { init: -0.1, lr: 0.03 },  // 前期不打反贼→更像忠臣

    /* ★ 学习效率优化权重（新增） */
    priority_replay_weight: { init: 1.0, lr: 0.02 },     // 优先级回放权重
    feature_importance_threshold: { init: 0.1, lr: 0.02 }, // 特征重要性阈值
    course_identity_weight: { init: 2.0, lr: 0.02 },    // 课程学习-身份判断权重
    course_target_weight: { init: 2.0, lr: 0.02 },      // 课程学习-目标选择权重
    course_card_weight: { init: 2.0, lr: 0.02 },        // 课程学习-出牌选择权重
    adaptive_lr_base: { init: 0.05, lr: 0.01 },         // 自适应学习率基础值

    /* ★ 通用决策权重（全部软指标化） */
    low_hp_boost: { init: 1.4, lr: 0.05 },              // 低血时出牌权重提高
    injured_boost: { init: 1.2, lr: 0.05 },              // 已受伤时出牌权重提高
    endgame_boost: { init: 1.15, lr: 0.05 },             // 残局出牌权重提高
    enemy_boost: { init: 1.15, lr: 0.05 },               // 打敌人权重提高
    no_shan_boost: { init: 1.2, lr: 0.05 },              // 对手没闪→杀价值提高
    no_wuxie_boost: { init: 1.15, lr: 0.05 },            // 对手没无懈→无懈价值提高
    scarce_card_boost: { init: 1.3, lr: 0.05 },          // 稀缺卡牌价值飙升
    high_priority_boost: { init: 1.1, lr: 0.05 },        // 高优先级卡牌价值提高
    big_profit_bonus: { init: 3.0, lr: 0.1 },             // 大赚加分
    small_profit_bonus: { init: 1.5, lr: 0.1 },          // 小赚加分
    enemy_low_hp_boost: { init: 1.5, lr: 0.05 },         // 敌人残血→打他权重提高
    nanman_scarcity_boost: { init: 1.25, lr: 0.05 },     // 杀稀缺→南蛮更值
    wanjian_scarcity_boost: { init: 1.25, lr: 0.05 },    // 闪稀缺→万箭更值
    burst_bonus_mult: { init: 0.6, lr: 0.05 },          // 爆发卡牌加分系数
    burst_boost_mult: { init: 0.4, lr: 0.05 },           // 爆发加成系数
    burst_general_boost: { init: 1.15, lr: 0.05 },       // 爆发通用权重
    equip_target_bonus: { init: 3.5, lr: 0.1 },           // 有装备的目标→拆/顺加分
    equip_low_bonus: { init: 1.0, lr: 0.1 },             // 无装备的目标→拆/顺加分
    target_hp_bonus: { init: 3.0, lr: 0.1 },              // 目标血量≥2→加分
    attack_card_boost: { init: 1.12, lr: 0.05 },          // 攻击牌打敌加成
    control_card_boost: { init: 1.08, lr: 0.05 },        // 控制牌打敌加成
    judge_zone_boost: { init: 1.3, lr: 0.05 },           // 判定区有延时牌→拆/顺加成
    control_general_boost: { init: 1.08, lr: 0.05 },     // 控制牌通用加成
    next_enemy_bonus: { init: 1.5, lr: 0.1 },            // 下家是敌人→加分
    defense_card_prev_boost: { init: 1.15, lr: 0.05 },    // 上家是敌人→防御牌加成
    kill_risk_boost: { init: 1.6, lr: 0.05 },            // 有击杀风险→权重提高
    self_risk_high_boost: { init: 1.3, lr: 0.05 },       // 自身风险高→权重提高
    self_risk_mid_boost: { init: 1.1, lr: 0.05 },        // 自身风险中→权重提高
    self_risk_low_boost: { init: 1.12, lr: 0.05 },       // 自身风险低→权重提高
    attack_card_general_boost: { init: 1.1, lr: 0.05 },  // 攻击牌通用加成
    defense_card_general_boost: { init: 1.08, lr: 0.05 }, // 防御牌通用加成
    early_hand_keep_bias: { init: 0.15, lr: 0.02 },      // 早期留牌偏差
    mid_hand_keep_bias: { init: 0.0, lr: 0.02 },         // 中期留牌偏差
    enemy_zhuge_bias: { init: 0.2, lr: 0.02 },            // 有连弩→留牌偏差
    low_hp_hand_bias: { init: 0.25, lr: 0.02 },          // 低血留牌偏差
    mid_hp_hand_bias: { init: 0.1, lr: 0.02 },           // 中血留牌偏差

    /* ★ 技能触发时机权重（新增） */
    skill_auto_bonus: { init: 1.05, lr: 0.03 },           // 自动发动技能加成
    skill_forced_bonus: { init: 1.03, lr: 0.03 },        // 锁定技加成
    skill_benefit_bonus: { init: 1.1, lr: 0.03 },        // 有利技能加成
    skill_cost_penalty: { init: 0.85, lr: 0.03 },        // 有害技能减分
    skill_draw_bonus: { init: 1.08, lr: 0.03 },         // 摸牌技能加成
    skill_recover_bonus: { init: 1.08, lr: 0.03 },      // 回血技能加成
    skill_damage_bonus: { init: 1.05, lr: 0.03 },        // 伤害技能加成
    skill_discard_penalty: { init: 0.9, lr: 0.03 },      // 弃牌技能减分
    skill_losehp_penalty: { init: 0.8, lr: 0.03 },       // 失去体力技能减分
    skill_turnover_penalty: { init: 0.85, lr: 0.03 },    // 翻面技能减分
    skill_removeskill_penalty: { init: 0.8, lr: 0.03 },  // 移除技能减分
    skill_addskill_bonus: { init: 1.15, lr: 0.03 },      // 添加技能加成
    skill_gaincard_bonus: { init: 1.1, lr: 0.03 },     // 获得牌技能加成
    skill_discardjudge_bonus: { init: 1.1, lr: 0.03 },   // 拆判定技能加成
    skill_decktop_bonus: { init: 1.08, lr: 0.03 },       // 控顶技能加成
};

/* ================= 初始化指标 ================= */
function _initMetrics() {
    _load();
    Object.keys(METRIC_DEFS).forEach(function (k) {
        if (!STORE.metrics[k]) {
            STORE.metrics[k] = {
                value: METRIC_DEFS[k].init,
                samples: 0,
                totalError: 0,
            };
        }
    });
}

/* ================= 获取指标当前值 ================= */
export function getMetric(key) {
    try {
        _initMetrics();
        if (!STORE.metrics[key]) return METRIC_DEFS[key] ? METRIC_DEFS[key].init : 1.0;
        return STORE.metrics[key].value;
    } catch (e) {
        return METRIC_DEFS[key] ? METRIC_DEFS[key].init : 1.0;
    }
}

/* ================= 学习：根据反馈调整指标 ================= */
export function learnMetric(key, error) {
    try {
        _initMetrics();
        if (!STORE.metrics[key] || !METRIC_DEFS[key]) return;

        const def = METRIC_DEFS[key];
        const m = STORE.metrics[key];

        /* 梯度下降：error 是实际收益 - 预期收益 */
        const delta = error * def.lr;
        m.value += delta;
        m.samples++;
        m.totalError += Math.abs(error);

        /* ★ 总学习次数+1 */
        _totalLearned++;

        /* 限制范围：不能太离谱 */
        const min = def.init * 0.5;
        const max = def.init * 2.0;
        if (m.value < min) m.value = min;
        if (m.value > max) m.value = max;

        _save();
    } catch (e) {}
}

/* ================= 批量学习：对局结束后统一更新 ================= */
export function learnFromGame(gameStats) {
    try {
        if (!gameStats) return;
        _initMetrics();

        /* 根据对局结果，调整各个指标 */
        /* 这里是简化版：如果赢了，说明当前指标是合理的，微调 */
        /* 如果输了，说明指标有偏差，调整方向 */

        /* 示例：如果打队友输了，降低打队友的权重 */
        if (gameStats.allyAttackCount > 0 && gameStats.win === false) {
            learnMetric('tgtLowHp_penalty', -0.5);  // 微调
        }

        /* 示例：如果残局赢了，提高残局系数 */
        if (gameStats.endgame && gameStats.win) {
            learnMetric('endgame_mul', 0.2);
        }

        _save();
    } catch (e) {}
}

/* ================= 统计接口 ================= */
export function softMetricStats() {
    try {
        _initMetrics();
        const list = [];
        Object.keys(STORE.metrics).forEach(function (k) {
            const m = STORE.metrics[k];
            const init = METRIC_DEFS[k] ? METRIC_DEFS[k].init : 0;
            list.push({
                key: k,
                current: Math.round(m.value * 100) / 100,
                init: init,
                drift: Math.round((m.value - init) / init * 100) / 100,
                samples: m.samples,
            });
        });
        /* ★ 返回总学习次数，和config.js对齐 */
        return {
            totalLearn: _totalLearned,
            metrics: list,
        };
    } catch (e) { return { totalLearn: 0, metrics: [] }; }
}

export function resetSoftMetrics() {
    STORE = { v: VERSION, metrics: {} };
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    log.info('softMetrics', '软指标已复位');
}

/* ================= 挂载 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.softMetrics = {
        get: getMetric,
        learn: learnMetric,
        learnFromGame: learnFromGame,
        stats: softMetricStats,
        reset: resetSoftMetrics,
    };
}
