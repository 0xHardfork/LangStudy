# LangStudy General Repository Rules

本规则适用于本仓库（LangStudy）的所有开发，包括前端与后端，旨在确保代码规范、历史记录可追溯性以及部署稳定性。

---

## Git 提交规范 (Commit Guidelines)

所有 commit 消息必须遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范。
格式要求如下：
```
<type>(<scope>): <subject>

[optional body]
```

### 1. 常用 Type 类型
- **`feat`**：新增功能业务逻辑或前端交互页面
- **`fix`**：修复后端安全漏洞、性能问题、或前端布局和类型 Bug
- **`refactor`**：代码重构（如组件拆分、消除重复代码，不改变业务表现）
- **`style`**：仅样式统一及调整（如 Tailwind 样式迁移，不涉及逻辑变化）
- **`test`**：新增、修改或修复单元测试与集成测试代码
- **`docs`**：补充或更新文档、TODO 列表、或代码内行注释

### 2. 范例
- `feat(frontend): add fill-blank level 4 full text exercise option`
- `fix(backend): fix userID leak in GetHistory database query`
- `style(review): migrate inline style in GrammarReview to TailwindCSS class`

---

## 代码开发与变更保障 (Quality Gates)

### 1. 编译前置检测 (Pre-commit / Pre-push Gate)
- **编译成功性**：任何修改提交前，必须在本地运行并成功编译，严禁带编译报错提交。
  - 前端编译命令：`npm run build` (tsc & vite build 必须 0 报错通过)
  - 后端编译命令：`go build ./...`
- **单元测试与验证**：
  - 针对核心复杂算法与业务逻辑（例如前端挖空词符切分 `splitToken` / 过滤，后端艾宾浩斯曲线计算），必须编写单元测试验证关键边界情况。无需追求死板的 100% 覆盖率，以防过度设计拖慢开发效率。
  - 新增 API 接口须追加基本的功能验证（前端可使用 Mock，后端可选择性使用单元/集成测试）。

### 2. 安全红线 (Zero Trust Security)
- **密钥与环境变量**：
  - 严禁将任何大模型 API 秘钥（如 Gemini Key / OpenAI Key）、数据库连接字符串（如 postgres 密码）、JWT 签名秘钥等敏感明文直接硬编码在代码文件中。
  - 必须使用环境变量或 `.env` 配置文件载入敏感值，且 `.env` 必须加入 `.gitignore` 排除列表。
- **防止注入与越权**：
  - 关系型数据库查询（PostgreSQL）必须使用 GORM 的占位符语句或参数绑定机制，严禁进行字符串拼接以防 SQL 注入。
  - 凡涉及单条记录操作的 API，必须做操作人所有权校验（即校验 `target.UserID == currentUserID`）。

---

## 文档与开发一致性

### 1. TODO 列表一致性跟踪
- 如果当前阶段的任务在 `todolist-front.md` 或 `todolist-back.md` 中有记录，完成该任务时**必须同步更新对应 TODO 文档的完成状态**。
- 若在开发中发现了新的潜在漏洞或待做项，应在对应 TODO 文档中及时记录，并标明优先级等级（🔴 立即修复 / 🟡 近期规划 / 🟢 有空改）。

### 2. 代码注释与文档原则 (Code Commentary Guidelines)
- **避免描述代码在“做什么”**：不要写冗余的注释来描述代码表层逻辑（如 `i++ // i 加一`）。
- **强烈建议写“为什么这么做”（Why）**：在遇到复杂的算法、Hack/Workaround 操作、大模型 Prompt 的背景逻辑，或特定的业务妥协时，必须在代码中写明意图，方便 AI 代理或人类在后续重构或迭代时理解，防止误删或改坏。

---

## Vibe Coding 最佳实践 (AI & Human Collaboration)

为了让 AI 代理与人类协同开发达到最高效率并减少摩擦，必须遵循以下规则：

### 1. AI 友好文件限制 (File Size Limit)
- **单个文件尽量控制在 300 行以内**，逻辑极度复杂的代码文件绝对不要超过 500 行。
- 超过限制时，必须进行拆分（如前端拆分组件或 Custom Hook，后端拆分辅助函数或独立 Service 文件）。这极大地方便了 AI 代理精确读取、分析和替换代码，防止文件过长导致上下文截断或生成代码丢失。

### 2. 小步快跑，持续构建 (Incremental Verification)
- **频繁运行编译检测**：在开发过程中采取增量修改方式，每完成一个小逻辑或组件，立即在本地运行 `go build ./...` 或 `npm run build`。
- 严禁一次性编写上千行未经任何编译和测试验证的代码，确保代码库随时处于“编译通过并可运行”的健康状态。

### 3. 严禁脑补 API 与数据结构 (Zero Assumption)
- 当 AI 代理在编写网络请求或调用数据库时，如果对接口定义的字段、数据类型或表结构不确定，**必须**查阅相关代码或数据库迁移文件，或直接向用户提问。
- 严禁凭空猜测并使用不存在的 API 参数、JSON 键名或 GORM 表字段。
