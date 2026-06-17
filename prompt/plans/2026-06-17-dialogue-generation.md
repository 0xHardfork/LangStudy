# 对话生成 & 填空学习功能 实现计划

> **执行说明:** 推荐使用分步执行或子代理驱动的方式按任务（Task）依次实现本计划。步骤使用复选框 (`- [ ]`) 语法进行进度跟踪。

**目标:** 通过大模型为用户生成目标语言的男女对话，并以逐句填空的方式进行语言学习，错误句自动进入艾宾浩斯复习队列。

**架构设计:**
- **后端**：新增 `internal/userprofile`、`internal/dialogue`、`internal/ebbinghaus` 三个 Feature 模块。LLM 调用在 `dialogue` service 层封装，读取 `llm_configs` 表中的配置发起 HTTP 请求。TTS 语音生成通过 `exec.Command("edge-tts", ...)` 调用本地 CLI，每句话保存一个独立 MP3 文件，路径存入 `dialogue_lines.audio_path`。
- **前端**：在普通用户界面新增"今日学习"流程，包含主题选择→语言选择（多语言时弹窗）→生成中→逐句填空→结果统计，以 React 状态机驱动，不引入新路由。填空练习界面每句话提供播放按钮，点击后播放对应 MP3。
- **数据流**：用户触发"生成对话" → 后端调用 LLM 生成文本 → 逐句保存 → 调用 edge-tts CLI 生成 MP3 并存路径 → LLM 批量评级词汇重要度 → 存入 DB → 前端按填空级别渲染 + 播放音频。

**技术栈:** Go 1.22 + Gin + GORM + PostgreSQL、React 18 + TypeScript + Ant Design、OpenAI-compatible Chat Completions API、edge-tts（Microsoft Edge TTS，免费无需 API Key）

---

## 涉及文件总览

```
backend/
  migrations/
    000003_create_user_profiles.up.sql          [NEW]
    000003_create_user_profiles.down.sql        [NEW]
    000004_create_dialogues.up.sql              [NEW]  ← dialogue_lines 含 audio_path 字段
    000004_create_dialogues.down.sql            [NEW]
  internal/
    userprofile/
      model.go    store.go    service.go    handler.go    [NEW]
    dialogue/
      model.go    store.go    service.go    handler.go    [NEW]
      tts.go                                              [NEW] ← edge-tts CLI 调用封装
    ebbinghaus/
      model.go    store.go    service.go    handler.go    [NEW]
  cmd/server/main.go                                      [MODIFY]
  static/audio/                                           [NEW] ← 运行时生成，存放 MP3 文件

frontend/src/
  types/index.ts                                          [NEW]
  services/api.ts                                         [NEW]
  store/useAppStore.ts                                    [NEW]
  components/
    TopicSelectModal.tsx                                  [NEW]
    LanguageSelectModal.tsx                               [NEW]
    FillBlankExercise.tsx                                 [NEW]  ← 含音频播放按钮
    ReviewExercise.tsx                                    [NEW]
  App.tsx                                                 [MODIFY]
```

---

## Task 1: 数据库迁移

**涉及文件:**
- 新增: `backend/migrations/000003_create_user_profiles.up.sql`
- 新增: `backend/migrations/000003_create_user_profiles.down.sql`
- 新增: `backend/migrations/000004_create_dialogues.up.sql`
- 新增: `backend/migrations/000004_create_dialogues.down.sql`

- [ ] **步骤 1: 000003 up — user_profiles 表**

```sql
CREATE TABLE IF NOT EXISTS user_profiles (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    nickname        VARCHAR(64) NOT NULL DEFAULT '',
    native_language VARCHAR(20) NOT NULL DEFAULT 'zh',
    -- 格式: [{"lang":"ja","level":"beginner"},{"lang":"en","level":"intermediate"}]
    target_languages JSONB NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **步骤 2: 000003 down**

```sql
DROP TABLE IF EXISTS user_profiles;
```

- [ ] **步骤 3: 000004 up — dialogues / dialogue_lines / vocabulary_items / ebbinghaus_reviews**

```sql
CREATE TABLE IF NOT EXISTS dialogues (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    language    VARCHAR(20) NOT NULL,
    level       VARCHAR(20) NOT NULL,
    topic       VARCHAR(100) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dialogue_lines (
    id            BIGSERIAL PRIMARY KEY,
    dialogue_id   BIGINT NOT NULL REFERENCES dialogues(id) ON DELETE CASCADE,
    line_index    INT NOT NULL,
    speaker       VARCHAR(10) NOT NULL,   -- "A" or "B"
    original_text TEXT NOT NULL,
    translation   TEXT NOT NULL,
    audio_path    TEXT,                  -- 相对路径，如 static/audio/1/0.mp3，生成失败时为 NULL
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vocabulary_items (
    id               BIGSERIAL PRIMARY KEY,
    dialogue_line_id BIGINT NOT NULL REFERENCES dialogue_lines(id) ON DELETE CASCADE,
    word             TEXT NOT NULL,
    word_index       INT NOT NULL,
    importance       SMALLINT NOT NULL CHECK (importance BETWEEN 1 AND 4),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ebbinghaus_reviews (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dialogue_line_id BIGINT NOT NULL REFERENCES dialogue_lines(id) ON DELETE CASCADE,
    next_review_at   TIMESTAMPTZ NOT NULL,
    review_count     INT NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, dialogue_line_id)
);

CREATE INDEX IF NOT EXISTS idx_dialogue_lines_dialogue_id ON dialogue_lines(dialogue_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_items_line_id   ON vocabulary_items(dialogue_line_id);
CREATE INDEX IF NOT EXISTS idx_ebbinghaus_user_next       ON ebbinghaus_reviews(user_id, next_review_at);
```

- [ ] **步骤 4: 000004 down**

```sql
DROP TABLE IF EXISTS ebbinghaus_reviews;
DROP TABLE IF EXISTS vocabulary_items;
DROP TABLE IF EXISTS dialogue_lines;
DROP TABLE IF EXISTS dialogues;
```

- [ ] **步骤 5: 验证迁移**

```bash
cd backend && go run -tags dev ./cmd/server
# 预期: 日志输出 migrations applied，无报错
# psql 验证
psql $DATABASE_URL -c "\dt"
# 应看到 5 张新表
```

- [ ] **步骤 6: 提交**

```bash
git add backend/migrations/000003_* backend/migrations/000004_*
git commit -m "feat(db): add user_profiles, dialogues, vocabulary, ebbinghaus tables"
```

---

## Task 2: userprofile 模块 (Backend)

**涉及文件:**
- 新增: `backend/internal/userprofile/model.go`
- 新增: `backend/internal/userprofile/store.go`
- 新增: `backend/internal/userprofile/service.go`
- 新增: `backend/internal/userprofile/handler.go`
- 修改: `backend/cmd/server/main.go`

**API:**
- `GET  /api/v1/me/profile` — 获取当前用户的学习档案（昵称、母语、目标语言列表）
- `PUT  /api/v1/me/profile` — 创建或更新学习档案

**model.go 关键类型:**

```go
type TargetLanguage struct {
    Lang  string `json:"lang"`  // "ja" | "en" | "ko" | "fr" | "de" | "es"
    Level string `json:"level"` // "beginner" | "intermediate" | "advanced"
}

// TargetLanguages 实现 driver.Valuer / sql.Scanner 接口用于 JSONB 读写
type TargetLanguages []TargetLanguage

type UserProfile struct {
    ID              uint
    UserID          uint            `gorm:"uniqueIndex;not null"`
    Nickname        string          `gorm:"size:64;not null;default:''"`
    NativeLanguage  string          `gorm:"column:native_language;size:20;not null;default:'zh'"`
    TargetLanguages TargetLanguages `gorm:"column:target_languages;type:jsonb;not null;default:'[]'"`
    CreatedAt, UpdatedAt time.Time
}

type UpsertProfileRequest struct {
    Nickname        string          `json:"nickname"         binding:"max=64"`
    NativeLanguage  string          `json:"native_language"  binding:"required,oneof=zh en ja ko fr de es"`
    TargetLanguages TargetLanguages `json:"target_languages" binding:"required,min=1"`
}
```

**store.go 接口:**

```go
type Store interface {
    GetByUserID(ctx context.Context, userID uint) (*UserProfile, error)
    Upsert(ctx context.Context, profile *UserProfile) error
}
// GetByUserID: 未找到时返回 (nil, nil)，不返回错误
// Upsert: 使用 GORM FirstOrCreate + Assign 模式实现 upsert
```

**service.go 业务规则:**
- `GetProfile`: 若 DB 中不存在则返回空默认值（NativeLanguage="zh", TargetLanguages=[]），不报错
- `UpsertProfile`: 直接写入，无额外业务校验

**main.go 注册（authed 路由组）:**

```go
authed.GET("/me/profile", profileHandler.GetProfile)
authed.PUT("/me/profile", profileHandler.UpsertProfile)
```

- [ ] **步骤 1:** 创建 `backend/internal/userprofile/model.go`
- [ ] **步骤 2:** 创建 `backend/internal/userprofile/store.go`
- [ ] **步骤 3:** 创建 `backend/internal/userprofile/service.go`
- [ ] **步骤 4:** 创建 `backend/internal/userprofile/handler.go`
- [ ] **步骤 5:** 修改 `backend/cmd/server/main.go` 注册模块和路由
- [ ] **步骤 6:** `go build -tags dev ./cmd/server` 验证编译

```bash
# 验证 API
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"superadmin","password":"superadmin123"}' | jq -r .data.token)

curl -s -X PUT http://localhost:8080/api/v1/me/profile \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"nickname":"Taro","native_language":"zh","target_languages":[{"lang":"ja","level":"beginner"}]}' | jq .
# 预期: code=0
```

- [ ] **步骤 7:** 提交

```bash
git add backend/internal/userprofile/ backend/cmd/server/main.go
git commit -m "feat(userprofile): add GET/PUT /me/profile API"
```

---

## Task 3: dialogue 模块 — model & store (Backend)

**涉及文件:**
- 新增: `backend/internal/dialogue/model.go`
- 新增: `backend/internal/dialogue/store.go`

**model.go 关键类型:**

```go
type Dialogue struct {
    ID, UserID uint; Language, Level, Topic string
    Lines     []DialogueLine `gorm:"foreignKey:DialogueID;constraint:OnDelete:CASCADE"`
    CreatedAt time.Time
}

type DialogueLine struct {
    ID, DialogueID uint; LineIndex int; Speaker string
    OriginalText, Translation string
    AudioPath  *string         `gorm:"column:audio_path"` // nullable，生成失败时为 nil
    Vocabulary []VocabularyItem `gorm:"foreignKey:DialogueLineID;constraint:OnDelete:CASCADE"`
    CreatedAt time.Time
}

type VocabularyItem struct {
    ID, DialogueLineID uint; Word string; WordIndex, Importance int; CreatedAt time.Time
}

// GenerateRequest — 生成入参
type GenerateRequest struct {
    Topic    string `binding:"required,max=100"`
    Language string `binding:"required,oneof=ja en ko fr de es"`
    Level    string `binding:"required,oneof=beginner intermediate advanced"`
}

// LineWithVocab — 包含音频路径的响应
type LineWithVocab struct {
    ID           uint             `json:"id"`
    LineIndex    int              `json:"line_index"`
    Speaker      string           `json:"speaker"`
    OriginalText string           `json:"original_text"`
    Translation  string           `json:"translation"`
    AudioPath    *string          `json:"audio_path"`  // 前端用于 <audio src=...>
    Vocabulary   []VocabularyItem `json:"vocabulary"`
}

// AvailableTopics — 硬编码主题列表
var AvailableTopics = []string{
    "SDL","Incident","购物","餐厅点餐","职场沟通","健康与医疗","兴趣爱好","k8s-security","DevSevOps","Web3-Security"
}
```

**store.go 接口:**

```go
type Store interface {
    CreateDialogue(ctx, *Dialogue) error
    CreateLines(ctx, []DialogueLine) error
    CreateVocabulary(ctx, []VocabularyItem) error
    GetDialogueByID(ctx, id, userID uint) (*Dialogue, error)
    ListDialogues(ctx, userID uint) ([]Dialogue, error)
}
// GetDialogueByID: Preload Lines (ORDER BY line_index ASC) + Lines.Vocabulary (ORDER BY word_index ASC)
```

- [ ] **步骤 1:** 创建 `backend/internal/dialogue/model.go`
- [ ] **步骤 2:** 创建 `backend/internal/dialogue/store.go`
- [ ] **步骤 3:** 提交

```bash
git add backend/internal/dialogue/model.go backend/internal/dialogue/store.go
git commit -m "feat(dialogue): add model and store layer"
```

---

## Task 4: dialogue 模块 — LLM Service & TTS & Handler (Backend)

**涉及文件:**
- 新增: `backend/internal/dialogue/tts.go`
- 新增: `backend/internal/dialogue/service.go`
- 新增: `backend/internal/dialogue/handler.go`
- 修改: `backend/cmd/server/main.go`

**API:**
- `GET  /api/v1/dialogue/topics` — 返回主题列表（无需参数）
- `POST /api/v1/dialogue/generate` — 生成对话（LLM + TTS，同步完成后返回）
- `GET  /api/v1/dialogue/:id` — 获取单个对话（含词汇 + audio_path）
- `GET  /api/v1/dialogue` — 列出用户历史对话

**tts.go — edge-tts CLI 封装:**

```go
// backend/internal/dialogue/tts.go

// voiceMap 按语言和说话人角色映射 edge-tts 声音名称
// Speaker A = 女声，Speaker B = 男声（与 Python 脚本一致）
var voiceMap = map[string]map[string]string{
    "ja": {"A": "ja-JP-NanamiNeural", "B": "ja-JP-KeitaNeural"},
    "en": {"A": "en-US-JennyNeural",  "B": "en-US-GuyNeural"},
    "ko": {"A": "ko-KR-SunHiNeural",  "B": "ko-KR-InJoonNeural"},
    "fr": {"A": "fr-FR-DeniseNeural", "B": "fr-FR-HenriNeural"},
    "de": {"A": "de-DE-KatjaNeural",  "B": "de-DE-ConradNeural"},
    "es": {"A": "es-ES-ElviraNeural", "B": "es-ES-AlvaroNeural"},
}

// GenerateAudio 调用 edge-tts CLI 生成单句 MP3
// outputPath: 绝对路径，如 /app/static/audio/1/0.mp3
// 返回相对路径（用于存 DB）：static/audio/1/0.mp3
// 若 edge-tts 不可用或执行失败，返回 ("", err)，调用方应将 audio_path 设为 NULL 而不是中断整个流程
func GenerateAudio(ctx context.Context, text, language, speaker, outputPath string) error {
    voice := voiceMap[language][speaker]
    if voice == "" {
        voice = "en-US-JennyNeural" // fallback
    }
    // 确保目录存在
    if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
        return fmt.Errorf("mkdir: %w", err)
    }
    // 调用: edge-tts --voice <voice> --text <text> --write-media <outputPath>
    cmd := exec.CommandContext(ctx, "edge-tts",
        "--voice", voice,
        "--text", text,
        "--write-media", outputPath,
    )
    out, err := cmd.CombinedOutput()
    if err != nil {
        return fmt.Errorf("edge-tts failed: %w, output: %s", err, string(out))
    }
    return nil
}
```

**service.GenerateDialogue 完整流程:**

```
1. 从 llm_configs 读取 ApiUrl / ApiKey / ModelName / PromptTpl
2. [LLM 调用 #1] 生成 16 句对话（8轮 A/B 交替）
   返回格式: [{"speaker":"A","original_text":"...","translation":"..."}]
3. 保存 Dialogue 记录（获取 dialogue.ID）
4. 逐句处理（for line in llmLines）:
   a. 调用 tts.GenerateAudio(ctx, line.OriginalText, language, line.Speaker,
         "static/audio/{dialogue.ID}/{lineIndex}.mp3")
   b. 若成功，audioPath = ptr("static/audio/{id}/{idx}.mp3")
      若失败，log.Warn(err)，audioPath = nil（不中断流程）
   c. 保存 DialogueLine（含 audio_path）
5. [LLM 调用 #2] 批量词汇重要度评级
   返回格式: [{"line_index":0,"word":"...","word_index":0,"importance":1}]
6. 保存 VocabularyItems
7. 调用 GetDialogueByID 返回完整数据（含 audio_path）
```

> **注意:** TTS 生成失败不应中断整个对话生成流程，仅记录 warn 日志，`audio_path` 存 NULL。

**静态文件目录规则:**
```
backend/static/audio/{dialogue_id}/{line_index}.mp3
```

**main.go 额外配置（静态文件服务 + 路由注册）:**

```go
// 静态文件服务（在路由注册前）
r.Static("/static", "./static")

// authed 路由组
authed.GET("/dialogue/topics", dialogueHandler.GetTopics)
authed.POST("/dialogue/generate", dialogueHandler.Generate)
authed.GET("/dialogue/:id", dialogueHandler.GetDialogue)
authed.GET("/dialogue", dialogueHandler.ListDialogues)
```

**运行前提条件（在部署/开发环境执行一次）:**
```bash
pipx install edge-tts
# 或
pip install edge-tts
# 验证
edge-tts --version
```

- [ ] **步骤 1:** 创建 `backend/internal/dialogue/tts.go`（封装 GenerateAudio + voiceMap）
- [ ] **步骤 2:** 创建 `backend/internal/dialogue/service.go`（含 TTS 调用逻辑）
- [ ] **步骤 3:** 创建 `backend/internal/dialogue/handler.go`
- [ ] **步骤 4:** 修改 `backend/cmd/server/main.go`（加入 Static 路由 + dialogue 模块注册）
- [ ] **步骤 5:** `go build -tags dev ./cmd/server` 验证编译
- [ ] **步骤 6:** 验证 TTS 生成

```bash
# 手动测试 edge-tts CLI
edge-tts --voice ja-JP-NanamiNeural --text "こんにちは" --write-media /tmp/test.mp3
ls -la /tmp/test.mp3  # 应存在且大小 > 0

# 验证静态文件服务
curl -I http://localhost:8080/static/audio/1/0.mp3
# 若文件存在: 200 OK
```

- [ ] **步骤 7:** 提交

```bash
git add backend/internal/dialogue/ backend/cmd/server/main.go
git commit -m "feat(dialogue): add LLM dialogue generation + edge-tts audio per line"
```

---

## Task 5: ebbinghaus 复习模块 (Backend)

**涉及文件:**
- 新增: `backend/internal/ebbinghaus/model.go`
- 新增: `backend/internal/ebbinghaus/store.go`
- 新增: `backend/internal/ebbinghaus/service.go`
- 新增: `backend/internal/ebbinghaus/handler.go`
- 修改: `backend/cmd/server/main.go`

**API:**
- `GET  /api/v1/reviews/due` — 获取今日到期复习（next_review_at ≤ NOW()，limit 20）
- `POST /api/v1/reviews/answer` — 提交答题结果

**复习间隔序列:** `var ReviewIntervals = []int{1, 3, 7, 14, 30}` （天数）

**RecordAnswer 业务规则:**

```
答对: review_count++，next_review_at = NOW() + ReviewIntervals[review_count] 天
      若 review_count >= 5，视为记住，next_review_at = NOW() + 1年（不再出现在复习列表）
答错: review_count = 0，next_review_at = NOW() + 1天（重置到第一个间隔）
```

**store.Upsert:** 使用 `clause.OnConflict` 在 `(user_id, dialogue_line_id)` 唯一索引上做 upsert

**model.go SubmitAnswerRequest:**

```go
type SubmitAnswerRequest struct {
    DialogueLineID uint `json:"dialogue_line_id" binding:"required"`
    IsCorrect      bool `json:"is_correct"`
}
```

**GetDueReviews 返回:** Preload `DialogueLine.Vocabulary`（ORDER BY word_index ASC），最多 20 条

**main.go 路由注册（authed 路由组）:**

```go
authed.GET("/reviews/due", ebbHandler.GetDueReviews)
authed.POST("/reviews/answer", ebbHandler.SubmitAnswer)
```

- [ ] **步骤 1:** 创建 `backend/internal/ebbinghaus/model.go`
- [ ] **步骤 2:** 创建 `backend/internal/ebbinghaus/store.go`
- [ ] **步骤 3:** 创建 `backend/internal/ebbinghaus/service.go`
- [ ] **步骤 4:** 创建 `backend/internal/ebbinghaus/handler.go`
- [ ] **步骤 5:** 修改 `backend/cmd/server/main.go` 注册 ebbinghaus 模块
- [ ] **步骤 6:** `go build -tags dev ./cmd/server` 验证编译
- [ ] **步骤 7:** 提交

```bash
git add backend/internal/ebbinghaus/ backend/cmd/server/main.go
git commit -m "feat(ebbinghaus): add spaced repetition review API"
```

---

## Task 6: Frontend — 类型定义 & API 服务层

**涉及文件:**
- 新增: `frontend/src/types/index.ts`
- 新增: `frontend/src/services/api.ts`
- 新增: `frontend/src/store/useAppStore.ts`

**types/index.ts 核心类型:**

```typescript
interface TargetLanguage   { lang: string; level: string }
interface UserLearningProfile { nickname: string; native_language: string; target_languages: TargetLanguage[] }
interface VocabularyItem   { id: number; dialogue_line_id: number; word: string; word_index: number; importance: number }
interface DialogueLine     {
    id: number; line_index: number; speaker: string
    original_text: string; translation: string
    audio_path: string | null  // ← 新增，如 "static/audio/1/0.mp3"
    vocabulary: VocabularyItem[]
}
interface Dialogue         { id: number; language: string; level: string; topic: string; lines: DialogueLine[]; created_at: string }
interface ReviewItem       { id: number; dialogue_line_id: number; original_text: string; translation: string; vocabulary: VocabularyItem[]; next_review_at: string; review_count: number }

const LANGUAGE_LABELS = { ja:'日语', en:'英语', ko:'韩语', fr:'法语', de:'德语', es:'西班牙语' }
const LEVEL_LABELS    = { beginner:'初级', intermediate:'中级', advanced:'高级' }
const DIALOGUE_TOPICS = ['日常对话','旅行','购物','餐厅点餐','职场沟通','健康与医疗','兴趣爱好','学校与学习']
```

**services/api.ts 封装函数:**

```typescript
getLearningProfile(token)                        → UserLearningProfile
upsertLearningProfile(token, payload)            → UserLearningProfile
getTopics(token)                                 → string[]
generateDialogue(token, {topic,language,level})  → Dialogue
getDueReviews(token)                             → ReviewItem[]
submitAnswer(token, {dialogue_line_id, is_correct}) → void
```

所有函数统一通过 `apiCall<T>` 辅助函数：若 `res.code !== 0` 则 `throw new Error(json.msg)`

**store/useAppStore.ts:** 使用 zustand，需先执行 `npm install zustand`

```typescript
type AppView = 'home'|'topic-select'|'language-select'|'generating'|'fill-blank'|'review'
interface AppState { currentView, selectedTopic, currentDialogue, fillBlankLevel + setters }
```

- [ ] **步骤 1:** `cd frontend && npm install zustand`
- [ ] **步骤 2:** 创建 `frontend/src/types/index.ts`
- [ ] **步骤 3:** 创建 `frontend/src/services/api.ts`
- [ ] **步骤 4:** 创建 `frontend/src/store/useAppStore.ts`
- [ ] **步骤 5:** 提交

```bash
git add frontend/src/types/ frontend/src/services/ frontend/src/store/
git commit -m "feat(frontend): add types, api service, zustand store"
```

---

## Task 7: Frontend — 模态弹窗组件

**涉及文件:**
- 新增: `frontend/src/components/TopicSelectModal.tsx`
- 新增: `frontend/src/components/LanguageSelectModal.tsx`

**TopicSelectModal:**
- 全屏遮罩 + 模态卡片（glassmorphism 暗色主题）
- 2列网格展示 8 个主题，每个带 emoji 图标
- hover 时高亮紫色边框，点击后调用 `onSelect(topic)`
- id 命名: `topic-${topic}`

**LanguageSelectModal:**
- 仅当用户有 ≥2 个目标语言时由 App.tsx 弹出
- 列表展示，每项含国旗 emoji + 语言名 + 等级
- id 命名: `lang-select-${tl.lang}`
- hover 样式使用 `onMouseEnter/Leave` 内联控制（无 TailwindCSS）

- [ ] **步骤 1:** 创建 `frontend/src/components/TopicSelectModal.tsx`
- [ ] **步骤 2:** 创建 `frontend/src/components/LanguageSelectModal.tsx`
- [ ] **步骤 3:** 提交

```bash
git add frontend/src/components/TopicSelectModal.tsx frontend/src/components/LanguageSelectModal.tsx
git commit -m "feat(frontend): add TopicSelectModal and LanguageSelectModal"
```

---

## Task 8: Frontend — FillBlankExercise 填空练习组件

**涉及文件:**
- 新增: `frontend/src/components/FillBlankExercise.tsx`

**填空级别逻辑（buildSegments 函数）:**

```
Level 1: 取 importance=1 的词，每句最多 1 个填空
Level 2: 取 importance≤2 的词，每句最多 2 个填空
Level 3: 取 importance≤3 的词，每句最多 3 个填空
Level 4: 整句空白 — 隐藏原文，显示翻译，用户在 textarea 输入完整原文
```

**分词逻辑:**
- `originalText.includes(' ')` 为 true → 按空格分词（英/法/德/西）
- 否则 → 按字符分词（日语等）
- 从分词结果按 `word_index` 定位填空位置

**答案校验:**
- Level 1-3: 逐个 blank 对比（`trim().toLowerCase()`）
- Level 4: 整句 `trim().toLowerCase().replace(/\s+/g,' ')` 后对比

**音频控制（AudioControls 子组件）:**

每个句子气泡右上角展示两个音频按钮，并排显示：

| 按钮 | 图标 | id | 功能 |
|------|------|----|------|
| 单次播放 | 🔊 / ⏸ | `btn-play-audio-{lineIdx}` | 点击播放一次，结束后自动停止 |
| 循环播放 | 🔁 / ⏹ | `btn-loop-audio-{lineIdx}` | 点击开启循环，再次点击停止循环 |

**行为规则:**
- 仅当 `line.audio_path != null` 时渲染控制区；否则两个按钮均灰显 `disabled`
- 单次播放：`audio.loop = false`；播放中图标变 ⏸，结束后恢复 🔊
- 循环播放：`audio.loop = true`；激活状态按钮高亮（紫色边框），图标变 ⏹；再次点击调用 `audio.pause()` 并停止
- 两种模式互斥：开启循环播放时，若单次播放正在进行则先停止；开始单次播放时，若循环正在播放则先停止
- 组件卸载（`useEffect` cleanup）时自动停止所有播放，防止内存泄漏

```typescript
// AudioControls 子组件示意
const AudioControls: React.FC<{ audioPath: string | null; lineIdx: number }> = ({ audioPath, lineIdx }) => {
    const [playState, setPlayState] = useState<'idle' | 'playing' | 'looping'>('idle')
    const audioRef = useRef<HTMLAudioElement | null>(null)

    const stop = () => {
        audioRef.current?.pause()
        if (audioRef.current) audioRef.current.currentTime = 0
        audioRef.current = null
        setPlayState('idle')
    }

    const handlePlay = () => {
        stop()
        const a = new Audio('/' + audioPath!)
        a.loop = false
        a.onended = () => setPlayState('idle')
        audioRef.current = a
        setPlayState('playing')
        a.play()
    }

    const handleLoop = () => {
        if (playState === 'looping') { stop(); return }
        stop()
        const a = new Audio('/' + audioPath!)
        a.loop = true
        audioRef.current = a
        setPlayState('looping')
        a.play()
    }

    useEffect(() => () => { stop() }, [])  // cleanup on unmount

    const disabled = !audioPath
    return (
        <div style={{ display: 'flex', gap: 4 }}>
            <button id={`btn-play-audio-${lineIdx}`} onClick={handlePlay} disabled={disabled || playState === 'playing'}>
                {playState === 'playing' ? '⏸' : '🔊'}
            </button>
            <button id={`btn-loop-audio-${lineIdx}`} onClick={handleLoop} disabled={disabled}
                style={{ outline: playState === 'looping' ? '2px solid #7c3aed' : 'none' }}>
                {playState === 'looping' ? '⏹' : '🔁'}
            </button>
        </div>
    )
}
```

**DialogueLine 类型:**
```typescript
interface DialogueLine {
    id: number
    line_index: number
    speaker: string
    original_text: string
    translation: string
    audio_path: string | null  // 如 "static/audio/1/0.mp3"
    vocabulary: VocabularyItem[]
}
```

**状态流程:**
```
submitted=false → 用户填写（可先单次/循环播放听音频）→ handleSubmit() → 调用 submitAnswer API
submitted=true  → 显示正确/错误（循环播放会继续直到手动停止）→ handleNext() → 下一句（切换时停止播放）
```

**组件 Props:**

```typescript
interface Props {
    token: string
    dialogue: Dialogue
    fillBlankLevel: number
    onFinish: (wrongCount: number) => void
    onLevelChange: (level: number) => void
}
```

**UI 元素 id:**
- `level-btn-{1-4}` — 难度选择按钮
- `btn-play-audio-{lineIdx}` — 每句单次播放按钮
- `btn-loop-audio-{lineIdx}` — 每句循环播放按钮
- `blank-{lineIdx}-{blankIdx}` — 填空输入框
- `full-input-{lineIdx}` — Level 4 整句输入框
- `btn-submit-answer` — 提交按钮
- `btn-next-line` — 下一句按钮（点击时自动停止当前音频）

- [ ] **步骤 1:** 更新 `frontend/src/types/index.ts`，在 `DialogueLine` 接口中加入 `audio_path: string | null`
- [ ] **步骤 2:** 创建 `frontend/src/components/FillBlankExercise.tsx`（含 AudioButton 子组件）
- [ ] **步骤 3:** 提交

```bash
git add frontend/src/types/index.ts frontend/src/components/FillBlankExercise.tsx
git commit -m "feat(frontend): add FillBlankExercise with audio playback and 4-level fill-in"
```

---

## Task 9: Frontend — 主流程装配 & App.tsx 重构

**涉及文件:**
- 新增: `frontend/src/components/ReviewExercise.tsx`
- 修改: `frontend/src/App.tsx`

**ReviewExercise 组件:**
- 挂载时调用 `getDueReviews` 获取到期列表
- 若为空：显示"暂无需要复习"提示 + 返回按钮
- 每次展示一句：显示翻译 + importance=1 词汇提示 + textarea 输入完整原文
- 提交后调用 `submitAnswer`，显示正误反馈，点击"下一条"继续
- 全部完成后显示"复习完成"结果页

**App.tsx 状态机 (AppView):**

```
home ──→ topic-select ──→ language-select ──→ generating ──→ fill-blank ──→ home
  │                                                                          ↑
  └──→ review ──────────────────────────────────────────────────────────────┘
```

**App.tsx 关键逻辑:**

```typescript
// handleTopicSelect: 选主题后判断目标语言数量
targets.length > 1  → setView('language-select')
targets.length === 1 → setSelectedLang(targets[0]); beginGenerate(topic, targets[0])
targets.length === 0 → alert('请先配置目标语言')

// beginGenerate: 异步生成对话
setView('generating') → await generateDialogue() → setCurrentDialogue() → setView('fill-blank')
// 生成失败: setGeneratingError(msg) → setView('home')

// handleExerciseFinish(wrongCount):
setExerciseResult({ wrongCount }) → setView('home')
// 主页显示结果横幅
```

**主页 ActionCard 组件（局部）:**
- 两张卡片：🎓 今日学习 / 🔄 今日复习
- hover 时背景变为渐变色 + translateY(-2px) + 阴影
- id: `btn-start-learning` / `btn-start-review`

- [ ] **步骤 1:** 创建 `frontend/src/components/ReviewExercise.tsx`
- [ ] **步骤 2:** 完整替换 `frontend/src/App.tsx`
- [ ] **步骤 3:** `npm run build` 验证无 TypeScript 错误
- [ ] **步骤 4:** 端到端测试

```
1. 普通用户登录 → 主页显示学习/复习按钮
2. 点击"今日学习" → 主题弹窗 → 选主题 → 生成动画
3. 生成完成 → 填空练习（验证 4 个级别）
4. 故意答错 → 完成练习 → 主页结果横幅
5. 点击"今日复习" → 错题出现
```

- [ ] **步骤 5:** 提交

```bash
git add frontend/src/components/ReviewExercise.tsx frontend/src/App.tsx
git commit -m "feat(frontend): assemble full dialogue learning flow in App.tsx"
```

---

## Verification Plan

```bash
# 1. 后端编译
cd backend && go build -tags dev ./cmd/server

# 2. 前端编译
cd frontend && npm run build

# 3. API 验证（需启动服务）
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"superadmin","password":"superadmin123"}' | jq -r .data.token)

# 设置学习档案
curl -s -X PUT http://localhost:8080/api/v1/me/profile \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"nickname":"Test","native_language":"zh","target_languages":[{"lang":"ja","level":"beginner"}]}' | jq .code
# 预期: 0

# 获取主题列表
curl -s http://localhost:8080/api/v1/dialogue/topics -H "Authorization: Bearer $TOKEN" | jq '.data | length'
# 预期: 8

# 生成对话（需要 llm_configs 中配置有效 API Key）
curl -s -X POST http://localhost:8080/api/v1/dialogue/generate \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"topic":"日常对话","language":"ja","level":"beginner"}' | jq '.data.lines | length'
# 预期: 16

# 检查复习列表（初始为空）
curl -s http://localhost:8080/api/v1/reviews/due \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
# 预期: 0
```
