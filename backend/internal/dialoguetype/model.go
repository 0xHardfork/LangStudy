package dialoguetype

import "time"

// DialogueType represents an admin-configured conversation topic category.
type DialogueType struct {
	ID          uint      `gorm:"primaryKey"       json:"id"`
	Name        string    `gorm:"size:100;uniqueIndex;not null" json:"name"`
	Description string    `gorm:"not null"         json:"description"`
	Emoji       string    `gorm:"size:10;not null" json:"emoji"`
	SortOrder   int       `gorm:"not null"         json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CreateRequest is the payload for POST /admin/dialogue-types.
type CreateRequest struct {
	Name        string `json:"name"        binding:"required,max=100"`
	Description string `json:"description"`
	Emoji       string `json:"emoji"       binding:"max=10"`
	SortOrder   int    `json:"sort_order"`
}

// UpdateRequest is the payload for PUT /admin/dialogue-types/:id.
type UpdateRequest struct {
	Name        string `json:"name"        binding:"required,max=100"`
	Description string `json:"description"`
	Emoji       string `json:"emoji"       binding:"max=10"`
	SortOrder   int    `json:"sort_order"`
}
