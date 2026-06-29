package dialogue

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Store is the data access interface for Dialogue.
type Store interface {
	// Existing methods
	CreateDialogue(ctx context.Context, d *Dialogue) error
	CreateLine(ctx context.Context, line *DialogueLine) error
	UpdateLineAudioPath(ctx context.Context, lineID uint, audioPath string) error
	CreateVocabulary(ctx context.Context, items []VocabularyItem) error
	GetDialogueByID(ctx context.Context, id, userID uint) (*Dialogue, error)
	GetDialogueByIDPublic(ctx context.Context, id uint) (*Dialogue, error)
	ListDialogues(ctx context.Context, userID uint) ([]Dialogue, error)

	// Shared dialogue
	GetSharedDialogue(ctx context.Context, topic, language, level string) (*Dialogue, error)
	RegisterSharedDialogue(ctx context.Context, topic, language, level string, dialogueID uint) error
	OverwriteSharedDialogue(ctx context.Context, topic, language, level string, dialogueID uint) error
	MarkDialogueRejected(ctx context.Context, id uint) error

	// Progress
	GetActiveDialogue(ctx context.Context, userID uint) (*ActiveDialogueResult, error)
	UpsertProgress(ctx context.Context, userID, dialogueID uint, lineIndex int, completed bool) error
	GetProgress(ctx context.Context, userID, dialogueID uint) (*UserDialogueProgress, error)

	ListTypes(ctx context.Context) ([]Type, error)
	GetTypeByName(ctx context.Context, name string) (*Type, error)
	CreateType(ctx context.Context, dt *Type) error
	UpdateType(ctx context.Context, dt *Type) error
	DeleteType(ctx context.Context, id uint) error
}

type gormStore struct {
	db *gorm.DB
}

// NewStore creates a new Store backed by GORM.
func NewStore(db *gorm.DB) Store {
	return &gormStore{db: db}
}

func (s *gormStore) CreateDialogue(ctx context.Context, d *Dialogue) error {
	if err := s.db.WithContext(ctx).Create(d).Error; err != nil {
		return fmt.Errorf("create dialogue: %w", err)
	}
	return nil
}

// CreateLine inserts a single DialogueLine record.
func (s *gormStore) CreateLine(ctx context.Context, line *DialogueLine) error {
	if err := s.db.WithContext(ctx).Omit("Vocabulary").Create(line).Error; err != nil {
		return fmt.Errorf("create dialogue line: %w", err)
	}
	return nil
}

// UpdateLineAudioPath sets the audio_path for a given DialogueLine.
func (s *gormStore) UpdateLineAudioPath(ctx context.Context, lineID uint, audioPath string) error {
	if err := s.db.WithContext(ctx).Model(&DialogueLine{}).
		Where("id = ?", lineID).
		Update("audio_path", audioPath).Error; err != nil {
		return fmt.Errorf("update audio_path: %w", err)
	}
	return nil
}

// CreateVocabulary batch-inserts vocabulary items, ignoring conflicts.
func (s *gormStore) CreateVocabulary(ctx context.Context, items []VocabularyItem) error {
	if len(items) == 0 {
		return nil
	}
	if err := s.db.WithContext(ctx).
		Clauses(clause.OnConflict{DoNothing: true}).
		Create(&items).Error; err != nil {
		return fmt.Errorf("create vocabulary: %w", err)
	}
	return nil
}

// GetDialogueByID retrieves a dialogue with all lines + vocabulary, filtered by user.
func (s *gormStore) GetDialogueByID(ctx context.Context, id, userID uint) (*Dialogue, error) {
	var d Dialogue
	err := s.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		Preload("Lines", func(db *gorm.DB) *gorm.DB {
			return db.Order("line_index ASC")
		}).
		Preload("Lines.Vocabulary", func(db *gorm.DB) *gorm.DB {
			return db.Order("word_index ASC")
		}).
		First(&d).Error
	if err != nil {
		return nil, fmt.Errorf("get dialogue: %w", err)
	}
	return &d, nil
}

// GetDialogueByIDPublic retrieves a dialogue without user ownership check (used for shared dialogues).
func (s *gormStore) GetDialogueByIDPublic(ctx context.Context, id uint) (*Dialogue, error) {
	var d Dialogue
	err := s.db.WithContext(ctx).
		Where("id = ?", id).
		Preload("Lines", func(db *gorm.DB) *gorm.DB {
			return db.Order("line_index ASC")
		}).
		Preload("Lines.Vocabulary", func(db *gorm.DB) *gorm.DB {
			return db.Order("word_index ASC")
		}).
		First(&d).Error
	if err != nil {
		return nil, fmt.Errorf("get dialogue (public): %w", err)
	}
	return &d, nil
}

// ListDialogues returns all dialogues for a user, most recent first.
func (s *gormStore) ListDialogues(ctx context.Context, userID uint) ([]Dialogue, error) {
	var dialogues []Dialogue
	if err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&dialogues).Error; err != nil {
		return nil, fmt.Errorf("list dialogues: %w", err)
	}
	return dialogues, nil
}

// GetSharedDialogue returns the canonical dialogue for a (topic, language, level) combo.
func (s *gormStore) GetSharedDialogue(ctx context.Context, topic, language, level string) (*Dialogue, error) {
	var sd SharedDialogue
	err := s.db.WithContext(ctx).
		Where("topic = ? AND language = ? AND level = ?", topic, language, level).
		First(&sd).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, gorm.ErrRecordNotFound
		}
		return nil, fmt.Errorf("get shared dialogue: %w", err)
	}
	return s.GetDialogueByIDPublic(ctx, sd.DialogueID)
}

// RegisterSharedDialogue inserts a shared dialogue entry; does nothing if one already exists.
func (s *gormStore) RegisterSharedDialogue(ctx context.Context, topic, language, level string, dialogueID uint) error {
	err := s.db.WithContext(ctx).Exec(`
		INSERT INTO shared_dialogues (topic, language, level, dialogue_id)
		VALUES (?, ?, ?, ?)
		ON CONFLICT (topic, language, level) DO NOTHING
	`, topic, language, level, dialogueID).Error
	if err != nil {
		return fmt.Errorf("register shared dialogue: %w", err)
	}
	return nil
}

// OverwriteSharedDialogue upserts a shared dialogue, replacing the existing dialogue_id.
func (s *gormStore) OverwriteSharedDialogue(ctx context.Context, topic, language, level string, dialogueID uint) error {
	err := s.db.WithContext(ctx).Exec(`
		INSERT INTO shared_dialogues (topic, language, level, dialogue_id, updated_at)
		VALUES (?, ?, ?, ?, NOW())
		ON CONFLICT (topic, language, level)
		DO UPDATE SET dialogue_id = EXCLUDED.dialogue_id, updated_at = NOW()
	`, topic, language, level, dialogueID).Error
	if err != nil {
		return fmt.Errorf("overwrite shared dialogue: %w", err)
	}
	return nil
}

// MarkDialogueRejected sets is_rejected = true for a dialogue.
func (s *gormStore) MarkDialogueRejected(ctx context.Context, id uint) error {
	if err := s.db.WithContext(ctx).
		Model(&Dialogue{}).
		Where("id = ?", id).
		Update("is_rejected", true).Error; err != nil {
		return fmt.Errorf("mark dialogue rejected: %w", err)
	}
	return nil
}

// GetActiveDialogue returns the most recently updated incomplete dialogue for the user.
func (s *gormStore) GetActiveDialogue(ctx context.Context, userID uint) (*ActiveDialogueResult, error) {
	// 1. Try to find an in-progress dialogue from user_dialogue_progress
	var progress UserDialogueProgress
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND is_completed = false", userID).
		Order("updated_at DESC").
		First(&progress).Error

	if err == nil {
		d, err := s.GetDialogueByIDPublic(ctx, progress.DialogueID)
		if err != nil {
			return nil, err
		}
		return &ActiveDialogueResult{
			Dialogue:         d,
			CurrentLineIndex: progress.CurrentLineIndex,
		}, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("get active dialogue progress: %w", err)
	}

	// 2. If no in-progress record, check the user's latest generated dialogue
	var latestDialogue Dialogue
	err = s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("id DESC").
		First(&latestDialogue).Error

	if err == nil {
		// Check if this latest dialogue has any progress record
		var prog UserDialogueProgress
		progErr := s.db.WithContext(ctx).
			Where("user_id = ? AND dialogue_id = ?", userID, latestDialogue.ID).
			First(&prog).Error

		if errors.Is(progErr, gorm.ErrRecordNotFound) {
			// No progress record exists, meaning it was generated but not started.
			// Return it as active with line index 0.
			d, err := s.GetDialogueByIDPublic(ctx, latestDialogue.ID)
			if err != nil {
				return nil, err
			}
			return &ActiveDialogueResult{
				Dialogue:         d,
				CurrentLineIndex: 0,
			}, nil
		} else if progErr == nil && !prog.IsCompleted {
			// Fallback: progress exists but was not found in step 1
			d, err := s.GetDialogueByIDPublic(ctx, latestDialogue.ID)
			if err != nil {
				return nil, err
			}
			return &ActiveDialogueResult{
				Dialogue:         d,
				CurrentLineIndex: prog.CurrentLineIndex,
			}, nil
		}
	}

	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("get latest dialogue: %w", err)
	}

	return nil, nil
}

// UpsertProgress creates or updates a user's progress record for a dialogue.
func (s *gormStore) UpsertProgress(ctx context.Context, userID, dialogueID uint, lineIndex int, completed bool) error {
	err := s.db.WithContext(ctx).Exec(`
		INSERT INTO user_dialogue_progress (user_id, dialogue_id, current_line_index, is_completed, updated_at)
		VALUES (?, ?, ?, ?, NOW())
		ON CONFLICT (user_id, dialogue_id)
		DO UPDATE SET
			current_line_index = EXCLUDED.current_line_index,
			is_completed       = EXCLUDED.is_completed,
			updated_at         = NOW()
	`, userID, dialogueID, lineIndex, completed).Error
	if err != nil {
		return fmt.Errorf("upsert progress: %w", err)
	}
	return nil
}

// GetProgress returns the user's progress record for a specific dialogue, or nil if none.
func (s *gormStore) GetProgress(ctx context.Context, userID, dialogueID uint) (*UserDialogueProgress, error) {
	var p UserDialogueProgress
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND dialogue_id = ?", userID, dialogueID).
		First(&p).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get progress: %w", err)
	}
	return &p, nil
}

func (s *gormStore) ListTypes(ctx context.Context) ([]Type, error) {
	var types []Type
	if err := s.db.WithContext(ctx).Order("sort_order ASC, id ASC").Find(&types).Error; err != nil {
		return nil, fmt.Errorf("list dialogue types: %w", err)
	}
	return types, nil
}

func (s *gormStore) GetTypeByName(ctx context.Context, name string) (*Type, error) {
	var dt Type
	if err := s.db.WithContext(ctx).Where("name = ?", name).First(&dt).Error; err != nil {
		return nil, fmt.Errorf("get dialogue type by name: %w", err)
	}
	return &dt, nil
}

func (s *gormStore) CreateType(ctx context.Context, dt *Type) error {
	if err := s.db.WithContext(ctx).Create(dt).Error; err != nil {
		return fmt.Errorf("create dialogue type: %w", err)
	}
	return nil
}

func (s *gormStore) UpdateType(ctx context.Context, dt *Type) error {
	if err := s.db.WithContext(ctx).Save(dt).Error; err != nil {
		return fmt.Errorf("update dialogue type: %w", err)
	}
	return nil
}

func (s *gormStore) DeleteType(ctx context.Context, id uint) error {
	if err := s.db.WithContext(ctx).Delete(&Type{}, id).Error; err != nil {
		return fmt.Errorf("delete dialogue type: %w", err)
	}
	return nil
}
