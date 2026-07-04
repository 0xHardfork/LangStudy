package grammar

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Store defines database operations for the grammar package.
type Store interface {
	CreateArticle(ctx context.Context, art *GrammarArticle) error
	GetArticles(ctx context.Context, userID uint) ([]GrammarArticle, error)
	GetArticle(ctx context.Context, id, userID uint) (*GrammarArticle, error)
	GetReview(ctx context.Context, userID, quizID uint) (*GrammarReview, error)
	UpsertReview(ctx context.Context, review *GrammarReview) error
	GetDueReviews(ctx context.Context, userID uint) ([]GrammarQuizReviewDetail, error)
	GetSentence(ctx context.Context, id uint) (*GrammarSentence, error)
	UpdateSentenceAndQuizzes(ctx context.Context, sent *GrammarSentence) error
}

type gormStore struct {
	db *gorm.DB
}

// NewStore creates a new grammar Store.
func NewStore(db *gorm.DB) Store {
	return &gormStore{db: db}
}

func (s *gormStore) CreateArticle(ctx context.Context, art *GrammarArticle) error {
	err := s.db.WithContext(ctx).Create(art).Error
	if err != nil {
		return fmt.Errorf("create grammar article: %w", err)
	}
	return nil
}

func (s *gormStore) GetArticles(ctx context.Context, userID uint) ([]GrammarArticle, error) {
	var list []GrammarArticle
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).Order("created_at desc").Find(&list).Error
	if err != nil {
		return nil, fmt.Errorf("get grammar articles: %w", err)
	}
	return list, nil
}

func (s *gormStore) GetArticle(ctx context.Context, id, userID uint) (*GrammarArticle, error) {
	var art GrammarArticle
	err := s.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		Preload("Sentences", func(db *gorm.DB) *gorm.DB {
			return db.Order("grammar_sentences.sentence_index asc")
		}).
		Preload("Sentences.Quizzes").
		First(&art).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get grammar article: %w", err)
	}
	return &art, nil
}

func (s *gormStore) GetReview(ctx context.Context, userID, quizID uint) (*GrammarReview, error) {
	var rev GrammarReview
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND grammar_quiz_id = ?", userID, quizID).
		First(&rev).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get grammar review: %w", err)
	}
	return &rev, nil
}

func (s *gormStore) UpsertReview(ctx context.Context, review *GrammarReview) error {
	err := s.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "grammar_quiz_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"next_review_at", "review_count", "updated_at"}),
		}).
		Create(review).Error
	if err != nil {
		return fmt.Errorf("upsert grammar review: %w", err)
	}
	return nil
}

func (s *gormStore) GetDueReviews(ctx context.Context, userID uint) ([]GrammarQuizReviewDetail, error) {
	type row struct {
		ReviewID        uint             `gorm:"column:review_id"`
		GrammarQuizID   uint             `gorm:"column:grammar_quiz_id"`
		Question        string           `gorm:"column:question"`
		Options         JSONOptions      `gorm:"column:options"`
		CorrectOption   int              `gorm:"column:correct_option"`
		Explanations    JSONExplanations `gorm:"column:explanations"`
		Tags            PostgresTags     `gorm:"column:tags"`
		NextReviewAt    time.Time        `gorm:"column:next_review_at"`
		ReviewCount     int              `gorm:"column:review_count"`
		SentenceText    string           `gorm:"column:sentence_text"`
		SentenceTrans   string           `gorm:"column:sentence_trans"`
		SentenceExplain string           `gorm:"column:sentence_explain"`
		AudioPath       *string          `gorm:"column:audio_path"`
	}
	var rows []row
	err := s.db.WithContext(ctx).Raw(`
		SELECT gr.id AS review_id, gr.grammar_quiz_id,
		       gq.question, gq.options, gq.correct_option, gq.explanations, gq.tags,
		       gr.next_review_at, gr.review_count,
		       gs.original_text AS sentence_text, gs.translation AS sentence_trans, gs.explanation AS sentence_explain, gs.audio_path
		FROM grammar_reviews gr
		JOIN grammar_quizzes gq ON gq.id = gr.grammar_quiz_id
		JOIN grammar_sentences gs ON gs.id = gq.sentence_id
		WHERE gr.user_id = ? AND gr.next_review_at <= NOW()
		ORDER BY gr.next_review_at ASC`, userID).Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("get due grammar reviews raw: %w", err)
	}

	result := make([]GrammarQuizReviewDetail, len(rows))
	for i, r := range rows {
		result[i] = GrammarQuizReviewDetail{
			ReviewID:        r.ReviewID,
			GrammarQuizID:   r.GrammarQuizID,
			Question:        r.Question,
			Options:         r.Options,
			CorrectOption:   r.CorrectOption,
			Explanations:    r.Explanations,
			Tags:            r.Tags,
			NextReviewAt:    r.NextReviewAt.Format(time.RFC3339),
			ReviewCount:     r.ReviewCount,
			SentenceText:    r.SentenceText,
			SentenceTrans:   r.SentenceTrans,
			SentenceExplain: r.SentenceExplain,
			AudioPath:       r.AudioPath,
		}
	}
	return result, nil
}

func (s *gormStore) GetSentence(ctx context.Context, id uint) (*GrammarSentence, error) {
	var sent GrammarSentence
	err := s.db.WithContext(ctx).First(&sent, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get grammar sentence: %w", err)
	}
	return &sent, nil
}

func (s *gormStore) UpdateSentenceAndQuizzes(ctx context.Context, sent *GrammarSentence) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Delete existing quizzes
		if err := tx.Where("sentence_id = ?", sent.ID).Delete(&GrammarQuiz{}).Error; err != nil {
			return err
		}
		// Update sentence fields
		if err := tx.Model(sent).Select("Translation", "Explanation", "AudioPath").Updates(sent).Error; err != nil {
			return err
		}
		// Insert new quizzes
		for i := range sent.Quizzes {
			sent.Quizzes[i].SentenceID = sent.ID
			if err := tx.Create(&sent.Quizzes[i]).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
