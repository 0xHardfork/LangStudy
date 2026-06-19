package dialoguetype

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

// Store is the data access interface for DialogueType.
type Store interface {
	List(ctx context.Context) ([]DialogueType, error)
	GetByName(ctx context.Context, name string) (*DialogueType, error)
	Create(ctx context.Context, dt *DialogueType) error
	Update(ctx context.Context, dt *DialogueType) error
	Delete(ctx context.Context, id uint) error
}

type gormStore struct {
	db *gorm.DB
}

// NewStore creates a Store backed by GORM.
func NewStore(db *gorm.DB) Store {
	return &gormStore{db: db}
}

func (s *gormStore) List(ctx context.Context) ([]DialogueType, error) {
	var types []DialogueType
	if err := s.db.WithContext(ctx).Order("sort_order ASC, id ASC").Find(&types).Error; err != nil {
		return nil, fmt.Errorf("list dialogue types: %w", err)
	}
	return types, nil
}

func (s *gormStore) GetByName(ctx context.Context, name string) (*DialogueType, error) {
	var dt DialogueType
	if err := s.db.WithContext(ctx).Where("name = ?", name).First(&dt).Error; err != nil {
		return nil, fmt.Errorf("get dialogue type by name: %w", err)
	}
	return &dt, nil
}

func (s *gormStore) Create(ctx context.Context, dt *DialogueType) error {
	if err := s.db.WithContext(ctx).Create(dt).Error; err != nil {
		return fmt.Errorf("create dialogue type: %w", err)
	}
	return nil
}

func (s *gormStore) Update(ctx context.Context, dt *DialogueType) error {
	if err := s.db.WithContext(ctx).Save(dt).Error; err != nil {
		return fmt.Errorf("update dialogue type: %w", err)
	}
	return nil
}

func (s *gormStore) Delete(ctx context.Context, id uint) error {
	if err := s.db.WithContext(ctx).Delete(&DialogueType{}, id).Error; err != nil {
		return fmt.Errorf("delete dialogue type: %w", err)
	}
	return nil
}
