package reading

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/0xHardfork/langstudy/platform/llm"
	"github.com/0xHardfork/langstudy/platform/llmconfig"
	"go.uber.org/zap"
)

// Service defines the business logic interface for reading study.
type Service interface {
	AnalyzeText(ctx context.Context, userID uint, req *AnalyzeReadingRequest) (*ReadingArticle, error)
	GetHistory(ctx context.Context, userID uint) ([]ReadingArticle, error)
	GetArticle(ctx context.Context, id, userID uint) (*ReadingArticle, error)
	RegenerateSentence(ctx context.Context, userID, sentenceID uint) (*ReadingSentence, error)
	AddSentence(ctx context.Context, userID uint, articleID uint, text string) (*ReadingArticle, error)
}

type svc struct {
	store     Store
	llmSvc    llmconfig.Service
	log       *zap.Logger
	llmCli    *llm.Client
	staticDir string
}

// NewService creates a new reading Service instance.
func NewService(store Store, llmSvc llmconfig.Service, log *zap.Logger, llmCli *llm.Client, staticDir string) Service {
	return &svc{
		store:     store,
		llmSvc:    llmSvc,
		log:       log,
		llmCli:    llmCli,
		staticDir: staticDir,
	}
}

const defaultReadingPromptTpl = `You are an expert English teacher. Analyze the grammar structure of the following sentence, translate it, and output a detailed grammatical breakdown in a clean, unified Markdown format.

Sentence: "%s"

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

func buildReadingPrompt(tpl string, sentence string) string {
	if tpl != "" {
		r := strings.NewReplacer(
			"{{sentence}}", sentence,
		)
		return r.Replace(tpl)
	}
	return fmt.Sprintf(defaultReadingPromptTpl, sentence)
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

func (s *svc) AnalyzeText(ctx context.Context, userID uint, req *AnalyzeReadingRequest) (*ReadingArticle, error) {
	if strings.TrimSpace(req.Text) == "" {
		art := &ReadingArticle{
			UserID:    userID,
			Title:     req.Title,
			RawText:   "",
			Sentences: []ReadingSentence{},
			CreatedAt: time.Now(),
		}
		if err := s.store.CreateArticle(ctx, art); err != nil {
			return nil, err
		}
		return art, nil
	}

	cfg, err := s.llmSvc.GetConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("get llm config: %w", err)
	}

	// 1. Split into paragraphs first to maintain layout, then split into sentences
	text := strings.ReplaceAll(req.Text, "\r\n", "\n")
	rawParagraphs := strings.Split(text, "\n")

	var sentences []ReadingSentence
	sentenceIdx := 0
	paragraphIdx := 0

	for _, pText := range rawParagraphs {
		pText = strings.TrimSpace(pText)
		if pText == "" {
			continue
		}
		pSentences := splitSentences(pText)
		for _, sText := range pSentences {
			sentences = append(sentences, ReadingSentence{
				SentenceIndex:  sentenceIdx,
				ParagraphIndex: paragraphIdx,
				OriginalText:   sText,
				CreatedAt:      time.Now(),
			})
			sentenceIdx++
		}
		paragraphIdx++
	}

	if len(sentences) == 0 {
		return nil, errors.New("no sentences found in text")
	}

	folderName := fmt.Sprintf("%d", time.Now().UnixNano())

	// 2. Concurrently analyze sentences and generate TTS
	var wg sync.WaitGroup
	sem := make(chan struct{}, 5) // max 5 concurrent LLM calls

	for i := range sentences {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			sText := sentences[idx].OriginalText

			if ctx.Err() != nil {
				sentences[idx].Translation = "（处理被取消）"
				sentences[idx].Explanation = "因超时或请求取消，本句未进行语法解析。"
				return
			}

			// Generate audio
			audioRelPath := fmt.Sprintf("static/audio/reading/%s/%d.mp3", folderName, idx)
			ttsErr := s.generateAudio(ctx, sText, audioRelPath)
			if ttsErr == nil {
				sentences[idx].AudioPath = &audioRelPath
			} else {
				s.log.Warn("tts generation failed for reading sentence", zap.String("sentence", sText), zap.Error(ttsErr))
			}

			// Call LLM
			prompt := buildReadingPrompt(cfg.ReadingPromptTpl, sText)
			llmOutput, err := s.llmCli.Call(ctx, cfg.ApiUrl, cfg.ApiKey, cfg.ModelName, prompt)
			if err != nil {
				s.log.Warn("failed to call LLM for reading analysis", zap.String("sentence", sText), zap.Error(err))
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
				s.log.Warn("failed to parse JSON from LLM output", zap.String("output", llmOutput), zap.Error(err))
				sentences[idx].Translation = "（格式解析失败）"
				sentences[idx].Explanation = fmt.Sprintf("AI 原始分析输出如下：\n%s", llmOutput)
				return
			}

			sentences[idx].Translation = parsed.Translation
			sentences[idx].Explanation = parsed.Explanation
		}(i)
	}
	wg.Wait()

	art := &ReadingArticle{
		UserID:    userID,
		Title:     req.Title,
		RawText:   req.Text,
		Sentences: sentences,
		CreatedAt: time.Now(),
	}

	if err := s.store.CreateArticle(ctx, art); err != nil {
		return nil, err
	}

	return art, nil
}

func (s *svc) GetHistory(ctx context.Context, userID uint) ([]ReadingArticle, error) {
	return s.store.GetArticles(ctx, userID)
}

func (s *svc) GetArticle(ctx context.Context, id, userID uint) (*ReadingArticle, error) {
	return s.store.GetArticle(ctx, id, userID)
}

func (s *svc) RegenerateSentence(ctx context.Context, userID, sentenceID uint) (*ReadingSentence, error) {
	cfg, err := s.llmSvc.GetConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("get llm config: %w", err)
	}

	sent, err := s.store.GetSentence(ctx, sentenceID)
	if err != nil {
		return nil, err
	}
	if sent == nil {
		return nil, fmt.Errorf("sentence not found")
	}

	art, err := s.store.GetArticle(ctx, sent.ArticleID, userID)
	if err != nil {
		return nil, err
	}
	if art == nil {
		return nil, fmt.Errorf("unauthorized access to sentence")
	}

	// Re-generate audio if missing
	if sent.AudioPath == nil || *sent.AudioPath == "" {
		folderName := fmt.Sprintf("%d", time.Now().UnixNano())
		audioRelPath := fmt.Sprintf("static/audio/reading/%s/re_%d.mp3", folderName, sentenceID)
		ttsErr := s.generateAudio(ctx, sent.OriginalText, audioRelPath)
		if ttsErr == nil {
			sent.AudioPath = &audioRelPath
		}
	}

	// Re-run LLM
	prompt := buildReadingPrompt(cfg.ReadingPromptTpl, sent.OriginalText)
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
		return nil, fmt.Errorf("AI format parse failed: %w (raw output: %s)", err, llmOutput)
	}

	sent.Translation = parsed.Translation
	sent.Explanation = parsed.Explanation

	if err := s.store.UpdateSentence(ctx, sent); err != nil {
		return nil, err
	}

	return sent, nil
}

func (s *svc) AddSentence(ctx context.Context, userID uint, articleID uint, text string) (*ReadingArticle, error) {
	// 1. Check ownership and load existing article
	art, err := s.store.GetArticle(ctx, articleID, userID)
	if err != nil {
		return nil, err
	}
	if art == nil {
		return nil, fmt.Errorf("article not found or unauthorized")
	}

	// 2. Parse text into new sentences
	text = strings.ReplaceAll(text, "\r\n", "\n")
	rawParagraphs := strings.Split(text, "\n")

	// Determine starting indices
	maxSentenceIdx := -1
	maxParagraphIdx := -1
	for _, sent := range art.Sentences {
		if sent.SentenceIndex > maxSentenceIdx {
			maxSentenceIdx = sent.SentenceIndex
		}
		if sent.ParagraphIndex > maxParagraphIdx {
			maxParagraphIdx = sent.ParagraphIndex
		}
	}

	var newSentences []ReadingSentence
	sentenceIdx := maxSentenceIdx + 1
	// The new sentences will start in the next paragraph
	paragraphIdx := maxParagraphIdx + 1

	for _, pText := range rawParagraphs {
		pText = strings.TrimSpace(pText)
		if pText == "" {
			continue
		}
		pSentences := splitSentences(pText)
		for _, sText := range pSentences {
			newSentences = append(newSentences, ReadingSentence{
				ArticleID:      articleID,
				SentenceIndex:  sentenceIdx,
				ParagraphIndex: paragraphIdx,
				OriginalText:   sText,
				CreatedAt:      time.Now(),
			})
			sentenceIdx++
		}
		paragraphIdx++
	}

	if len(newSentences) == 0 {
		return nil, errors.New("no valid sentences found to add")
	}

	folderName := fmt.Sprintf("%d", time.Now().UnixNano())

	// 3. Concurrently analyze new sentences and generate TTS
	cfg, err := s.llmSvc.GetConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("get llm config: %w", err)
	}

	var wg sync.WaitGroup
	sem := make(chan struct{}, 5) // max 5 concurrent LLM calls

	for i := range newSentences {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			sText := newSentences[idx].OriginalText

			if ctx.Err() != nil {
				newSentences[idx].Translation = "（处理被取消）"
				newSentences[idx].Explanation = "因超时或请求取消，本句未进行语法解析。"
				return
			}

			// Generate audio
			audioRelPath := fmt.Sprintf("static/audio/reading/%s/add_%d.mp3", folderName, idx)
			ttsErr := s.generateAudio(ctx, sText, audioRelPath)
			if ttsErr == nil {
				newSentences[idx].AudioPath = &audioRelPath
			} else {
				s.log.Warn("tts generation failed for added reading sentence", zap.String("sentence", sText), zap.Error(ttsErr))
			}

			// Call LLM
			prompt := buildReadingPrompt(cfg.ReadingPromptTpl, sText)
			llmOutput, err := s.llmCli.Call(ctx, cfg.ApiUrl, cfg.ApiKey, cfg.ModelName, prompt)
			if err != nil {
				s.log.Warn("failed to call LLM for added reading analysis", zap.String("sentence", sText), zap.Error(err))
				newSentences[idx].Translation = "（AI 翻译失败）"
				newSentences[idx].Explanation = fmt.Sprintf("AI 语法分析失败，错误: %v", err)
				return
			}

			cleanedJSON := cleanJSONMarkdown(llmOutput)
			repairedJSON := repairJSON(cleanedJSON)

			var parsed struct {
				Translation string `json:"translation"`
				Explanation string `json:"explanation"`
			}

			if err := json.Unmarshal([]byte(repairedJSON), &parsed); err != nil {
				s.log.Warn("failed to parse JSON from LLM output for added sentence", zap.String("output", llmOutput), zap.Error(err))
				newSentences[idx].Translation = "（格式解析失败）"
				newSentences[idx].Explanation = fmt.Sprintf("AI 原始分析输出如下：\n%s", llmOutput)
				return
			}

			newSentences[idx].Translation = parsed.Translation
			newSentences[idx].Explanation = parsed.Explanation
		}(i)
	}
	wg.Wait()

	// 4. Save new sentences to store
	if err := s.store.AddSentences(ctx, newSentences); err != nil {
		return nil, err
	}

	// 5. Update article raw_text by appending the new text
	var updatedRawText string
	if art.RawText == "" {
		updatedRawText = text
	} else {
		updatedRawText = art.RawText + "\n\n" + text
	}
	if err := s.store.UpdateArticleRawText(ctx, articleID, updatedRawText); err != nil {
		return nil, err
	}

	// 6. Return fresh reloaded article details
	return s.store.GetArticle(ctx, articleID, userID)
}

// --- TTS helper functions ---

var (
	edgeTTSBinOnce sync.Once
	edgeTTSBinPath string
)

func edgeTTSBin() string {
	edgeTTSBinOnce.Do(func() {
		binName := "edge-tts"
		if runtime.GOOS == "windows" {
			binName = "edge-tts.exe"
		}
		candidates := []string{
			filepath.Join("..", ".venv", "bin", binName), // from backend/
			filepath.Join(".venv", "bin", binName),       // from project root
		}
		for _, c := range candidates {
			if _, err := os.Stat(c); err == nil {
				if abs, err := filepath.Abs(c); err == nil {
					edgeTTSBinPath = abs
					return
				}
			}
		}
		edgeTTSBinPath = "edge-tts"
	})
	return edgeTTSBinPath
}

func (s *svc) generateAudio(ctx context.Context, text, outputPath string) error {
	voice := "en-US-JennyNeural"

	// Map virtual path to physical
	physicalPath := outputPath
	if strings.HasPrefix(outputPath, "static/") {
		physicalPath = filepath.Join(s.staticDir, strings.TrimPrefix(outputPath, "static/"))
	} else if strings.HasPrefix(outputPath, "static\\") {
		physicalPath = filepath.Join(s.staticDir, strings.TrimPrefix(outputPath, "static\\"))
	}

	if err := os.MkdirAll(filepath.Dir(physicalPath), 0755); err != nil {
		return fmt.Errorf("create audio folder: %w", err)
	}

	bin := edgeTTSBin()
	cmd := exec.CommandContext(ctx, bin,
		"--voice", voice,
		"--text", text,
		"--write-media", physicalPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("edge-tts [%s]: %w — output: %s", bin, err, string(out))
	}
	return nil
}
