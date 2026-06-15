package user

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

type Store interface {
	Create(ctx context.Context, user *User) error
	GetByID(ctx context.Context, id uint) (*User, error)
	GetByUsername(ctx context.Context, username string) (*User, error)
	List(ctx context.Context, offset, limit int) ([]*User, error)
	Delete(ctx context.Context, id uint) error
}

type gormStore struct {
	db *gorm.DB
}

func NewStore(db *gorm.DB) Store {
	return &gormStore{db: db}
}

func (s *gormStore) Create(ctx context.Context, user *User) error {
	if err := s.db.WithContext(ctx).Create(user).Error; err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

func (s *gormStore) GetByID(ctx context.Context, id uint) (*User, error) {
	var u User
	if err := s.db.WithContext(ctx).First(&u, id).Error; err != nil {
		return nil, fmt.Errorf("get user by id %d: %w", id, err)
	}
	return &u, nil
}

func (s *gormStore) GetByUsername(ctx context.Context, username string) (*User, error) {
	var u User
	if err := s.db.WithContext(ctx).Where("username = ?", username).First(&u).Error; err != nil {
		return nil, fmt.Errorf("get user by username: %w", err)
	}
	return &u, nil
}

func (s *gormStore) List(ctx context.Context, offset, limit int) ([]*User, error) {
	var users []*User
	if err := s.db.WithContext(ctx).Order("id asc").Offset(offset).Limit(limit).Find(&users).Error; err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	return users, nil
}

func (s *gormStore) Delete(ctx context.Context, id uint) error {
	if err := s.db.WithContext(ctx).Delete(&User{}, id).Error; err != nil {
		return fmt.Errorf("delete user: %w", err)
	}
	return nil
}

