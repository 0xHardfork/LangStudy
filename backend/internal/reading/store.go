package reading

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"
)

// Store defines database operations for the reading package.
type Store interface {
	CreateArticle(ctx context.Context, art *ReadingArticle) error
	GetArticles(ctx context.Context, userID uint) ([]ReadingArticle, error)
	GetArticle(ctx context.Context, id, userID uint) (*ReadingArticle, error)
	GetSentence(ctx context.Context, id uint) (*ReadingSentence, error)
	UpdateSentence(ctx context.Context, sent *ReadingSentence) error
}

type gormStore struct {
	db *gorm.DB
}

// NewStore creates a new reading Store.
func NewStore(db *gorm.DB) Store {
	return &gormStore{db: db}
}

func (s *gormStore) CreateArticle(ctx context.Context, art *ReadingArticle) error {
	err := s.db.WithContext(ctx).Create(art).Error
	if err != nil {
		return fmt.Errorf("create reading article: %w", err)
	}
	return nil
}

func (s *gormStore) GetArticles(ctx context.Context, userID uint) ([]ReadingArticle, error) {
	var list []ReadingArticle
	err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at desc").
		Find(&list).Error
	if err != nil {
		return nil, fmt.Errorf("get reading articles: %w", err)
	}
	return list, nil
}

func (s *gormStore) GetArticle(ctx context.Context, id, userID uint) (*ReadingArticle, error) {
	var art ReadingArticle
	err := s.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		Preload("Sentences", func(db *gorm.DB) *gorm.DB {
			return db.Order("reading_sentences.paragraph_index asc, reading_sentences.sentence_index asc")
		}).
		First(&art).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get reading article: %w", err)
	}
	return &art, nil
}

func (s *gormStore) GetSentence(ctx context.Context, id uint) (*ReadingSentence, error) {
	var sent ReadingSentence
	err := s.db.WithContext(ctx).First(&sent, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get reading sentence: %w", err)
	}
	return &sent, nil
}

func (s *gormStore) UpdateSentence(ctx context.Context, sent *ReadingSentence) error {
	err := s.db.WithContext(ctx).
		Model(sent).
		Select("Translation", "Explanation", "AudioPath").
		Updates(sent).Error
	if err != nil {
		return fmt.Errorf("update reading sentence: %w", err)
	}
	return nil
}
