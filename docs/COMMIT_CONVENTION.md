# Commit 规范

为了让自动生成 CHANGELOG 工作，请遵循以下 commit message 格式：

## 格式

```
<类型>: <主题>

<正文（可选）>
```

## 类型

| 类型 | 说明 | 示例 |
|---|---|---|
| `feat` | 新功能 | `feat: 新增决策回放模块` |
| `fix` | Bug 修复 | `fix: 修复校准面板挂载问题` |
| `docs` | 文档更新 | `docs: 更新 README` |
| `refactor` | 代码重构 | `refactor: 重构特征提取` |
| `chore` | 杂项 | `chore: 更新依赖` |
| `perf` | 性能优化 | `perf: 优化特征提取速度` |
| `test` | 测试 | `test: 增加校准器单元测试` |

## 示例

```
feat: 新增策略进化模块

- 遗传算法种群 8 个
- 精英保留 Top 2
- 每 5 局进化一次

closes #123
```

```
fix: 修复面板打开后内容空白问题

改用全屏遮罩方式，不用 ui.create.dialog
```

## 关联 Issue

在 commit message 里加上 `closes #123`，合并 PR 后会自动关闭对应的 Issue。
