---
name: add-feature
description: 指导代理开发新功能、新增 API 端点或前端页面/组件。适用于用户要求添加全新业务功能或模块的场景。
---

# 新增功能开发技能 (Add Feature Skill)

本技能指导代理如何在 `LangStudy` 中高标准开发一个全新的业务功能，包含后端接口和前端页面。

## 开发步骤流程

### 1. 需求与设计对齐
- 澄清不确定的业务字段或交互逻辑，严禁自行猜想和脑补。
- 设计前后端交互的数据结构（API Request / Response 格式）。

### 2. 后端开发 (Go / Gin / GORM)
- **数据库设计**：
  - 在 `internal/<domain>/model.go` 中定义模型。
  - **必须**在 `migrations/` 下手工编写对应的 `.up.sql` / `.down.sql` 文件，并在开发或本地运行环境应用迁移。禁止隐式依赖 AutoMigrate。
- **三层架构设计**：
  - 新建或更新 `internal/<domain>/` 包下的三层文件：
    - `handler.go`：解析 HTTP 请求、提取鉴权 `userID`、绑定 JSON 并校验（如使用 Gin binding）。
    - `service.go`：实现核心业务逻辑，控制数据库事务（如使用 GORM `Transaction`）。
    - `store.go`：底层 GORM 数据库查询。
- **多租户隔离**：凡涉及用户个人数据的接口，必须严格从 JWT Context 中提取 `userID` 并透传到 Store 进行过滤校验。
- **路由注册**：在 Handler 中实现并暴露 `RegisterRoutes(public, authed, admin *gin.RouterGroup)`，并在路由总入口自注册。

### 3. 前端开发 (React 19 / TypeScript / Zustand / Tailwind v4)
- **组件及页面划分**：
  - 页面级组件放入 `src/pages/`，通用小组件或子功能组件放入 `src/components/<feature>/`。
  - 单个文件大小严格限制在 300 行以内，超过时必须拆分。
- **API 交互封装**：
  - 必须在 `src/services/api.ts` 中声明统一的请求函数，使用底层的 `apiCall` 包装器。
  - **Mock 数据先行**：如果后端接口未就绪，必须先在 `api.ts` 里模拟延迟数据进行前端 UI 验证。
- **全局状态**：
  - 如需跨页面状态，在 Zustand store（`src/store/useAppStore.ts`）中增加相应状态，并**务必**更新 `reset()` 函数确保用户登出时能完全清理该状态。
- **微交互与视觉**：
  - 为新添加的按钮、列表、弹窗等配备 Tailwind 过渡动效（例如 `transition-all duration-200`），保证交互的高级感。

### 4. 验证与构建
- 在提交前运行本地编译：
  - 后端：`go build ./...`
  - 前端：`npm run build` (vite build & tsc 编译)
- 运行新增功能的对应测试，确保不带任何编译错误或崩溃问题交付。
