# 无名AI v2.0 · 开发者文档

> 三国杀纯策略决策扩展 · 具备自我感知、自我学习、自我校准、自我进化的完整闭环系统
> 
> 本扩展为「无名AI + 决策积分引擎」整合版（v2.0），在遵守 GPL 3.0 协议的前提下允许任何人二次修复与使用
> 
> [点我跳转无名杀项目](https://github.com/libnoname/noname)

---

## 一、快速开始

### 1.1 安装

1. 下载 `无名AI_v2.0_发布版.zip`
2. 解压到无名杀扩展目录
3. 重载扩展即可

### 1.2 验证安装

打开无名杀控制台（F12），跑：

```javascript
// 自检所有模块
(function () {
  const D = window.__DJSC;
  const lines = [];
  const checks = [
    ['weights', 'object'], ['features', 'function'], ['engine', 'function'],
    ['calibrator', 'object'], ['metaCognition', 'object'],
    ['cognitionLog', 'object'], ['conflict', 'object'],
    ['multiProfile', 'object'], ['strategyBus', 'object'],
    ['modelGuard', 'object'], ['elementFB', 'object'],
    ['weightPersist', 'object'], ['crossMode', 'object'],
    ['compare', 'object'], ['hotSwap', 'object'],
    ['shared', 'object'], ['evolution', 'object'],
  ];
  checks.forEach(function ([k, t]) {
    const v = D[k];
    const ok = t === 'object' ? (v && typeof v === 'object') : typeof v === t;
    lines.push((ok ? '✅' : '❌') + ' ' + k);
  });
  alert(lines.join('\n'));
})();
```

### 1.3 打开面板

| 面板 | 控制台调用 | 配置面板按钮 |
|---|---|---|
| AI 大脑总览 | `window.__DJSC.openBrainDashboard()` | 🧠 打开 · AI 大脑总览 |
| 校准趋势 | `window.__DJSC.openCalibratorPanel()` | 📈 打开 · 决策校准趋势 |
| 决策回放 | `window.__DJSC.openReplayPanel()` | 🎬 打开 · 决策回放时间轴 |
| 决策对比 | `window.__DJSC.openComparePanel()` | ⚖️ 打开 · 决策对比模式 |
| 模型热更新 | `window.__DJSC.hotSwap.stats()` | 🔥 打开 · 模型热更新 |
| 公共知识库 | `window.__DJSC.shared.stats()` | 🤝 打开 · 公共知识库 |
| 策略进化 | `window.__DJSC.evolution.stats()` | 🧬 打开 · 策略进化 |
| 模块自检 | `window.__DJSC.openSelfCheck()` | 🔍 打开 · 模块自检面板 |

---

## 二、系统架构

### 2.1 整体闭环

```
┌─────────────────────────────────────────────────────────┐
│                    AI 大脑（闭环系统）                    │
├─────────────────────────────────────────────────────────┤
│  感知层：elementAccess   → 读取/定义技能/卡牌/武将       │
│  学习层：elementFeedback → 观察实战，自动修正定义         │
│  自省层：metaCognition   → 知道自己熟不熟                │
│  分权层：confidence      → rule/blend/model/skip         │
│  仲裁层：strategyBus     → 冲突时用规划裁决              │
│  校准层：decisionCalibrator → 从结果回填自动微调         │
│  模仿层：multiProfile    → 多档案互相学习                │
│  护栏层：modelGuard      → 红线拦截，防错动作            │
│  固化层：weightPersist   → 校准偏移刻进模型权重          │
│  迁移层：crossModeTransfer → 跨模式共享通用认知            │
│  对比层：decisionCompare → 多档案同局对比                │
│  进化层：evolution       → 遗传算法优化策略                │
│  热更层：modelHotSwap    → 攒样本训练→A/B→晋升          │
│  协同层：sharedKnowledge → 公共知识库群体智慧              │
│  观测层：cognitionLog / conflict / calibratorPanel /     │
│          brainDashboard / replayPanel / comparePanel     │
└─────────────────────────────────────────────────────────┘
```

### 2.2 决策流程

```
枚举候选动作
    ↓
特征提取（96维 Int8）
    ↓
元认知评估（6维 → familiarity/modulator/level）
    ↓
规则打分 + 模型预测（多层网络 96→64→6）
    ↓
分权融合（rule / blend / model / skip）
    ↓
策略总线仲裁（规则 vs 模型冲突时）
    ↓
模型护栏检查（8条红线）
    ↓
选择最高分动作
    ↓
执行 + 记录完整链路
    ↓
1500ms 后观察结果 → 校准器回填
    ↓
局结束 → 归档 + 热更新 + 进化 + 协同
```

---

## 三、模块文档

### 3.1 核心模块

#### features.js — 特征提取（96维）

```javascript
// 维度分配
0-47  基础局面特征（血量/手牌/装备/敌人等）
48-63 时序特征 + AI 自我状态（校准偏移 + 元认知熟悉度）
64-79 相对强度 + 元认知干预级别
80-95 概率/牌堆/全局校准统计

// 使用
const f = new Int8Array(96);
window.__DJSC.extractFeatures(me, act, ctx, f);
```

#### weights.js — 多层网络（96→64→6）

```javascript
// 接口
getWeights() / getBias()   // 旧接口兼容
predict(features)           // 推理
__getW1() / __getB1()      // 隐藏层权重（供热更新）
__getW2() / __getB2()      // 输出层权重（供热更新）
__applySnapshot(snapshot)   // 热替换权重
saveWeights()               // 保存到 localStorage
```

#### engine.js — 决策引擎

```javascript
// 核心函数
bestAction(me)              // 主决策入口
rulesDecide(me, acts)       // 规则打分
modelDecision(me, acts)     // 模型预测
settle()                    // 局结算（自动归档+校准+热更新+进化）
```

### 3.2 学习模块

#### metaCognition.js — 6维元认知

```javascript
// 6维架构
元素认知 35% / 模式认知 15% / 局面类型 15%
目标认知 10% / 局势认知 15% / 时间压力 10%

// 输出
{
  familiarity: 0~1,      // 熟悉度
  modulator: 0.5~1.0,    // 调制因子
  level: 'high'|'mid'|'low',
  intervention: 'model'|'blend'|'rule'|'skip'
}
```

#### decisionCalibrator.js — 自动校准

```javascript
// 偏移维度
{ atk, def, wAtkCard, wDefCard, modelTrust }

// 规则
单次调整 ≤ 0.03
累计偏差 ≤ 0.3
学习率衰减 0.95

// 接口
weights()          // 获取当前偏移
reset()            // 归零
stats()            // 统计信息
```

#### multiProfile.js — 多档案协同

```javascript
// 预置档案
均衡型 / 激进型 / 保守型 / 守护型 / 独狼型

// 融合规则
每 3 局融合一次
胜率 < 0.4 降权 0.5
胜率 > 0.6 升权 1.5
低胜率可模仿高胜率（70%自己+30%最优）

// 接口
effectiveShift()   // 获取当前有效偏移
recordResult(key, win)
imitateBest(key)
list()             // 所有档案
stats()            // 统计
```

### 3.3 决策模块

#### strategyBus.js — 策略总线

```javascript
// 触发条件
规则和模型都高置信（>0.55）但结论不同

// 仲裁方式
分差 > 5 → 直接选高分
调用 planner 走 2 步预测
简化版：检查目标是否有反制手段

// 接口
arbitrate(ruleBest, modelPick, me, candidates)
stats()
```

#### modelGuard.js — 模型护栏

```javascript
// 8条红线
打队友 / 过度出牌 / 自残 / 无意义装备等

// 冷却
30分钟

// 接口
check(action, me)
status()
```

### 3.4 观测模块

#### cognitiveLog.js — 认知日志

```javascript
// 记录内容
每次决策的完整链路
干预级别 / 模型置信 / 规则打分

// 接口
log(entry)
stats()
```

#### conflictDetector.js — 认知冲突检测

```javascript
// 检测
规则 vs 模型的决策分歧

// 接口
detect(ruleBest, modelPick)
stats()
```

### 3.5 进化模块

#### weightPersist.js — 权重持久化

```javascript
// 原理
把校准偏移固化进输出层偏置 B2
atk>0 → B2[D]（进攻标签）增加
def>0 → B2[C]（保守标签）增加
modelTrust>0 → 所有 B2 减小

// 触发
每局结束消化一次，消化后 shift 归零

// 接口
digest(shift, weightsModule)
onSettle()
stats()
```

#### crossModeTransfer.js — 跨模式迁移

```javascript
// 分层
global 层：技能/卡牌通用
modes 层：身份/国战/斗地主专精

// 读写规则
读取：当前模式 > 全局
写入：按 kind 自动分层
skill/card → global
character/identity/faction → mode

// 自动提升
某元素在 ≥3 个模式都出现 → 提升为全局

// 接口
read(kind, id)
write(kind, id, patch)
promote(kind, id, threshold)
autoPromote(threshold)
```

#### evolution.js — 策略进化

```javascript
// 遗传算法
种群大小：8
精英保留：Top 2
杂交：Top 40% 两两混合，单点交叉
变异：15% 概率随机扰动 ±0.08
淘汰：Bottom 20%
进化间隔：每 5 局

// 接口
record(genomeId, win)
current()          // 获取当前最优基因组
stats()
forceEvolve()
```

#### modelHotSwap.js — 模型热更新

```javascript
// 流程
攒够 300 样本 → 触发训练
训练结果存为"候选模型"
候选跑 20 局 A/B 测试
胜率超过旧模型 5% → 自动替换
否则丢弃

// 接口
trigger()          // 手动触发训练
recordScore(score)
promote()          // 手动晋升
discard()          // 手动丢弃
stats()
```

#### sharedKnowledge.js — 协同学习

```javascript
// 局面指纹
血量段 + 手牌段 + 敌人 HP 段 + 集火状态

// 群体智慧
每个指纹下记录"选择→胜率"
高置信（≥3样本）→ 给候选加分

// 接口
contribute(me, action, outcome)
recommend(me, ctx)
applyBonus(me, acts, ctx)
stats()
list(n)
```

---

## 四、开发者规范

### 4.1 代码风格

```javascript
// 1. 所有模块统一挂载到 window.__DJSC
window.__DJSC = window.__DJSC || {};
window.__DJSC.xxx = { ... };

// 2. 所有导出函数都必须 try-catch 包裹
export function xxx() {
    try {
        // 逻辑
    } catch (e) {
        // 静默失败，不影响游戏
    }
}

// 3. localStorage 操作必须 try-catch
function _save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
}

// 4. 变量命名
// 私有变量：_xxx（下划线开头）
// 公开接口：xxx（无下划线）
// 常量：XXX（全大写）

// 5. 注释规范
// 文件头：说明模块用途、原理、触发条件
// 关键逻辑：说明为什么这么做
// 函数：说明参数、返回值、副作用
```

### 4.2 新增模块规范

```javascript
// 1. 文件位置：score/xxx.js
// 2. 必须 import logger
import { log } from './logger.js';

// 3. 必须有挂载段
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.xxx = {
        func1: func1,
        func2: func2,
        stats: statsFunc,
        reset: resetFunc,
    };
}

// 4. 必须有 localStorage 持久化
const STORE_KEY = 'djsc_xxx_v1';
let _loaded = false;
function _load() { ... }
function _save() { ... }

// 5. 必须有 stats() 和 reset() 接口
export function stats() { ... }
export function reset() { ... }

// 6. 新增模块后必须在 engine.js 加 import
import './xxx.js';

// 7. 新增模块后必须在 selfCheck.js 加检查项
check('模块名', 'xxx', 'object');
check('模块名', 'xxx.stats', 'function');
```

### 4.3 面板开发规范

```javascript
// 1. 统一用全屏遮罩（不用 ui.create.dialog）
function _openFullscreenPanel(title, html) {
    // 关闭旧面板
    if (window.__DJSC_PANEL) {
        window.__DJSC_PANEL.remove();
        window.__DJSC_PANEL = null;
    }
    // 创建全屏面板
    const panel = document.createElement('div');
    panel.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; ...';
    // 挂到 document.body
    document.body.appendChild(panel);
    window.__DJSC_PANEL = panel;
}

// 2. 统一颜色
// 背景：#0a1018
// 面板：#14243c
// 主文字：#dbe7f5
// 标题：#9ad8ff
// 成功：#7fe3a0
// 警告：#ffd479
// 错误：#ff9c9c

// 3. 必须有关闭按钮
const closeBtn = document.createElement('div');
closeBtn.textContent = '✕ 关闭';
closeBtn.addEventListener('click', () => {
    panel.remove();
    window.__DJSC_PANEL = null;
});
```

### 4.4 特征系统规范

```javascript
// 1. 不新增维度，只填充预留位
// 96维固定，预留位从 f[48] 开始

// 2. Int8 范围 [-127, 127]
// 量化函数：q(v) = Math.round(v * 127)

// 3. 时序特征需要归一化
// 例如：f[62] = q(熟悉度)  // 0~1 → 0~127

// 4. 新增特征必须在 features.js 注释说明维度分配
```

### 4.5 权重系统规范

```javascript
// 1. Int8 量化，SCALE = 32
// 实际值 = int8_value / SCALE

// 2. 权重保存到 localStorage：djsc_weights_v3

// 3. 热更新用 __applySnapshot(snapshot)
// snapshot = { w1, b1, w2, b2 }

// 4. 权重修改后必须 saveWeights()
```

---

## 五、注意事项（必看）

### 5.1 常见坑

| 坑 | 解决方案 |
|---|---|
| 新建模块后忘记在 engine.js 加 import | 挂载代码不执行 → 自检报 undefined |
| 用 ui.create.dialog 打开面板 | 内容区空白 → 改用全屏遮罩 |
| 静态 import 导致整个 extension.js 加载失败 | 改成在 engine.js 显式 import |
| node --check 抓不到 ESM 顶层裸 return | 用 `node --input-type=module --check < file` |
| 硬拦截 useCard 返回 null 会导致游戏崩溃 | 改成仅日志不拦截 |
| 控制台不支持 console.table | 用纯文本字符串拼接 |
| `window.__DJSC={...}` 直接赋值覆盖其他模块 | 必须用 `Object.assign` 或 `|| {}` |

### 5.2 性能注意

| 项 | 说明 |
|---|---|
| 特征提取 | 每次决策都跑，必须 O(n) 复杂度 |
| 元认知计算 | 轻量，不超过 1ms |
| 校准器观察 | 1500ms 延迟，不阻塞决策 |
| 热更新训练 | 后台异步，不阻塞游戏 |
| localStorage 读写 | 必须 try-catch，避免存储爆炸 |
| 面板渲染 | 大数据量用虚拟滚动 |

### 5.3 数据持久化

| Key | 内容 | 上限 |
|---|---|---|
| djsc_weights_v3 | 模型权重 | 固定 |
| djsc_element_shadow_v1 | 元素影子表 | 自动清理 |
| djsc_metacog_v1 | 元认知数据 | 自动清理 |
| djsc_calibrator_v1 | 校准器偏移 | 累计 ≤ 0.3 |
| djsc_calib_history_v1 | 校准历史 | 200 条 |
| djsc_multi_profile_v1 | 多档案数据 | 8 个档案 |
| djsc_replay_v1 | 决策回放 | 20 局 × 50 条 |
| djsc_hotswap_v1 | 热更新数据 | 1 个候选 |
| djsc_shared_knowledge_v1 | 公共知识库 | 500 条 |
| djsc_evolution_v1 | 进化种群 | 8 个个体 |

### 5.4 兼容性

| 项 | 说明 |
|---|---|
| 96维特征 | 旧模型（48维）不兼容，需清空旧数据 |
| 旧训练数据 | 需执行 `window.__DJSC.trainBufferClear()` |
| 面板系统 | 全屏遮罩版，兼容所有无名杀版本 |
| localStorage | 所有数据都在 localStorage，清缓存即重置 |

---

## 六、调试技巧

### 6.1 快速验证

```javascript
// 1. 看所有模块挂载状态
Object.keys(window.__DJSC).forEach(k => console.log(k, typeof window.__DJSC[k]));

// 2. 看校准器偏移
console.log(window.__DJSC.calibrator.weights());

// 3. 看当前元认知
console.log(window.__DJSC.metaCognition.modulate({ type:'card', id:'sha' }, {}));

// 4. 看多档案状态
console.log(window.__DJSC.multiProfile.stats());

// 5. 看进化种群
console.log(window.__DJSC.evolution.stats());
```

### 6.2 清空数据

```javascript
// 清空所有学习数据
window.__DJSC.calibrator.reset();
window.__DJSC.metaCognition.reset();
window.__DJSC.multiProfile.reset();
window.__DJSC.weightPersist.reset();
window.__DJSC.crossMode.reset();
window.__DJSC.compare.reset();
window.__DJSC.hotSwap.reset();
window.__DJSC.shared.reset();
window.__DJSC.evolution.reset();
window.__DJSC.replay.reset();

// 清空训练样本
window.__DJSC.trainBufferClear();

// 清空权重（恢复默认）
localStorage.removeItem('djsc_weights_v3');
```

---

## 七、技术参数速查

| 参数 | 值 |
|---|---|
| 特征维度 | 96 维 |
| 网络结构 | 96 → 64(ReLU) → 6 |
| Int8 范围 | [-127, 127] |
| 分层量化 SCALE | 32 |
| 训练样本阈值 | 200（fast=300，slow=1000） |
| 元认知熟悉度分级 | ≥0.7 high，≥0.4 mid，<0.4 low |
| 干预级别权重 | model=0.5 / blend=0.3 / rule=0.1 / skip=0 |
| 护栏冷却 | 30 分钟 |
| 校准器单次调整 | ≤ 0.03 |
| 校准器累计偏差上限 | ≤ 0.3 |
| 校准器学习率衰减 | 0.95 |
| 多档案融合间隔 | 每 3 局 |
| 多档案胜率降权 | <0.4 降权 0.5 |
| 多档案胜率升权 | >0.6 升权 1.5 |
| 权重持久化学习率 | DIGEST_LR=8 |
| 热更新样本阈值 | 300 |
| 热更新 A/B 局数 | 20 |
| 热更新晋升阈值 | 胜率 +5% |
| 进化种群大小 | 8 |
| 进化精英保留 | Top 2 |
| 进化间隔 | 每 5 局 |
| 变异率 | 15% |
| 变异幅度 | ±0.08 |
