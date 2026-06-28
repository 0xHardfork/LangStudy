# Backend TODO List

> 来源：Code Review + 目录结构分析（2026-06-28）
> 优先级：🔴 立即修复 / 🟡 近期规划 / 🟢 有空改

---

## 🔴 安全漏洞（必须修）

- [x] **数据泄露：`GetHistory` 缺少 userID 过滤**
  - 文件：`internal/grammar/handler.go` + `service.go` + `store.go`
  - `handler.go` 提取了 userID 但没有传给 service，`GetArticles()` 无 `WHERE user_id = ?`
  - 任意登录用户可读取所有人的语法分析历史
  - 修复：Service 接口改为 `GetHistory(ctx, userID uint)`，Store 加 `WHERE user_id = ?`

- [x] **水平越权：`GetArticle` / `RegenerateSentence` 缺少所有权校验**
  - 文件：`internal/grammar/handler.go` + `service.go`
  - 任意用户只需知道 ID 即可访问/修改他人文章
  - 修复：fetch 后校验 `art.UserID == userID`，或 Store 查询带 `user_id` 条件

- [x] **用户枚举攻击：`user.Login` 区分"用户不存在"与"密码错误"**
  - 文件：`internal/user/service.go` L53
  - `"user not found: %w"` 会透传到前端，暴露用户是否注册
  - 修复：两种情况统一返回 `"invalid credentials"`

- [x] **数据完整性漏洞：`GenerateDialogue` / `RegenerateDialogue` 缺少事务保护**
  - 文件：`internal/dialogue/service.go` L121-L150
  - 对话头部、对话行、单词分级是分成多次独立的 db Create 操作。如果中途有任何一行出错或 TTS 失败抛错，会导致数据库残留无 Line / 无 rating 的孤儿 Dialogue 头部脏数据。
  - 修复：使用 GORM 的 `Transaction` 回滚块包裹整个 Dialogue 保存链路。

---

## 🔴 性能问题（严重影响体验）

- [x] **`AnalyzeText` 串行执行 LLM + TTS，导致必然超时**
  - 文件：`internal/grammar/service.go` L161-L260
  - 每句话依次做 TTS（阻塞）+ LLM（120s timeout），30 句 = 潜在 3600s
  - HTTP Server `WriteTimeout = 120s`，前端必然先断开
  - 修复：改用 `golang.org/x/sync/errgroup` 并发 + 信号量限流（如最多 5 并发）

- [x] **`callLLM` 重试循环内每次 `new http.Client`，连接池失效**
  - 文件：`internal/grammar/service.go` L361
  - 每次重试都新建 Client，TCP 连接无法复用，存在 fd 泄漏风险
  - 修复：将 `httpClient` 提升为 `svc` 字段，`NewService` 时初始化一次

- [x] **`GenerateDialogue` 的 TTS 语音生成是串行阻塞执行的**
  - 文件：`internal/dialogue/service.go` L129-L150
  - 生成对话时，每句话依次调用 `generateAudio` 生成 MP3，当对话行数较多时，HTTP 请求在 TTS 阶段会面临极大的串行阻塞延时。
  - 修复：在 Dialogue 生成中引入并发处理，使用 `errgroup` 并行化执行 `generateAudio` 请求。

---

## 🟡 代码质量与规范

- [x] **两套重复的 LLM 类型定义 + 客户端逻辑（DRY 违反）**
  - `internal/grammar/service.go` 和 `internal/dialogue/service.go` 各自定义了
    `llmMessage / llmRequest / llmChoice / llmResponse` 及 `callLLM` 函数
  - grammar 版本有重试，dialogue 版本没有
  - 修复：提取 `platform/llm/` 包，统一 LLM 客户端

- [x] **`dialogue/service.go` 的 `callLLM` 缺少重试机制**
  - 文件：`internal/dialogue/service.go` L321
  - 核心对话生成功能失败一次即报错，建议加 3 次重试 + 指数退避

- [x] **`ReviewIntervals` 硬编码重复两处**
  - `internal/ebbinghaus/model.go`：`var ReviewIntervals = []int{1, 3, 7, 14, 30}`
  - `internal/grammar/service.go` L302：局部变量 `intervals := []int{1, 3, 7, 14, 30}`
  - 修复：grammar 包复用 `ebbinghaus.ReviewIntervals`，或提取到 `platform/srs/` 包

- [x] **`currentUserID` 函数在两个包重复定义**
  - `internal/ebbinghaus/handler.go` 和 `internal/grammar/handler.go` 各有一份
  - 修复：提取到 `platform/httputil/` 或 `platform/middleware/` 包

- [x] **`repairJSON` 的括号补全逻辑不可靠**
  - 文件：`internal/grammar/service.go` L125-L145
  - 通过数 `{` 和 `}` 数量来补全 JSON，字符串内的括号会被错误计数
  - 修复：改用 `json.Valid()` 检测，解析失败直接 fallback，不尝试修复

- [x] **`AdminRequired` 每次请求都查数据库**
  - 文件：`internal/auth/middleware.go` L71
  - 可将 `role` embed 进 JWT claim，避免 DB 查询；或加 Redis 缓存层

- [x] **日志中间件对 4xx/5xx 也使用 `Info` 级别**
  - 文件：`cmd/server/main.go` L247
  - 修复：`status >= 400` 时改用 `log.Warn`，`status >= 500` 用 `log.Error`

- [x] **`PostgresTags.Scan` 手写 Postgres Array 解析有 Bug**
  - 文件：`internal/grammar/model.go` L88-L116
  - `strings.Split(trimmed, ",")` 在 tag 内容含逗号时会错误切分
  - 修复：使用 `github.com/lib/pq` 的 `pq.Array` 或 `jackc/pgtype`

- [x] **闲置资产：Redis 连接被初始化，但从未被任何业务服务使用**
  - 文件：`cmd/server/main.go` L84-L91
  - 项目配置并启动了 Redis 容器及连接，但在初始化各 Store/Service 时从未传入 Redis 客户端，目前属于完全闲置的资源。
  - 修复：决定是否使用 Redis 缓存用户 Profile 等高频读取数据，或者在不需要时直接从主程序 and docker-compose 中裁撤 Redis 服务。

---

## 🟡 目录结构重组

- [x] **`internal/llmconfig` 应移入 `platform/`**
  - LLM 配置是基础设施，与 DB config、Redis config 同级
  - 目标路径：`platform/llmconfig/`（或合并进 `platform/llm/`）

- [x] **`internal/auth/` 应移入 `platform/`**
  - JWT middleware 是基础设施，非业务逻辑
  - 目标路径：`platform/auth/` 或 `platform/middleware/`

- [x] **`user/` 和 `userprofile/` 边界模糊，考虑合并或明确命名**
  - 选项 A：合并为 `internal/user/`，`userprofile` 作为子结构体
  - 选项 B：重命名为 `internal/account/`（账号） + `internal/learner/`（学习档案）

- [x] **`dialoguetype/` 命名不规范，考虑合并进 `dialogue/`**
  - Go 包名推荐单词，`dialoguetype` 读起来别扭
  - 选项 A：合并进 `internal/dialogue/`，类型命名为 `dialogue.Type`
  - 选项 B：重命名为 `internal/topic/`（贴合前端 API `/dialogue/topics`）

- [ ] **`migrations/fs.go` 应移出 SQL 目录**
  - SQL 文件目录混入 Go 源码，职责不纯
  - 修复：将 `fs.go`（embed + RunMigrations）移到 `platform/database/migrate.go` (注：Go 编译器 embed 机制不允许使用 `..` 相对路径，故该文件需保留在 migrations 目录内以支持 embed 编译)

---

## 🟡 Gin 最佳实践与代码规范

- [x] **GORM 日志桥接：GORM 采用 `Silent` 模式，屏蔽了 SQL 错误与慢查询排查**
  - 文件：`platform/database/postgres.go` L14
  - 目前数据库调用为静默模式，若发生 SQL 报错或慢查询，无法在系统日志中显式暴露。
  - 修复：编写自定义 GORM Logger，将 SQL 执行信息、警告和错误重定向到全局 Zap 日志中，并设定慢查询阈值（如 200ms）。

- [x] **结构化 Panic 恢复：`gin.Recovery()` 将 Panic 堆栈输出为非结构化文本**
  - 文件：`cmd/server/main.go` L135
  - 发生 Panic 时，堆栈信息直接打到 stderr 中，无法被日志系统（ELK、Stackdriver 等）进行 JSON 格式 of the unified 聚合。
  - 修复：集成自定义的 Zap Panic Recovery 中间件，将崩溃堆栈及上下文参数以结构化 JSON 格式写入 Zap 日志。

- [x] **路由注册模块化：`main.go` 承载了全站所有路由的分组与声明，过于臃肿**
  - 文件：`cmd/server/main.go` L145-L196
  - 随着业务接口增加，`main.go` 中的路由声明会无限延长，违反职责单一原则。
  - 修复：采用模块化路由挂载，各业务模块（如 user, grammar, dialogue）对外提供 `RegisterRoutes(rg *gin.RouterGroup)` 方法，`main.go` 仅负责分发子路由组。

- [x] **参数校验报错友好化：`ShouldBindJSON` 出错直接向用户暴露 validator 内部校验文案**
  - 文件：各模块 `handler.go`
  - 参数校验失败时返回 `err.Error()`，例如 `Key: 'RegisterRequest.Username' Error:Field validation...`，严重影响用户体验。
  - 修复：集成 `go-playground/validator/v10` 的翻译器（Translator），将校验报错信息转换为用户可读的中文文案（如“用户名长度必须至少为3位”）。

---

## 🟢 Minor / 有空改

- [x] **HTTP Server 超时时间过于宽松（120s）**
  - 对于普通 CRUD 接口太宽，应区分处理 (已优化为 60s 紧凑超时)
  - LLM/TTS 接口建议异步化（任务队列 or SSE streaming）

- [x] **`viper` 作为全局状态使用，测试不友好**
  - 文件：`platform/config/config.go`
  - 修复：改用 `viper.New()` 创建实例并传递

- [x] **`static/` 生成音频文件确认不要 commit 进仓库**
  - 检查 `.gitignore` 是否已包含 `static/audio/` (.gitignore 已忽略整个 backend/static/ 目录)

- [x] **`dialogue/service.go` 中 `GenerateDialogue` 和 `RegenerateDialogue` 逻辑大量重复**
  - TTS 循环、vocab rating、结果聚合逻辑几乎相同
  - 修复：提取 `saveDialogueLines(ctx, d, llmLines)` 等私有函数复用 (已提取为 saveDialogueAndAssets 辅助方法)

---

## 参考：推荐目标目录结构

```
backend/
├── cmd/server/main.go
├── internal/
│   ├── account/          # user + userprofile 合并
│   ├── dialogue/
│   │   └── topic/        # dialoguetype 改名移入
│   ├── ebbinghaus/
│   └── grammar/
├── platform/
│   ├── auth/             # 原 internal/auth/
│   ├── cache/
│   ├── config/
│   ├── database/
│   │   └── migrate.go    # 原 migrations/fs.go
│   ├── devenv/
│   ├── llm/              # 原 internal/llmconfig/ + 统一 LLM 客户端
│   ├── logger/
│   ├── middleware/
│   └── response/
├── migrations/           # 只放 .sql 文件
└── configs/
```
