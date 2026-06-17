package userprofile

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"
)

// Store is the data access interface for UserProfile.
type Store interface {
	GetByUserID(ctx context.Context, userID uint) (*UserProfile, error)
	Upsert(ctx context.Context, profile *UserProfile) error
}

type gormStore struct {
	db *gorm.DB
}

// NewStore creates a new Store backed by GORM.
func NewStore(db *gorm.DB) Store {
	return &gormStore{db: db}
}

// GetByUserID returns the profile for the given user, or (nil, nil) if not found.
func (s *gormStore) GetByUserID(ctx context.Context, userID uint) (*UserProfile, error) {
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

// Upsert creates or updates the user profile.
func (s *gormStore) Upsert(ctx context.Context, profile *UserProfile) error {
	result := s.db.WithContext(ctx).
		Where(UserProfile{UserID: profile.UserID}).
		Assign(UserProfile{
			Nickname:        profile.Nickname,
			NativeLanguage:  profile.NativeLanguage,
			TargetLanguages: profile.TargetLanguages,
		}).
		FirstOrCreate(profile)
	if result.Error != nil {
		return fmt.Errorf("upsert user profile: %w", result.Error)
	}
	// If found, save the assigned fields
	if result.RowsAffected == 0 {
		if err := s.db.WithContext(ctx).Save(profile).Error; err != nil {
			return fmt.Errorf("save user profile: %w", err)
		}
	}
	return nil
}
