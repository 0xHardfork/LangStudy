package dialogue

import "time"

type Dialogue struct {
	ID         uint           `gorm:"primaryKey"                                        json:"id"`
	UserID     uint           `gorm:"not null"                                          json:"user_id"`
	Language   string         `gorm:"size:20;not null"                                  json:"language"`
	Level      string         `gorm:"size:20;not null"                                  json:"level"`
	Topic      string         `gorm:"size:100;not null"                                 json:"topic"`
	IsRejected bool           `gorm:"not null;default:false"                            json:"is_rejected"`
	Lines      []DialogueLine `gorm:"foreignKey:DialogueID;constraint:OnDelete:CASCADE" json:"lines"`
	CreatedAt  time.Time      `json:"created_at"`
}

type DialogueLine struct {
	ID           uint             `gorm:"primaryKey"                                                 json:"id"`
	DialogueID   uint             `gorm:"not null"                                                   json:"dialogue_id"`
	LineIndex    int              `gorm:"not null"                                                   json:"line_index"`
	Speaker      string           `gorm:"size:10;not null"                                           json:"speaker"`
	OriginalText string           `gorm:"not null"                                                   json:"original_text"`
	Translation  string           `gorm:"not null"                                                   json:"translation"`
	AudioPath    *string          `gorm:"column:audio_path"                                          json:"audio_path"`
	Vocabulary   []VocabularyItem `gorm:"foreignKey:DialogueLineID;constraint:OnDelete:CASCADE"      json:"vocabulary"`
	CreatedAt    time.Time        `json:"created_at"`
}

type VocabularyItem struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	DialogueLineID uint      `gorm:"not null"   json:"dialogue_line_id"`
	Word           string    `gorm:"not null"   json:"word"`
	WordIndex      int       `gorm:"not null"   json:"word_index"`
	Importance     int       `gorm:"not null"   json:"importance"`
	CreatedAt      time.Time `json:"created_at"`
}

type SharedDialogue struct {
	ID         uint      `gorm:"primaryKey"         json:"id"`
	Topic      string    `gorm:"size:100;not null"  json:"topic"`
	Language   string    `gorm:"size:20;not null"   json:"language"`
	Level      string    `gorm:"size:20;not null"   json:"level"`
	DialogueID uint      `gorm:"not null"           json:"dialogue_id"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (SharedDialogue) TableName() string {
	return "shared_dialogues"
}

type UserDialogueProgress struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	UserID           uint      `gorm:"not null"   json:"user_id"`
	DialogueID       uint      `gorm:"not null"   json:"dialogue_id"`
	CurrentLineIndex int       `gorm:"not null"   json:"current_line_index"`
	IsCompleted      bool      `gorm:"not null"   json:"is_completed"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (UserDialogueProgress) TableName() string {
	return "user_dialogue_progress"
}

type ActiveDialogueResult struct {
	Dialogue         *Dialogue `json:"dialogue"`
	CurrentLineIndex int       `json:"current_line_index"`
}

type SharedDialogueResult struct {
	Dialogue         *Dialogue `json:"dialogue"`
	CurrentLineIndex int       `json:"current_line_index"`
}

type GenerateRequest struct {
	Topic            string `json:"topic"    binding:"required,max=100"`
	Language         string `json:"language" binding:"required,oneof=ja en ko fr de es"`
	Level            string `json:"level"    binding:"required,oneof=beginner intermediate advanced"`
	TopicDescription string `json:"topic_description"`
}

type RegenerateRequest struct {
	PrevDialogueID uint   `json:"prev_dialogue_id" binding:"required"`
	Topic          string `json:"topic"            binding:"required,max=100"`
	Language       string `json:"language"         binding:"required,oneof=ja en ko fr de es"`
	Level          string `json:"level"            binding:"required,oneof=beginner intermediate advanced"`
	Hint           string `json:"hint"`
	NativeLanguage string `json:"native_language"`
}

type UpdateProgressRequest struct {
	CurrentLineIndex int  `json:"current_line_index"`
	IsCompleted      bool `json:"is_completed"`
}

type llmDialogueLine struct {
	Speaker      string `json:"speaker"`
	OriginalText string `json:"original_text"`
	Translation  string `json:"translation"`
}

type llmVocabItem struct {
	LineIndex  int    `json:"line_index"`
	Word       string `json:"word"`
	WordIndex  int    `json:"word_index"`
	Importance int    `json:"importance"`
}

type Type struct {
	ID          uint      `gorm:"primaryKey"       json:"id"`
	Name        string    `gorm:"size:100;uniqueIndex;not null" json:"name"`
	Description string    `gorm:"not null"         json:"description"`
	Emoji       string    `gorm:"size:10;not null" json:"emoji"`
	SortOrder   int       `gorm:"not null"         json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (Type) TableName() string {
	return "dialogue_types"
}

type CreateTopicRequest struct {
	Name        string `json:"name"        binding:"required,max=100"`
	Description string `json:"description"`
	Emoji       string `json:"emoji"       binding:"max=10"`
	SortOrder   int    `json:"sort_order"`
}

type UpdateTopicRequest struct {
	Name        string `json:"name"        binding:"required,max=100"`
	Description string `json:"description"`
	Emoji       string `json:"emoji"       binding:"max=10"`
	SortOrder   int    `json:"sort_order"`
}
