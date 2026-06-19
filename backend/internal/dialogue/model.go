package dialogue

import "time"

// Dialogue represents a generated dialogue session.
type Dialogue struct {
	ID        uint           `gorm:"primaryKey"                                            json:"id"`
	UserID    uint           `gorm:"not null"                                              json:"user_id"`
	Language  string         `gorm:"size:20;not null"                                      json:"language"`
	Level     string         `gorm:"size:20;not null"                                      json:"level"`
	Topic     string         `gorm:"size:100;not null"                                     json:"topic"`
	Lines     []DialogueLine `gorm:"foreignKey:DialogueID;constraint:OnDelete:CASCADE"     json:"lines"`
	CreatedAt time.Time      `json:"created_at"`
}

// DialogueLine represents a single line of dialogue with optional audio.
type DialogueLine struct {
	ID           uint            `gorm:"primaryKey"                                                  json:"id"`
	DialogueID   uint            `gorm:"not null"                                                    json:"dialogue_id"`
	LineIndex    int             `gorm:"not null"                                                    json:"line_index"`
	Speaker      string          `gorm:"size:10;not null"                                            json:"speaker"` // "A" or "B"
	OriginalText string          `gorm:"not null"                                                    json:"original_text"`
	Translation  string          `gorm:"not null"                                                    json:"translation"`
	AudioPath    *string         `gorm:"column:audio_path"                                           json:"audio_path"` // nullable
	Vocabulary   []VocabularyItem `gorm:"foreignKey:DialogueLineID;constraint:OnDelete:CASCADE"      json:"vocabulary"`
	CreatedAt    time.Time       `json:"created_at"`
}

// VocabularyItem represents a word in a dialogue line with its importance rating.
type VocabularyItem struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	DialogueLineID  uint      `gorm:"not null"   json:"dialogue_line_id"`
	Word            string    `gorm:"not null"   json:"word"`
	WordIndex       int       `gorm:"not null"   json:"word_index"`
	Importance      int       `gorm:"not null"   json:"importance"` // 1-4
	CreatedAt       time.Time `json:"created_at"`
}

// GenerateRequest is the payload for POST /dialogue/generate.
type GenerateRequest struct {
	Topic            string `json:"topic"    binding:"required,max=100"`
	Language         string `json:"language" binding:"required,oneof=ja en ko fr de es"`
	Level            string `json:"level"    binding:"required,oneof=beginner intermediate advanced"`
	TopicDescription string `json:"topic_description"` // optional; injected by service from DB
}

// llmDialogueLine is the JSON structure returned by the LLM for dialogue generation.
type llmDialogueLine struct {
	Speaker      string `json:"speaker"`
	OriginalText string `json:"original_text"`
	Translation  string `json:"translation"`
}

// llmVocabItem is the JSON structure returned by the LLM for vocabulary rating.
type llmVocabItem struct {
	LineIndex  int    `json:"line_index"`
	Word       string `json:"word"`
	WordIndex  int    `json:"word_index"`
	Importance int    `json:"importance"`
}
