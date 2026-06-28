package user

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"
)

type Store interface {
	Create(ctx context.Context, user *User) error
	GetByID(ctx context.Context, id uint) (*User, error)
	GetByUsername(ctx context.Context, username string) (*User, error)
	List(ctx context.Context, offset, limit int) ([]*User, error)
	Delete(ctx context.Context, id uint) error

	GetProfileByUserID(ctx context.Context, userID uint) (*UserProfile, error)
	UpsertProfile(ctx context.Context, profile *UserProfile) error
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

func (s *gormStore) GetProfileByUserID(ctx context.Context, userID uint) (*UserProfile, error) {
	var p UserProfile
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&p).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get user profile: %w", err)
	}
	return &p, nil
}

func (s *gormStore) UpsertProfile(ctx context.Context, profile *UserProfile) error {
	result := s.db.WithContext(ctx).
		Where(UserProfile{UserID: profile.UserID}).
		Assign(UserProfile{
			Nickname:        profile.Nickname,
			NativeLanguage:  profile.NativeLanguage,
			TargetLanguages: profile.TargetLanguages,
			FillBlankLevel:  profile.FillBlankLevel,
		}).
		FirstOrCreate(profile)
	if result.Error != nil {
		return fmt.Errorf("upsert user profile: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		if err := s.db.WithContext(ctx).Save(profile).Error; err != nil {
			return fmt.Errorf("save user profile: %w", err)
		}
	}
	return nil
}
