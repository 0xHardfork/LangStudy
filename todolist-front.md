# Frontend TODO List（剩余未完成项）

> 更新：2026-06-28（已完成项已标注 ✅）
> 优先级：🔴 立即修复 / 🟡 近期规划 / 🟢 有空改

---

## ✅ 已完成（本次优化）

- ✅ `AuthUser` 接口在 `App.tsx` 重复定义 → 已删除，统一从 `types/index.ts` import
- ✅ API 5xx 错误信息暴露 → `apiCall` 已加 5xx 屏蔽 + 网络错误统一提示
- ✅ `getSharedDialogue` URL 参数未编码 → 改用 `URLSearchParams`
- ✅ `App.tsx` 中裸 `fetch` 调用 → 改为 `getProfile()` 封装函数
- ✅ `store.reset()` 不完整 → 补全所有字段重置（含 `fillBlankLevel`、`exerciseResult`）
- ✅ Token 全局管理 → 加入 Zustand store，localStorage 操作集中在 `setToken()`
- ✅ 语言名硬编码 → 改用 `LANGUAGE_LABELS` 常量
- ✅ `AudioControls` 三处重复 → 提取到 `components/common/AudioPlayer.tsx`，统一 `onerror` 处理
- ✅ `dist/` 是否 gitignore → 已确认在 `.gitignore` 中，无需处理
- ✅ `antd` 使用情况 → `AdminDashboard.tsx` 有使用，保留合理
- ✅ `token` 仍通过 props 传递给每个子组件 → 已全部重构，改从 useAppStore(state => state.token!) 读取
- ✅ `App.tsx` 巨型组件拆分 → 已将 Auth、用户学习数据、Header 导航栏、路由条件渲染分别拆分至 `useAuth`、`useUserData`、`Header`、`Home` 中，`App.tsx` 缩减至 ~170 行
- ✅ `react-router-dom` 路由重构 → 已全面引入 `<BrowserRouter>` 与 `<Routes>`，实现真实 URL 路由切换
- ✅ `ReviewExercise.tsx` 大文件拆分 → 已将听力填空复习、语法单选复习从原 ~950 行的 `ReviewExercise.tsx` 中解耦，拆分成 `DialogueReview.tsx` 和 `GrammarReview.tsx`，原文件作为统一的 Tabs 切换看板，缩减至 ~110 行
- ✅ `GrammarDashboard.tsx` 大文件拆分 → 已将文章上传及列表、文章深度语法解析、完形填空选择题从原 ~750 行的 `GrammarDashboard.tsx` 中拆分到 `GrammarArticleList`、`GrammarArticleDetail` 和 `GrammarQuizCard` 中，原文件作为统一的页面控制器，缩减至 ~95 行
- ✅ `FillBlankExercise.tsx` 大文件拆分 → 已将历史完成行展示、听写填空答题卡片从原 ~610 行的 `FillBlankExercise.tsx` 中拆分到 `DialogueLineItem` 和 `FillBlankCard` 中，原文件作为单纯的学习进度和答题流程控制器，缩减至 ~195 行
- ✅ 语法讲解 Markdown 支持 → 新增 `Markdown.tsx` 组件，为英语文章语法讲解文本提供加粗、代码块、列表、多级标题等高级 Markdown 语法高亮渲染
- ✅ Tailwind 样式迁移 → 已将所有业务页面及弹窗组件（包含 `Home.tsx`、`AudioPlayer.tsx`、`Header.tsx`、`DialoguePreview.tsx`、`UserProfileModal.tsx`、`LearningHistory.tsx`、`TopicSelectModal.tsx`、`LanguageSelectModal.tsx`、`FillBlankExercise.tsx` 等）中的 inline style 风格完全迁移到 Tailwind CSS 类，删除了所有 JS 模拟 hover 的代码，全站实现全响应式支持
- ✅ Zustand 状态管理重构 & 消除 Prop Drilling → `user`、`learningProfile`、`dialogueTypes` 及 API 行为动作已并入 store；创建了 `hooks/useAuth.ts` 与 `hooks/useUserData.ts` 用以控制授权状态及配置拉取，各子组件不再通过 prop drilling 获取 token 与 profile
- ✅ 目录结构整理与路由化 → 已新增 `pages/` 目录用于承载路由页面，完成 `Header`、`Home`、`Login` 重构，引入 React Router DOM 实现路径化单页跳转，原 `App.tsx` 仅留存干净的路由地图配置

---

## 🔴 安全（需后端配合）

- [ ] **Token 存在 `localStorage`，XSS 风险**
  - 文件：`store/useAppStore.ts`（目前 `localStorage` 操作已集中于此）
  - 根本修复：迁移到 `HttpOnly Cookie`，需后端修改 `/login` 接口 + 移除前端手动传 `Authorization` Header
  - **短期缓解**：目前已封装到 store，禁止组件直接操作 localStorage（规则已写入 `.agents/rules/frontend.md`）

---

## 🟡 组件拆分（大文件需分拆）

*(所有大文件拆分项目已完成)*

---

## 🟡 样式统一（Tailwind 迁移，工作量最大）

*(已全部完成样式迁移)*

---

## 🟡 状态管理 & 数据层

- ✅ loading/error 状态统一封装 → 已编写通用泛型自定义 Hook `hooks/useRequest.ts`，重构了 `ReviewExercise`、`GrammarDashboard` 以及 `LearningHistory` 页面下的所有接口请求，消除了每个页面独立的 `loading`/`error` 本地状态声明

---

## 🟡 目录结构整理

*(页面拆分、Hooks 目录补充、路由重构已基本完成)*
- ✅ 页面级组件移入 `pages/` 并完成路径调整
- ✅ 确认 Tailwind v4 的初始化方式（v4 统一用 `@import "tailwindcss"`）
- ✅ 补充全局字体、scrollbar、animation keyframes (已统一配置于 style.css)

---

## 🟢 Minor

- ✅ **`tsconfig.json` 严格编译检查** → 已成功开启 `"noUncheckedIndexedAccess": true`，并对项目内所有受此规则影响的数组与字符串字符检索添加了安全的类型保护（Type Guards & Nullish Coalescing），彻底消除了数组索引越界引起的潜在运行时崩溃风险。

---

## 推荐执行顺序

```
阶段 1（独立可做）：
  └── token props 删除（从各组件 props 接口移除 token，改从 store 读）

阶段 2（配套做）：
  ├── App.tsx 拆分 → useAuth / useUserData / Header / AppRouter
  └── react-router-dom 接入（依赖 App.tsx 拆分）

阶段 3（最大工程量）：
  ├── 组件拆分（Review / Grammar / FillBlank）
  └── Tailwind 迁移（配合拆分同步进行，逐组件替换）

阶段 4（收尾）：
  ├── loading/error hook 统一
  ├── learningProfile/dialogueTypes 移入 store
  └── style.css 初始化 + tsconfig 严格模式
```
