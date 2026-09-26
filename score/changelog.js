/*
 * ============================================
 * // Autor: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 无名AI · 更新日志（从 v4.60 到 v4.90） =================
 * 每个版本标注：修改文件、行号、修改内容
 * 方便追溯每个功能的实现位置
 */

export const CHANGELOG = [
// 저자: 비승 오리지널 | 라이선스: GPL-3.0
    /* ===== v4.57.0 接管层启用 + 对象方法扫描版 ===== */
    {
        version: '4.57.0',
        name: '接管层启用 + 对象方法扫描版',
        date: '2026-09-13',
        changes: [
            {
                file: 'score/override/use.js',
                lines: '1-246',
                desc: '新建 AI 接管层，硬接管 chooseToUse：结束回合短路'
            },
            {
                file: 'score/skillScanner.js',
                lines: '1-378',
                desc: '新建技能扫描器，通过"对谁做"判断技能正负号'
            }
        ]
    },

    /* ===== v4.59.0 多维度评分系统版 ===== */
    {
        version: '4.59.0',
        name: '多维度评分系统版',
        date: '2026-09-14',
        changes: [
            {
                file: 'score/skillRules.js',
                lines: '1-225',
                desc: '新建规则表，八维度评分：对象/范围/时机/频率/风险/持续'
            }
        ]
    },

    /* ===== v4.60.0 多维评分完整版 ===== */
    {
        version: '4.60.0',
        name: '多维评分完整版',
        date: '2026-09-14',
        changes: [
            {
                file: 'score/skills.js',
                lines: '1-1793',
                desc: '技能拆解完整版，效果/成本/维度乘数'
            }
        ]
    },

    /* ===== v4.61.0 规则表补全版 ===== */
    {
        version: '4.61.0',
        name: '规则表补全版',
        date: '2026-09-15',
        changes: [
            {
                file: 'score/skillRules.js',
                lines: '全表',
                desc: '补全规则表，覆盖率从 60% 提升到 95%+'
            }
        ]
    },

    /* ===== v4.62.0 技能拆解完整版 ===== */
    {
        version: '4.62.0',
        name: '技能拆解完整版',
        date: '2026-09-15',
        changes: [
            {
                file: 'score/panel.js',
                lines: 'skillBreakdownPanel',
                desc: '技能拆解面板，可视化展示每个技能的评分构成'
            }
        ]
    },

    /* ===== v4.63.0 决策层消费多维分 ===== */
    {
        version: '4.63.0',
        name: '决策层消费多维分',
        date: '2026-09-16',
        changes: [
            {
                file: 'score/engine.js',
                lines: 'bestAction 函数',
                desc: '多维评分消费：bestAction 直接读 multi.final，不再用旧的 base*2'
            }
        ]
    },

    /* ===== v4.64.0 技能分类早退版 ===== */
    {
        version: '4.64.0',
        name: '技能分类早退版',
        date: '2026-09-16',
        changes: [
            {
                file: 'score/skillScanner.js',
                lines: '技能分类早退',
                desc: '假技能/内部工具直接空标签，不浪费计算'
            }
        ]
    },

    /* ===== v4.65.0 子技能继承完整版 ===== */
    {
        version: '4.65.0',
        name: '子技能继承完整版',
        date: '2026-09-17',
        changes: [
            {
                file: 'score/skills.js',
                lines: '子技能继承',
                desc: '子技能从主技能继承标签（×0.5），覆盖率从 60% 提升到 95%+'
            }
        ]
    },

    /* ===== v4.66.0 三期 bestAction 多维分选 ===== */
    {
        version: '4.66.0',
        name: '三期 bestAction 多维分选',
        date: '2026-09-17',
        changes: [
            {
                file: 'score/engine.js',
                lines: 'bestAction 三期分选',
                desc: '三期 bestAction 多维分选：攻击/防御/辅助'
            }
        ]
    },

    /* ===== v4.67.0 优化器覆写暴露版 ===== */
    {
        version: '4.67.0',
        name: '优化器覆写暴露版',
        date: '2026-09-18',
        changes: [
            {
                file: 'js/optimization.js',
                lines: '1-1918',
                desc: '卡牌覆写信号：optimization.js 的精细评分（顺手拆敌、火攻算花色等）接入 bestAction'
            }
        ]
    },

    /* ===== v4.67.1 修复 chooseToUse 返回值问题 ===== */
    {
        version: '4.67.1',
        name: '修复 chooseToUse 返回值问题',
        date: '2026-09-18',
        changes: [
            {
                file: 'score/override/use.js',
                lines: 'chooseToUse 返回值',
                desc: '修复 chooseToUse 返回值问题'
            }
        ]
    },

    /* ===== v4.68.0 跨局记忆修复版 ===== */
    {
        version: '4.68.0',
        name: '跨局记忆修复版',
        date: '2026-09-19',
        changes: [
            {
                file: 'score/memory.js',
                lines: 'settle 条件放宽',
                desc: '跨局记忆修复版（settle 条件放宽 + liveCount 阈值 2→1）'
            }
        ]
    },

    /* ===== v4.69.0 跨局记忆系统修复版 ===== */
    {
        version: '4.69.0',
        name: '跨局记忆系统修复版',
        date: '2026-09-19',
        changes: [
            {
                file: 'score/memory.js',
                lines: '1-267',
                desc: '跨局记忆系统修复版：玩家风格画像 + 跨局存储'
            }
        ]
    },

    /* ===== v4.69.2 修复跨局记忆写入 ===== */
    {
        version: '4.69.2',
        name: '修复跨局记忆写入',
        date: '2026-09-20',
        changes: [
            {
                file: 'score/observer.js',
                lines: 'styleOf 函数',
                desc: '修复跨局记忆写入（styleOf 在 total<2 时也返回实际数据）'
            }
        ]
    },

    /* ===== v4.70.0 记忆驱动决策 ===== */
    {
        version: '4.70.0',
        name: '记忆驱动决策',
        date: '2026-09-20',
        changes: [
            {
                file: 'score/observer.js',
                lines: 'styleOf 函数',
                desc: '记忆驱动决策（风格偏好权重提高 + 卡牌价值调整）'
            }
        ]
    },

    /* ===== v4.70.1 修复桃循环漏洞 ===== */
    {
        version: '4.70.1',
        name: '修复桃循环漏洞',
        date: '2026-09-20',
        changes: [
            {
                file: 'score/engine.js',
                lines: 'tao 无条件暴露',
                desc: '修复桃循环漏洞（tao 无条件暴露 + 伤害牌打友方硬约束）'
            }
        ]
    },

    /* ===== v4.70.2 友方伤害线性衰减 ===== */
    {
        version: '4.70.2',
        name: '友方伤害线性衰减',
        date: '2026-09-20',
        changes: [
            {
                file: 'score/engine.js',
                lines: '_djsc_hurtAlly',
                desc: '友方伤害线性衰减（每次 -0.5 累积）'
            }
        ]
    },

    /* ===== v4.70.3 衰减数值从 0.5 改 0.2 ===== */
    {
        version: '4.70.3',
        name: '衰减数值从 0.5 改 0.2',
        date: '2026-09-20',
        changes: [
            {
                file: 'score/engine.js',
                lines: '衰减数值',
                desc: '衰减数值从 0.5 改 0.2'
            }
        ]
    },

    /* ===== v4.70.4 衰减数值调优 ===== */
    {
        version: '4.70.4',
        name: '衰减数值调优',
        date: '2026-09-20',
        changes: [
            {
                file: 'score/engine.js',
                lines: '衰减数值',
                desc: '衰减数值调优'
            }
        ]
    },

    /* ===== v4.83.0 牌堆多模式适配版 ===== */
    {
        version: '4.83.0',
        name: '牌堆多模式适配版',
        date: '2026-09-18',
        changes: [
            {
                file: 'score/deckMemory.js',
                lines: '1-200',
                desc: '新建牌堆记忆引擎，静态表 + 运行时过滤，支持 7 种模式（identity/guozhan/doudizhu/boss/versus/single/default）'
            },
            {
                file: 'score/engine.js',
                lines: 'import 区',
                desc: 'import deckConsume, deckReset, cardRemaining, deckAutoDetect, deckSyncFromUI'
            },
            {
                file: 'score/engine.js',
                lines: 'scoreCardUse 函数',
                desc: '在使用牌时调用 deckConsume(card) 扣减剩余牌堆'
            },
            {
                file: 'score/override/use.js',
                lines: 'installHooks 开头',
                desc: '调用 deckAutoDetect() 自动识别当前模式'
            }
        ]
    },

    /* ===== v4.83.1 牌堆别名修复版 ===== */
    {
        version: '4.83.1',
        name: '牌堆别名修复版',
        date: '2026-09-18',
        changes: [
            {
                file: 'score/deckMemory.js',
                lines: 'CARD_ID_ALIASES 表',
                desc: '新增 30+ 个装备/锦囊的全名缩写别名（如 zhuque → zhuqueyushan）'
            },
            {
                file: 'score/deckMemory.js',
                lines: '_isCardSupported 函数',
                desc: '改为宽松过滤：lib.card 不完整时（<50张）跳过过滤，避免误剔'
            }
        ]
    },

    /* ===== v4.83.2 牌堆147张完整版 ===== */
    {
        version: '4.83.2',
        name: '牌堆147张完整版',
        date: '2026-09-18',
        changes: [
            {
                file: 'score/deckMemory.js',
                lines: '_isCardSupported 函数最后一行',
                desc: 'return false → return true（兜底：找不到别名就保留，确保 147 张全对）'
            }
        ]
    },

    /* ===== v4.84.0 牌堆感知全覆盖版 ===== */
    {
        version: '4.84.0',
        name: '牌堆感知全覆盖版',
        date: '2026-09-19',
        changes: [
            {
                file: 'score/engine.js',
                lines: 'EFFECT_HANDLERS.draw',
                desc: '摸牌时调用 deckConsume(card) 扣减'
            },
            {
                file: 'score/engine.js',
                lines: 'EFFECT_HANDLERS.discard',
                desc: '弃牌时调用 deckConsume(card) 扣减'
            },
            {
                file: 'score/engine.js',
                lines: 'EFFECT_HANDLERS.gain',
                desc: '获得牌时调用 deckConsume(card) 扣减'
            },
            {
                file: 'score/engine.js',
                lines: 'EFFECT_HANDLERS.lose',
                desc: '失去牌时调用 deckConsume(card) 扣减'
            },
            {
                file: 'score/engine.js',
                lines: 'EFFECT_HANDLERS.judge',
                desc: '判定牌翻开后调用 deckConsume(card) 扣减'
            },
            {
                file: 'score/engine.js',
                lines: 'installHooks 里 respond hook',
                desc: '打出（respond）时调用 deckConsume(card) 扣减'
            }
        ]
    },

    /* ===== v4.84.1 牌堆UI同步版 ===== */
    {
        version: '4.84.1',
        name: '牌堆UI同步版',
        date: '2026-09-19',
        changes: [
            {
                file: 'score/deckMemory.js',
                lines: 'deckSyncFromUI 函数',
                desc: '新建：从 ui.cardPile.children 重建 REMAINING（以真实 DOM 为准）'
            },
            {
                file: 'score/deckMemory.js',
                lines: '_initRemaining 函数',
                desc: '加对账逻辑：数量不一致则强制从 UI 重建'
            },
            {
                file: 'score/engine.js',
                lines: 'installHooks 里 get.cards hook',
                desc: 'hook get.cards，每次从牌堆拿牌都调用 deckConsume'
            },
            {
                file: 'score/engine.js',
                lines: 'installHooks 里 game.gameDraw hook',
                desc: 'hook game.gameDraw，初始发牌结束后从 UI 重建'
            }
        ]
    },

    /* ===== v4.85.0 训练蒸馏闭环版 ===== */
    {
        version: '4.85.0',
        name: '训练蒸馏闭环版',
        date: '2026-09-20',
        changes: [
            {
                file: 'score/features.js',
                lines: '1-174',
                desc: '新建：32 维特征提取（手牌/血量/身份/局势/装备/阶段/资源）'
            },
            {
                file: 'score/trainExport.js',
                lines: '1-152',
                desc: '新建：样本缓冲 + 导出 JSON + 下载'
            },
            {
                file: 'score/weights.js',
                lines: '1-50',
                desc: '新建：权重文件（待训练后填入）'
            },
            {
                file: 'score/engine.js',
                lines: 'trainStartGame / trainSettleGame',
                desc: '开始一局/结束一局时调用 trainExport'
            },
            {
                file: 'js/config.js',
                lines: '训练按钮区',
                desc: '加 3 个训练按钮（导出/清空/统计）'
            }
        ]
    },

    /* ===== v4.85.1 训练按钮巨大版 ===== */
    {
        version: '4.85.1',
        name: '训练按钮巨大版',
        date: '2026-09-20',
        changes: [
            {
                file: 'js/config.js',
                lines: '训练按钮样式',
                desc: '改成斗转星移风格大按钮，竖排排列，不重叠'
            }
        ]
    },

    /* ===== v4.85.2 训练样本修复版 ===== */
    {
        version: '4.85.2',
        name: '训练样本修复版',
        date: '2026-09-20',
        changes: [
            {
                file: 'score/engine.js',
                lines: 'bestAction 末尾',
                desc: '补 trainRecordSample 调用（之前只加了 start 和 settle，没加 record，导致统计为 0）'
            }
        ]
    },

    /* ===== v4.85.3 顺延时衰减版 ===== */
    {
        version: '4.85.3',
        name: '顺延时衰减版',
        date: '2026-09-20',
        changes: [
            {
                file: 'score/optimization.js',
                lines: 'shunshou.button',
                desc: '顺敌方延时锦囊（兵/乐）→ 刷分漏洞衰减 0.3'
            }
        ]
    },

    /* ===== v4.85.4 火攻API修复版 ===== */
    {
        version: '4.85.4',
        name: '火攻API修复版',
        date: '2026-09-20',
        changes: [
            {
                file: 'js/content.js',
                lines: 'huogong content 函数',
                desc: '去掉 .forResultCards() 调用（无名杀 1.11.6 nightly 已移除旧 API）'
            }
        ]
    },

    /* ===== v4.85.5 火攻API完全修复版 ===== */
    {
        version: '4.85.5',
        name: '火攻API完全修复版',
        date: '2026-09-20',
        changes: [
            {
                file: 'js/content.js',
                lines: 'huogong content 函数',
                desc: '彻底回退火攻 content 函数，直接调用原始函数'
            }
        ]
    },

    /* ===== v4.86.0 攻击队友禁令版 ===== */
    {
        version: '4.86.0',
        name: '攻击队友禁令版',
        date: '2026-09-21',
        changes: [
            {
                file: 'score/engine.js',
                lines: 'scoreCardUse 函数 target 处理',
                desc: '攻击队友时 AI 自己 -3 倍分（阻断刷分循环）'
            },
            {
                file: 'score/engine.js',
                lines: 'bestAction acts.sort 前',
                desc: '攻击队友的动作 score = -999（直接剔除）'
            }
        ]
    },

    /* ===== v4.86.1 四层立体防队友版 ===== */
    {
        version: '4.86.1',
        name: '四层立体防队友版',
        date: '2026-09-21',
        changes: [
            {
                file: 'score/engine.js',
                lines: 'hand.forEach 开头',
                desc: '第一层：物理拦截（直接跳过打队友的攻击牌）'
            },
            {
                file: 'score/engine.js',
                lines: 'hand.forEach 评分',
                desc: '第二层：评分重罚（打队友 s -= 100）'
            },
            {
                file: 'score/engine.js',
                lines: 'scoreCardUse target 处理',
                desc: '第三层：结算修正（攻击队友 AI 自己 -5 倍分）'
            },
            {
                file: 'score/engine.js',
                lines: 'bestAction isEnemy 判断',
                desc: '第四层：阵营识别兜底（斗地主/国战模式）'
            }
        ]
    },

    /* ===== v4.86.2 三层绝对拦截版 ===== */
    {
        version: '4.86.2',
        name: '三层绝对拦截版',
        date: '2026-09-21',
        changes: [
            {
                file: 'score/engine.js',
                lines: 'hand.forEach 开头',
                desc: '绝对拦截：只要目标是友方，直接屏蔽所有攻击牌'
            },
            {
                file: 'score/engine.js',
                lines: 'scoreCardUse target 处理',
                desc: '攻击队友：give(me, -50, "攻击盟友（严重违规）")'
            },
            {
                file: 'score/override/use.js',
                lines: '_shouldVeto 函数',
                desc: '执行层终极拦截：试图攻击盟友，已强制否决'
            }
        ]
    },

    /* ===== v4.87.0 友方延迟评估版 ===== */
    {
        version: '4.87.0',
        name: '友方延迟评估版',
        date: '2026-09-21',
        changes: [
            {
                file: 'score/engine.js',
                lines: '顶部 import 后',
                desc: '新建友方动作评估挂起表 _allyActionPending'
            },
            {
                file: 'score/engine.js',
                lines: '_snapshotAlly / _evaluateAllyAction',
                desc: '快照友方状态，600ms 后评估是否有正收益'
            },
            {
                file: 'score/engine.js',
                lines: 'scoreCardUse target 处理',
                desc: '对友方出牌挂起，延迟评估（有正收益不惩罚，无正收益扣 50%/70%）'
            },
            {
                file: 'score/engine.js',
                lines: 'EFFECT_HANDLERS.damage / loseHp / discard / lose',
                desc: '加 _markAllyHurt 标记（判断友方是否受伤）'
            },
            {
                file: 'score/engine.js',
                lines: 'hand.forEach 开头',
                desc: '删除之前的绝对拦截代码（允许战术性卖血）'
            },
            {
                file: 'score/override/use.js',
                lines: '_shouldVeto 函数',
                desc: '删除之前的执行层拦截代码'
            }
        ]
    },

    /* ===== v4.87.1 训练接口修复版 ===== */
    {
        version: '4.87.1',
        name: '训练接口修复版',
        date: '2026-09-21',
        changes: [
            {
                file: 'score/panel.js',
                lines: 'installDebugBridge window.__DJSC',
                desc: '挂载训练数据调试接口（trainBufferSize / trainBufferClear / trainExport）'
            }
        ]
    },

    /* ===== v4.88.0 动作特征扩展版 ===== */
    {
        version: '4.88.0',
        name: '动作特征扩展版',
        date: '2026-09-21',
        changes: [
            {
                file: 'score/features.js',
                lines: 'FEATURE_NAMES',
                desc: '从 32 维扩展到 48 维（32 状态 + 16 动作）'
            },
            {
                file: 'score/features.js',
                lines: 'f[32..47] 动作特征',
                desc: '动作类型（card/skill/equip/end）+ 牌名映射（攻击/防御/控制）+ 目标特征（友方/敌方/血量/手牌/评分/集火）'
            }
        ]
    },

    /* ===== v4.89.0 阵营关系精细化版 ===== */
    {
        version: '4.89.0',
        name: '阵营关系精细化版',
        date: '2026-09-21',
        changes: [
            {
                file: 'score/modeStrategy.js',
                lines: 'IDENTITY_STRATEGY',
                desc: '身份局：主公/忠臣/反贼/内奸精细决策加成'
            },
            {
                file: 'score/modeStrategy.js',
                lines: 'GUOZHAN_STRATEGY',
                desc: '国战：明置同势力绝对不能打，暗置敌人降权，珠联璧合加成'
            },
            {
                file: 'score/modeStrategy.js',
                lines: 'DOUDIZHU_STRATEGY',
                desc: '斗地主：地主进攻加成，农民集火地主+救队友'
            },
            {
                file: 'score/modeStrategy.js',
                lines: 'BOSS_STRATEGY',
                desc: 'BOSS 战：挑战者围攻 BOSS，BOSS 速杀残血'
            },
            {
                file: 'score/modeStrategy.js',
                lines: 'VERSUS_STRATEGY',
                desc: '对战：打队友 -2.0，救队友 +0.5，打敌方 +0.4'
            },
            {
                file: 'score/modeStrategy.js',
                lines: 'TAFANG_STRATEGY',
                desc: '塔防：打 NPC 加成，打玩家强惩罚'
            },
            {
                file: 'score/modeStrategy.js',
                lines: 'BRAWL_STRATEGY',
                desc: '大乱斗：各自为战，优先打残血'
            }
        ]
    },

    /* ===== v4.89.1 斗地主对决惩罚翻倍版 ===== */
    {
        version: '4.89.1',
        name: '斗地主对决惩罚翻倍版',
        date: '2026-09-21',
        changes: [
            {
                file: 'score/modeStrategy.js',
                lines: 'DOUDIZHU_STRATEGY.decisionBoost',
                desc: '农民打明身份队友：惩罚翻倍（-2.0 → -4.0）+ 分数减半'
            },
            {
                file: 'score/modeStrategy.js',
                lines: 'DOUDIZHU_STRATEGY.decisionBoost',
                desc: '按损失程度将 20%~60% 阵营分给地主（其他阵营）'
            },
            {
                file: 'score/modeStrategy.js',
                lines: 'VERSUS_STRATEGY.decisionBoost',
                desc: '对战打明身份队友：惩罚翻倍（-2.0 → -4.0）+ 分数减半'
            },
            {
                file: 'score/modeStrategy.js',
                lines: 'VERSUS_STRATEGY.decisionBoost',
                desc: '按损失程度将 20%~60% 阵营分给敌方（其他阵营）'
            }
        ]
    },

    /* ===== v4.90.0 数据污染全面扫描版 ===== */
    {
        version: '4.90.0',
        name: '数据污染全面扫描版',
        date: '2026-09-21',
        changes: [
            {
                file: 'score/engine.js',
                lines: 'EFFECT_HANDLERS.damage 第 396 行',
                desc: '污染修复：伤害事件判断 src 和 me 是否是友方（打队友不加分）'
            },
            {
                file: 'score/engine.js',
                lines: 'installHooks die 第 672 行',
                desc: '污染修复：击杀奖励判断 killer 和 me 是否是友方（杀队友 -10 分）'
            }
        ]
    }
];

/* 打印更新日志 */
export function printChangelog() {
    console.log('=== 无名AI 更新日志（v4.83 ~ v4.90）===');
    CHANGELOG.forEach(function (v) {
        console.log('\n[' + v.version + '] ' + v.name + ' (' + v.date + ')');
        v.changes.forEach(function (c) {
            console.log('  · ' + c.file + ':' + c.lines + ' → ' + c.desc);
        });
    });
}

/* 获取指定版本的更新内容 */
export function getVersionChanges(version) {
    const v = CHANGELOG.find(function (v) { return v.version === version; });
    return v || null;
}

/* 获取所有版本号 */
export function getAllVersions() {
    return CHANGELOG.map(function (v) { return v.version; });
}

/* 获取最新版本 */
export function getLatestVersion() {
    return CHANGELOG[CHANGELOG.length - 1];
}
