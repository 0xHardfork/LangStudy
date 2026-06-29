package dialogue

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/0xHardfork/langstudy/platform/llm"
	"github.com/0xHardfork/langstudy/platform/llmconfig"
	"go.uber.org/zap"
)

type Service interface {
	GetTopics(ctx context.Context) ([]Type, error)
	GetSharedDialogue(ctx context.Context, topic, language, level string, userID uint) (*SharedDialogueResult, error)
	GetActiveDialogue(ctx context.Context, userID uint) (*ActiveDialogueResult, error)
	GenerateDialogue(ctx context.Context, userID uint, req *GenerateRequest) (*Dialogue, error)
	RegenerateDialogue(ctx context.Context, userID uint, req *RegenerateRequest) (*Dialogue, error)
	UpdateProgress(ctx context.Context, userID, dialogueID uint, lineIndex int, completed bool) error
	GetDialogue(ctx context.Context, id, userID uint) (*Dialogue, error)
	ListDialogues(ctx context.Context, userID uint) ([]Dialogue, error)
	RejectDialogue(ctx context.Context, id uint) error

	ListTopics(ctx context.Context) ([]Type, error)
	CreateTopic(ctx context.Context, req *CreateTopicRequest) (*Type, error)
	UpdateTopic(ctx context.Context, id uint, req *UpdateTopicRequest) (*Type, error)
	DeleteTopic(ctx context.Context, id uint) error
}

type service struct {
	store     Store
	llmStore  llmconfig.Store
	log       *zap.Logger
	staticDir string
	llmCli    *llm.Client
}

func NewService(store Store, llmStore llmconfig.Store, log *zap.Logger, staticDir string, llmCli *llm.Client) Service {
	return &service{
		store:     store,
		llmStore:  llmStore,
		log:       log,
		staticDir: staticDir,
		llmCli:    llmCli,
	}
}

func (s *service) GetTopics(ctx context.Context) ([]Type, error) {
	return s.store.ListTypes(ctx)
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

func (s *service) RejectDialogue(ctx context.Context, id uint) error {
	return s.store.MarkDialogueRejected(ctx, id)
}

func (s *service) GenerateDialogue(ctx context.Context, userID uint, req *GenerateRequest) (*Dialogue, error) {
	cfg, err := s.llmStore.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("load llm config: %w", err)
	}

	if req.TopicDescription == "" {
		if dt, lookupErr := s.store.GetTypeByName(ctx, req.Topic); lookupErr == nil {
			req.TopicDescription = dt.Description
		}
	}

	dialoguePrompt := buildDialoguePrompt(cfg.PromptTpl, req)
	llmLines, err := s.callLLMForDialogue(ctx, cfg, dialoguePrompt)
	if err != nil {
		return nil, fmt.Errorf("llm dialogue generation: %w", err)
	}
	if len(llmLines) == 0 {
		return nil, fmt.Errorf("llm returned empty dialogue")
	}

	d, err := s.saveDialogueAndAssets(ctx, cfg, userID, req.Language, req.Level, req.Topic, llmLines)
	if err != nil {
		return nil, err
	}

	if regErr := s.store.RegisterSharedDialogue(ctx, req.Topic, req.Language, req.Level, d.ID); regErr != nil {
		s.log.Warn("register shared dialogue failed", zap.Error(regErr))
	}

	return s.store.GetDialogueByID(ctx, d.ID, userID)
}

func (s *service) RegenerateDialogue(ctx context.Context, userID uint, req *RegenerateRequest) (*Dialogue, error) {
	cfg, err := s.llmStore.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("load llm config: %w", err)
	}

	topicDesc := ""
	if dt, lookupErr := s.store.GetTypeByName(ctx, req.Topic); lookupErr == nil {
		topicDesc = dt.Description
	}

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

	d, err := s.saveDialogueAndAssets(ctx, cfg, userID, req.Language, req.Level, req.Topic, llmLines)
	if err != nil {
		return nil, err
	}

	if markErr := s.store.MarkDialogueRejected(ctx, req.PrevDialogueID); markErr != nil {
		s.log.Warn("mark dialogue rejected failed", zap.Error(markErr))
	}

	if ovErr := s.store.OverwriteSharedDialogue(ctx, req.Topic, req.Language, req.Level, d.ID); ovErr != nil {
		s.log.Warn("overwrite shared dialogue failed", zap.Error(ovErr))
	}

	return s.store.GetDialogueByIDPublic(ctx, d.ID)
}

func (s *service) saveDialogueAndAssets(ctx context.Context, cfg *llmconfig.LLMConfig, userID uint, language, level, topic string, llmLines []llmDialogueLine) (*Dialogue, error) {
	lines := make([]DialogueLine, len(llmLines))
	for i, ll := range llmLines {
		lines[i] = DialogueLine{
			LineIndex:    i,
			Speaker:      ll.Speaker,
			OriginalText: ll.OriginalText,
			Translation:  ll.Translation,
		}
	}

	d := &Dialogue{
		UserID:   userID,
		Language: language,
		Level:    level,
		Topic:    topic,
		Lines:    lines,
	}
	if err := s.store.CreateDialogue(ctx, d); err != nil {
		return nil, fmt.Errorf("save dialogue: %w", err)
	}

	var wg sync.WaitGroup
	ttsSem := make(chan struct{}, 5)
	ttsCtx, ttsCancel := context.WithTimeout(ctx, 5*time.Minute)
	defer ttsCancel()

	for i, line := range d.Lines {
		wg.Add(1)
		go func(i int, line DialogueLine) {
			defer wg.Done()
			ttsSem <- struct{}{}
			defer func() { <-ttsSem }()

			relPath := fmt.Sprintf("%s/audio/%d/%d.mp3", s.staticDir, d.ID, i)
			if ttsErr := generateAudio(ttsCtx, line.OriginalText, language, line.Speaker, relPath); ttsErr != nil {
				s.log.Warn("tts generation failed", zap.Int("line", i), zap.Error(ttsErr))
			} else {
				if err := s.store.UpdateLineAudioPath(ctx, line.ID, relPath); err != nil {
					s.log.Warn("update audio_path failed", zap.Int("line", i), zap.Error(err))
				}
			}
		}(i, line)
	}
	wg.Wait()

	vocabPrompt := buildVocabPrompt(cfg.VocabPromptTpl, llmLines)
	vocabItems, err := s.callLLMForVocab(ctx, cfg, vocabPrompt)
	if err != nil {
		s.log.Warn("vocab rating failed, skipping", zap.Error(err))
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
				s.log.Warn("save vocabulary failed", zap.Error(saveErr))
			}
		}
	}

	return d, nil
}

func (s *service) callLLMForDialogue(ctx context.Context, cfg *llmconfig.LLMConfig, prompt string) ([]llmDialogueLine, error) {
	content, err := s.llmCli.Call(ctx, cfg.ApiUrl, cfg.ApiKey, cfg.ModelName, prompt)
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
	content, err := s.llmCli.Call(ctx, cfg.ApiUrl, cfg.ApiKey, cfg.ModelName, prompt)
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
	descHint := ""
	if req.TopicDescription != "" {
		descHint = fmt.Sprintf(" Context about this topic: %s", req.TopicDescription)
	}
	if tpl != "" {
		r := strings.NewReplacer(
			"{{language}}", req.Language,
			"{{level}}", req.Level,
			"{{topic}}", req.Topic,
			"{{topic_description}}", descHint,
		)
		return r.Replace(tpl)
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
func buildVocabPrompt(tpl string, lines []llmDialogueLine) string {
	linesJSON, _ := json.Marshal(lines)
	maxLineIndex := len(lines) - 1
	if tpl != "" {
		r := strings.NewReplacer(
			"{{max_line_index}}", fmt.Sprintf("%d", maxLineIndex),
			"{{lines_json}}", string(linesJSON),
		)
		return r.Replace(tpl)
	}
	return fmt.Sprintf(`Given these dialogue lines (indexed 0 to %d):
%s

For each line, identify the top 3 most important vocabulary words for language learners.
Rate each word's importance from 1 (most important) to 4 (least important).
Word index is the 0-based position of the word when the sentence is split by spaces (or by character for non-space languages).
Return ONLY a JSON array with no other text:
[{"line_index":0,"word":"<word>","word_index":0,"importance":1},...]`,
		maxLineIndex, string(linesJSON))
}

func (s *service) ListTopics(ctx context.Context) ([]Type, error) {
	return s.store.ListTypes(ctx)
}

func (s *service) CreateTopic(ctx context.Context, req *CreateTopicRequest) (*Type, error) {
	emoji := req.Emoji
	if emoji == "" {
		emoji = "💬"
	}
	dt := &Type{
		Name:        req.Name,
		Description: req.Description,
		Emoji:       emoji,
		SortOrder:   req.SortOrder,
	}
	if err := s.store.CreateType(ctx, dt); err != nil {
		return nil, err
	}
	return dt, nil
}

func (s *service) UpdateTopic(ctx context.Context, id uint, req *UpdateTopicRequest) (*Type, error) {
	emoji := req.Emoji
	if emoji == "" {
		emoji = "💬"
	}
	dt := &Type{
		ID:          id,
		Name:        req.Name,
		Description: req.Description,
		Emoji:       emoji,
		SortOrder:   req.SortOrder,
	}
	if err := s.store.UpdateType(ctx, dt); err != nil {
		return nil, err
	}
	return dt, nil
}

func (s *service) DeleteTopic(ctx context.Context, id uint) error {
	return s.store.DeleteType(ctx, id)
}
