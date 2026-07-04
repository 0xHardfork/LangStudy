# LangStudy Frontend Development Rules

## 技术栈

- **框架**：React 19 + TypeScript（strict mode）
- **构建**：Vite 8
- **状态管理**：Zustand（`src/store/useAppStore.ts`）
- **样式**：TailwindCSS v4（**唯一允许的样式方案**）
- **HTTP 请求**：通过 `src/services/api.ts` 统一封装，禁止在组件内直接 `fetch`
- **路由**：react-router-dom（待迁移完成后使用）

---

## 目录结构规范

```
frontend/src/
├── App.tsx              # 仅负责：路由声明 + AuthGuard
├── main.tsx
├── style.css            # 全局样式 + Tailwind 初始化
├── pages/               # 页面级组件（直接对应一个路由）
│   ├── Login.tsx
│   ├── Home.tsx
│   └── ...
├── components/
│   ├── common/          # 通用、可复用的 UI 组件
│   │   └── AudioPlayer.tsx
│   ├── dialogue/        # 对话功能相关组件
│   ├── grammar/         # 语法功能相关组件
│   ├── review/          # 复习功能相关组件
│   └── layout/          # 布局组件（Header、Sidebar 等）
├── hooks/               # 自定义 hooks（useAuth, useAudio 等）
├── services/
│   └── api.ts           # 所有 API 调用的唯一入口
├── store/
│   └── useAppStore.ts   # Zustand 全局状态
└── types/
    └── index.ts         # 所有共享 TypeScript 类型
```

### 规则
- **页面级组件**放 `pages/`，通用/可复用组件放 `components/`
- 不要在 `pages/` 里写业务逻辑组件，不要在 `components/` 里写路由页面
- 单个文件 **不超过 300 行**。超过时必须拆分为子组件或自定义 hook
- 新功能模块在 `components/` 下建子目录（如 `components/grammar/`）

---

## 样式规范

### ✅ 必须使用 TailwindCSS className

```tsx
// ✅ 正确
<button className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors">
  提交
</button>
```

### ❌ 禁止 inline style

```tsx
// ❌ 禁止
<button style={{ padding: '8px 16px', background: '#7c3aed', color: 'white' }}>
  提交
</button>
```

### ❌ 禁止 JS hover 模拟（onMouseEnter/Leave 切换样式）

```tsx
// ❌ 禁止
onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(124,58,237,0.1)'}
```

使用 Tailwind `hover:` 前缀代替：

```tsx
// ✅ 正确
className="bg-transparent hover:bg-violet-600/10 transition-colors"
```

### 颜色规范
参考 `Login.tsx` 的调色盘，保持风格统一：
- 背景底色：`bg-slate-950`
- 卡片背景：`bg-slate-900/60`
- 边框：`border-slate-800`
- 主色：`blue-500` / `violet-500`（渐变 `from-blue-500 to-violet-500`）
- 文字：`text-white`、`text-slate-400`、`text-slate-200`

---

## 状态管理规范

### 登录态与 Cookie 校验 (HttpOnly)
- **规则**：全站身份验证完全废弃基于 `localStorage` 的 Token 存储方案，迁移至安全的 `HttpOnly Cookie`。
- **具体要求**：
  - **禁止**在前端代码中调用 `localStorage.setItem('token', ...)`，也不允许在 Zustand Store 中维护与缓存活跃的 `token` 字符串。
  - 前端路由守卫（如 `RequireAuth`）判断是否已登录，必须依据全局状态树中的 `state.user` 对象是否为空。
  - 用户登录成功时，后端接口不再返回 `token`，而是返回已登录的用户档案对象。前端接收后，调用 `setUser(user)` 挂载到 Store。
  - 应用在初始化/页面刷新时，调用 `getProfile()` 发起无参数请求核验 Cookie，如若成功则保存用户实体 `setUser(user)`，否则清空状态 `reset()` 引导至登录页。
  - 登出动作必须向 `/api/v1/logout` 发起 POST 请求清空后端 Cookie 凭证，然后调用本地 `reset()`。

### Store 规范
- `reset()` 必须重置所有字段到初始值（包括 `fillBlankLevel`、`exerciseResult` 等，且将 `user` 设为 `null`）。
- 新增全局状态时同步更新 `reset()` 函数。
- **配置自同步**：在调用 `setLearningProfile(profile)` 更新用户个人设置时，必须自动提取其中的默认填空等级 `profile.fill_blank_level` 并覆盖赋值到全局 `fillBlankLevel` 字段，以保证开始学习时正确初始化用户的默认难度设定。

---

## API 调用规范

### 统一使用 `apiCall` 封装

所有 API 请求必须通过 `src/services/api.ts` 中的具名函数，禁止在组件内裸调 `fetch`。
- **凭证附带**：底层 API 通用请求器 `apiCall` 必须显式配置 `credentials: 'same-origin'`，保证浏览器发送请求时自动附带认证 Cookie，同时在 Headers 中移除手动拼接 `Authorization` Bearer Token 的逻辑。

```tsx
// ✅ 正确：通过 services/api.ts 封装的函数
import { getProfile } from '../services/api'
const user = await getProfile(token)

// ❌ 禁止：在组件内直接 fetch
fetch('/api/v1/profile', { headers: { Authorization: `Bearer ${token}` } })
```

### URL 参数编码
查询参数必须使用 `URLSearchParams` 进行编码：

```tsx
// ✅ 正确
const params = new URLSearchParams({ topic, language, level })
apiCall(token, `/dialogue/shared?${params.toString()}`)

// ❌ 禁止（language/level 未编码）
apiCall(token, `/dialogue/shared?topic=${encodeURIComponent(topic)}&language=${language}`)
```

### 错误处理
- 5xx 错误统一显示通用提示，不把内部错误信息暴露给用户
- 网络错误统一显示"网络请求失败，请检查网络连接"

### 使用 `useRequest` 统一管理 Loading & Error 状态
- 异步接口的加载（`loading`）和错误（`error`）状态必须通过通用泛型 Hook `src/hooks/useRequest.ts` 管理，禁止在页面级或复杂组件中重复定义临时的 `const [loading, setLoading] = useState(false)` 等模板代码。

---

## 类型规范

### 统一在 `types/index.ts` 定义
所有跨组件共享的 TypeScript interface/type 必须定义在 `src/types/index.ts`，禁止在组件内重复定义。

```tsx
// ✅ 正确
import type { AuthUser } from '../types'

// ❌ 禁止：在组件内重复定义已存在的 interface
interface AuthUser {
  id: number
  username: string
  // ...
}
```

### 开启 `"noUncheckedIndexedAccess": true` 后的安全要求
- 针对数组元素（如 `arr[idx]`、`arr[0]`）或字符串索引访问的取值，其推导类型均会带有 `| undefined`。
- **必须**使用前置非空判断（Type Guards，如 `if (!item) return`）或空值合并运算符（`??`）进行保护，**严禁**使用 `!` 进行强制非空断言。

---

## 组件规范

### 可复用组件必须提取
当同一组件逻辑在 **2处以上** 出现时，必须提取到 `components/common/` 目录。

**已有通用组件**（禁止在其他文件重复实现）：
- `components/common/AudioPlayer.tsx`：导出 `AudioControls`（播放+循环）和 `ListPlayButton`（单键播放）

### 组件文件不超过 300 行
超过 300 行时，将子功能提取为独立组件或 hook。

---

## 样式文件构建规范

### Google 字体及外部样式 @import 优先级
- **规则**：在 `style.css` 中引入外部 Google Fonts 字体或第三方样式表时，其 `@import url(...)` 规则必须放置在文件的**最顶部**（排在 `@import "tailwindcss";` 之前）。
- **原因**：Tailwind v4 会在展开编译时在原地插入大量基础样式规则。如果将其他 `@import` 写在它的下方，会导致 PostCSS 报出 `@import must precede all other statements` 错误而造成 Vite 构建中断。

---

## 安全规范

### Cookie 安全隔离
- 全站采用基于 `HttpOnly`、`SameSite=Lax`、`Path=/` 的安全 Cookie 存储 JWT。由于 Cookie 具备 `HttpOnly` 特性，前端 JavaScript 代码无法直接读取凭证，从而在物理上消除了 XSS 获取 Token 的安全隐患。

### 不要在 UI 中暴露服务端错误
- 捕获到 `status >= 500` 的错误时，统一显示通用消息，不直接透传服务端错误字符串。

---

## 前端 Vibe 最佳实践 (Frontend Best Practices)

为了保证视觉体验的高级感、防范白屏崩溃、以及前后端并行开发，必须遵循以下规则：

### 1. 动效与微交互 (Micro-interactions)
- **拒绝硬性突变**：为所有的交互元素（按钮悬停、卡片悬停、弹窗显示、加载状态切换等）配置平滑的 Tailwind 过渡动画，例如：`transition-all duration-200 hover:scale-[1.01]`，或 `transition-colors duration-200`。
- 交互状态的改变必须具有平滑渐变感，以建立高级、流畅的用户界面质感。

### 2. Mock 数据先行 (Mock-First Development)
- **前后端并行开发**：当新功能的后端 API 尚未编写完成或无法连通时，**优先在 `src/services/api.ts` 中实现对应的 mock 数据，并可模拟延迟 300-500ms 返回**。
- 这有助于立即开始前端的页面布局、交互设计和状态测试，避免前端因“等待后端接口”而卡住。

### 3. Zustand 状态树的衍生状态与 Selector
- **避免状态冗余**：Zustand Store 中仅存储基础原始数据，不要存储能通过已有状态计算得出的派生状态（例如“已选择列表的长度”、“根据列表项过滤后的结果”等）。
- 派生状态应在组件内部使用 React `useMemo` 计算，或使用 Zustand selector 进行提取，避免多处状态同步不同步导致的数据流 Bug。

### 4. 防御性渲染与优雅降级 (Graceful Degradation)
- **防崩溃/白屏**：对可能存在空指针的接口数据访问（如 `data?.title` 或 `list?.[0]?.name`）必须做好安全链（Optional Chaining）和默认空值保护。
- 对于各种空数据状态，必须提供专用的占位组件或优雅的缺省文本展示；当接口请求加载时，必须呈现占位图（Skeleton）或平滑的加载动效，杜绝未处理的闪烁或直接空白。
