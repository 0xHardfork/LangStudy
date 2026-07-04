package llmconfig

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

type Store interface {
	Get(ctx context.Context) (*LLMConfig, error)
	Update(ctx context.Context, config *LLMConfig) error
}

type gormStore struct {
	db *gorm.DB
}

func NewStore(db *gorm.DB) Store {
	return &gormStore{db: db}
}

func (s *gormStore) Get(ctx context.Context) (*LLMConfig, error) {
	var cfg LLMConfig
	if err := s.db.WithContext(ctx).First(&cfg).Error; err != nil {
		return nil, fmt.Errorf("get llm config: %w", err)
	}
	return &cfg, nil
}

func (s *gormStore) Update(ctx context.Context, cfg *LLMConfig) error {
	if err := s.db.WithContext(ctx).Save(cfg).Error; err != nil {
		return fmt.Errorf("update llm config: %w", err)
	}
	return nil
}
