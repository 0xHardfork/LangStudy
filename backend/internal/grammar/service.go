package grammar

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/0xHardfork/langstudy/internal/llmconfig"
	"go.uber.org/zap"
)

type svc struct {
	store  Store
	llmSvc llmconfig.Service
	log    *zap.Logger
}

// NewService creates a new grammar Service.
func NewService(store Store, llmSvc llmconfig.Service, log *zap.Logger) Service {
	return &svc{
		store:  store,
		llmSvc: llmSvc,
		log:    log,
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
	// Remove trailing commas before } or ]
	s = trailingCommaRx.ReplaceAllString(s, "$1")

	// Balance braces
	openBraces := strings.Count(s, "{")
	closeBraces := strings.Count(s, "}")
	if openBraces > closeBraces {
		s = s + strings.Repeat("}", openBraces-closeBraces)
	}

	// Balance brackets
	openBrackets := strings.Count(s, "[")
	closeBrackets := strings.Count(s, "]")
	if openBrackets > closeBrackets {
		s = s + strings.Repeat("]", openBrackets-closeBrackets)
	}

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

	var sentences []GrammarSentence
	for idx, sText := range rawSentences {
		audioRelPath := fmt.Sprintf("static/audio/grammar/%s/%d.mp3", folderName, idx)
		ttsErr := s.generateAudio(ctx, sText, audioRelPath)
		var audioPathPtr *string
		if ttsErr == nil {
			audioPathPtr = &audioRelPath
		} else {
			s.log.Warn("tts generation failed for grammar sentence", zap.String("sentence", sText), zap.Error(ttsErr))
		}

		prompt := fmt.Sprintf(grammarPromptTemplate, sText)
		llmOutput, err := s.callLLM(ctx, cfg, prompt)
		if err != nil {
			s.log.Warn("failed to call LLM for grammar analysis", zap.String("sentence", sText), zap.Error(err))
			sentence := GrammarSentence{
				SentenceIndex: idx,
				OriginalText:  sText,
				Translation:   "（AI 翻译失败）",
				Explanation:   fmt.Sprintf("AI 语法分析失败，错误信息: %v\n请稍后重新提交该文章尝试。", err),
				AudioPath:     audioPathPtr,
				CreatedAt:     time.Now(),
			}
			sentences = append(sentences, sentence)
			continue
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
			sentence := GrammarSentence{
				SentenceIndex: idx,
				OriginalText:  sText,
				Translation:   "（AI 格式解析失败）",
				Explanation:   fmt.Sprintf("AI 原始分析输出如下：\n%s", llmOutput),
				AudioPath:     audioPathPtr,
				CreatedAt:     time.Now(),
			}
			sentences = append(sentences, sentence)
			continue
		}

		// Handle tags nested inside explanations or convert non-string explanations safely
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

		sentences = append(sentences, sentence)
	}

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

func (s *svc) GetHistory(ctx context.Context) ([]GrammarArticle, error) {
	return s.store.GetArticles(ctx)
}

func (s *svc) GetArticle(ctx context.Context, id uint) (*GrammarArticle, error) {
	return s.store.GetArticle(ctx, id)
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

	intervals := []int{1, 3, 7, 14, 30}

	if req.IsCorrect {
		review.ReviewCount++
		if review.ReviewCount >= len(intervals) {
			review.NextReviewAt = now.AddDate(1, 0, 0)
		} else {
			days := intervals[review.ReviewCount]
			review.NextReviewAt = now.AddDate(0, 0, days)
		}
	} else {
		review.ReviewCount = 0
		review.NextReviewAt = now.AddDate(0, 0, intervals[0])
	}
	review.UpdatedAt = now

	return s.store.UpsertReview(ctx, &review)
}

func (s *svc) GetDueReviews(ctx context.Context, userID uint) ([]GrammarQuizReviewDetail, error) {
	return s.store.GetDueReviews(ctx, userID)
}

// --- LLM helper ---

type llmMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type llmRequest struct {
	Model    string       `json:"model"`
	Messages []llmMessage `json:"messages"`
}

type llmChoice struct {
	Message llmMessage `json:"message"`
}

type llmResponse struct {
	Choices []llmChoice `json:"choices"`
}

func (s *svc) callLLM(ctx context.Context, cfg *llmconfig.LLMConfig, prompt string) (string, error) {
	var lastErr error
	backoff := 1 * time.Second

	for attempt := 1; attempt <= 3; attempt++ {
		reqBody := llmRequest{
			Model: cfg.ModelName,
			Messages: []llmMessage{
				{Role: "user", Content: prompt},
			},
		}
		bodyBytes, err := json.Marshal(reqBody)
		if err != nil {
			return "", fmt.Errorf("marshal llm request: %w", err)
		}

		httpClient := &http.Client{Timeout: 120 * time.Second}
		httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.ApiUrl, bytes.NewReader(bodyBytes))
		if err != nil {
			return "", fmt.Errorf("build llm request: %w", err)
		}
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", "Bearer "+cfg.ApiKey)

		resp, err := httpClient.Do(httpReq)
		if err != nil {
			lastErr = fmt.Errorf("attempt %d failed to call llm: %w", attempt, err)
			s.log.Warn("llm call network error, retrying", zap.Int("attempt", attempt), zap.Error(err))
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(backoff):
			}
			backoff *= 2
			continue
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			lastErr = fmt.Errorf("attempt %d llm returned %d: %s", attempt, resp.StatusCode, string(body))
			
			// If it's a transient rate limit (429) or service unavailable (503), retry!
			if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusServiceUnavailable {
				s.log.Warn("llm returned transient error, retrying", zap.Int("attempt", attempt), zap.Int("status", resp.StatusCode))
				select {
				case <-ctx.Done():
					return "", ctx.Err()
				case <-time.After(backoff):
				}
				backoff *= 2
				continue
			}
			return "", lastErr
		}

		var llmResp llmResponse
		err = json.NewDecoder(resp.Body).Decode(&llmResp)
		resp.Body.Close()
		if err != nil {
			return "", fmt.Errorf("decode llm response: %w", err)
		}
		if len(llmResp.Choices) == 0 {
			return "", fmt.Errorf("llm returned no choices")
		}
		return llmResp.Choices[0].Message.Content, nil
	}

	return "", fmt.Errorf("llm call failed after 3 attempts: %w", lastErr)
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

func (s *svc) RegenerateSentence(ctx context.Context, sentenceID uint) (*GrammarSentence, error) {
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

	prompt := fmt.Sprintf(grammarPromptTemplate, sent.OriginalText)
	llmOutput, err := s.callLLM(ctx, cfg, prompt)
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
