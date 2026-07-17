package subtitle

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/0xHardfork/langstudy/platform/llm"
	"github.com/0xHardfork/langstudy/platform/llmconfig"
	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"
)

// Service defines the business logic interface for subtitle study.
type Service interface {
	ProcessSubtitle(ctx context.Context, userID uint, filename, title, targetLang, nativeLang string, contentBytes []byte) (*SubtitleTopic, error)
	GetHistory(ctx context.Context, userID uint) ([]SubtitleTopic, error)
	GetTopic(ctx context.Context, id, userID uint) (*SubtitleTopic, error)
	RegenerateSentence(ctx context.Context, userID, sentenceID uint) (*SubtitleSentence, error)
	DeleteTopic(ctx context.Context, id, userID uint) error

	ProcessChunk(ctx context.Context, userID, chunkID uint) error
	MergeTopic(ctx context.Context, id, userID uint) error
	ShareTopic(ctx context.Context, id, userID uint) error
	UnshareTopic(ctx context.Context, id, userID uint) error
	GetSharedHistory(ctx context.Context) ([]SubtitleTopic, error)
	StartTopicProcessing(userID, topicID uint) error
}

type svc struct {
	store  Store
	llmSvc llmconfig.Service
	log    *zap.Logger
	llmCli *llm.Client

	activeTasksMu sync.Mutex
	activeTasks   map[uint]context.CancelFunc
}

// NewService creates a new subtitle Service.
func NewService(store Store, llmSvc llmconfig.Service, log *zap.Logger, llmCli *llm.Client) Service {
	return &svc{
		store:       store,
		llmSvc:      llmSvc,
		log:         log,
		llmCli:      llmCli,
		activeTasks: make(map[uint]context.CancelFunc),
	}
}

// Prompt fallback templates
const defaultTranslatePromptTpl = `You are a professional subtitle translator. Translate the following video subtitle blocks from a learning context. For each block, translate its "text" into the target learning language "{{target_lang}}" (if not already in it) and the native language "{{native_lang}}".
Input blocks (JSON format):
{{blocks}}

You MUST return a JSON array containing ONLY objects with this exact structure:
[
  {
    "index": <block index>,
    "target_text": "<translation in {{target_lang}}>",
    "native_text": "<translation in {{native_lang}}>"
  }
]`

const defaultAnalyzePromptTpl = `You are an expert English teacher. Analyze the grammar structure of the following sentence from a video subtitle, translate it, and output a detailed grammatical breakdown in a clean, unified Markdown format.

Sentence: "{{sentence}}"

Generate a JSON object strictly matching this schema:
{
  "translation": "accurate Chinese translation of the sentence",
  "explanation": "Detailed grammatical analysis of the sentence structure. You MUST use this exact Markdown template for the explanation:

### 1. 句子主干 (Core Structure)
- **主语 (Subject):** [Explain what the subject is]
- **谓语 (Predicate):** [Explain the verb/predicate]
- **宾语/表语 (Object/Predicative):** [Explain the object or predicative]

### 2. 语法点解析 (Grammar Points)
- **[Point Name 1]**: [Detail analysis of clauses, modifiers, voice, tenses, etc.]
- **[Point Name 2]**: [Detail analysis of another syntax rule applied here]

### 3. 词汇与搭配 (Vocabulary & Phrases)
- **[Word/Phrase 1]**: [Chinese meaning and context explanation]
- **[Word/Phrase 2]**: [Chinese meaning and context explanation]"
}`

func buildTranslatePrompt(tpl, targetLang, nativeLang, blocksJSON string) string {
	if tpl == "" {
		tpl = defaultTranslatePromptTpl
	}
	r := strings.NewReplacer(
		"{{target_lang}}", targetLang,
		"{{native_lang}}", nativeLang,
		"{{blocks}}", blocksJSON,
	)
	return r.Replace(tpl)
}

func buildAnalyzePrompt(tpl, sentence string) string {
	if tpl == "" {
		tpl = defaultAnalyzePromptTpl
	}
	r := strings.NewReplacer(
		"{{sentence}}", sentence,
	)
	return r.Replace(tpl)
}

var tagRegex = regexp.MustCompile(`(?i)<[^>]*>`)
var bracketRegex = regexp.MustCompile(`\[[^\]]*\]|\([^\)]*\)`)
var speakerRegex = regexp.MustCompile(`(?i)^\s*[a-z0-9\s_-]+:`)

func cleanTextForScript(text string) string {
	text = tagRegex.ReplaceAllString(text, "")
	text = bracketRegex.ReplaceAllString(text, "")
	text = speakerRegex.ReplaceAllString(text, "")
	return strings.TrimSpace(text)
}

func splitSentences(text string) []string {
	normalized := strings.ReplaceAll(text, "\r\n", " ")
	normalized = strings.ReplaceAll(normalized, "\n", " ")

	var sentences []string
	var current strings.Builder

	runes := []rune(normalized)
	for i := 0; i < len(runes); i++ {
		r := runes[i]
		current.WriteRune(r)

		if r == '.' || r == '?' || r == '!' {
			isEnd := i == len(runes)-1
			if !isEnd {
				next := runes[i+1]
				if next == ' ' || next == '"' || next == '\'' {
					sentences = append(sentences, strings.TrimSpace(current.String()))
					current.Reset()
				}
			} else {
				sentences = append(sentences, strings.TrimSpace(current.String()))
				current.Reset()
			}
		}
	}
	if current.Len() > 0 {
		trimmed := strings.TrimSpace(current.String())
		if trimmed != "" {
			sentences = append(sentences, trimmed)
		}
	}

	var cleaned []string
	for _, s := range sentences {
		if s != "" {
			cleaned = append(cleaned, s)
		}
	}
	return cleaned
}

func cleanJSONMarkdown(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```json") {
		s = strings.TrimPrefix(s, "```json")
		s = strings.TrimSuffix(s, "```")
	} else if strings.HasPrefix(s, "```") {
		s = strings.TrimPrefix(s, "```")
		s = strings.TrimSuffix(s, "```")
	}
	return strings.TrimSpace(s)
}

var trailingCommaRx = regexp.MustCompile(`,\s*([\}\]])`)

func repairJSON(s string) string {
	s = strings.TrimSpace(s)
	s = trailingCommaRx.ReplaceAllString(s, "$1")
	return s
}

func (s *svc) ProcessSubtitle(ctx context.Context, userID uint, filename, title, targetLang, nativeLang string, contentBytes []byte) (*SubtitleTopic, error) {
	// 1. Parse SRT/VTT/ASS file bytes
	parsedBlocks := ParseSubtitle(contentBytes)
	if len(parsedBlocks) == 0 {
		return nil, errors.New("no valid subtitle blocks found in file")
	}

	// 2. Create Topic with pending status
	topic := &SubtitleTopic{
		UserID:           userID,
		Title:            title,
		OriginalFileName: filename,
		NativeLanguage:   nativeLang,
		TargetLanguage:   targetLang,
		Status:           "pending",
		CreatedAt:        time.Now(),
	}

	if err := s.store.CreateTopic(ctx, topic); err != nil {
		return nil, err
	}

	// 3. Split parsedBlocks into chunks of 30 blocks
	const chunkSize = 30
	for i := 0; i < len(parsedBlocks); i += chunkSize {
		end := i + chunkSize
		if end > len(parsedBlocks) {
			end = len(parsedBlocks)
		}

		chunkBlocks := parsedBlocks[i:end]
		chunkJSON, err := json.Marshal(chunkBlocks)
		if err != nil {
			return nil, fmt.Errorf("serialize chunk blocks: %w", err)
		}

		chunk := &SubtitleChunk{
			TopicID:    topic.ID,
			ChunkIndex: i / chunkSize,
			StartIndex: chunkBlocks[0].Index,
			EndIndex:   chunkBlocks[len(chunkBlocks)-1].Index,
			RawContent: string(chunkJSON),
			Status:     "pending",
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}

		if err := s.store.CreateChunk(ctx, chunk); err != nil {
			return nil, err
		}
	}

	// Fetch full topic details (including chunks) to return
	return s.store.GetTopic(ctx, topic.ID, userID)
}

func (s *svc) ProcessChunk(ctx context.Context, userID, chunkID uint) (err error) {
	chunk, err := s.store.GetChunk(ctx, chunkID)
	if err != nil {
		return err
	}
	if chunk == nil {
		return errors.New("chunk not found")
	}

	// Verify topic ownership
	topic, err := s.store.GetTopic(ctx, chunk.TopicID, userID)
	if err != nil {
		return err
	}
	if topic == nil {
		return errors.New("unauthorized access to chunk")
	}

	// Mark chunk as processing
	_ = s.store.UpdateChunkStatus(ctx, chunkID, "processing", "")

	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("panic in chunk processing: %v", r)
		}
		if err != nil {
			s.log.Error("chunk processing failed", zap.Uint("chunkID", chunkID), zap.Error(err))
			_ = s.store.UpdateChunkStatus(ctx, chunkID, "failed", err.Error())
		} else {
			_ = s.store.UpdateChunkStatus(ctx, chunkID, "completed", "")
		}
	}()

	cfg, err := s.llmSvc.GetConfig(ctx)
	if err != nil {
		return err
	}

	// Deserialize blocks
	var parsedBlocks []ParsedBlock
	if err := json.Unmarshal([]byte(chunk.RawContent), &parsedBlocks); err != nil {
		return err
	}

	blocks := make([]SubtitleBlock, len(parsedBlocks))
	for idx, pb := range parsedBlocks {
		targetText, nativeText := SplitBilingualText(pb.Text)
		blocks[idx] = SubtitleBlock{
			TopicID:    chunk.TopicID,
			BlockIndex: pb.Index,
			StartTime:  pb.StartTime,
			EndTime:    pb.EndTime,
			RawText:    pb.Text,
			TargetText: targetText,
			NativeText: nativeText,
		}
	}

	// Concurrently translate blocks in batches of 15
	const batchSize = 15
	g, translateCtx := errgroup.WithContext(ctx)
	sem := make(chan struct{}, 5)

	type rawBlockItem struct {
		Index int    `json:"index"`
		Text  string `json:"text"`
	}

	type transResult struct {
		Index      int    `json:"index"`
		TargetText string `json:"target_text"`
		NativeText string `json:"native_text"`
	}

	for i := 0; i < len(blocks); i += batchSize {
		start := i
		end := i + batchSize
		if end > len(blocks) {
			end = len(blocks)
		}

		g.Go(func() error {
			needTranslation := false
			for idx := start; idx < end; idx++ {
				if blocks[idx].NativeText == "" {
					needTranslation = true
					break
				}
			}

			if !needTranslation {
				return nil
			}

			sem <- struct{}{}
			defer func() { <-sem }()

			if translateCtx.Err() != nil {
				return translateCtx.Err()
			}

			batchItems := make([]rawBlockItem, 0, end-start)
			for idx := start; idx < end; idx++ {
				if blocks[idx].NativeText == "" {
					batchItems = append(batchItems, rawBlockItem{
						Index: blocks[idx].BlockIndex,
						Text:  blocks[idx].TargetText,
					})
				}
			}

			bBytes, err := json.Marshal(batchItems)
			if err != nil {
				return err
			}

			prompt := buildTranslatePrompt(cfg.SubtitleTranslatePromptTpl, topic.TargetLanguage, topic.NativeLanguage, string(bBytes))
			llmOutput, err := s.llmCli.Call(translateCtx, cfg.ApiUrl, cfg.ApiKey, cfg.ModelName, prompt)
			if err != nil {
				s.log.Warn("batch translation failed, using fallback", zap.Error(err))
				for idx := start; idx < end; idx++ {
					if blocks[idx].NativeText == "" {
						blocks[idx].NativeText = "（翻译失败）"
					}
				}
				return nil
			}

			cleanedJSON := cleanJSONMarkdown(llmOutput)
			repairedJSON := repairJSON(cleanedJSON)

			var results []transResult
			if err := json.Unmarshal([]byte(repairedJSON), &results); err != nil {
				s.log.Warn("batch translation parse failed, using fallback", zap.String("output", llmOutput), zap.Error(err))
				for idx := start; idx < end; idx++ {
					if blocks[idx].NativeText == "" {
						blocks[idx].NativeText = "（解析翻译出错）"
					}
				}
				return nil
			}

			resMap := make(map[int]transResult)
			for _, r := range results {
				resMap[r.Index] = r
			}

			for idx := start; idx < end; idx++ {
				if blocks[idx].NativeText != "" {
					continue
				}
				rIndex := blocks[idx].BlockIndex
				if res, ok := resMap[rIndex]; ok {
					blocks[idx].TargetText = res.TargetText
					blocks[idx].NativeText = res.NativeText
				} else {
					blocks[idx].NativeText = "（未返回翻译）"
				}
			}
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return err
	}

	// Reconstruct and clean sentences
	var targetScriptLines []string
	for _, b := range blocks {
		cleaned := cleanTextForScript(b.TargetText)
		if cleaned != "" {
			targetScriptLines = append(targetScriptLines, cleaned)
		}
	}
	fullScriptText := strings.Join(targetScriptLines, " ")

	rawSentences := splitSentences(fullScriptText)
	if len(rawSentences) == 0 {
		for _, b := range blocks {
			if b.TargetText != "" {
				rawSentences = append(rawSentences, b.TargetText)
			}
		}
	}

	sentences := make([]SubtitleSentence, len(rawSentences))
	for i := range rawSentences {
		sentences[i] = SubtitleSentence{
			TopicID: chunk.TopicID,
			// Offset sentence index globally: chunkIndex * 1000 + localIndex
			SentenceIndex: (chunk.ChunkIndex * 1000) + i,
			OriginalText:  rawSentences[i],
		}
	}

	// Concurrently analyze sentences in chunk
	var wg sync.WaitGroup
	for i := range sentences {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			sText := sentences[idx].OriginalText

			if isSimpleSentence(sText) {
				sentences[idx].Translation = sText
				sentences[idx].Explanation = "（单词或短语气，已跳过语法分析）"
				return
			}

			select {
			case sem <- struct{}{}:
				defer func() { <-sem }()
			case <-ctx.Done():
				sentences[idx].Translation = "（分析被取消）"
				sentences[idx].Explanation = "请求取消，未进行 AI 语法深度解析。"
				return
			}

			prompt := buildAnalyzePrompt(cfg.SubtitleAnalyzePromptTpl, sText)
			llmOutput, err := s.llmCli.Call(ctx, cfg.ApiUrl, cfg.ApiKey, cfg.ModelName, prompt)
			if err != nil {
				s.log.Warn("sentence grammar analysis failed", zap.String("sentence", sText), zap.Error(err))
				sentences[idx].Translation = "（AI 翻译失败）"
				sentences[idx].Explanation = fmt.Sprintf("AI 语法分析失败，错误: %v", err)
				return
			}

			cleanedJSON := cleanJSONMarkdown(llmOutput)
			repairedJSON := repairJSON(cleanedJSON)

			var parsed struct {
				Translation string `json:"translation"`
				Explanation string `json:"explanation"`
			}

			if err := json.Unmarshal([]byte(repairedJSON), &parsed); err != nil {
				s.log.Warn("failed to parse grammar JSON", zap.String("sentence", sText), zap.Error(err))
				sentences[idx].Translation = "（格式解析失败）"
				sentences[idx].Explanation = fmt.Sprintf("AI 原始分析输出如下：\n%s", llmOutput)
				return
			}

			sentences[idx].Translation = parsed.Translation
			sentences[idx].Explanation = parsed.Explanation
		}(i)
	}
	wg.Wait()

	// Write blocks and sentences to DB
	if err := s.store.SaveChunkResults(ctx, blocks, sentences); err != nil {
		return err
	}

	return nil
}

func (s *svc) MergeTopic(ctx context.Context, id, userID uint) error {
	topic, err := s.store.GetTopic(ctx, id, userID)
	if err != nil {
		return err
	}
	if topic == nil {
		return errors.New("subtitle topic not found")
	}

	// Verify all chunks are completed
	for _, chunk := range topic.Chunks {
		if chunk.Status != "completed" {
			return fmt.Errorf("chunk #%d status is '%s', not completed", chunk.ChunkIndex+1, chunk.Status)
		}
	}

	return s.store.MergeTopic(ctx, id, userID)
}

func (s *svc) GetHistory(ctx context.Context, userID uint) ([]SubtitleTopic, error) {
	return s.store.GetTopics(ctx, userID)
}

func (s *svc) GetTopic(ctx context.Context, id, userID uint) (*SubtitleTopic, error) {
	return s.store.GetTopic(ctx, id, userID)
}

func (s *svc) RegenerateSentence(ctx context.Context, userID, sentenceID uint) (*SubtitleSentence, error) {
	cfg, err := s.llmSvc.GetConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("get llm config: %w", err)
	}

	sent, err := s.store.GetSentence(ctx, sentenceID)
	if err != nil {
		return nil, err
	}
	if sent == nil {
		return nil, errors.New("sentence not found")
	}

	topic, err := s.store.GetTopic(ctx, sent.TopicID, userID)
	if err != nil {
		return nil, err
	}
	if topic == nil {
		return nil, errors.New("unauthorized access to sentence")
	}

	prompt := buildAnalyzePrompt(cfg.SubtitleAnalyzePromptTpl, sent.OriginalText)
	llmOutput, err := s.llmCli.Call(ctx, cfg.ApiUrl, cfg.ApiKey, cfg.ModelName, prompt)
	if err != nil {
		return nil, fmt.Errorf("AI analysis failed: %w", err)
	}

	cleanedJSON := cleanJSONMarkdown(llmOutput)
	repairedJSON := repairJSON(cleanedJSON)

	var parsed struct {
		Translation string `json:"translation"`
		Explanation string `json:"explanation"`
	}

	if err := json.Unmarshal([]byte(repairedJSON), &parsed); err != nil {
		return nil, fmt.Errorf("AI format parse failed: %w", err)
	}

	sent.Translation = parsed.Translation
	sent.Explanation = parsed.Explanation

	if err := s.store.UpdateSentence(ctx, sent); err != nil {
		return nil, err
	}

	return sent, nil
}

func (s *svc) DeleteTopic(ctx context.Context, id, userID uint) error {
	return s.store.DeleteTopic(ctx, id, userID)
}

func (s *svc) ShareTopic(ctx context.Context, id, userID uint) error {
	return s.store.ToggleShareTopic(ctx, id, userID, true)
}

func (s *svc) UnshareTopic(ctx context.Context, id, userID uint) error {
	return s.store.ToggleShareTopic(ctx, id, userID, false)
}

func (s *svc) GetSharedHistory(ctx context.Context) ([]SubtitleTopic, error) {
	return s.store.GetSharedTopics(ctx)
}

func (s *svc) StartTopicProcessing(userID, topicID uint) error {
	s.activeTasksMu.Lock()
	if _, running := s.activeTasks[topicID]; running {
		s.activeTasksMu.Unlock()
		return nil
	}

	ctx, cancel := context.WithCancel(context.Background())
	s.activeTasks[topicID] = cancel
	s.activeTasksMu.Unlock()

	go func() {
		defer func() {
			s.activeTasksMu.Lock()
			delete(s.activeTasks, topicID)
			s.activeTasksMu.Unlock()
			cancel()
		}()

		// Reset chunks that were stuck in "processing" back to "pending"
		if err := s.store.ResetStuckChunks(ctx, topicID); err != nil {
			s.log.Error("failed to reset stuck chunks", zap.Uint("topicID", topicID), zap.Error(err))
		}

		for {
			topic, err := s.store.GetTopic(ctx, topicID, userID)
			if err != nil {
				s.log.Error("background task: failed to get topic", zap.Uint("topicID", topicID), zap.Error(err))
				return
			}
			if topic == nil || topic.Status != "pending" {
				return
			}

			var nextChunk *SubtitleChunk
			for i := range topic.Chunks {
				c := &topic.Chunks[i]
				if c.Status != "completed" {
					nextChunk = c
					break
				}
			}

			if nextChunk == nil {
				s.log.Info("background task: all chunks completed, merging topic", zap.Uint("topicID", topicID))
				if err := s.store.MergeTopic(ctx, topicID, userID); err != nil {
					s.log.Error("background task: failed to merge topic", zap.Uint("topicID", topicID), zap.Error(err))
				}
				return
			}

			err = s.ProcessChunk(ctx, userID, nextChunk.ID)
			if err != nil {
				s.log.Error("background task: chunk process failed, stopping runner", zap.Uint("topicID", topicID), zap.Uint("chunkID", nextChunk.ID), zap.Error(err))
				return
			}
		}
	}()

	return nil
}

func isSimpleSentence(s string) bool {
	cleaned := strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == ' ' || r == '\'' {
			return r
		}
		return -1
	}, s)
	words := strings.Fields(strings.TrimSpace(cleaned))
	return len(words) <= 3
}
