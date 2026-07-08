---
name: update-feature
description: Guides the agent to modify, optimize, or refactor an existing full-stack feature, covering backend, web frontend, and Flutter mobile app simultaneously. Use this for cross-cutting bug fixes, API contract changes, or refactoring that spans all three layers.
---

# Update Feature Skill (Full-Stack Orchestrator)

This skill guides the agent to safely and consistently update an existing feature across **all three layers** of the `LangStudy` system: backend API, React web frontend, and Flutter mobile app.

## Before You Start: Cross-Layer Impact Assessment

When a change touches a shared contract (e.g., API response shape, database schema, or shared business logic), always assess the blast radius first:
- Which backend handlers, services, and stores are affected?
- Which React components or Zustand store fields consume the changed API or data type?
- Which Flutter models, Cubits, or Datasources depend on the changed contract?

Document the affected files before making any changes. This prevents accidental regressions in layers you didn't intend to modify.

---

## Layer 1: Backend (Go / Gin / GORM)
> Follow the `update-backend-feature` skill for full details.

**Key steps:**
- Search for all callers of any shared service, `platform/` library, or database model being changed.
- If modifying `internal/*/model.go`, write the corresponding `.up.sql` / `.down.sql` migration files.
- Preserve backward compatibility where possible. Discuss breaking API changes with the user before proceeding.
- Preserve all existing Zap structured logging; always pass `context.Context` through the call chain.
- If any hardcoded LLM prompt is encountered, extract it to `llm_configs` and seed it in the migration SQL.

**Verification:**
```bash
go build ./...
go test ./...
```

---

## Layer 2: Web Frontend (React 19 / TypeScript / Zustand / Tailwind v4)
> Follow the `update-web-feature` skill for full details.

**Key steps:**
- Search for all usages of the component, store field, or API function being changed.
- Update TypeScript type definitions in `src/types/` if the API contract changed.
- Update `src/services/api.ts` to match the new API shape.
- If a Zustand store field is modified or removed, update `reset()` and all consuming components.
- Migrate any remaining inline `style={{}}` to Tailwind classes encountered during the update.
- After modifications, ensure no file exceeds 300 lines.

**Verification:**
```bash
npm run build
```

---

## Layer 3: Flutter App (Dart / Flutter / Cubit / GetIt)
> Follow the `update-app-feature` skill for full details.

**Key steps:**
- Search for all usages of the Cubit, Repository, or model being changed.
- If a model's `fromJson`/`toJson` changes, verify all deserialization sites.
- If a Cubit state variant is added or removed, update all `BlocBuilder`/`BlocListener` consumers.
- If route paths or parameters change, update all navigation call sites.
- Update `service_locator.dart` if constructor signatures change.

**Verification:**
```bash
flutter analyze
flutter test
```

---

## Cross-Layer Checklist
Before marking the update as complete, confirm:
- [ ] All affected backend code compiles and tests pass
- [ ] API contract changes are reflected in both web `src/types/` and app models
- [ ] Web frontend builds with no TypeScript errors
- [ ] Flutter app passes `flutter analyze` with no issues
- [ ] No existing functionality in any layer has regressed
