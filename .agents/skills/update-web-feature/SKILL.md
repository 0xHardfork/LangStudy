---
name: update-web-feature
description: Guides the agent to modify, optimize, or refactor an existing web frontend feature. Use this for UI bug fixes, style adjustments, performance improvements, or React component refactoring.
---

# Update Web Feature Skill (React Frontend)

This skill guides the agent to safely and efficiently modify or refactor an existing feature in the `LangStudy` web frontend using React 19 / TypeScript / Zustand / Tailwind v4.

## Development Workflow

### 1. Impact Assessment
Before modifying any shared component, Zustand store field, or API service function:
- Search for all usages of the code being changed across the frontend codebase.
- Confirm that no other pages or components will be silently broken.
- If the change modifies a shared API response type in `src/types/`, update all consumers of that type.

### 2. Styling Rules
- **Never use inline `style={{}}` or raw CSS files.** Migrate any existing inline styles to Tailwind utility classes during the update.
- Ensure all transition and animation effects are consistent with the existing UI (e.g., `transition-all duration-200`).
- Verify that the updated UI works correctly in dark mode.

### 3. Zustand Store Modifications
If adding, modifying, or removing a field in `src/store/useAppStore.ts`:
- Update every component that references the changed field.
- **Always** update the store's `reset()` function to include the new field, ensuring it is cleared on logout.

### 4. API Contract Changes
If the backend API response shape changes:
- Update the TypeScript type definition in `src/types/`.
- Update the corresponding API function in `src/services/api.ts`.
- Check all components that consume the data and update them accordingly.

### 5. File Size & Component Splitting
- After modifications, if any file exceeds 300 lines, split it into sub-components.
- Move shared sub-components to `src/components/<feature>/` and page-specific components to `src/pages/`.

### 6. Verification
After completing changes, run:
```bash
# Frontend type check and build
npm run build
```
Fix all TypeScript errors and build failures before delivering.
