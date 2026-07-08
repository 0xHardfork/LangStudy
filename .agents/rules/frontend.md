---
trigger: always_on
---

# LangStudy Frontend Development Rules

## Tech Stack

- **Framework**: React 19 + TypeScript (strict mode)
- **Bundler**: Vite 8
- **State Management**: Zustand (`src/store/useAppStore.ts`)
- **Styling**: TailwindCSS v4 (**the sole permitted styling solution**)
- **HTTP Requests**: Unified wrapping in `src/services/api.ts`; raw `fetch` or `axios` calls inside components are prohibited
- **Routing**: `react-router-dom`

---

## Directory Structure

```
frontend/src/
├── App.tsx              # App entry point: Route declarations + AuthGuard
├── main.tsx
├── style.css            # Global styles + Tailwind initialization
├── pages/               # Page-level components mapping directly to routes
│   ├── Login.tsx
│   ├── Home.tsx
│   └── ...
├── components/
│   ├── common/          # Reusable shared UI components
│   │   └── AudioPlayer.tsx
│   ├── dialogue/        # Dialogue feature-specific components
│   ├── grammar/         # Grammar feature-specific components
│   ├── review/          # Review feature-specific components
│   └── layout/          # Layout layout-specific components (Header, Sidebar, etc.)
├── hooks/               # Custom React hooks (useAuth, useAudio, etc.)
├── services/
│   └── api.ts           # Sole entry point for API requests
├── store/
│   └── useAppStore.ts   # Zustand global store
└── types/
    └── index.ts         # Shared TypeScript type definitions
```

### Rules
- **Page-level components** go to `pages/`; reusable components belong in `components/`.
- Do not write business logic or state containers directly in `pages/`; do not write routing bindings in `components/`.
- **File size limit**: Individual files must not exceed **300 lines**. Split into sub-components or custom hooks when approaching this limit.
- Feature-specific UI code must reside under subdirectories of `components/` (e.g., `components/grammar/`).

---

## Styling Specifications

### ✅ Always use TailwindCSS classNames

```tsx
// ✅ CORRECT
<button className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors">
  Submit
</button>
```

### ❌ Prohibited: Inline Styles

```tsx
// ❌ PROHIBITED
<button style={{ padding: '8px 16px', background: '#7c3aed', color: 'white' }}>
  Submit
</button>
```

### ❌ Prohibited: JS Hover Simulations (onMouseEnter/onMouseLeave toggling)

```tsx
// ❌ PROHIBITED
onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(124,58,237,0.1)'}
```

Always use Tailwind's `hover:` prefix:

```tsx
// ✅ CORRECT
className="bg-transparent hover:bg-violet-600/10 transition-colors"
```

### Color Palette Constraints
Adhere strictly to the color palette defined in `Login.tsx` to maintain UI consistency:
- Base Background: `bg-slate-950`
- Card Background: `bg-slate-900/60`
- Borders: `border-slate-800`
- Brand Primary: `blue-500` / `violet-500` (gradients: `from-blue-500 to-violet-500`)
- Text: `text-white`, `text-slate-400`, `text-slate-200`

---

## State Management Rules

### Session State & Cookie Authentication (HttpOnly)
- **Rule**: Defer all authentication token storage to `HttpOnly Cookies`. LocalStorage-based JWT storage is strictly decommissioned.
- **Implementation**:
  - **Never** call `localStorage.setItem('token', ...)` or cache raw JWT strings inside the Zustand store.
  - The routing guard (`RequireAuth`) must check the `state.user` object in the Zustand store instead of checking LocalStorage token presence.
  - Upon successful login, the backend returns the authenticated user's profile instead of the raw JWT. Call `setUser(user)` on the Zustand store to store the session.
  - Upon app initialization or page reload, call `getProfile()` without params to verify the HTTP cookie session. If successful, call `setUser(user)`; otherwise, call `reset()` and route the user to `/login`.
  - Logging out must dispatch a POST request to `/api/v1/logout` to clear the cookie session on the backend, followed by calling `reset()` locally.

### Store Rules
- `reset()` must clear all store fields to their initial states (including `fillBlankLevel`, `exerciseResult`, etc., setting `user` to `null`).
- Keep the `reset()` function updated when adding new state fields to the store.
- **Config Syncing**: When calling `setLearningProfile(profile)` to update user settings, retrieve the user's default level (`profile.fill_blank_level`) and assign it to the global `fillBlankLevel` state.

---

## API Request Rules

### Encapsulate Requests in `apiCall`

All API requests must go through named functions defined in `src/services/api.ts`. Raw `fetch` calls inside components are prohibited.
- **Credential Attachment**: The underlying `apiCall` helper must explicitly configure `credentials: 'same-origin'` to attach session cookies automatically. Do not manually append `Authorization` headers.

```tsx
// ✅ CORRECT: Wrapping API calls inside services/api.ts
import { getProfile } from '../services/api'
const user = await getProfile(token)

// ❌ PROHIBITED: Fetching directly inside the component
fetch('/api/v1/profile', { headers: { Authorization: `Bearer ${token}` } })
```

### URL Parameter Encoding
Encode all query parameters using `URLSearchParams`:

```tsx
// ✅ CORRECT
const params = new URLSearchParams({ topic, language, level })
apiCall(token, `/dialogue/shared?${params.toString()}`)

// ❌ PROHIBITED: Unencoded query parameters
apiCall(token, `/dialogue/shared?topic=${encodeURIComponent(topic)}&language=${language}`)
```

### Error Handling
- Server errors (`status >= 500`) must be masked with a generic user-friendly message. Never expose raw database or backend crash traces to users.
- Network exceptions must display `"网络请求失败，请检查网络连接"` (Network request failed, please check your connection).

### Loading & Error Management via `useRequest`
- Manage asynchronous fetch state (loading, error) using the shared generic hook `src/hooks/useRequest.ts`. Do not write duplicate `const [loading, setLoading] = useState(false)` boilerplate in individual page components.

---

## Type Specifications

### Centralize Types in `types/index.ts`
All shared TypeScript interfaces and types must reside in `src/types/index.ts`. Never define duplicate types inside individual components.

```tsx
// ✅ CORRECT
import type { AuthUser } from '../types'

// ❌ PROHIBITED: Defining duplicate interfaces
interface AuthUser {
  id: number
  username: string
}
```

### Safety Requirements under `"noUncheckedIndexedAccess": true`
- Accessing array elements (`arr[idx]`, `arr[0]`) or dictionary indices returns an inferenced type containing `| undefined`.
- **Always** protect these lookups using Type Guards (e.g. `if (!item) return`) or the nullish coalescing operator (`??`). Never use the non-null assertion operator `!`.

---

## Component Standards

### Extract Reusable Components
When a UI layout is used in **more than 2 places**, extract it as a shared component under `components/common/`.

**Existing Shared Components** (never reimplement these):
- `components/common/AudioPlayer.tsx`: Exposes `AudioControls` (play + loop) and `ListPlayButton` (single button play).

### Limit File Length to 300 Lines
If a component exceeds 300 lines, refactor it into smaller sub-components or extract state logic into custom hooks.

---

## Stylesheet Build Order

### @import Statement Priority in `style.css`
- **Rule**: Place all external font imports and third-party stylesheets (e.g., `@import url(...)`) at the **absolute top** of `style.css` (before `@import "tailwindcss";`).
- **Reason**: Tailwind v4 injects a large volume of reset and utility styles during compilation. If other `@import` rules are placed after Tailwind's import, PostCSS will throw a compilation error (`@import must precede all other statements`), failing the Vite build.

---

## Security Standards

### Cookie Session Protection
- Session validation relies on `HttpOnly`, `SameSite=Lax`, `Path=/` cookies containing the JWT. Since `HttpOnly` blocks JavaScript access, this completely mitigates XSS token extraction threats.

### Mask Server Details
- Intercept and mask all 5xx errors with generic messages, preventing raw backend errors from leaking to the user interface.

---

## Frontend Best Practices (Vibe Coding Support)

To guarantee micro-interaction quality, prevent page crashes, and facilitate parallel backend integration:

### 1. Transitions & Micro-interactions
- **No Abrupt UI Snapping**: Apply smooth Tailwind transitions to hover states, active states, modals, and loader toggles (e.g., `transition-all duration-200 hover:scale-[1.01]`).

### 2. Mock-First Development
- **Parallel Feature Development**: If the backend API for a new feature is not ready, implement a mocked response inside `src/services/api.ts` with a simulated delay of `300-500ms`. This enables full UI logic and layout verification without being blocked by API integration.

### 3. Derived State & Selectors
- **Avoid Redundant State**: Do not store state variables in the Zustand store that can be computed from existing variables (e.g., item count, filtered list). Compute them inside components using `useMemo` or using Zustand selectors.

### 4. Graceful Degradation & Null-Safety
- **Zero White-Screens**: Guard all API data access with optional chaining (`data?.title` or `list?.[0]?.name`).
- Provide empty state placeholders or fallback skeletons when content is loading or missing.
