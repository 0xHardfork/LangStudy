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
