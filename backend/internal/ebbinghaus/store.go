package ebbinghaus

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Store is the data access interface for EbbinghausReview.
type Store interface {
	GetDueReviews(ctx context.Context, userID uint, limit int) ([]reviewWithLineRow, error)
	Upsert(ctx context.Context, review *EbbinghausReview) error
	GetByUserAndLine(ctx context.Context, userID, dialogueLineID uint) (*EbbinghausReview, error)
}

// reviewWithLineRow is an internal join result.
type reviewWithLineRow struct {
	ReviewID       uint
	DialogueLineID uint
	OriginalText   string
	Translation    string
	AudioPath      *string
	NextReviewAt   time.Time
	ReviewCount    int
}

type gormStore struct {
	db *gorm.DB
}

// NewStore creates a new Store backed by GORM.
func NewStore(db *gorm.DB) Store {
	return &gormStore{db: db}
}

// GetDueReviews returns reviews due for the user (next_review_at ≤ NOW()).
func (s *gormStore) GetDueReviews(ctx context.Context, userID uint, limit int) ([]reviewWithLineRow, error) {
	type row struct {
		ReviewID       uint      `gorm:"column:review_id"`
		DialogueLineID uint      `gorm:"column:dialogue_line_id"`
		OriginalText   string    `gorm:"column:original_text"`
		Translation    string    `gorm:"column:translation"`
		AudioPath      *string   `gorm:"column:audio_path"`
		NextReviewAt   time.Time `gorm:"column:next_review_at"`
		ReviewCount    int       `gorm:"column:review_count"`
	}
	var rows []row
	err := s.db.WithContext(ctx).Raw(`
		SELECT er.id AS review_id, er.dialogue_line_id,
		       dl.original_text, dl.translation, dl.audio_path,
		       er.next_review_at, er.review_count
		FROM ebbinghaus_reviews er
		JOIN dialogue_lines dl ON dl.id = er.dialogue_line_id
		WHERE er.user_id = ? AND er.next_review_at <= NOW()
		ORDER BY er.next_review_at ASC
		LIMIT ?`, userID, limit).Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("get due reviews: %w", err)
	}
	result := make([]reviewWithLineRow, len(rows))
	for i, r := range rows {
		result[i] = reviewWithLineRow{
			ReviewID:       r.ReviewID,
			DialogueLineID: r.DialogueLineID,
			OriginalText:   r.OriginalText,
			Translation:    r.Translation,
			AudioPath:      r.AudioPath,
			NextReviewAt:   r.NextReviewAt,
			ReviewCount:    r.ReviewCount,
		}
	}
	return result, nil
}

// Upsert inserts or updates an EbbinghausReview on (user_id, dialogue_line_id) conflict.
func (s *gormStore) Upsert(ctx context.Context, review *EbbinghausReview) error {
	err := s.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "dialogue_line_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"next_review_at", "review_count", "updated_at"}),
		}).
		Create(review).Error
	if err != nil {
		return fmt.Errorf("upsert review: %w", err)
	}
	return nil
}

// GetByUserAndLine retrieves a specific review record, or nil if not found.
func (s *gormStore) GetByUserAndLine(ctx context.Context, userID, dialogueLineID uint) (*EbbinghausReview, error) {
	var r EbbinghausReview
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND dialogue_line_id = ?", userID, dialogueLineID).
		First(&r).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("get review: %w", err)
	}
	return &r, nil
}
