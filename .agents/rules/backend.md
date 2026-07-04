# LangStudy Backend Development Rules

本规则适用于 Go 后端服务开发。所有后端代码的设计、修改和审查必须严格遵守以下规范。

---

## 技术栈与依赖库

- **语言版本**：Go 1.25+ (开启 strict 类型与 shadow 检查)
- **Web 框架**：Gin (`github.com/gin-gonic/gin`)
- **ORM**：GORM (`gorm.io/gorm` + `gorm.io/driver/postgres`)
- **配置管理**：Viper (`github.com/spf13/viper`)
- **结构化日志**：Zap (`go.uber.org/zap`)
- **数据库迁移**：Golang-migrate (`github.com/golang-migrate/migrate/v4`)
- **单元与集成测试**：`testing` + Testcontainers (`github.com/testcontainers/testcontainers-go`)

---

## 目录结构规范

```
backend/
├── cmd/                 # 应用程序入口
├── configs/             # 配置文件模板与读取定义
├── migrations/          # 数据库 SQL 迁移脚本 (UP/DOWN)
├── platform/            # 平台基础服务，与业务解耦（如 llm 统一客户端、DB/Redis 初始化）
└── internal/            # 业务领域模块（遵循松耦合的三层分包结构）
    ├── user/            # 用户认证与用户设置管理
    ├── dialogue/        # 对画生成、历史跟踪与艾宾浩斯听力复习
    └── grammar/         # 深度语法分析与完形填空错题库
```

### 业务领域内部结构 (以 `grammar` 为例)
在 `internal/grammar/` 包中，只允许包含以下核心文件，职责划分如下：
1. **`handler.go`**：负责 HTTP 协议路由解析、输入参数绑定校验 (Gin Bind JSON)、鉴权上下文提取 (`userID`)、通用响应格式化。
2. **`service.go`**：负责核心业务逻辑控制、调用大模型/TTS 等外部 API 接口、多步操作的数据库事务管理。
3. **`store.go`**：负责底层关系数据库持久化操作，只包含 SQL 查询及 GORM API 调用。

---

## 安全规则 (最高等级优先)

### 1. 数据多租户隔离与所有权校验 (水平越权防护)
- **规则**：所有查询/修改用户私有数据的接口，必须从 JWT 获取 `userID`，并且在 SQL 查询中追加过滤。
- **具体做法**：
  - Handler 层必须通过 Context 提取 `userID` 并传递给 Service 层：
    ```go
    userID, exists := c.Get("userID")
    if !exists {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
        return
    }
    ```
  - Service 和 Store 层的所有读写方法参数中必须显式传递 `userID uint`：
    ```go
    // ❌ 错误：缺少所有权校验，可被任意用户篡改
    func (s *service) GetArticle(ctx context.Context, articleID uint) (*Article, error)
    
    // ✅ 正确：使用 userID 隔离查询
    func (s *service) GetArticle(ctx context.Context, articleID uint, userID uint) (*Article, error)
    ```
  - Store 查询中必须包含 `user_id = ?` 条件：
    ```go
    // ✅ 正确
    db.Where("id = ? AND user_id = ?", articleID, userID).First(&article)
    ```

### 2. 避免用户枚举攻击 (Informative Errors)
- **规则**：用户登录/注册过程中的账户认证错误，必须模糊提示，不得泄露账户是否注册的信息。
- **具体做法**：
  - 密码错误、账号不存在等认证失败逻辑，必须统一返回统一的消息，例如：`"invalid username or password"`。
  - **禁止**返回 `"user not found"` 或 `"incorrect password"` 等具有明显探测性质的系统级错误给前端。

### 3. 敏感数据处理与错误暴露
- **规则**：严禁向客户端输出含有数据库细节、外部 API 秘钥或堆栈调用详情的错误。
- **具体做法**：
  - `status >= 500` 的内部故障，必须在后端使用 Zap 打印详细日志，返回给前端的响应必须为泛化的通用错误信息 (例如 `"internal server error"`)。

---

## 性能与并发规则

### 1. 禁用连接池重复初始化
- **规则**：禁止在每个 API 请求的生命周期、重试循环、循环内部中实例化新的 `http.Client`、数据库连接池或 Redis 连接。
- **具体做法**：
  - 将所有网络客户端、外部服务客户端挂载在 Service 或 Platform 结构的结构体成员中，并在 `NewService` 时初始化一次：
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

### 2. 外部接口并发控制与超时防护
- **规则**：如遇多条长文本处理（如批量 LLM 诊断或分句 TTS 生成），**禁止**使用 `for` 循环同步串行调用，以防请求超时（HTTP 超时限制通常为 120s）。
- **具体做法**：
  - 必须使用并发工具包（如 `golang.org/x/sync/errgroup`）并行发送外部请求。
  - 必须加入并发信号量控制，防止对第三方服务发起海量突发请求导致被限流：
    ```go
    g, ctx := errgroup.WithContext(originalCtx)
    sem := make(chan struct{}, 5) // 最大 5 个并发通道
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

### 3. Context 上下文完全透传
- **规则**：所有网络请求与 GORM 查询操作必须严格透传包含 Deadline 和 Cancel 信息的 `context.Context`，保证请求取消时及时释放底层连接。
- **具体做法**：
  - GORM 的所有操作必须携带 `.WithContext(ctx)`：
    ```go
    db.WithContext(ctx).Where("user_id = ?", userID).Find(&results)
    ```

---

## 代码规范与 DRY (Don't Repeat Yourself)

### 1. 通用工具包与定义抽离
- **规则**：跨领域模块的公共外部行为（如大语言模型 LLM 请求定义、日志、数据库事务通用方法）必须抽离在 `platform/` 下，严禁在各自领域内定义重叠的实体。
- **具体做法**：
  - 统一大模型访问在 `platform/llm` 中定义 `Client` 结构体，`Dialogue` 和 `Grammar` 服务仅注入 `llm.Client`，严禁在 `dialogue/service.go` 和 `grammar/service.go` 中各自保留独立的 LLM 发送逻辑和 Request/Response Struct 声明。

### 2. 严格的类型转换与校验
- **规则**：不可使用 `interface{}`/`any` 绕过静态类型系统。输入绑定参数必须设置合适的校验 tag（如 `binding:"required,gt=0"`）。

---

## 最佳实践与架构规范

### 1. GORM 日志与慢查询监控
- **规则**：数据库必须配置自定义日志桥接器，将 GORM SQL 执行日志、警告和错误重定向到全局 Zap 日志中。
- **具体做法**：
  - 慢查询阈值必须设定为 `200ms`。当 SQL 执行时间大于 `200ms` 时，必须自动输出 `WARN` 级别的慢查询警告日志。

### 2. Gin Panic 结构化恢复中间件
- **规则**：禁止使用原生的 `gin.Recovery()`。必须集成基于 Zap 的自定义 panic 恢复中间件，以确保发生崩溃时输出结构化的 JSON 堆栈日志，并向客户端返回统一且干净的错误响应。

### 3. 模块化路由自注册
- **规则**：每个业务包的 HTTP 控制器 Handler 必须暴露并实现 `RegisterRoutes(public, authed, admin *gin.RouterGroup)`，将子路由的声明和挂载内聚到各 Handler 内部。
- **具体做法**：
  - `cmd/server/main.go` 仅作为高层路由器分发中转，负责初始化核心分组和调用 Handler 注册方法，禁止在 `main.go` 内集中式裸写路由映射。

### 4. 参数校验报错友好化 (中文翻译器)
- **规则**：参数绑定（如 `ShouldBindJSON`）出错时，严禁直接返回原生 `err.Error()`。必须通过 `platform/validator.Translate(err)` 将 `validator` 校验错误翻译成可读的中文短句返回给客户端。

### 5. 配置管理 (Viper 实例隔离)
- **规则**：禁止在代码中直接使用全局 `viper.Get` / `viper.Set`。必须通过 `viper.New()` 实例化本地配置对象，并使用导出的 `config.Viper()` 进行统一读写和 `Reload()` 操作，保证测试的上下文环境隔离。

### 6. 模型与数据表映射 (TableName 显式声明)
- **规则**：在 `internal/` 或各模块下定义的 GORM 模型结构体（如 `Type` 实体），如果其命名的复数规则不符合标准英文复数（或与迁移表名不符，如 `dialogue_types`），必须显式实现 `TableName() string` 方法：
  ```go
  func (Type) TableName() string {
      return "dialogue_types"
  }
  ```

### 7. 安全 Cookie 身份校验 (HttpOnly)
- **规则**：用户登录态校验必须迁移至 `HttpOnly` Cookie 架构。
- **具体做法**：
  - `/login` 成功后，通过 HTTP 响应头部注入名为 `token` 的 Cookie，设置 `HttpOnly: true`、`Path: "/"`，且 `Secure` 标记根据当前环境动态设定（生产环境必须开启）。
  - `JWTMiddleware` 鉴权时优先尝试读取 Cookie，未读取到时作为降级备用手段提取 `Authorization` Bearer 头部凭证。
  - 增加 `/logout` 接口，通过向客户端签发 `MaxAge: -1` 的 Cookie 来清理登录状态。

---

## 后端 Vibe 最佳实践 (Backend Best Practices)

为了保证后端在面对大模型输出波动、快速迭代及团队协作时的代码质量，必须遵循以下规则：

### 1. 防爆大模型响应 (Robust LLM JSON Handling)
- **严格反序列化与安全降级**：所有解析大模型返回 JSON 的逻辑，必须设计对应的**错误处理与 Fallback / 重试机制**（如返回数据库默认值，或者友好向前端报错）。
- **杜绝脆弱修补**：严禁编写脆弱的正则表达式或字符匹配补全逻辑来尝试“修复”损坏的 JSON，解析失败应直接作为 error 抛出或重试，不得让脏数据进入后续流程。

### 2. 数据库迁移防遗漏 (Strict Database Migrations)
- **禁拔河式修改**：凡涉及 GORM 模型结构体（`internal/*/model.go`）的修改，**必须**同步在 `migrations/` 目录下编写并保存对应的 SQL 迁移脚本（`*.up.sql` / `*.down.sql`）。
- 禁止依赖 GORM AutoMigrate 进行本地和线上表结构的自动维护，以防因缺少历史演进追踪而在环境部署时发生 Schema 错位或静默报错。

### 3. Zap 结构化日志可追溯性 (Traceable Logging)
- **禁止无上下文的 Error 打印**：在打印 `Error` 或 `Warn` 级别日志时，**必须**使用结构化字段（如 `zap.Uint("userID", userID)`、`zap.Uint("articleID", articleID)`）携带当前操作的业务实体 ID。
- 绝不能仅仅打印一个裸的错误字符串，确保在生产环境排查链路时日志清晰、可追溯。

### 4. 级联取消与超时防护 (Cascade Timeout)
- **全链路传递 Context**：所有发往第三方 API（如大模型调用、TTS 语音合成）的网络请求，必须显式传递具有合理 `Timeout` 限制（通常限制为 30s-60s）的上下文，并在 Service 级别支持 Context 取消检测，防止慢接口霸占连接池导致服务雪崩。
