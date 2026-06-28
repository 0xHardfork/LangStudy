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

### Token 管理
- Token 的读写通过 `useAppStore` 的 `setToken()` 统一处理，禁止在组件内直接操作 `localStorage`
- **禁止**：`localStorage.setItem('token', t)` / `localStorage.getItem('token')`
- **使用**：`const { token, setToken } = useAppStore()`

### Token 传递
- Token **不通过 props 传递**给子组件
- 子组件直接从 `useAppStore` 读取：`const { token } = useAppStore()`

### Store 规范
- `reset()` 必须重置所有字段到初始值（包括 `fillBlankLevel`、`exerciseResult`）
- 新增全局状态时同步更新 `reset()` 函数

---

## API 调用规范

### 统一使用 `apiCall` 封装

所有 API 请求必须通过 `src/services/api.ts` 中的具名函数，禁止在组件内裸调 `fetch`。

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

## 安全规范

### Token 存储（当前状态）
当前 token 存储在 `localStorage`（存在 XSS 风险）。
**待办**：迁移到 `HttpOnly Cookie`，需后端配合修改 `/login` 接口。

### 不要在 UI 中暴露服务端错误
捕获到 `status >= 500` 的错误时，统一显示通用消息，不直接透传服务端错误字符串。
