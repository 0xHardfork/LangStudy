package ebbinghaus

import (
	"context"
	"time"
)

// ReviewIntervals defines the spaced repetition intervals in days.
var ReviewIntervals = []int{1, 3, 7, 14, 30}

// EbbinghausReview tracks spaced repetition state for a dialogue line.
type EbbinghausReview struct {
	ID              uint         `gorm:"primaryKey"                                  json:"id"`
	UserID          uint         `gorm:"not null"                                    json:"user_id"`
	DialogueLineID  uint         `gorm:"not null"                                    json:"dialogue_line_id"`
	NextReviewAt    time.Time    `gorm:"not null"                                    json:"next_review_at"`
	ReviewCount     int          `gorm:"not null;default:0"                          json:"review_count"`
	CreatedAt       time.Time    `json:"created_at"`
	UpdatedAt       time.Time    `json:"updated_at"`
}

// SubmitAnswerRequest is the payload for POST /reviews/answer.
type SubmitAnswerRequest struct {
	DialogueLineID uint `json:"dialogue_line_id" binding:"required"`
	IsCorrect      bool `json:"is_correct"`
}

// ReviewWithLine is the response type that includes dialogue line context.
type ReviewWithLine struct {
	ID             uint    `json:"id"`
	DialogueLineID uint    `json:"dialogue_line_id"`
	OriginalText   string  `json:"original_text"`
	Translation    string  `json:"translation"`
	AudioPath      *string `json:"audio_path"`
	NextReviewAt   string  `json:"next_review_at"`
	ReviewCount    int     `json:"review_count"`
}

// Service defines the business logic interface for Ebbinghaus reviews.
type Service interface {
	GetDueReviews(ctx context.Context, userID uint) ([]ReviewWithLine, error)
	RecordAnswer(ctx context.Context, userID uint, req *SubmitAnswerRequest) error
	UpsertReview(ctx context.Context, userID, dialogueLineID uint) error
}
