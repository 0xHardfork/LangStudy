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
- **单元测试覆盖**：
  - 核心计算与业务转换逻辑（例如前端挖空词符切分 `splitToken` / 过滤，后端艾宾浩斯曲线计算）必须包含 100% 覆盖率的单元测试。
  - 新增 API 接口须追加基本的端到端集成测试（前端可使用 Mock，后端建议使用 Testcontainers 挂载隔离数据库）。

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

### 2. 代码自解释要求 (Self-Explanatory Code)
- 生成与修改代码时，**不要在代码中添加解释性的注释或注解**。
- 应通过清晰、直观、具有描述性的变量命名、函数命名、合理的模块与结构划分来使代码实现自我解释，避免冗余的注释干扰阅读。
