---
name: add-web-feature
description: Guides the agent to develop a new frontend web feature, including pages, components, API service calls, and Zustand state. Use this when the user asks to add a new web UI page or feature in the React frontend.
---

# Add Web Feature Skill (React Frontend)

This skill guides the agent to develop a brand-new frontend feature in the `LangStudy` web app using React 19 / TypeScript / Zustand / Tailwind v4.

## Development Workflow

### 1. Requirements & Design Alignment
- Clarify the expected UI layout, user interaction flow (loading states, error states, empty states), and how it connects to backend APIs.
- If a backend API is not yet ready, mock the response in `src/services/api.ts` using a simulated delay to unblock frontend development.

### 2. Page & Component Structure
- Place page-level components in `src/pages/`.
- Place reusable sub-components or feature-specific widgets in `src/components/<feature>/`.
- **Strictly limit each file to 300 lines.** Split into sub-components when approaching the limit.

### 3. API Service Layer
- Declare all API request functions in `src/services/api.ts`, using the project's shared `apiCall` wrapper for consistent error handling and authentication.
- Do not make raw `fetch` or `axios` calls directly inside components or Zustand stores.

### 4. Global State (Zustand)
- If the feature requires state to be shared across pages, add the relevant state fields and actions to `src/store/useAppStore.ts`.
- **Always** update the store's `reset()` function to clear the new state fields on logout. Failing to do so causes stale data bugs.

### 5. Routing
- Register the new page route in the app's routing configuration (e.g., `src/App.tsx` or the dedicated router file).
- Use consistent path naming conventions matching the existing routes.

### 6. Visual Polish & Micro-Interactions
- Add Tailwind transition effects to all interactive elements (e.g., `transition-all duration-200`).
- Follow the existing dark-mode color palette and component design language.
- Never use inline `style={{}}` or raw CSS files — use Tailwind utility classes exclusively.

### 7. Verification
Before marking the task done, run:
```bash
# Frontend type check and build
npm run build
```
Fix all TypeScript type errors and build failures before delivering.
