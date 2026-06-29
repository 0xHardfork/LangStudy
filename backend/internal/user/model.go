package user

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

type User struct {
	ID         uint      `gorm:"primaryKey"`
	Username   string    `gorm:"uniqueIndex;size:64;not null"`
	Password   string    `gorm:"not null"`
	Role       string    `gorm:"size:20;not null;default:'user'"`
	IsApproved bool      `gorm:"column:is_approved;not null;default:false"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=64"`
	Password string `json:"password" binding:"required,min=8"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type ProfileResponse struct {
	ID         uint      `json:"id"`
	Username   string    `json:"username"`
	Role       string    `json:"role"`
	IsApproved bool      `json:"is_approved"`
	CreatedAt  time.Time `json:"created_at"`
}

type CreateUserRequest struct {
	Username string `json:"username" binding:"required,min=3,max=64"`
	Password string `json:"password" binding:"required,min=8"`
	Role     string `json:"role" binding:"required,oneof=admin user"`
}

type TargetLanguage struct {
	Lang  string `json:"lang"`
	Level string `json:"level"`
}

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

type UpsertProfileRequest struct {
	Nickname        string          `json:"nickname"         binding:"max=64"`
	NativeLanguage  string          `json:"native_language"  binding:"required,oneof=zh en ja ko fr de es"`
	TargetLanguages TargetLanguages `json:"target_languages" binding:"required"`
	FillBlankLevel  int             `json:"fill_blank_level"  binding:"required,min=1,max=4"`
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required,min=8"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

