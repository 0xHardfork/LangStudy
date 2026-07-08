---
trigger: always_on
---

# LangStudy General Repository Rules

These rules apply to all development within this repository (LangStudy), including frontend and backend, to ensure code standardization, commit history traceability, and deployment stability.

---

## Git Commit Guidelines (Conventional Commits)

All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.
The format is as follows:
```
<type>(<scope>): <subject>

[optional body]
```

### 1. Common Types
- **`feat`**: New business logic features or frontend interactive pages
- **`fix`**: Fixes for backend security vulnerabilities, performance issues, or frontend layout/type bugs
- **`refactor`**: Code refactoring (e.g. splitting components, removing duplicate code, without changing behavior)
- **`style`**: Style changes and alignment only (e.g. TailwindCSS migration, no logic changes)
- **`test`**: Adding, modifying, or fixing unit and integration tests
- **`docs`**: Additions or updates to documentation, TODO lists, or inline comments

### 2. Examples
- `feat(frontend): add fill-blank level 4 full text exercise option`
- `fix(backend): fix userID leak in GetHistory database query`
- `style(review): migrate inline style in GrammarReview to TailwindCSS class`

---

## Quality Gates

### 1. Pre-commit / Pre-push Gate
- **Compilation Success**: Before submitting any modifications, code must compile successfully locally. Committing code with compiler errors is strictly prohibited.
  - Frontend compile command: `npm run build` (tsc & vite build must pass with 0 errors)
  - Backend compile command: `go build ./...`
- **Unit Testing & Verification**:
  - Write unit tests for core algorithm/business logic (e.g. frontend token splitting `splitToken` or backend Ebbinghaus repetition interval calculations) to verify boundary cases. Do not obsess over 100% test coverage if it slows down development velocity.
  - New API endpoints must include basic functional verification (using Mock responses on the frontend, and unit/integration tests on the backend).

### 2. Zero Trust Security
- **Credentials & Environment Variables**:
  - Never hardcode any LLM API keys (e.g. Gemini Key, OpenAI Key), database connection strings, or JWT signing secrets in code.
  - Use environment variables or `.env` files, and ensure `.env` is added to `.gitignore`.
- **Sensitive Data & IP Masking**:
  - Never hardcode real production server IPs in code, scripts, comments, or documentation. Use placeholder addresses (e.g. `192.168.1.100` or `127.0.0.1`).
  - For the mobile app, compile-time variable injection (e.g. `--dart-define` in Dart) must be used to inject server URLs and IPs. Never hardcode real backend IPs in compiled binaries or public source repositories.
- **Credential History Erasing**:
  - If a password, API key, or real server IP is accidentally committed to the Git repository, **simply deleting it in a subsequent commit is not sufficient**.
  - You must physically purge the history (e.g. using git rebase, git filter-repo, or creating a clean orphan branch and forcing push) to ensure the secret is not left in Git history.
- **SQL Injection & Privilege Escalation Protection**:
  - Always use GORM's parameterized queries or placeholder queries. Never concatenate raw strings to construct SQL queries.
  - For any API manipulating a single record, verify ownership (e.g., check that `target.UserID == currentUserID`).

---

## Documentation and Code Comments

### 1. Code Commentary Guidelines
- **Avoid describing "what" the code does**: Do not write redundant comments for obvious logic (e.g. `i++ // increment i`).
- **Explain "why" (the intent)**: For complex algorithms, workarounds, prompt designs, or specific compromises, document the context and intent so future developers (human or AI) do not break the code during updates.

---

## Vibe Coding Best Practices (AI & Human Collaboration)

To maximize collaboration efficiency between the AI agent and the human developer, follow these rules:

### 1. File Size Limits (AI Friendly)
- **Keep files under 300 lines** whenever possible. Highly complex code files must never exceed 500 lines.
- Split files when they exceed this limit (e.g., extract sub-components or custom React hooks, partition helper functions or service classes in Go). This prevents context window truncation and code generation errors.

### 2. Incremental Verification
- **Run build checks frequently**: Modify code incrementally, running `go build ./...` or `npm run build` immediately after completing a logical change.
- Never write hundreds of lines of code without running compilation checks.

### 3. Zero Assumption
- If you are unsure about API contracts, database fields, or struct types, **always** inspect the code, check migration files, or ask the user.
- Never guess API parameter names, JSON key names, or database column names.
