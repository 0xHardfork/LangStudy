---
name: add-backend-feature
description: Guides the agent to develop a new backend API feature, including database schema, service logic, and HTTP handlers. Use this when the user asks to add a new backend endpoint or domain module.
---

# Add Feature Skill (Backend)

This skill guides the agent to develop a brand-new backend feature in `LangStudy` using Go / Gin / GORM, to a high standard.

## Development Workflow

### 1. Requirements & Design Alignment
- Clarify any ambiguous business fields or interaction logic. **Never assume or fabricate API contracts.**
- Design the request/response data structure for the new API before writing any code.
- Check existing domain packages (under `backend/internal/`) for patterns to follow.

### 2. Database Design
- Define the new model struct in `internal/<domain>/model.go`.
- **Always** write explicit migration SQL files in `migrations/` — both `.up.sql` and `.down.sql`. Never rely on GORM `AutoMigrate` in production.
- Apply the migration in the local dev environment before proceeding.

### 3. Three-Layer Architecture (Handler → Service → Store)
Create or update files under `internal/<domain>/`:

- **`handler.go`** — Parse the HTTP request, extract authenticated `userID` from JWT context, bind and validate JSON using Gin binding tags.
- **`service.go`** — Implement core business logic. Control transactions using GORM `db.Transaction(...)` where atomicity is needed.
- **`store.go`** — All GORM database queries. Use parameterized queries exclusively; never concatenate raw SQL strings.

### 4. Multi-Tenant Isolation
For any endpoint touching user-specific data, always extract `userID` from the JWT context (`auth.CurrentUserID(c)`) and pass it through every layer down to the Store query filters. Never trust user-supplied IDs from the request body for ownership checks.

### 5. Route Registration
Implement `RegisterRoutes(public, authed, admin *gin.RouterGroup)` on the Handler and register it at the application entry point.

### 6. LLM Prompt Configuration (if applicable)
If the new feature involves an LLM prompt:
- **Never hardcode the prompt in source code.**
- Add the prompt as a configurable field in the `llm_configs` table (update the model definition and `UpdateConfigRequest`), and update the `AdminDashboard` frontend page to expose it.
- In the migration SQL for this feature, **insert the default prompt as seed data** so it is immediately visible and editable after a fresh deployment.
- In code, load the prompt dynamically via `llmconfig.Service`. Only fall back to a hardcoded default if the database value is empty.

### 7. Verification
Before marking the task done, run:
```bash
# Backend compile check
go build ./...

# Backend unit tests
go test ./...
```
Fix all compile errors and test failures before delivering.
