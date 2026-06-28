# Backend TODO List

> 来源：Code Review + 目录结构分析（2026-06-28）
> 优先级：🔴 立即修复 / 🟡 近期规划 / 🟢 有空改

---

## 🔴 安全漏洞（必须修）

- [ ] **数据泄露：`GetHistory` 缺少 userID 过滤**
  - 文件：`internal/grammar/handler.go` + `service.go` + `store.go`
  - `handler.go` 提取了 userID 但没有传给 service，`GetArticles()` 无 `WHERE user_id = ?`
  - 任意登录用户可读取所有人的语法分析历史
  - 修复：Service 接口改为 `GetHistory(ctx, userID uint)`，Store 加 `WHERE user_id = ?`

- [ ] **水平越权：`GetArticle` / `RegenerateSentence` 缺少所有权校验**
  - 文件：`internal/grammar/handler.go` + `service.go`
  - 任意用户只需知道 ID 即可访问/修改他人文章
  - 修复：fetch 后校验 `art.UserID == userID`，或 Store 查询带 `user_id` 条件

- [ ] **用户枚举攻击：`user.Login` 区分"用户不存在"与"密码错误"**
  - 文件：`internal/user/service.go` L53
  - `"user not found: %w"` 会透传到前端，暴露用户是否注册
  - 修复：两种情况统一返回 `"invalid credentials"`

---

## 🔴 性能问题（严重影响体验）

- [ ] **`AnalyzeText` 串行执行 LLM + TTS，导致必然超时**
  - 文件：`internal/grammar/service.go` L161-L260
  - 每句话依次做 TTS（阻塞）+ LLM（120s timeout），30 句 = 潜在 3600s
  - HTTP Server `WriteTimeout = 120s`，前端必然先断开
  - 修复：改用 `golang.org/x/sync/errgroup` 并发 + 信号量限流（如最多 5 并发）

- [ ] **`callLLM` 重试循环内每次 `new http.Client`，连接池失效**
  - 文件：`internal/grammar/service.go` L361
  - 每次重试都新建 Client，TCP 连接无法复用，存在 fd 泄漏风险
  - 修复：将 `httpClient` 提升为 `svc` 字段，`NewService` 时初始化一次

---

## 🟡 代码质量与规范

- [ ] **两套重复的 LLM 类型定义 + 客户端逻辑（DRY 违反）**
  - `internal/grammar/service.go` 和 `internal/dialogue/service.go` 各自定义了
    `llmMessage / llmRequest / llmChoice / llmResponse` 及 `callLLM` 函数
  - grammar 版本有重试，dialogue 版本没有
  - 修复：提取 `platform/llm/` 包，统一 LLM 客户端

- [ ] **`dialogue/service.go` 的 `callLLM` 缺少重试机制**
  - 文件：`internal/dialogue/service.go` L321
  - 核心对话生成功能失败一次即报错，建议加 3 次重试 + 指数退避

- [ ] **`ReviewIntervals` 硬编码重复两处**
  - `internal/ebbinghaus/model.go`：`var ReviewIntervals = []int{1, 3, 7, 14, 30}`
  - `internal/grammar/service.go` L302：局部变量 `intervals := []int{1, 3, 7, 14, 30}`
  - 修复：grammar 包复用 `ebbinghaus.ReviewIntervals`，或提取到 `platform/srs/` 包

- [ ] **`currentUserID` 函数在两个包重复定义**
  - `internal/ebbinghaus/handler.go` 和 `internal/grammar/handler.go` 各有一份
  - 修复：提取到 `platform/httputil/` 或 `platform/middleware/` 包

- [ ] **`repairJSON` 的括号补全逻辑不可靠**
  - 文件：`internal/grammar/service.go` L125-L145
  - 通过数 `{` 和 `}` 数量来补全 JSON，字符串内的括号会被错误计数
  - 修复：改用 `json.Valid()` 检测，解析失败直接 fallback，不尝试修复

- [ ] **`AdminRequired` 每次请求都查数据库**
  - 文件：`internal/auth/middleware.go` L71
  - 可将 `role` embed 进 JWT claim，避免 DB 查询；或加 Redis 缓存层

- [ ] **日志中间件对 4xx/5xx 也使用 `Info` 级别**
  - 文件：`cmd/server/main.go` L247
  - 修复：`status >= 400` 时改用 `log.Warn`，`status >= 500` 用 `log.Error`

- [ ] **`PostgresTags.Scan` 手写 Postgres Array 解析有 Bug**
  - 文件：`internal/grammar/model.go` L88-L116
  - `strings.Split(trimmed, ",")` 在 tag 内容含逗号时会错误切分
  - 修复：使用 `github.com/lib/pq` 的 `pq.Array` 或 `jackc/pgtype`

---

## 🟡 目录结构重组

- [ ] **`internal/llmconfig` 应移入 `platform/`**
  - LLM 配置是基础设施，与 DB config、Redis config 同级
  - 目标路径：`platform/llmconfig/`（或合并进 `platform/llm/`）

- [ ] **`internal/auth/` 应移入 `platform/`**
  - JWT middleware 是基础设施，非业务逻辑
  - 目标路径：`platform/auth/` 或 `platform/middleware/`

- [ ] **`user/` 和 `userprofile/` 边界模糊，考虑合并或明确命名**
  - 选项 A：合并为 `internal/user/`，`userprofile` 作为子结构体
  - 选项 B：重命名为 `internal/account/`（账号） + `internal/learner/`（学习档案）

- [ ] **`dialoguetype/` 命名不规范，考虑合并进 `dialogue/`**
  - Go 包名推荐单词，`dialoguetype` 读起来别扭
  - 选项 A：合并进 `internal/dialogue/`，类型命名为 `dialogue.Type`
  - 选项 B：重命名为 `internal/topic/`（贴合前端 API `/dialogue/topics`）

- [ ] **`migrations/fs.go` 应移出 SQL 目录**
  - SQL 文件目录混入 Go 源码，职责不纯
  - 修复：将 `fs.go`（embed + RunMigrations）移到 `platform/database/migrate.go`

---

## 🟢 Minor / 有空改

- [ ] **HTTP Server 超时时间过于宽松（120s）**
  - 对于普通 CRUD 接口太宽，应区分处理
  - LLM/TTS 接口建议异步化（任务队列 or SSE streaming）

- [ ] **`viper` 作为全局状态使用，测试不友好**
  - 文件：`platform/config/config.go`
  - 修复：改用 `viper.New()` 创建实例并传递

- [ ] **`static/` 生成音频文件确认不要 commit 进仓库**
  - 检查 `.gitignore` 是否已包含 `static/audio/`

- [ ] **`dialogue/service.go` 中 `GenerateDialogue` 和 `RegenerateDialogue` 逻辑大量重复**
  - TTS 循环、vocab rating、结果聚合逻辑几乎相同
  - 修复：提取 `saveDialogueLines(ctx, d, llmLines)` 等私有函数复用

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
