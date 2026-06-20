package ebbinghaus

import (
	"context"
	"fmt"
	"time"
)

type svc struct {
	store Store
}

// NewService creates a new Ebbinghaus Service.
func NewService(store Store) Service {
	return &svc{store: store}
}

// GetDueReviews returns up to 20 reviews due today for the user.
func (s *svc) GetDueReviews(ctx context.Context, userID uint) ([]ReviewWithLine, error) {
	rows, err := s.store.GetDueReviews(ctx, userID, 20)
	if err != nil {
		return nil, fmt.Errorf("get due reviews: %w", err)
	}
	result := make([]ReviewWithLine, len(rows))
	for i, r := range rows {
		result[i] = ReviewWithLine{
			ID:             r.ReviewID,
			DialogueLineID: r.DialogueLineID,
			OriginalText:   r.OriginalText,
			Translation:    r.Translation,
			AudioPath:      r.AudioPath,
			NextReviewAt:   r.NextReviewAt.Format(time.RFC3339),
			ReviewCount:    r.ReviewCount,
		}
	}
	return result, nil
}

// GetReviewSchedule returns all review items scheduled for the user.
func (s *svc) GetReviewSchedule(ctx context.Context, userID uint) ([]ReviewWithLine, error) {
	rows, err := s.store.GetReviewSchedule(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get review schedule: %w", err)
	}
	result := make([]ReviewWithLine, len(rows))
	for i, r := range rows {
		result[i] = ReviewWithLine{
			ID:             r.ReviewID,
			DialogueLineID: r.DialogueLineID,
			OriginalText:   r.OriginalText,
			Translation:    r.Translation,
			AudioPath:      r.AudioPath,
			NextReviewAt:   r.NextReviewAt.Format(time.RFC3339),
			ReviewCount:    r.ReviewCount,
		}
	}
	return result, nil
}


// RecordAnswer updates the review schedule based on whether the answer was correct.
//
// Correct:   review_count++ → next interval = ReviewIntervals[review_count] days
//            If review_count ≥ len(ReviewIntervals), schedule 1 year out (memorized).
// Incorrect: review_count = 0 → next interval = 1 day (restart).
func (s *svc) RecordAnswer(ctx context.Context, userID uint, req *SubmitAnswerRequest) error {
	existing, err := s.store.GetByUserAndLine(ctx, userID, req.DialogueLineID)
	if err != nil {
		return fmt.Errorf("get review: %w", err)
	}

	now := time.Now()
	var review EbbinghausReview

	if existing != nil {
		review = *existing
	} else {
		review = EbbinghausReview{
			UserID:         userID,
			DialogueLineID: req.DialogueLineID,
		}
	}

	if req.IsCorrect {
		review.ReviewCount++
		if review.ReviewCount >= len(ReviewIntervals) {
			// Memorized — schedule far future
			review.NextReviewAt = now.AddDate(1, 0, 0)
		} else {
			days := ReviewIntervals[review.ReviewCount]
			review.NextReviewAt = now.AddDate(0, 0, days)
		}
	} else {
		review.ReviewCount = 0
		review.NextReviewAt = now.AddDate(0, 0, ReviewIntervals[0])
	}
	review.UpdatedAt = now

	if err := s.store.Upsert(ctx, &review); err != nil {
		return fmt.Errorf("upsert review: %w", err)
	}
	return nil
}

// UpsertReview creates or re-schedules a review for a dialogue line (called after wrong answer in fill-blank).
func (s *svc) UpsertReview(ctx context.Context, userID, dialogueLineID uint) error {
	review := &EbbinghausReview{
		UserID:         userID,
		DialogueLineID: dialogueLineID,
		NextReviewAt:   time.Now().AddDate(0, 0, ReviewIntervals[0]),
		ReviewCount:    0,
		UpdatedAt:      time.Now(),
	}
	return s.store.Upsert(ctx, review)
}
