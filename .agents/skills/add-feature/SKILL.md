---
name: add-feature
description: Guides the agent to develop a complete new full-stack feature, covering backend API, web frontend, and Flutter mobile app simultaneously. Use this when the user asks to add a new end-to-end feature that spans all three layers of the system.
---

# Add Feature Skill (Full-Stack Orchestrator)

This skill guides the agent to develop a brand-new feature across **all three layers** of the `LangStudy` system: backend API, React web frontend, and Flutter mobile app. Follow each layer's dedicated skill in order.

## Development Order

Always develop layers in this dependency order to avoid blocking:
1. **Backend first** — API contract and database schema must be established before frontend and app can consume them.
2. **Web frontend second** — React page and components consuming the new backend API.
3. **Flutter app third** — Mobile feature consuming the same backend API.

---

## Layer 1: Backend (Go / Gin / GORM)
> Follow the `add-backend-feature` skill for full details.

**Key steps:**
- Define the data model in `internal/<domain>/model.go`.
- Write explicit migration SQL files in `migrations/` (`.up.sql` / `.down.sql`).
- Implement the three-layer architecture: `handler.go` → `service.go` → `store.go`.
- Enforce multi-tenant isolation: always extract `userID` from JWT context and filter by it in store queries.
- Register routes via `RegisterRoutes(public, authed, admin *gin.RouterGroup)`.
- If LLM prompts are involved, add them to `llm_configs` and seed the database via migration SQL.

**Verification:**
```bash
go build ./...
go test ./...
```

---

## Layer 2: Web Frontend (React 19 / TypeScript / Zustand / Tailwind v4)
> Follow the `add-web-feature` skill for full details.

**Key steps:**
- Add page-level components to `src/pages/`, sub-components to `src/components/<feature>/`.
- Declare all API calls in `src/services/api.ts` using the shared `apiCall` wrapper.
- Add cross-page state to `src/store/useAppStore.ts` and update the `reset()` function.
- Register the new route in the app router.
- Add Tailwind transitions for all interactive elements.
- Keep all files under 300 lines.

**Verification:**
```bash
npm run build
```

---

## Layer 3: Flutter App (Dart / Flutter / Cubit / GetIt)
> Follow the `add-app-feature` skill for full details.

**Key steps:**
- Create the full Clean Architecture structure under `lib/features/<feature_name>/` (models, data, cubit, view). Extract sub-widgets into `view/widgets/` when a page file exceeds ~300 lines.
- Implement `fromJson`/`toJson` on all models.
- Register `Datasource`, `Repository`, and `Cubit` in `lib/core/di/service_locator.dart`.
- Register the new page route in `lib/app/router/`.
- Use `Theme.of(context)` for all styling; never hardcode colors.

**Verification:**
```bash
flutter analyze
flutter test
```

---

## Cross-Layer Checklist
Before marking the feature as complete, confirm:
- [ ] Database migration applied and rollback tested
- [ ] Backend API compiles and all tests pass
- [ ] Web frontend builds with no TypeScript errors
- [ ] Flutter app passes `flutter analyze` with no issues
- [ ] The new feature is accessible on all three clients
