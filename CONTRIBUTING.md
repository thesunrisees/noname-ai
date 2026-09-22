# 贡献指南

感谢你考虑为无名AI 做贡献！

## 如何贡献

### 报告 Bug

1. 先搜索 [Issues](https://github.com/你的用户名/仓库名/issues)，确认没有重复
2. 用 [Bug 模板](.github/ISSUE_TEMPLATE/bug_report.md) 提交
3. 附上复现步骤、环境信息、控制台日志

### 提建议

1. 用 [Feature 模板](.github/ISSUE_TEMPLATE/feature_request.md) 提交
2. 描述清楚你想解决的问题和期望的解决方案

### 提交代码

1. Fork 本仓库
2. 创建分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'Add some feature'`
4. 推送到分支：`git push origin feature/your-feature`
5. 提交 Pull Request

## 开发规范

### 代码风格

- 所有模块统一挂载到 `window.__DJSC`
- 所有导出函数必须 `try-catch` 包裹
- localStorage 操作必须 `try-catch`
- 私有变量用 `_` 开头，公开接口不用

### 新增模块规范

1. 文件放在 `score/` 目录
2. 必须 `import { log } from './logger.js'`
3. 必须有挂载段：`window.__DJSC.xxx = { ... }`
4. 必须有 `stats()` 和 `reset()` 接口
5. 新增模块后必须在 `engine.js` 加 `import './xxx.js'`
6. 新增模块后必须在 `selfCheck.js` 加检查项

### 面板开发规范

- 统一用全屏遮罩（不用 `ui.create.dialog`）
- 统一颜色：背景 `#0a1018`，面板 `#14243c`，标题 `#9ad8ff`
- 必须有关闭按钮

## 提交前检查

- [ ] 代码能正常运行，不报错
- [ ] 新增模块已在 `engine.js` 加 import
- [ ] 新增模块已在 `selfCheck.js` 加检查项
- [ ] 控制台没有红色错误
- [ ] 自检面板全绿

## 行为准则

请保持友善、尊重，不发表攻击性言论。详见 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。
