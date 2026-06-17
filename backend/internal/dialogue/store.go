package dialogue

import (
	"context"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Store is the data access interface for Dialogue.
type Store interface {
	CreateDialogue(ctx context.Context, d *Dialogue) error
	CreateLine(ctx context.Context, line *DialogueLine) error
	UpdateLineAudioPath(ctx context.Context, lineID uint, audioPath string) error
	CreateVocabulary(ctx context.Context, items []VocabularyItem) error
	GetDialogueByID(ctx context.Context, id, userID uint) (*Dialogue, error)
	ListDialogues(ctx context.Context, userID uint) ([]Dialogue, error)
}

type gormStore struct {
	db *gorm.DB
}

// NewStore creates a new Store backed by GORM.
func NewStore(db *gorm.DB) Store {
	return &gormStore{db: db}
}

// CreateDialogue inserts a new Dialogue record (ID will be set after insert).
func (s *gormStore) CreateDialogue(ctx context.Context, d *Dialogue) error {
	if err := s.db.WithContext(ctx).Omit("Lines").Create(d).Error; err != nil {
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

// GetDialogueByID retrieves a dialogue with all lines (ordered) and vocabulary (ordered).
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
