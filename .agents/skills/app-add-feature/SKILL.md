---
name: app-add-feature
description: 指导代理开发 Flutter 移动端 App 的新功能、新增页面或业务组件。适用于用户要求在 App 中添加全新业务功能或模块的场景。
---

# App 新增功能开发技能 (App Add Feature Skill)

本技能指导代理如何在 `LangStudy` 的 Flutter 移动端 App 中高标准地开发一个全新的业务功能或模块。

## 开发步骤流程

### 1. 需求与设计对齐
- **确认 API 契约**：明确该功能所需的后端 API 接口。如果后端接口未就绪，应在 App 的数据源层（Datasource）先行提供 Mock 数据。
- **设计 UI 与交互**：理解页面所需的交互逻辑（加载状态、错误展示、刷新机制、暗黑模式适配等）。

### 2. 功能模块结构设计 (`lib/features/`)
在新功能的开发中，必须在 `lib/features/<feature_name>/` 下创建标准的 Clean Architecture 结构。严禁把所有代码写在单个文件中：

- **`models/`**：
  - 定义与后端交互的 Data Model。
  - 必须提供 `fromJson` 和 `toJson` 序列化方法。
- **`data/`**：
  - **`datasource/`**：声明并实现数据源类（例如 `xxx_remote_datasource.dart`），负责具体的 HTTP 请求（通常通过 Dio）或本地持久化缓存。
  - **`repository/`**：声明并实现 Repository 类（例如 `xxx_repository.dart`），负责处理业务数据逻辑，并将原始数据模型（Model）转换或提供给 Cubit 状态管理层。
- **`cubit/`**（或 `bloc/`）：
  - 存放 Cubit 类和 State 状态类。
  - **状态拆分规范**：状态定义应清晰反映业务生命周期，至少包含 `Initial`、`Loading`、`Loaded` (携带数据)、`Failure` (携带错误消息) 四种基本状态。
- **`view/`**：
  - 存放页面级 Widget（如 `xxx_page.dart`）。
  - 页面级 Widget 内部通常使用 `BlocProvider` 或 `BlocBuilder` 消费 Cubit 中的状态。
- **`widgets/`**：
  - 存放仅该功能模块内部使用的子组件、卡片、列表项等，避免 `view/` 页面文件代码过长（单个文件控制在 300 行内）。

### 3. 依赖注入与路由注册 (DI & Router)
- **依赖注入 (DI)**：
  - 将新写好的 `Datasource`、`Repository` 以及 `Cubit`（如果是全局单例的话）注册进 `lib/core/di/` 中的服务定位器中（通常使用 `GetIt`）。
- **路由注册 (Router)**：
  - 在 `lib/app/router/` 中注册新页面的路由路径（路由库通常采用 `go_router`），确保导航可以正确跳转。

### 4. 国际化多语言与主题配置
- **多语言（Localization）**：
  - 凡是展示给用户的静态文本，**严禁硬编码**。
  - 必须同步更新 `lib/l10n/` 下的翻译文件（`app_en.arb`、`app_zh.arb`、`app_ja.arb`），并运行 `flutter gen-l10n`（如果配置了自动生成，构建时会自动运行）来生成多语言类。
- **主题适配（Theme）**：
  - 使用 `Theme.of(context)` 获取颜色与文本样式，确保在新功能中完美适配暗黑模式和全局配色方案。

### 5. 验证与测试
- **代码分析**：在交付前必须在 `app/` 目录下运行 `flutter analyze`，确保代码中无静态分析错误或 Lint 警告。
- **单元与组件测试**：
  - 在 `test/features/<feature_name>/` 下编写相应的单元测试（如测试 Cubit 状态流转）或 Widget 测试。
  - 运行 `flutter test`，确保新功能测试及全局测试均通过。
