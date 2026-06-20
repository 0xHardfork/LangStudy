package userprofile

import (
	"context"
	"fmt"
)

type service struct {
	store Store
}

// NewService creates a new Service.
func NewService(store Store) Service {
	return &service{store: store}
}

// GetProfile returns the user's learning profile.
// If no profile exists, it returns a default empty profile without error.
func (s *service) GetProfile(ctx context.Context, userID uint) (*UserProfile, error) {
	p, err := s.store.GetByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get profile: %w", err)
	}
	if p == nil {
		// Return default empty profile
		return &UserProfile{
			UserID:          userID,
			NativeLanguage:  "zh",
			TargetLanguages: TargetLanguages{},
			FillBlankLevel:  1,
		}, nil
	}
	return p, nil
}

// UpsertProfile creates or updates the learning profile for a user.
func (s *service) UpsertProfile(ctx context.Context, userID uint, req *UpsertProfileRequest) (*UserProfile, error) {
	profile := &UserProfile{
		UserID:          userID,
		Nickname:        req.Nickname,
		NativeLanguage:  req.NativeLanguage,
		TargetLanguages: req.TargetLanguages,
		FillBlankLevel:  req.FillBlankLevel,
	}
	if err := s.store.Upsert(ctx, profile); err != nil {
		return nil, fmt.Errorf("upsert profile: %w", err)
	}
	return profile, nil
}
