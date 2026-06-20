package dialogue

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/0xHardfork/langstudy/internal/dialoguetype"
	"github.com/0xHardfork/langstudy/internal/llmconfig"
	"go.uber.org/zap"
)

// Service defines the business logic interface for dialogue generation.
type Service interface {
	GetTopics(ctx context.Context) ([]dialoguetype.DialogueType, error)
	GetSharedDialogue(ctx context.Context, topic, language, level string, userID uint) (*SharedDialogueResult, error)
	GetActiveDialogue(ctx context.Context, userID uint) (*ActiveDialogueResult, error)
	GenerateDialogue(ctx context.Context, userID uint, req *GenerateRequest) (*Dialogue, error)
	RegenerateDialogue(ctx context.Context, userID uint, req *RegenerateRequest) (*Dialogue, error)
	UpdateProgress(ctx context.Context, userID, dialogueID uint, lineIndex int, completed bool) error
	GetDialogue(ctx context.Context, id, userID uint) (*Dialogue, error)
	ListDialogues(ctx context.Context, userID uint) ([]Dialogue, error)
}

type service struct {
	store     Store
	llmStore  llmconfig.Store
	typeStore dialoguetype.Store
	log       *zap.Logger
	staticDir string
}

// NewService creates a new dialogue Service.
func NewService(store Store, llmStore llmconfig.Store, typeStore dialoguetype.Store, log *zap.Logger, staticDir string) Service {
	return &service{
		store:     store,
		llmStore:  llmStore,
		typeStore: typeStore,
		log:       log,
		staticDir: staticDir,
	}
}

func (s *service) GetTopics(ctx context.Context) ([]dialoguetype.DialogueType, error) {
	return s.typeStore.List(ctx)
}

func (s *service) GetDialogue(ctx context.Context, id, userID uint) (*Dialogue, error) {
	return s.store.GetDialogueByID(ctx, id, userID)
}

func (s *service) ListDialogues(ctx context.Context, userID uint) ([]Dialogue, error) {
	return s.store.ListDialogues(ctx, userID)
}

// GetSharedDialogue returns the canonical dialogue for a (topic, language, level) combo,
// along with the requesting user's progress on it.
func (s *service) GetSharedDialogue(ctx context.Context, topic, language, level string, userID uint) (*SharedDialogueResult, error) {
	d, err := s.store.GetSharedDialogue(ctx, topic, language, level)
	if err != nil {
		return nil, err
	}
	lineIndex := 0
	if p, _ := s.store.GetProgress(ctx, userID, d.ID); p != nil {
		if !p.IsCompleted {
			lineIndex = p.CurrentLineIndex
		}
	}
	return &SharedDialogueResult{
		Dialogue:         d,
		CurrentLineIndex: lineIndex,
	}, nil
}

// GetActiveDialogue returns the user's most recently updated incomplete dialogue.
func (s *service) GetActiveDialogue(ctx context.Context, userID uint) (*ActiveDialogueResult, error) {
	return s.store.GetActiveDialogue(ctx, userID)
}

// UpdateProgress upserts the user's progress for a dialogue.
func (s *service) UpdateProgress(ctx context.Context, userID, dialogueID uint, lineIndex int, completed bool) error {
	return s.store.UpsertProgress(ctx, userID, dialogueID, lineIndex, completed)
}

// GenerateDialogue orchestrates LLM text generation + TTS audio + vocabulary rating.
func (s *service) GenerateDialogue(ctx context.Context, userID uint, req *GenerateRequest) (*Dialogue, error) {
	cfg, err := s.llmStore.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("load llm config: %w", err)
	}

	// Enrich request with type description from DB (non-fatal if missing)
	if req.TopicDescription == "" {
		if dt, lookupErr := s.typeStore.GetByName(ctx, req.Topic); lookupErr == nil {
			req.TopicDescription = dt.Description
		}
	}

	// --- Step 1: LLM call #1 — generate dialogue text ---
	dialoguePrompt := buildDialoguePrompt(cfg.PromptTpl, req)
	llmLines, err := s.callLLMForDialogue(ctx, cfg, dialoguePrompt)
	if err != nil {
		return nil, fmt.Errorf("llm dialogue generation: %w", err)
	}
	if len(llmLines) == 0 {
		return nil, fmt.Errorf("llm returned empty dialogue")
	}

	// --- Step 2: Save Dialogue header ---
	d := &Dialogue{
		UserID:   userID,
		Language: req.Language,
		Level:    req.Level,
		Topic:    req.Topic,
	}
	if err := s.store.CreateDialogue(ctx, d); err != nil {
		return nil, fmt.Errorf("save dialogue: %w", err)
	}

	// --- Step 3: Save lines + TTS per line ---
	ttsCtx, ttsCancel := context.WithTimeout(ctx, 5*time.Minute)
	defer ttsCancel()

	for i, ll := range llmLines {
		line := &DialogueLine{
			DialogueID:   d.ID,
			LineIndex:    i,
			Speaker:      ll.Speaker,
			OriginalText: ll.OriginalText,
			Translation:  ll.Translation,
		}
		if err := s.store.CreateLine(ctx, line); err != nil {
			return nil, fmt.Errorf("save line %d: %w", i, err)
		}

		// TTS — non-fatal
		relPath := fmt.Sprintf("%s/audio/%d/%d.mp3", s.staticDir, d.ID, i)
		if ttsErr := generateAudio(ttsCtx, ll.OriginalText, req.Language, ll.Speaker, relPath); ttsErr != nil {
			s.log.Warn("tts generation failed", zap.Int("line", i), zap.Error(ttsErr))
		} else {
			if err := s.store.UpdateLineAudioPath(ctx, line.ID, relPath); err != nil {
				s.log.Warn("update audio_path failed", zap.Int("line", i), zap.Error(err))
			}
		}
	}

	// --- Step 4: LLM call #2 — vocabulary importance rating ---
	vocabPrompt := buildVocabPrompt(llmLines)
	vocabItems, err := s.callLLMForVocab(ctx, cfg, vocabPrompt)
	if err != nil {
		s.log.Warn("vocab rating failed, skipping", zap.Error(err))
	} else {
		full, fetchErr := s.store.GetDialogueByID(ctx, d.ID, userID)
		if fetchErr == nil {
			lineIDByIndex := make(map[int]uint, len(full.Lines))
			for _, l := range full.Lines {
				lineIDByIndex[l.LineIndex] = l.ID
			}
			dbItems := make([]VocabularyItem, 0, len(vocabItems))
			for _, v := range vocabItems {
				lineID, ok := lineIDByIndex[v.LineIndex]
				if !ok {
					continue
				}
				dbItems = append(dbItems, VocabularyItem{
					DialogueLineID: lineID,
					Word:           v.Word,
					WordIndex:      v.WordIndex,
					Importance:     v.Importance,
				})
			}
			if saveErr := s.store.CreateVocabulary(ctx, dbItems); saveErr != nil {
				s.log.Warn("save vocabulary failed", zap.Error(saveErr))
			}
		}
	}

	// --- Step 5: Register as shared dialogue (only if none exists yet) ---
	if regErr := s.store.RegisterSharedDialogue(ctx, req.Topic, req.Language, req.Level, d.ID); regErr != nil {
		s.log.Warn("register shared dialogue failed", zap.Error(regErr))
	}

	// --- Step 6: Return complete dialogue ---
	return s.store.GetDialogueByID(ctx, d.ID, userID)
}

// RegenerateDialogue generates a new dialogue using user feedback, marks the old one as rejected,
// and updates the shared dialogue pointer.
func (s *service) RegenerateDialogue(ctx context.Context, userID uint, req *RegenerateRequest) (*Dialogue, error) {
	cfg, err := s.llmStore.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("load llm config: %w", err)
	}

	// Fetch topic description from DB
	topicDesc := ""
	if dt, lookupErr := s.typeStore.GetByName(ctx, req.Topic); lookupErr == nil {
		topicDesc = dt.Description
	}

	// Build enriched prompt
	genReq := &GenerateRequest{
		Topic:            req.Topic,
		Language:         req.Language,
		Level:            req.Level,
		TopicDescription: topicDesc,
	}
	dialoguePrompt := buildRegeneratePrompt(cfg.PromptTpl, genReq, req.Hint, req.NativeLanguage)
	llmLines, err := s.callLLMForDialogue(ctx, cfg, dialoguePrompt)
	if err != nil {
		return nil, fmt.Errorf("llm regeneration: %w", err)
	}
	if len(llmLines) == 0 {
		return nil, fmt.Errorf("llm returned empty dialogue on regeneration")
	}

	// Save new dialogue
	d := &Dialogue{
		UserID:   userID,
		Language: req.Language,
		Level:    req.Level,
		Topic:    req.Topic,
	}
	if err := s.store.CreateDialogue(ctx, d); err != nil {
		return nil, fmt.Errorf("save regenerated dialogue: %w", err)
	}

	ttsCtx, ttsCancel := context.WithTimeout(ctx, 5*time.Minute)
	defer ttsCancel()

	for i, ll := range llmLines {
		line := &DialogueLine{
			DialogueID:   d.ID,
			LineIndex:    i,
			Speaker:      ll.Speaker,
			OriginalText: ll.OriginalText,
			Translation:  ll.Translation,
		}
		if err := s.store.CreateLine(ctx, line); err != nil {
			return nil, fmt.Errorf("save regen line %d: %w", i, err)
		}
		relPath := fmt.Sprintf("%s/audio/%d/%d.mp3", s.staticDir, d.ID, i)
		if ttsErr := generateAudio(ttsCtx, ll.OriginalText, req.Language, ll.Speaker, relPath); ttsErr != nil {
			s.log.Warn("tts regen failed", zap.Int("line", i), zap.Error(ttsErr))
		} else {
			if err := s.store.UpdateLineAudioPath(ctx, line.ID, relPath); err != nil {
				s.log.Warn("update audio_path failed", zap.Int("line", i), zap.Error(err))
			}
		}
	}

	// Vocab rating (non-fatal)
	vocabPrompt := buildVocabPrompt(llmLines)
	vocabItems, err := s.callLLMForVocab(ctx, cfg, vocabPrompt)
	if err != nil {
		s.log.Warn("vocab rating failed on regen", zap.Error(err))
	} else {
		full, fetchErr := s.store.GetDialogueByIDPublic(ctx, d.ID)
		if fetchErr == nil {
			lineIDByIndex := make(map[int]uint, len(full.Lines))
			for _, l := range full.Lines {
				lineIDByIndex[l.LineIndex] = l.ID
			}
			dbItems := make([]VocabularyItem, 0, len(vocabItems))
			for _, v := range vocabItems {
				lineID, ok := lineIDByIndex[v.LineIndex]
				if !ok {
					continue
				}
				dbItems = append(dbItems, VocabularyItem{
					DialogueLineID: lineID,
					Word:           v.Word,
					WordIndex:      v.WordIndex,
					Importance:     v.Importance,
				})
			}
			if saveErr := s.store.CreateVocabulary(ctx, dbItems); saveErr != nil {
				s.log.Warn("save vocab on regen failed", zap.Error(saveErr))
			}
		}
	}

	// Mark old dialogue as rejected
	if markErr := s.store.MarkDialogueRejected(ctx, req.PrevDialogueID); markErr != nil {
		s.log.Warn("mark dialogue rejected failed", zap.Error(markErr))
	}

	// Update shared dialogue to point to new one
	if ovErr := s.store.OverwriteSharedDialogue(ctx, req.Topic, req.Language, req.Level, d.ID); ovErr != nil {
		s.log.Warn("overwrite shared dialogue failed", zap.Error(ovErr))
	}

	return s.store.GetDialogueByIDPublic(ctx, d.ID)
}

// --- LLM helpers ---

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

func (s *service) callLLM(ctx context.Context, cfg *llmconfig.LLMConfig, prompt string) (string, error) {
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
		return "", fmt.Errorf("call llm: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("llm returned %d: %s", resp.StatusCode, string(body))
	}

	var llmResp llmResponse
	if err := json.NewDecoder(resp.Body).Decode(&llmResp); err != nil {
		return "", fmt.Errorf("decode llm response: %w", err)
	}
	if len(llmResp.Choices) == 0 {
		return "", fmt.Errorf("llm returned no choices")
	}
	return llmResp.Choices[0].Message.Content, nil
}

func (s *service) callLLMForDialogue(ctx context.Context, cfg *llmconfig.LLMConfig, prompt string) ([]llmDialogueLine, error) {
	content, err := s.callLLM(ctx, cfg, prompt)
	if err != nil {
		return nil, err
	}
	content = cleanJSON(content)
	var lines []llmDialogueLine
	if err := json.Unmarshal([]byte(content), &lines); err != nil {
		return nil, fmt.Errorf("parse dialogue json: %w — raw: %s", err, content)
	}
	return lines, nil
}

func (s *service) callLLMForVocab(ctx context.Context, cfg *llmconfig.LLMConfig, prompt string) ([]llmVocabItem, error) {
	content, err := s.callLLM(ctx, cfg, prompt)
	if err != nil {
		return nil, err
	}
	content = cleanJSON(content)
	var items []llmVocabItem
	if err := json.Unmarshal([]byte(content), &items); err != nil {
		return nil, fmt.Errorf("parse vocab json: %w — raw: %s", err, content)
	}
	return items, nil
}

// cleanJSON strips markdown code fences that LLMs sometimes wrap JSON in.
func cleanJSON(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```") {
		if idx := strings.Index(s, "\n"); idx != -1 {
			s = s[idx+1:]
		}
		if idx := strings.LastIndex(s, "```"); idx != -1 {
			s = s[:idx]
		}
	}
	return strings.TrimSpace(s)
}

// buildDialoguePrompt constructs the first LLM prompt for a new dialogue.
func buildDialoguePrompt(tpl string, req *GenerateRequest) string {
	if tpl != "" {
		r := strings.NewReplacer(
			"{{language}}", req.Language,
			"{{level}}", req.Level,
			"{{topic}}", req.Topic,
			"{{topic_description}}", req.TopicDescription,
		)
		return r.Replace(tpl)
	}
	descHint := ""
	if req.TopicDescription != "" {
		descHint = fmt.Sprintf(" Context about this topic: %s", req.TopicDescription)
	}
	return fmt.Sprintf(`Generate a natural dialogue in %s at %s level about the topic "%s".%s
The dialogue should have exactly 16 lines, alternating between speaker A (female) and speaker B (male).
Return ONLY a JSON array with no other text, in this exact format:
[{"speaker":"A","original_text":"<text in %s>","translation":"<Chinese translation>"},...]`,
		req.Language, req.Level, req.Topic, descHint, req.Language)
}

// buildRegeneratePrompt constructs the LLM prompt for regeneration with user feedback.
func buildRegeneratePrompt(tpl string, req *GenerateRequest, hint, nativeLang string) string {
	base := buildDialoguePrompt(tpl, req)

	extras := []string{}
	if nativeLang != "" {
		extras = append(extras, fmt.Sprintf("Learner's native language: %s", nativeLang))
	}
	if hint != "" {
		extras = append(extras, fmt.Sprintf("User feedback on previous dialogue: \"%s\"", hint))
	}
	extras = append(extras, "Please generate a COMPLETELY DIFFERENT dialogue from the previous version, incorporating the user's feedback.")

	return base + "\n\n" + strings.Join(extras, "\n")
}

// buildVocabPrompt constructs the second LLM prompt for vocabulary rating.
func buildVocabPrompt(lines []llmDialogueLine) string {
	linesJSON, _ := json.Marshal(lines)
	return fmt.Sprintf(`Given these dialogue lines (indexed 0 to %d):
%s

For each line, identify the top 3 most important vocabulary words for language learners.
Rate each word's importance from 1 (most important) to 4 (least important).
Word index is the 0-based position of the word when the sentence is split by spaces (or by character for non-space languages).
Return ONLY a JSON array with no other text:
[{"line_index":0,"word":"<word>","word_index":0,"importance":1},...]`,
		len(lines)-1, string(linesJSON))
}
