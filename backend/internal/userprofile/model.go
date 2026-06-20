package userprofile

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// TargetLanguage represents a single target language with proficiency level.
type TargetLanguage struct {
	Lang  string `json:"lang"`  // "ja" | "en" | "ko" | "fr" | "de" | "es"
	Level string `json:"level"` // "beginner" | "intermediate" | "advanced"
}

// TargetLanguages is a JSONB-backed slice of TargetLanguage.
type TargetLanguages []TargetLanguage

func (tl TargetLanguages) Value() (driver.Value, error) {
	b, err := json.Marshal(tl)
	if err != nil {
		return nil, fmt.Errorf("marshal target_languages: %w", err)
	}
	return string(b), nil
}

func (tl *TargetLanguages) Scan(value interface{}) error {
	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return fmt.Errorf("unsupported type for TargetLanguages: %T", value)
	}
	return json.Unmarshal(bytes, tl)
}

// UserProfile stores a user's learning profile.
type UserProfile struct {
	ID              uint            `gorm:"primaryKey"                                           json:"id"`
	UserID          uint            `gorm:"uniqueIndex;not null"                                 json:"user_id"`
	Nickname        string          `gorm:"size:64;not null;default:''"                         json:"nickname"`
	NativeLanguage  string          `gorm:"column:native_language;size:20;not null;default:'zh'" json:"native_language"`
	TargetLanguages TargetLanguages `gorm:"column:target_languages;type:jsonb;not null;default:'[]'" json:"target_languages"`
	FillBlankLevel  int             `gorm:"column:fill_blank_level;not null;default:1"           json:"fill_blank_level"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

// UpsertProfileRequest is the payload for PUT /me/profile.
type UpsertProfileRequest struct {
	Nickname        string          `json:"nickname"         binding:"max=64"`
	NativeLanguage  string          `json:"native_language"  binding:"required,oneof=zh en ja ko fr de es"`
	TargetLanguages TargetLanguages `json:"target_languages" binding:"required"`
	FillBlankLevel  int             `json:"fill_blank_level"  binding:"required,min=1,max=4"`
}

// Service interface for dependency inversion.
type Service interface {
	GetProfile(ctx context.Context, userID uint) (*UserProfile, error)
	UpsertProfile(ctx context.Context, userID uint, req *UpsertProfileRequest) (*UserProfile, error)
}
