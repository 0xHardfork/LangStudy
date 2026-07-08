---
name: update-backend-feature
description: Guides the agent to modify, optimize, or refactor an existing backend feature. Use this for bug fixes, performance improvements, database schema changes, or backend API contract adjustments.
---

# Update Feature Skill (Backend)

This skill guides the agent to safely and efficiently modify or refactor an existing backend feature in `LangStudy`, preventing regressions and maintaining system stability.

## Development Workflow

### 1. Impact Assessment
Before touching any shared code (e.g., `platform/` library, shared service interfaces, or database models), **always** search for all references first:
- Identify every caller or consumer of the code being changed.
- Confirm that the modification will not silently break other modules.
- If the change modifies an API response structure, assess the impact on both the web and app clients.

### 2. Database Schema Changes
If modifying a model struct in `internal/*/model.go`:
- **Always** write a corresponding migration file in `migrations/` (both `.up.sql` and `.down.sql`).
- Never rely on GORM `AutoMigrate` for production schema changes.

### 3. Backward Compatibility
- Avoid directly breaking existing API response shapes. If a breaking change is genuinely necessary, discuss with the user before proceeding.
- For additive changes (new optional fields), no migration of existing callers is needed. For removals or renames, update all callers in the same PR.

### 4. Logging & Robustness
- Preserve existing structured Zap logging. Do not remove log calls during refactoring unless they are clearly redundant.
- Always pass `context.Context` through the call chain. Never use `context.Background()` inside handler or service code.

### 5. LLM Prompt Management (if applicable)
If the updated logic involves an LLM prompt:
- If the original code had a hardcoded prompt, **take this opportunity to extract it** into the `llm_configs` table and expose it in the `AdminDashboard`.
- In the new migration SQL, **insert the old hardcoded prompt as seed data** so the admin panel has a working default after deployment.
- Fall back to the hardcoded string only when the database value is empty.

### 6. Verification
After completing changes, run:
```bash
# Backend compile check
go build ./...

# Backend unit tests (catch regressions)
go test ./...
```
Fix all compile errors and test failures before delivering. Pay special attention to existing tests that may be affected by the refactored logic.
