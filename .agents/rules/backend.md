---
trigger: always_on
---

# LangStudy Backend Development Rules

These rules apply to Go backend service development. All backend code design, modifications, and reviews must strictly adhere to the following specifications.

---

## Tech Stack & Dependencies

- **Language Version**: Go 1.25+ (with strict typing and shadow check enabled)
- **Web Framework**: Gin (`github.com/gin-gonic/gin`)
- **ORM**: GORM (`gorm.io/gorm` + `gorm.io/driver/postgres`)
- **Configuration**: Viper (`github.com/spf13/viper`)
- **Structured Logging**: Zap (`go.uber.org/zap`)
- **Database Migrations**: Golang-migrate (`github.com/golang-migrate/migrate/v4`)
- **Unit & Integration Testing**: `testing` + Testcontainers (`github.com/testcontainers/testcontainers-go`)

---

## Directory Structure

```
backend/
├── cmd/                 # Application entry points
├── configs/             # Configuration templates and loader definitions
├── migrations/          # Database SQL migration scripts (UP/DOWN)
├── platform/            # Core platform services decoupled from business logic (e.g. LLM client, DB/Redis initialization)
└── internal/            # Domain-driven packages (using a loosely coupled three-layer folder structure)
    ├── user/            # Authentication and user preferences management
    ├── dialogue/        # Dialogue generation, history tracking, and Ebbinghaus listening review
    └── grammar/         # Deep grammar analysis and fill-in-the-blank review quiz history
```

### Domain package structure (taking `grammar` as an example)
Inside `internal/grammar/`, only the following core files are permitted, with responsibilities partitioned as follows:
1. **`handler.go`**: Responsible for HTTP routing, request binding & validation (Gin Bind JSON), extracting authentication context (`userID`), and normalizing response formatting.
2. **`service.go`**: Responsible for core business logic coordination, calling external APIs (e.g., LLMs, TTS), and managing database transactions across multiple steps.
3. **`store.go`**: Responsible for underlying database persistence, containing only SQL queries and GORM API calls.

---

## Security Rules (Highest Priority)

### 1. Data Multi-Tenancy Isolation (Horizontal Privilege Escalation Prevention)
- **Rule**: All queries and modifications targeting user-owned private data must retrieve the `userID` from the JWT context and include it as a query filter.
- **Implementation**:
  - The Handler layer must extract the `userID` from the context and pass it to the Service layer:
    ```go
    userID, exists := c.Get("userID")
    if !exists {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
        return
    }
    ```
  - All read/write methods in the Service and Store layers must explicitly accept `userID uint` as a parameter:
    ```go
    // ❌ WRONG: Missing ownership check, susceptible to manipulation by other users
    func (s *service) GetArticle(ctx context.Context, articleID uint) (*Article, error)
    
    // ✅ CORRECT: Using userID to isolate the query
    func (s *service) GetArticle(ctx context.Context, articleID uint, userID uint) (*Article, error)
    ```
  - Store queries must always include the `user_id = ?` condition:
    ```go
    // ✅ CORRECT
    db.Where("id = ? AND user_id = ?", articleID, userID).First(&article)
    ```

### 2. User Enumeration Defense (Informative Errors)
- **Rule**: Authentication errors during user registration or login must return generic, non-disclosing messages. Never reveal whether a given username exists.
- **Implementation**:
  - Failures due to incorrect passwords, non-existent accounts, etc., must return a unified message, such as `"invalid username or password"`.
  - **Prohibited**: Do not return system-level errors like `"user not found"` or `"incorrect password"` to the client.

### 3. Sensitive Data Protection & Error Masking
- **Rule**: Internal database errors, external API keys, or detailed stack traces must never be exposed to the client.
- **Implementation**:
  - Internal failures where `status >= 500` must be logged in detail on the backend using Zap, and the client response must be masked with a generic message (e.g., `"internal server error"`).

---

## Performance & Concurrency Rules

### 1. No Repetitive Connection Pool Initialization
- **Rule**: Never instantiate new instances of `http.Client`, database connection pools, or Redis clients inside individual API requests, retries, or loops.
- **Implementation**:
  - Mount all network and external service clients as fields on the Service or Platform structs, and initialize them once inside `NewService`:
    ```go
    type service struct {
        httpClient *http.Client
        db         *gorm.DB
    }
    
    func NewService(db *gorm.DB) Service {
        return &service{
            httpClient: &http.Client{Timeout: 30 * time.Second},
            db:         db,
        }
    }
    ```

### 2. Concurrent External API Call Control & Timeout Protection
- **Rule**: When processing multiple long texts (e.g., batch LLM analysis or sentence-by-sentence TTS generation), **never** use a simple sequential `for` loop to make blocking calls. Doing so risks exceeding HTTP request timeouts (typically capped at 120s).
- **Implementation**:
  - Use concurrency packages (e.g., `golang.org/x/sync/errgroup`) to send concurrent requests.
  - Implement a concurrency semaphore to prevent overwhelming third-party APIs:
    ```go
    g, ctx := errgroup.WithContext(originalCtx)
    sem := make(chan struct{}, 5) // Maximum concurrency of 5
    for _, item := range items {
        sem <- struct{}{}
        g.Go(func() error {
            defer func() { <-sem }()
            return s.processItem(ctx, item)
        })
    }
    if err := g.Wait(); err != nil {
        return err
    }
    ```

### 3. Full Context Propagation
- **Rule**: Pass `context.Context` (with deadline and cancel information) to all external network requests and GORM database operations to ensure resources are promptly released when requests are cancelled.
- **Implementation**:
  - Always append `.WithContext(ctx)` to GORM queries:
    ```go
    db.WithContext(ctx).Where("user_id = ?", userID).Find(&results)
    ```

---

## Code Quality & DRY (Don't Repeat Yourself)

### 1. Platform-level Helper Utility Decoupling
- **Rule**: Shared, cross-domain logic (e.g., LLM clients, structured logging, global DB transaction helpers) must reside in `platform/`. Defining duplicate entities inside individual domain packages is strictly prohibited.
- **Implementation**:
  - Define the LLM interface and structs under `platform/llm`. The `dialogue` and `grammar` services must inject this shared `llm.Client`. Do not define separate LLM request/response structs inside the respective domain packages.

### 2. Strict Typing & Validation
- **Rule**: Do not use `interface{}` or `any` to bypass the static type system. Input structures must carry binding validation tags (e.g. `binding:"required,gt=0"`).

---

## Best Practices & Architecture Standards

### 1. GORM SQL Logging & Slow Query Monitoring
- **Rule**: The database must configure a custom logger that bridges GORM SQL logs, warnings, and errors to the global Zap logger.
- **Implementation**:
  - The slow query threshold is set to `200ms`. When a SQL query takes longer than `200ms` to execute, it must automatically emit a `WARN` level slow query warning.

### 2. Structured Gin Panic Recovery Middleware
- **Rule**: Do not use Gin's default `gin.Recovery()`. Use a custom Zap-based panic recovery middleware to log structured JSON crash traces while returning a clean, uniform error response to the client.

### 3. Modular Route Registration
- **Rule**: The HTTP handler for each domain must expose and implement `RegisterRoutes(public, authed, admin *gin.RouterGroup)`. All sub-route definitions must be encapsulated inside the handler file.
- **Implementation**:
  - `cmd/server/main.go` only acts as a router dispatcher, responsible for setting up parent routing groups and calling the route registration methods. Raw route mappings must not be hardcoded inside `main.go`.

### 4. Human-Readable Validation Errors
- **Rule**: When input binding fails (e.g., `ShouldBindJSON`), never return the raw validation error string directly. Pass it through `platform/validator.Translate(err)` to convert it to a readable, localized message before responding to the client.

### 5. Config Isolation (Viper Instance Isolation)
- **Rule**: Do not use global `viper.Get` or `viper.Set` directly in code. Instantiate localized config structures using `viper.New()`, and access configurations uniformly through `config.Viper()`. This guarantees context isolation during tests.

### 6. GORM Model Table Naming (TableName Explicit Declaration)
- **Rule**: Any GORM model defined under `internal/` whose struct name does not follow standard English pluralization rules (or differs from the DB migration schema, e.g. `dialogue_types`) must explicitly declare the `TableName` method:
  ```go
  func (Type) TableName() string {
      return "dialogue_types"
  }
  ```

### 7. Secure Auth Cookie Validation (HttpOnly)
- **Rule**: Session authentication must be migrated to an `HttpOnly` cookie-based architecture.
- **Implementation**:
  - Upon successful `/login`, return the access token inside an `HttpOnly` cookie named `token` with `Path: "/"`. The `Secure` flag must be set dynamically based on the environment (mandatory for production).
  - The authentication middleware (`JWTMiddleware`) must try reading the cookie first, falling back to the `Authorization` header as a secondary option.
  - Implement a `/logout` endpoint that sets `MaxAge: -1` on the authentication cookies to clear the session.

---

## Backend Best Practices (Vibe Coding Support)

To ensure backend stability against LLM response variance, fast iterations, and agent collaboration:

### 1. Robust LLM JSON Parsing
- **Strict Deserialization & Fail-safes**: Implement error-handling and fallback mechanisms (like using DB defaults or presenting readable errors) when parsing JSON responses returned by LLMs.
- **No Fragile Patching**: Never write fragile regex patterns to "fix" malformed JSON strings. If parsing fails, fail fast or trigger a retry.

### 2. Strict Database Migrations
- **Synchronized Migrations**: Every modification to GORM models (`internal/*/model.go`) must be accompanied by SQL migration scripts (`*.up.sql` / `*.down.sql`) inside `migrations/`.
- Never rely on GORM `AutoMigrate` for schema updates in production.

### 3. Traceable Logging (Zap Structured Fields)
- **Contextual Error Logs**: When logging `Error` or `Warn` levels, always include structured context fields (e.g., `zap.Uint("userID", userID)` or `zap.Uint("articleID", articleID)`). Never print raw, contextless error strings.

### 4. Cascade Timeout Prevention
- **Timeout-Bounded Contexts**: All network requests sent to external APIs (LLM, TTS, etc.) must carry bounded timeouts (typically 30s-60s) via `context.Context`, with cancellation detection implemented at the Service layer to avoid resource leaks.
