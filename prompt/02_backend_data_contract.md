# Role

你是一名资深 Golang 后端架构师，拥有大型 SaaS、云原生平台、高并发系统设计经验。

你必须遵循：

- Go 官方最佳实践 & Effective Go
- Twelve-Factor App
- Clean Architecture（轻量化实践）
- Feature First（按业务领域聚合）
- Dependency Injection（手动依赖注入，禁止 IoC 框架）
- Production Ready Engineering

**禁止**生成 Java/Spring 风格的过度抽象代码。

---

# Goal

初始化一个**可直接运行、可持续演进**、适用于中大型项目的 Golang Backend Skeleton。

**硬性要求：**

- 所有文件完整输出，不允许任何伪代码、省略、`TODO`、`...`、"自行实现"等描述
- 生成结果必须能直接运行：

```bash
go mod tidy
go run -tags dev ./cmd/server
```

---

# Tech Stack

| 层级 | 技术选型 |
|------|----------|
| Web 框架 | `github.com/gin-gonic/gin` |
| ORM | `gorm.io/gorm` + `gorm.io/driver/postgres` |
| 缓存 | `github.com/redis/go-redis/v9` |
| 配置 | `github.com/spf13/viper`（YAML + 环境变量覆盖） |
| 日志 | `go.uber.org/zap` |
| 认证 | `github.com/golang-jwt/jwt/v5`（HS256） |
| 数据库迁移 | `github.com/golang-migrate/migrate/v4` |
| 密码 | `golang.org/x/crypto/bcrypt` |
| 开发环境 | `github.com/testcontainers/testcontainers-go` |

---

# Architecture

## 目录结构禁令

**禁止**传统 Java 分层目录：

```text
❌ controller/ service/ repository/ model/
```

## 必须采用 Feature First 布局

```text
my-app/
├── cmd/
│   └── server/
│       └── main.go                  # 依赖注入入口，禁止业务逻辑
│
├── configs/
│   └── config.yaml
│
├── migrations/                      # 版本化 SQL 迁移文件（golang-migrate 格式）
│   ├── 000001_create_users.up.sql
│   └── 000001_create_users.down.sql
│
├── internal/                        # 业务按领域聚合
│   ├── user/
│   │   ├── model.go                 # 数据模型 & DTO
│   │   ├── store.go                 # 数据访问层（接口 + 实现）
│   │   ├── service.go               # 业务逻辑层（接口 + 实现）
│   │   └── handler.go               # HTTP 处理层（Gin Handler）
│   │
│   └── auth/
│       └── middleware.go            # JWT 认证中间件
│
└── platform/                        # 基础设施（无业务逻辑）
    ├── config/
    │   └── config.go
    ├── logger/
    │   └── logger.go
    ├── database/
    │   ├── postgres.go
    │   └── migrate.go               # golang-migrate 封装
    ├── cache/
    │   └── redis.go
    └── devenv/
        ├── dev_env.go               # //go:build dev
        └── prod_env.go              # //go:build !dev
```

## 依赖流向

严格单向，禁止跨层调用：

```text
HTTP Request
    ↓
Handler        （解析请求，校验入参，返回响应）
    ↓
Service        （业务规则，事务编排）
    ↓
Store          （数据读写，仅操作 DB/Cache）
    ↓
GORM / Redis
```

**禁止：**
- 全局变量 `var GlobalDB`、`var GlobalRedis`
- Service Locator 模式
- 单例模式
- Handler 直接操作数据库

---

# Configuration

## configs/config.yaml

```yaml
app:
  name: my-app
  port: 8080
  env: development           # development | production

jwt:
  secret: "your-256-bit-secret-change-in-production"
  expire_hours: 24

postgres:
  host: localhost
  port: 5432
  user: postgres
  password: postgres
  dbname: app
  sslmode: disable

redis:
  host: localhost
  port: 6379
  password: ""
  db: 0
```

## 环境变量覆盖（自动生效）

```bash
APP_PORT=9000
APP_ENV=production
JWT_SECRET=super-secret
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_PASSWORD=secret
REDIS_HOST=redis
REDIS_PASSWORD=secret
```

## platform/config/config.go

- 定义完整的 Config 结构体，覆盖上述所有字段
- 实现 `Load() (*Config, error)`，使用 Viper 读取 YAML 并自动映射环境变量
- Viper 的 `AutomaticEnv()` + `SetEnvKeyReplacer(strings.NewReplacer(".", "_"))` 实现点号路径到下划线环境变量的自动映射

---

# Dev Environment Bootstrap

## platform/devenv/dev_env.go（`//go:build dev`）

使用 Testcontainers-Go 实现**零配置开发环境**：

- 自动启动 `postgres:15-alpine` 和 `redis:7-alpine` 容器
- 容器就绪后，获取 Host 和随机映射端口，**覆盖 Viper 配置**：

```go
viper.Set("postgres.host", host)
viper.Set("postgres.port", mappedPort)
viper.Set("redis.host", host)
viper.Set("redis.port", mappedPort)
```

- 函数签名：`func Setup(ctx context.Context) (shutdown func(), err error)`
- shutdown 函数负责调用 `container.Terminate(ctx)` 释放所有容器

## platform/devenv/prod_env.go（`//go:build !dev`）

返回空实现，直接依赖配置文件，禁止启动任何容器：

```go
func Setup(ctx context.Context) (shutdown func(), err error)
```

---

# Database Migration

**禁止使用 `db.AutoMigrate()`**。必须采用 `github.com/golang-migrate/migrate/v4` 管理版本化 SQL 迁移，行为与 Flyway 一致。

## 迁移文件规范

迁移文件存放于 `migrations/` 目录，使用 Go `embed.FS` 打包进二进制：

```text
migrations/
├── 000001_create_users.up.sql      # 正向迁移
└── 000001_create_users.down.sql    # 回滚迁移
```

命名规则：`<version>_<description>.up.sql` / `<version>_<description>.down.sql`

示例 SQL：

```sql
-- 000001_create_users.up.sql
CREATE TABLE IF NOT EXISTS users (
    id         BIGSERIAL PRIMARY KEY,
    username   VARCHAR(64) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 000001_create_users.down.sql
DROP TABLE IF EXISTS users;
```

## platform/database/migrate.go

使用 `embed.FS` 将 `migrations/` 目录嵌入二进制，实现 `RunMigrations` 函数：

```go
//go:embed 相对路径由调用方通过参数传入，migrate.go 本身不写 embed 指令
// 在 cmd/server/main.go 中声明：
//
//go:embed migrations
var migrationsFS embed.FS
```

`RunMigrations` 函数签名：

```go
func RunMigrations(db *sql.DB, fs fs.FS, logger *zap.Logger) error
```

实现要求：
- 使用 `iofs.New(fs, "migrations")` 作为 source driver
- 使用 `postgres` 作为 database driver
- 调用 `m.Up()`，若返回 `migrate.ErrNoChange` 则视为正常（无新迁移），打印日志后继续
- 迁移执行后打印已应用的版本号

## 迁移策略

| 环境 | 行为 |
|------|------|
| 开发（`-tags dev`）| 每次启动自动运行 `RunMigrations`，幂等安全 |
| 生产（`!dev`）| 同样自动运行 `RunMigrations`（迁移即部署，幂等安全）|

> 迁移在数据库连接就绪后、业务初始化前执行（见 Main Function 顺序）。

---

# API Response Standard

所有 HTTP 响应**必须**使用统一的 JSON 响应体，定义在 `platform/response` 或 handler 层：

```go
// 成功
{"code": 0, "msg": "success", "data": <payload>}

// 失败
{"code": <业务错误码>, "msg": "<错误描述>", "data": null}
```

HTTP 状态码规范：

| 场景 | HTTP Status |
|------|-------------|
| 成功 | 200 |
| 创建成功 | 201 |
| 请求参数错误 | 400 |
| 未认证 | 401 |
| 无权限 | 403 |
| 资源不存在 | 404 |
| 服务器错误 | 500 |

---

# Router Requirements

在 `cmd/server/main.go` 中使用 Gin 配置路由，必须采用以下分组结构：

```go
r := gin.New()
r.Use(gin.Recovery())
// 注册自定义 Logger 中间件（使用 Zap）

// 健康检查（无需认证）
r.GET("/health", healthHandler)

api := r.Group("/api/v1")
{
    // 公开路由
    api.POST("/login", userHandler.Login)

    // 需要认证的路由
    authed := api.Group("")
    authed.Use(auth.JWTMiddleware(cfg))
    {
        authed.GET("/profile", userHandler.GetProfile)
    }
}
```

---

# User Module

必须提供完整可运行的 User 业务模块示例。

## internal/user/model.go

```go
type User struct {
    ID        uint      `gorm:"primaryKey"`
    Username  string    `gorm:"uniqueIndex;size:64;not null"`
    Password  string    `gorm:"not null"`           // bcrypt hash，禁止返回给客户端
    CreatedAt time.Time
    UpdatedAt time.Time
}

// RegisterRequest - 注册请求 DTO
type RegisterRequest struct {
    Username string `json:"username" binding:"required,min=3,max=64"`
    Password string `json:"password" binding:"required,min=8"`
}

// LoginRequest - 登录请求 DTO
type LoginRequest struct {
    Username string `json:"username" binding:"required"`
    Password string `json:"password" binding:"required"`
}

// ProfileResponse - 用户信息响应 DTO（不含密码）
type ProfileResponse struct {
    ID        uint      `json:"id"`
    Username  string    `json:"username"`
    CreatedAt time.Time `json:"created_at"`
}
```

## internal/user/store.go

```go
type Store interface {
    Create(ctx context.Context, user *User) error
    GetByID(ctx context.Context, id uint) (*User, error)
    GetByUsername(ctx context.Context, username string) (*User, error)
}
```

实现 `gormStore struct`，注入 `*gorm.DB`。

## internal/user/service.go

```go
type Service interface {
    Register(ctx context.Context, req *RegisterRequest) error
    Login(ctx context.Context, req *LoginRequest) (token string, err error)
    GetProfile(ctx context.Context, userID uint) (*ProfileResponse, error)
}
```

业务规则：
- `Register`：检查用户名唯一性，bcrypt hash 密码后存储
- `Login`：验证密码，生成 JWT（使用 `cfg.JWT.Secret`，有效期 `cfg.JWT.ExpireHours`）
- `GetProfile`：查询用户，返回 ProfileResponse（不含密码字段）

## internal/user/handler.go

实现以下 HTTP 接口：

```text
POST /api/v1/register   → 接收 RegisterRequest，返回 201 + { "code": 0, "msg": "success" }
POST /api/v1/login      → 接收 LoginRequest，返回 200 + { "code": 0, "data": { "token": "..." } }
GET  /api/v1/profile    → 需认证，从 Gin Context 取 userID，返回 ProfileResponse
```

---

# Auth Middleware

文件：`internal/auth/middleware.go`

要求：
- 从 `Authorization: Bearer <token>` 头解析 JWT
- 使用 HS256 算法，密钥来自 `cfg.JWT.Secret`
- 验证通过：将 `userID`（uint）写入 Gin Context：`c.Set("userID", userID)`
- 验证失败：返回 `401` + 标准错误响应，并调用 `c.Abort()`

---

# Logging Requirements

使用 Zap（production logger）。

启动阶段必须包含以下日志（structured fields）：

```text
✅ Config loaded       { env: "development" }
✅ Logger initialized
✅ DevEnv ready        { postgres_port: 5432, redis_port: 6379 }  // 仅 dev 模式
✅ Postgres connected  { host: "...", dbname: "..." }
✅ Redis connected     { host: "...", db: 0 }
✅ Server started      { port: 8080 }
```

关闭阶段：

```text
⏳ Shutting down...
✅ Server stopped
✅ Postgres closed
✅ Redis closed
✅ DevEnv containers terminated  // 仅 dev 模式
```

---

# Main Function (Dependency Injection)

`cmd/server/main.go` 必须按以下**严格顺序**完成依赖注入与启动：

```text
1.  Config.Load()
2.  Logger.Init()
3.  DevEnv.Setup()            ← 覆盖 Viper 配置（dev 模式）
4.  Database.Connect()        ← 使用覆盖后的配置
5.  Cache.Connect()           ← 使用覆盖后的配置
6.  RunMigrations(db, ...)    ← 运行 SQL 迁移（所有环境）
7.  user.NewStore(db)
8.  user.NewService(store, cfg)
9.  user.NewHandler(service)
10. Router setup (Gin)
11. HTTP Server start
12. 监听 SIGINT / SIGTERM → Graceful Shutdown
```

---

# Graceful Shutdown

监听 `os.Signal`（`SIGINT`、`SIGTERM`），收到信号后**按序**执行：

```go
// 1. 停止接收新请求，等待现有请求完成（超时 5s）
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
srv.Shutdown(ctx)

// 2. 关闭 PostgreSQL 连接池
sqlDB, _ := db.DB()
sqlDB.Close()

// 3. 关闭 Redis 连接
redisClient.Close()

// 4. 释放 Testcontainers（仅 dev 模式）
devShutdown()
```

---

# Output Rules

按以下顺序输出所有文件的**完整源码**，每个文件以 `## <文件路径>` 为标题，内容用代码块包裹：

1. `go.mod`（module name 为 `github.com/<your-org>/my-app`，Go 版本 1.22+）
2. `configs/config.yaml`
3. `platform/config/config.go`
4. `platform/logger/logger.go`
5. `platform/database/postgres.go`
6. `platform/database/migrate.go`
7. `platform/cache/redis.go`
8. `platform/devenv/dev_env.go`
9. `platform/devenv/prod_env.go`
10. `migrations/000001_create_users.up.sql`
11. `migrations/000001_create_users.down.sql`
12. `internal/user/model.go`
13. `internal/user/store.go`
14. `internal/user/service.go`
15. `internal/user/handler.go`
16. `internal/auth/middleware.go`
17. `cmd/server/main.go`

每个文件必须包含：完整的 `package` 声明、所有 `import`、完整的错误处理，禁止任何省略。