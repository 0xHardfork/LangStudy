package grammar

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

	"github.com/0xHardfork/langstudy/internal/ebbinghaus"
	"github.com/0xHardfork/langstudy/platform/llm"
	"github.com/0xHardfork/langstudy/platform/llmconfig"
	"go.uber.org/zap"
)

type svc struct {
	store  Store
	llmSvc llmconfig.Service
	log    *zap.Logger
	llmCli *llm.Client
}

func NewService(store Store, llmSvc llmconfig.Service, log *zap.Logger, llmCli *llm.Client) Service {
	return &svc{
		store:  store,
		llmSvc: llmSvc,
		log:    log,
		llmCli: llmCli,
	}
}

const grammarPromptTemplate = `You are an expert English grammar teacher. Analyze the grammar structure of the following sentence and generate a Cloze multiple-choice question testing a key grammar point.

Sentence: "%s"

Generate a JSON object strictly matching this schema:
{
  "translation": "accurate Chinese translation of the sentence",
  "explanation": "Detailed grammatical analysis of the sentence structure (Subject, Verb, Object, Clauses, Modifiers, etc.) and explanations of the syntax rules used.",
  "quiz": {
    "question": "The sentence with the key grammar word/phrase replaced by ____ (e.g., 'The teacher who ____ us English has left the school.')",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_option": 0,
    "tags": ["Grammar Concept Tag 1 (e.g. Attributive Clause)", "Grammar Concept Tag 2 (e.g. Verb Tense)"],
    "explanations": {
      "0": "Pedagogical explanation of why Option A is correct or why it is a common incorrect trap.",
      "1": "Pedagogical explanation of why Option B is correct or why it is a common incorrect trap.",
      "2": "Pedagogical explanation of why Option C is correct or why it is a common incorrect trap.",
      "3": "Pedagogical explanation of why Option D is correct or why it is a common incorrect trap."
    }
  }
}

Guidelines:
1. Ensure the JSON output is valid and can be parsed directly. DO NOT put trailing commas (e.g., placing a comma after the last key-value pair in an object or array before the closing brace/bracket).
2. The Cloze question's correct option must fill the blank '____' to reconstruct the original sentence exactly.
3. The other options (distractors) should represent typical grammatical mistakes made by ESL learners (e.g., wrong verb tense, incorrect pronoun, incorrect word form).
4. Provide clear, supportive explanations for both the correct answer and each incorrect option.
5. Provide 1 to 3 relevant grammatical tags.
`

func buildGrammarPrompt(tpl string, sentence string) string {
	if tpl != "" {
		r := strings.NewReplacer(
			"{{sentence}}", sentence,
		)
		return r.Replace(tpl)
	}
	return fmt.Sprintf(grammarPromptTemplate, sentence)
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

func (s *svc) AnalyzeText(ctx context.Context, userID uint, req *AnalyzeRequest) (*GrammarArticle, error) {
	cfg, err := s.llmSvc.GetConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("get llm config: %w", err)
	}

	rawSentences := splitSentences(req.Text)
	if len(rawSentences) == 0 {
		return nil, errors.New("no sentences found in text")
	}

	folderName := fmt.Sprintf("%d", time.Now().UnixNano())

	sentences := make([]GrammarSentence, len(rawSentences))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 5)

	for idx, sText := range rawSentences {
		wg.Add(1)
		go func(idx int, sText string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			if ctx.Err() != nil {
				sentences[idx] = GrammarSentence{
					SentenceIndex: idx,
					OriginalText:  sText,
					Translation:   "（未分析，请求已被取消或超时）",
					Explanation:   "处理已取消。",
					CreatedAt:     time.Now(),
				}
				return
			}

			audioRelPath := fmt.Sprintf("static/audio/grammar/%s/%d.mp3", folderName, idx)
			ttsErr := s.generateAudio(ctx, sText, audioRelPath)
			var audioPathPtr *string
			if ttsErr == nil {
				audioPathPtr = &audioRelPath
			} else {
				s.log.Warn("tts generation failed for grammar sentence", zap.String("sentence", sText), zap.Error(ttsErr))
			}

			prompt := buildGrammarPrompt(cfg.GrammarPromptTpl, sText)
			llmOutput, err := s.llmCli.Call(ctx, cfg.ApiUrl, cfg.ApiKey, cfg.ModelName, prompt)
			if err != nil {
				s.log.Warn("failed to call LLM for grammar analysis", zap.String("sentence", sText), zap.Error(err))
				sentences[idx] = GrammarSentence{
					SentenceIndex: idx,
					OriginalText:  sText,
					Translation:   "（AI 翻译失败）",
					Explanation:   fmt.Sprintf("AI 语法分析失败，错误信息: %v\n请稍后重新提交该文章尝试。", err),
					AudioPath:     audioPathPtr,
					CreatedAt:     time.Now(),
				}
				return
			}

			cleanedJSON := cleanJSONMarkdown(llmOutput)
			repairedJSON := repairJSON(cleanedJSON)

			var parsed struct {
				Translation string            `json:"translation"`
				Explanation string            `json:"explanation"`
				Quiz        struct {
					Question      string                 `json:"question"`
					Options       []string               `json:"options"`
					CorrectOption int                    `json:"correct_option"`
					Explanations  map[string]interface{} `json:"explanations"`
					Tags          []string               `json:"tags"`
				} `json:"quiz"`
			}

			if err := json.Unmarshal([]byte(repairedJSON), &parsed); err != nil {
				s.log.Warn("failed to unmarshal grammar analysis response", zap.String("output", llmOutput), zap.Error(err))
				sentences[idx] = GrammarSentence{
					SentenceIndex: idx,
					OriginalText:  sText,
					Translation:   "（AI 格式解析失败）",
					Explanation:   fmt.Sprintf("AI 原始分析输出如下：\n%s", llmOutput),
					AudioPath:     audioPathPtr,
					CreatedAt:     time.Now(),
				}
				return
			}

			cleanExplanations := make(map[string]string)
			for k, v := range parsed.Quiz.Explanations {
				if k == "tags" {
					if parsed.Quiz.Tags == nil || len(parsed.Quiz.Tags) == 0 {
						if slice, ok := v.([]interface{}); ok {
							for _, item := range slice {
								if str, ok := item.(string); ok {
									parsed.Quiz.Tags = append(parsed.Quiz.Tags, str)
								}
							}
						}
					}
					continue
				}
				if str, ok := v.(string); ok {
					cleanExplanations[k] = str
				} else {
					cleanExplanations[k] = fmt.Sprintf("%v", v)
				}
			}

			sentence := GrammarSentence{
				SentenceIndex: idx,
				OriginalText:  sText,
				Translation:   parsed.Translation,
				Explanation:   parsed.Explanation,
				AudioPath:     audioPathPtr,
				CreatedAt:     time.Now(),
			}

			if parsed.Quiz.Question != "" && len(parsed.Quiz.Options) == 4 {
				quiz := GrammarQuiz{
					Question:      parsed.Quiz.Question,
					Options:       JSONOptions(parsed.Quiz.Options),
					CorrectOption: parsed.Quiz.CorrectOption,
					Explanations:  JSONExplanations(cleanExplanations),
					Tags:          PostgresTags(parsed.Quiz.Tags),
					CreatedAt:     time.Now(),
				}
				sentence.Quizzes = append(sentence.Quizzes, quiz)
			}

			sentences[idx] = sentence
		}(idx, sText)
	}
	wg.Wait()

	art := &GrammarArticle{
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

func (s *svc) GetHistory(ctx context.Context, userID uint) ([]GrammarArticle, error) {
	return s.store.GetArticles(ctx, userID)
}

func (s *svc) GetArticle(ctx context.Context, id, userID uint) (*GrammarArticle, error) {
	return s.store.GetArticle(ctx, id, userID)
}

func (s *svc) RecordAnswer(ctx context.Context, userID uint, req *SubmitQuizAnswerRequest) error {
	existing, err := s.store.GetReview(ctx, userID, req.GrammarQuizID)
	if err != nil {
		return err
	}

	now := time.Now()
	var review GrammarReview
	if existing != nil {
		review = *existing
	} else {
		review = GrammarReview{
			UserID:        userID,
			GrammarQuizID: req.GrammarQuizID,
		}
	}

	if req.IsCorrect {
		review.ReviewCount++
		if review.ReviewCount >= len(ebbinghaus.ReviewIntervals) {
			review.NextReviewAt = now.AddDate(1, 0, 0)
		} else {
			days := ebbinghaus.ReviewIntervals[review.ReviewCount]
			review.NextReviewAt = now.AddDate(0, 0, days)
		}
	} else {
		review.ReviewCount = 0
		review.NextReviewAt = now.AddDate(0, 0, ebbinghaus.ReviewIntervals[0])
	}
	review.UpdatedAt = now

	return s.store.UpsertReview(ctx, &review)
}

func (s *svc) GetDueReviews(ctx context.Context, userID uint) ([]GrammarQuizReviewDetail, error) {
	return s.store.GetDueReviews(ctx, userID)
}



// --- TTS helpers ---

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
			filepath.Join("..", ".venv", "bin", binName), // run from backend/
			filepath.Join(".venv", "bin", binName),       // run from project root
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

	if err := os.MkdirAll(filepath.Dir(outputPath), 0o755); err != nil {
		return fmt.Errorf("mkdir for audio: %w", err)
	}

	bin := edgeTTSBin()
	cmd := exec.CommandContext(ctx, bin,
		"--voice", voice,
		"--text", text,
		"--write-media", outputPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("edge-tts [%s]: %w — output: %s", bin, err, string(out))
	}
	return nil
}

func (s *svc) RegenerateSentence(ctx context.Context, userID, sentenceID uint) (*GrammarSentence, error) {
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
		return nil, fmt.Errorf("unauthorized")
	}

	// Overwrite/regenerate the edge-tts audio if it is missing
	if sent.AudioPath == nil || *sent.AudioPath == "" {
		folderName := fmt.Sprintf("%d", time.Now().UnixNano())
		audioRelPath := fmt.Sprintf("static/audio/grammar/%s/re.mp3", folderName)
		ttsErr := s.generateAudio(ctx, sent.OriginalText, audioRelPath)
		if ttsErr == nil {
			sent.AudioPath = &audioRelPath
		} else {
			s.log.Warn("tts generation failed on regenerate", zap.Error(ttsErr))
		}
	}

	prompt := buildGrammarPrompt(cfg.GrammarPromptTpl, sent.OriginalText)
	llmOutput, err := s.llmCli.Call(ctx, cfg.ApiUrl, cfg.ApiKey, cfg.ModelName, prompt)
	if err != nil {
		return nil, fmt.Errorf("AI re-analysis failed: %w", err)
	}

	cleanedJSON := cleanJSONMarkdown(llmOutput)
	repairedJSON := repairJSON(cleanedJSON)

	var parsed struct {
		Translation string            `json:"translation"`
		Explanation string            `json:"explanation"`
		Quiz        struct {
			Question      string                 `json:"question"`
			Options       []string               `json:"options"`
			CorrectOption int                    `json:"correct_option"`
			Explanations  map[string]interface{} `json:"explanations"`
			Tags          []string               `json:"tags"`
		} `json:"quiz"`
	}

	if err := json.Unmarshal([]byte(repairedJSON), &parsed); err != nil {
		return nil, fmt.Errorf("AI output parsing failed: %w (raw output: %s)", err, llmOutput)
	}

	// Process tag nesting and clean explanations
	cleanExplanations := make(map[string]string)
	for k, v := range parsed.Quiz.Explanations {
		if k == "tags" {
			if parsed.Quiz.Tags == nil || len(parsed.Quiz.Tags) == 0 {
				if slice, ok := v.([]interface{}); ok {
					for _, item := range slice {
						if str, ok := item.(string); ok {
							parsed.Quiz.Tags = append(parsed.Quiz.Tags, str)
						}
					}
				}
			}
			continue
		}
		if str, ok := v.(string); ok {
			cleanExplanations[k] = str
		} else {
			cleanExplanations[k] = fmt.Sprintf("%v", v)
		}
	}

	sent.Translation = parsed.Translation
	sent.Explanation = parsed.Explanation
	sent.Quizzes = nil // clear slice

	if parsed.Quiz.Question != "" && len(parsed.Quiz.Options) == 4 {
		quiz := GrammarQuiz{
			SentenceID:    sent.ID,
			Question:      parsed.Quiz.Question,
			Options:       JSONOptions(parsed.Quiz.Options),
			CorrectOption: parsed.Quiz.CorrectOption,
			Explanations:  JSONExplanations(cleanExplanations),
			Tags:          PostgresTags(parsed.Quiz.Tags),
			CreatedAt:     time.Now(),
		}
		sent.Quizzes = append(sent.Quizzes, quiz)
	}

	if err := s.store.UpdateSentenceAndQuizzes(ctx, sent); err != nil {
		return nil, err
	}

	return sent, nil
}
