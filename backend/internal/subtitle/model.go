package subtitle

import "time"

// SubtitleTopic represents a subtitle upload session.
type SubtitleTopic struct {
	ID               uint               `gorm:"primaryKey"                                json:"id"`
	UserID           uint               `gorm:"not null"                                  json:"user_id"`
	Title            string             `gorm:"size:255;not null"                         json:"title"`
	OriginalFileName string             `gorm:"column:original_file_name;size:255;not null" json:"original_file_name"`
	NativeLanguage   string             `gorm:"column:native_language;size:20;not null"   json:"native_language"`
	TargetLanguage   string             `gorm:"column:target_language;size:20;not null"   json:"target_language"`
	Status           string             `gorm:"size:50;not null;default:'pending'"        json:"status"`
	IsShared         bool               `gorm:"column:is_shared;not null;default:false"   json:"is_shared"`
	Blocks           []SubtitleBlock    `gorm:"foreignKey:TopicID;constraint:OnDelete:CASCADE" json:"blocks"`
	Sentences        []SubtitleSentence `gorm:"foreignKey:TopicID;constraint:OnDelete:CASCADE" json:"sentences"`
	Chunks           []SubtitleChunk    `gorm:"foreignKey:TopicID;constraint:OnDelete:CASCADE" json:"chunks"`
	CreatedAt        time.Time          `json:"created_at"`
}

// TableName overrides the GORM table name.
func (SubtitleTopic) TableName() string {
	return "subtitle_topics"
}

// SubtitleBlock represents a parsed SRT/VTT block.
type SubtitleBlock struct {
	ID         uint   `gorm:"primaryKey" json:"id"`
	TopicID    uint   `gorm:"not null"   json:"topic_id"`
	BlockIndex int    `gorm:"not null"   json:"block_index"`
	StartTime  string `gorm:"size:50;not null" json:"start_time"`
	EndTime    string `gorm:"size:50;not null" json:"end_time"`
	RawText    string `gorm:"not null"   json:"raw_text"`
	TargetText string `gorm:"not null"   json:"target_text"`
	NativeText string `gorm:"not null"   json:"native_text"`
}

// TableName overrides the GORM table name.
func (SubtitleBlock) TableName() string {
	return "subtitle_blocks"
}

// SubtitleSentence represents a cleaned and parsed sentence for grammar analysis.
type SubtitleSentence struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	TopicID       uint      `gorm:"not null"   json:"topic_id"`
	SentenceIndex int       `gorm:"not null"   json:"sentence_index"`
	OriginalText  string    `gorm:"not null"   json:"original_text"`
	Translation   string    `gorm:"not null"   json:"translation"`
	Explanation   string    `gorm:"not null"   json:"explanation"`
	CreatedAt     time.Time `json:"created_at"`
}

// TableName overrides the GORM table name.
func (SubtitleSentence) TableName() string {
	return "subtitle_sentences"
}

// SubtitleChunk represents a portion of subtitle blocks to process.
type SubtitleChunk struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	TopicID      uint      `gorm:"not null"   json:"topic_id"`
	ChunkIndex   int       `gorm:"not null"   json:"chunk_index"`
	StartIndex   int       `gorm:"not null"   json:"start_index"`
	EndIndex     int       `gorm:"not null"   json:"end_index"`
	RawContent   string    `gorm:"not null"   json:"raw_content"`
	Status       string    `gorm:"size:50;not null;default:'pending'" json:"status"`
	ErrorMessage string    `gorm:"column:error_message;not null;default:''" json:"error_message"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// TableName overrides the GORM table name.
func (SubtitleChunk) TableName() string {
	return "subtitle_chunks"
}
