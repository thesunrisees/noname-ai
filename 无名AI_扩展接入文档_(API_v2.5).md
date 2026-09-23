# 无名AI 扩展接入文档 (API v2.5)

## 全局对象

所有 API 都挂载在 `window.__DJSC` 下。

---

## 一、模型推理

### `confidence(features)`
- **类型**: 函数
- **参数**: `features` — 96 维特征数组（Int8Array 或 Array）
- **返回**: `{ action, label, probs, confidence }`
  - `action`: 动作类型（model/blend/rule/skip）
  - `label`: 推荐标签（A/B/C/D/E/F）
  - `probs`: 6 个标签的概率分布
  - `confidence`: 置信度（0~1）
- **说明**: 模型前向推理，返回对当前状态的动作推荐

### `confidenceOf(probs)`
- **类型**: 函数
- **参数**: `probs` — 概率分布数组
- **返回**: 置信度（0~1）
- **说明**: 计算概率分布的置信度（基于熵）

### `blendScore(ruleScore, modelScore, conf)`
- **类型**: 函数
- **参数**:
  - `ruleScore`: 规则引擎分数
  - `modelScore`: 模型分数
  - `conf`: 置信度（0~1）
- **返回**: 融合后的分数
- **说明**: 按置信度融合规则和模型分数

### `weightsReady()`
- **类型**: 函数
- **返回**: `boolean`
- **说明**: 检查模型权重是否已加载

---

## 二、配置与状态

### `cfg(key, defaultValue)`
- **类型**: 函数
- **参数**:
  - `key`: 配置键名
  - `defaultValue`: 默认值
- **返回**: 配置值
- **说明**: 读取扩展配置

### `getState()`
- **类型**: 函数
- **返回**: 模型状态对象
- **说明**: 获取模型当前状态

### `modeStatus`
- **类型**: 对象
- **说明**: 当前模式状态信息

---

## 三、概率预测

### `probHasShan(target)`
- **类型**: 函数
- **参数**: `target` — 目标玩家
- **返回**: 概率值（0~1）
- **说明**: 预测目标有闪的概率

### `probHasTao(target)`
- **类型**: 函数
- **参数**: `target` — 目标玩家
- **返回**: 概率值（0~1）
- **说明**: 预测目标有桃的概率

### `probHasWuxie(target)`
- **类型**: 函数
- **参数**: `target` — 目标玩家
- **返回**: 概率值（0~1）
- **说明**: 预测目标有无懈可击的概率

### `probHasSha(target)`
- **类型**: 函数
- **参数**: `target` — 目标玩家
- **返回**: 概率值（0~1）
- **说明**: 预测目标有杀的概率

### `probHasJiu(target)`
- **类型**: 函数
- **参数**: `target` — 目标玩家
- **返回**: 概率值（0~1）
- **说明**: 预测目标有酒的概率

### `seatPressure(me, target)`
- **类型**: 函数
- **参数**:
  - `me`: 当前玩家
  - `target`: 目标玩家
- **返回**: 座位压力值
- **说明**: 计算目标对当前玩家的座位压力

---

## 四、评分与决策

### `situationFactor(me)`
- **类型**: 函数
- **参数**: `me` — 当前玩家
- **返回**: 局势因子对象
- **说明**: 评估当前局势（节奏、风险、经济等）

### `targetScore(me, target)`
- **类型**: 函数
- **参数**:
  - `me`: 当前玩家
  - `target`: 目标玩家
- **返回**: 目标评分
- **说明**: 计算对目标的攻击/保护评分

### `forecastSummary(me)`
- **类型**: 函数
- **参数**: `me` — 当前玩家
- **返回**: 预测摘要
- **说明**: 预测未来几回合的局势变化

### `burstThreatOf(me, target)`
- **类型**: 函数
- **参数**:
  - `me`: 当前玩家
  - `target`: 目标玩家
- **返回**: 爆发威胁值
- **说明**: 计算目标对当前玩家的爆发伤害威胁

### `maxBurstThreat(me)`
- **类型**: 函数
- **参数**: `me` — 当前玩家
- **返回**: 最大爆发威胁值
- **说明**: 计算所有敌人对当前玩家的最大爆发威胁

### `cardValueOf(card)`
- **类型**: 函数
- **参数**: `card` — 卡牌对象
- **返回**: 卡牌价值
- **说明**: 计算卡牌的战术价值

### `enemiesOf(me)`
- **类型**: 函数
- **参数**: `me` — 当前玩家
- **返回**: 敌人列表
- **说明**: 获取当前玩家的所有敌人

### `isEnemyOf(me, target)`
- **类型**: 函数
- **参数**:
  - `me`: 当前玩家
  - `target`: 目标玩家
- **返回**: `boolean`
- **说明**: 判断目标是否是敌人

---

## 五、牌堆记忆

### `deckMemory`
- **类型**: 对象
- **方法**:
  - `cardRemaining(type)` — 计算某类牌剩余数量
  - `deckConsume(card)` — 消耗一张牌
  - `deckReset()` — 重置牌堆记忆
  - `totalRemaining()` — 总剩余牌数
- **说明**: 牌堆剩余牌数追踪

---

## 六、认知与冲突检测

### `cognitionLog`
- **类型**: 对象
- **方法**:
  - `log(data)` — 记录一次认知决策
  - `recent()` — 获取最近的认知日志
  - `stats()` — 获取认知统计
  - `reset()` — 重置认知日志
- **说明**: 模型决策的认知日志

### `conflict`
- **类型**: 对象
- **方法**:
  - `detect(best, modelConf, metaMod, ctx)` — 检测冲突
  - `recent()` — 获取最近的冲突记录
  - `stats()` — 获取冲突统计
  - `reset()` — 重置冲突记录
- **说明**: 模型决策与规则决策的冲突检测

### `calibrator`
- **类型**: 对象
- **方法**:
  - `modelTrust()` — 获取模型信任度
  - `record(best, modelConf, ctx)` — 记录校准数据
  - `reset()` — 重置校准数据
- **说明**: 模型校准器

### `metaCognition`
- **类型**: 对象
- **方法**:
  - `effective(modelConf, metaMod)` — 计算有效干预级别
- **说明**: 元认知模块

### `strategyBus`
- **类型**: 对象
- **方法**:
  - `arbitrate(best, modelConf, me, acts)` — 策略总线仲裁
  - `reset()` — 重置策略总线
- **说明**: 策略总线仲裁模块

---

## 七、决策记录

### `decision`
- **类型**: 对象
- **方法**:
  - `log(me, layers, candidates, winner)` — 记录一次决策
  - `recent()` — 获取最近的决策记录
  - `reset()` — 重置决策记录
- **说明**: 决策记录与回放

### `postCheck`
- **类型**: 对象
- **方法**:
  - `check(me, best, result)` — 决策后检查
  - `stats()` — 获取检查统计
- **说明**: 决策后验证模块

### `decisionHooks`
- **类型**: 对象
- **说明**: 决策钩子系统

---

## 八、面板与 UI

### `openSelfCheck()`
- **类型**: 函数
- **说明**: 打开自检面板

### `openScorePanel()`
- **类型**: 函数
- **说明**: 打开评分面板

### `openNarratorPanel()`
- **类型**: 函数
- **说明**: 打开决策叙述面板

### `openProfilerPanel()`
- **类型**: 函数
- **说明**: 打开性能分析面板

### `openCalibratorPanel()`
- **类型**: 函数
- **说明**: 打开校准面板

### `openBrainDashboard()`
- **类型**: 函数
- **说明**: 打开大脑仪表盘

### `openComparePanel()`
- **类型**: 函数
- **说明**: 打开对比面板

---

## 九、训练与导出

### `bandit`
- **类型**: 对象
- **方法**:
  - `stats()` — 获取 Bandit 算法统计
  - `reset()` — 重置 Bandit 数据
- **说明**: Bandit 多臂老虎机算法

### `autoFeature`
- **类型**: 对象
- **方法**:
  - `stats()` — 获取自动特征权重统计
  - `top(n)` — 获取权重最高的 n 个特征
  - `reset()` — 重置自动特征
- **说明**: 自动特征权重学习

### `discover`
- **类型**: 对象
- **方法**:
  - `stats()` — 获取自动发现统计
- **说明**: 自动发现模块

### `evolution`
- **类型**: 对象
- **说明**: 进化学习模块

### `modelGuard`
- **类型**: 对象
- **方法**:
  - `guardCheck(me, best, ctx)` — 模型护栏检查
  - `status` — 护栏状态
- **说明**: 模型护栏（防止 AI 做出违规决策）

### `modelState`
- **类型**: 对象
- **方法**:
  - `getState()` — 获取模型状态
- **说明**: 模型状态管理

### `hotSwap`
- **类型**: 对象
- **说明**: 模型热更新

---

## 十、其他工具

### `psychology`
- **类型**: 对象
- **说明**: 玩家心理分析模块

### `comboChain`
- **类型**: 对象
- **说明**: 连招链分析模块

### `playerMemory`
- **类型**: 对象
- **说明**: 玩家记忆模块

### `profiler`
- **类型**: 对象
- **说明**: 性能分析器

### `narrator`
- **类型**: 对象
- **说明**: 决策叙述模块

### `identity`
- **类型**: 对象
- **说明**: 身份判断模块

### `memory`
- **类型**: 对象
- **说明**: 游戏记忆模块

### `checkAllyExempt(target)`
- **类型**: 函数
- **参数**: `target` — 目标玩家
- **返回**: `boolean`
- **说明**: 检查友方是否豁免（不应该被攻击）

### `cardStrategy`
- **类型**: 对象
- **说明**: 卡牌策略模块

### `cardTags`
- **类型**: 对象
- **说明**: 卡牌标签模块

### `viewAs`
- **类型**: 对象
- **说明**: 视为模块

### `skillTiming`
- **类型**: 对象
- **说明**: 技能时机模块

### `skillProfile`
- **类型**: 对象
- **说明**: 技能画像模块

### `multiProfile`
- **类型**: 对象
- **方法**:
  - `reset()` — 重置多画像
- **说明**: 多画像系统

### `charStore`
- **类型**: 对象
- **方法**:
  - `update(charName, stats)` — 更新武将统计
  - `top(limit)` — 获取排行榜
  - `get(charName, mode)` — 获取武将记录
  - `allModes()` — 获取所有模式
  - `clear(mode)` — 清除统计
  - `currentMode()` — 获取当前模式
- **说明**: 武将统计存储

### `report`
- **类型**: 对象
- **说明**: 报告生成模块

### `archive`
- **类型**: 对象
- **说明**: 归档模块

---

## 十一、模型输出标签说明

模型输出的 6 个神经元（A/B/C/D/E/F）含义：

| 标签 | 含义 | 说明 |
|------|------|------|
| A | 引擎 | 规则引擎决策（基础策略） |
| B | 换牌 | 出牌/换牌动作 |
| C | 结束 | 结束回合 / 防御 |
| D | 进攻 | 攻击类动作（杀、决斗、AOE 等） |
| E | 装备 | 装备相关动作 |
| F | 技能 | 技能发动动作 |

---

## 十二、快速测试

在游戏控制台输入以下命令测试接口：

```javascript
var d = !!window.__DJSC;
var w = d && typeof __DJSC.weightsReady === 'function' ? __DJSC.weightsReady() : '未挂载';
var c = d && typeof __DJSC.cfg === 'function' ? __DJSC.cfg('useTrainedModel', false) : '未挂载';
var f = d && typeof __DJSC.confidence === 'function';
alert("检查结果:\n__DJSC存在: " + d + "\n权重就绪: " + w + "\n模型开关: " + c + "\n置信度函数: " + f);
```

---

## 版本

- **版本**: v2.5
- **更新日期**: 2026-09-23
