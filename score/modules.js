/*
 * ============================================
 * // Penulis: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 无名AI · 模块清单（完整功能地图） =================
 * 每个模块标注：文件路径、行号、功能说明
 * 方便快速定位每个功能的实现位置
 */

export const MODULES = [
// Autor: Feisheng Original | Lizenz: GPL-3.0
    /* ===== 核心决策引擎 ===== */
    {
        category: '核心决策引擎',
        modules: [
            {
                name: '决策主循环',
                file: 'score/engine.js',
                lines: 'bestAction 函数',
                desc: 'AI 每次出牌枚举所有候选动作，通过多层信号加权打分，选最高分动作执行'
            },
            {
                name: '记分系统',
                file: 'score/engine.js',
                lines: 'give / giveVs / givePair',
                desc: '实时记分：玩家得分累积，阵营分按均摊守恒'
            },
            {
                name: '效果处理器表',
                file: 'score/engine.js',
                lines: 'EFFECT_HANDLERS',
                desc: '处理 damage/recover/draw/discard/gain/lose/judge 等效果事件'
            },
            {
                name: '出牌 Hook',
                file: 'score/engine.js',
                lines: 'installHooks / proto.useCard',
                desc: 'hook useCard，每次出牌时调用 scoreCardUse'
            },
            {
                name: '击杀奖励',
                file: 'score/engine.js',
                lines: 'installHooks / proto.die',
                desc: '击杀奖励：杀敌人 +6，杀队友 -10'
            },
            {
                name: '结算',
                file: 'score/engine.js',
                lines: 'settle 函数',
                desc: '终局存活奖励 +3，跨局记忆合并'
            }
        ]
    },

    /* ===== 技能识别系统 ===== */
    {
        category: '技能识别系统',
        modules: [
            {
                name: '技能扫描器',
                file: 'score/skillScanner.js',
                lines: '1-378',
                desc: '通过"对谁做"判断技能正负号，比关键词识别更精确'
            },
            {
                name: '技能规则表',
                file: 'score/skillRules.js',
                lines: '1-225',
                desc: '八维度评分：对象/范围/时机/频率/风险/持续，输出 -15 ~ +15 综合分'
            },
            {
                name: '技能库',
                file: 'score/skills.js',
                lines: '1-1793',
                desc: '技能拆解：效果/成本/维度乘数，子技能继承标签'
            },
            {
                name: '技能拆解面板',
                file: 'score/panel.js',
                lines: 'skillBreakdownPanel',
                desc: '可视化展示每个技能的评分构成'
            }
        ]
    },

    /* ===== 跨局记忆系统 ===== */
    {
        category: '跨局记忆系统',
        modules: [
            {
                name: '玩家风格画像',
                file: 'score/memory.js',
                lines: '1-267',
                desc: '记录每位玩家的攻击/援助行为，生成 aggressive/cautious/vengeful 标签'
            },
            {
                name: '跨局存储',
                file: 'score/memory.js',
                lines: 'loadStore / saveStore',
                desc: '通过 localStorage 持久化，多局累积'
            },
            {
                name: '记忆驱动决策',
                file: 'score/observer.js',
                lines: 'styleOf 函数',
                desc: '面对 aggressive 敌人时防御牌价值提高；面对 vengeful 敌人时攻击牌价值降低'
            },
            {
                name: '记忆面板',
                file: 'score/panel.js',
                lines: 'memoryPanel',
                desc: '查看所有玩家的风格画像和样本数'
            }
        ]
    },

    /* ===== 牌堆记忆引擎 ===== */
    {
        category: '牌堆记忆引擎',
        modules: [
            {
                name: '牌堆总分布',
                file: 'score/deckMemory.js',
                lines: 'DECK_DATA_JUNZHENG / DECK_DATA_STANDARD',
                desc: '军争版 147 张 + 标准版 108 张静态表'
            },
            {
                name: '多模式适配',
                file: 'score/deckMemory.js',
                lines: 'MODE_CONFIGS',
                desc: '7 种模式：identity/guozhan/doudizhu/boss/versus/single/default'
            },
            {
                name: '别名表',
                file: 'score/deckMemory.js',
                lines: 'CARD_ID_ALIASES',
                desc: '30+ 装备/锦囊的全名缩写别名'
            },
            {
                name: 'UI 同步',
                file: 'score/deckMemory.js',
                lines: 'deckSyncFromUI 函数',
                desc: '从 ui.cardPile.children 重建 REMAINING（以真实 DOM 为准）'
            },
            {
                name: '牌堆预测',
                file: 'score/deckPredict.js',
                lines: '1-150',
                desc: '判定成功率 + 牌名稀缺度 + 摸牌期望'
            }
        ]
    },

    /* ===== 威胁评估系统 ===== */
    {
        category: '威胁评估系统',
        modules: [
            {
                name: '威胁评估',
                file: 'score/threat.js',
                lines: '1-689',
                desc: '敌方威胁评估：手牌/装备/技能/血量'
            },
            {
                name: '命中率计算',
                file: 'score/threat.js',
                lines: 'probHasShan / probHasBagua',
                desc: '敌方有闪概率 / 有八卦概率'
            },
            {
                name: '座位压力',
                file: 'score/threat.js',
                lines: 'seatPressure 函数',
                desc: '座位距离压力评估'
            }
        ]
    },

    /* ===== 模式策略系统 ===== */
    {
        category: '模式策略系统',
        modules: [
            {
                name: '身份局策略',
                file: 'score/modeStrategy.js',
                lines: 'IDENTITY_STRATEGY',
                desc: '主公/忠臣/反贼/内奸精细决策加成'
            },
            {
                name: '国战策略',
                file: 'score/modeStrategy.js',
                lines: 'GUOZHAN_STRATEGY',
                desc: '明置同势力绝对不能打，暗置敌人降权，珠联璧合加成'
            },
            {
                name: '斗地主策略',
                file: 'score/modeStrategy.js',
                lines: 'DOUDIZHU_STRATEGY',
                desc: '地主进攻加成，农民集火地主+救队友，打明身份队友 -4.0'
            },
            {
                name: 'BOSS 战策略',
                file: 'score/modeStrategy.js',
                lines: 'BOSS_STRATEGY',
                desc: '挑战者围攻 BOSS，BOSS 速杀残血'
            },
            {
                name: '对战策略',
                file: 'score/modeStrategy.js',
                lines: 'VERSUS_STRATEGY',
                desc: '打队友 -4.0 + 分数减半，20%~60% 阵营分给敌方'
            }
        ]
    },

    /* ===== 训练蒸馏系统 ===== */
    {
        category: '训练蒸馏系统',
        modules: [
            {
                name: '特征提取',
                file: 'score/features.js',
                lines: '1-236',
                desc: '48 维特征（32 状态 + 16 动作），用于线性回归蒸馏'
            },
            {
                name: '样本缓冲',
                file: 'score/trainExport.js',
                lines: '1-152',
/* Auctor: Feisheng Originale, Omnia iura reservantur */
                desc: '缓冲每局的训练样本，游戏结束后导出为 JSON'
            },
            {
                name: '权重文件',
                file: 'score/weights.js',
                lines: '1-50',
                desc: '权重文件（待训练后填入）'
            }
        ]
    },

    /* ===== 决策面板系统 ===== */
    {
        category: '决策面板系统',
        modules: [
            {
                name: '决策积分面板',
                file: 'score/panel.js',
                lines: 'decisionPanel',
                desc: '实时显示 AI 每个决策的候选动作和分数'
            },
            {
                name: '战报面板',
                file: 'score/report.js',
                lines: '1-412',
                desc: '对局结束后展示完整决策回放'
            },
            {
                name: '归档面板',
                file: 'score/archive.js',
                lines: '1-244',
                desc: '历史对局归档，可回看'
            },
            {
                name: '配置面板',
                file: 'js/config.js',
                lines: '1-500',
                desc: '各种开关和参数调节（性格/风险/团队等）'
            }
        ]
    },

    /* ===== AI 接管层 ===== */
    {
        category: 'AI 接管层',
        modules: [
            {
                name: '出牌接管',
                file: 'score/override/use.js',
                lines: '1-246',
                desc: '硬接管 chooseToUse：结束回合短路 + 低价值牌否决'
            },
            {
                name: '响应接管',
                file: 'score/override/respond.js',
                lines: '1-200',
                desc: '闪/桃/无懈的智能响应'
            },
            {
                name: '弃牌接管',
                file: 'score/override/discard.js',
                lines: '1-215',
                desc: '智能弃牌，不瞎弃'
            },
            {
                name: '电路保护',
                file: 'score/override/circuit.js',
                lines: '1-100',
                desc: '异常熔断：AI 决策异常时自动降级'
            }
        ]
    },

    /* ===== 身份推理系统 ===== */
    {
        category: '身份推理系统',
        modules: [
            {
                name: '身份推理',
                file: 'score/identity.js',
                lines: '1-391',
                desc: '通过行为推理玩家身份（忠/反/内）'
            },
            {
                name: '身份面板',
                file: 'score/panel.js',
                lines: 'identityPanel',
                desc: '可视化展示身份推理结果'
            }
        ]
    },

    /* ===== 经济系统 ===== */
    {
        category: '经济系统',
        modules: [
            {
                name: '资源平衡',
                file: 'score/economy.js',
                lines: '1-150',
                desc: '手牌/装备/血量资源平衡评估'
            },
            {
                name: '卖血价值',
                file: 'score/economy.js',
                lines: 'sellHpValue 函数',
                desc: '卖血收益评估（郭嘉/曹操等）'
            }
        ]
    },

    /* ===== 规划器系统 ===== */
    {
        category: '规划器系统',
        modules: [
            {
                name: '多步规划',
                file: 'score/planner.js',
                lines: '1-413',
                desc: '多步视角微调 best：短期收益 vs 长期收益'
            },
            {
                name: '团队广播',
                file: 'score/teamBroadcast.js',
                lines: '1-100',
                desc: '团队意图广播：集火/救援/拆装备'
            }
        ]
    },

    /* ===== 反馈系统 ===== */
    {
        category: '反馈系统',
        modules: [
            {
                name: '决策反馈',
                file: 'score/decisionFeedback.js',
                lines: '1-200',
                desc: '决策结果反馈：打对了加分，打错了扣分'
            },
            {
                name: '风格反馈',
                file: 'score/styleFeedback.js',
                lines: '1-100',
                desc: '风格画像反馈：根据结果调整风格标签'
            }
        ]
    },

    /* ===== 其他系统 ===== */
    {
        category: '其他系统',
        modules: [
            {
                name: '多回合预测',
                file: 'score/multiturn.js',
                lines: '1-100',
                desc: '多回合局势预测'
            },
            {
                name: '策略家',
                file: 'score/strategist.js',
                lines: '1-526',
                desc: '高级策略：残局/逆风/顺风决策'
            },
            {
                name: '自动播放',
                file: 'score/autoplay.js',
                lines: '1-303',
                desc: '挂机自动打局'
            },
            {
                name: 'AI 对比',
                file: 'score/compareAI.js',
                lines: '1-286',
                desc: '两个 AI 对比测试'
            },
            {
                name: '图表',
                file: 'score/charts.js',
                lines: '1-100',
                desc: '折线图/柱状图/雷达图/饼图'
            },
            {
                name: 'I18N',
                file: 'score/i18n.js',
                lines: '1-100',
                desc: '国际化支持'
            }
        ]
    }
];

/* 打印模块清单 */
export function printModules() {
    console.log('=== 无名AI 模块清单 ===');
    MODULES.forEach(function (cat) {
        console.log('\n[' + cat.category + ']');
        cat.modules.forEach(function (m) {
            console.log('  · ' + m.name + ' (' + m.file + ':' + m.lines + ')');
            console.log('    ' + m.desc);
        });
    });
}

/* 按类别获取模块 */
export function getModulesByCategory(category) {
    const cat = MODULES.find(function (c) { return c.category === category; });
    return cat ? cat.modules : [];
}

/* 按文件名获取模块 */
export function getModulesByFile(file) {
    const result = [];
    MODULES.forEach(function (cat) {
        cat.modules.forEach(function (m) {
            if (m.file === file) result.push(m);
        });
    });
    return result;
}

/* 获取所有类别 */
export function getAllCategories() {
    return MODULES.map(function (c) { return c.category; });
}

/* 获取模块总数 */
export function getModuleCount() {
    let count = 0;
    MODULES.forEach(function (c) { count += c.modules.length; });
    return count;
}
