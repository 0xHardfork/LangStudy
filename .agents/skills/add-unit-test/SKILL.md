---
name: add-unit-test
description: Guides the agent to write unit tests for backend Go code or frontend React/TypeScript logic. Use this when correctness of core algorithms or business logic needs to be verified with automated tests.
---

# Add Unit Test Skill

This skill guides the agent to write well-structured unit tests in the `LangStudy` project, covering critical computation logic, algorithms, and data transformation functions.

## Rules & Guidelines

### 1. What to Test (Priority)
**High priority — always test:**
- Core computation and business transformation logic, e.g., the Ebbinghaus spaced repetition interval calculation, fill-in-the-blank token splitting (`splitToken`).
- Data model parsing with fallback behavior (e.g., JSON deserialization with default values on missing fields).

**Low priority — optional or skip:**
- Simple GORM CRUD mappings (covered by the ORM itself, unless there is a complex sub-query).
- Simple HTTP route handlers that only bind parameters with no business logic.

### 2. Backend Tests (Go)
- **File placement**: Test files live in the same directory as the code under test, named `<file>_test.go`.
- **Use table-driven tests** — the recommended Go community pattern for covering multiple scenarios cleanly:
  ```go
  func TestCalculateNextInterval(t *testing.T) {
      tests := []struct {
          name     string
          input    int
          expected int
      }{
          {"first review", 1, 3},
          {"second review", 3, 7},
          {"invalid step fallback", -1, 1},
      }
      for _, tt := range tests {
          t.Run(tt.name, func(t *testing.T) {
              result := CalculateNextInterval(tt.input)
              if result != tt.expected {
                  t.Errorf("expected %d, got %d", tt.expected, result)
              }
          })
      }
  }
  ```
- **Dependency isolation (Mocking)**: For code that calls external services (LLM APIs, TTS, etc.), mock the dependency via interfaces. **Never make real network calls inside unit tests** — they are slow, consume API quota, and produce non-deterministic results.

### 3. Frontend Tests (TypeScript)
- Write tests for core utility functions in `src/utils/` or `src/lib/`.
- Cover edge cases: empty arrays, out-of-order input, strings with special characters, boundary values.
- Use the project's configured test runner (Jest or Vitest).

### 4. Verification
Before delivering, run and confirm all tests pass locally:
```bash
# Go
go test -v ./...

# TypeScript (if configured)
npm run test
```
**Never submit test code that fails to compile or causes test suite failures.**
