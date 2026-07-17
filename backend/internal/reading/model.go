package reading

import (
	"time"
)

// ReadingArticle represents a long English text uploaded by the user.
type ReadingArticle struct {
	ID        uint              `gorm:"primaryKey"                                      json:"id"`
	UserID    uint              `gorm:"not null"                                        json:"user_id"`
	Title     string            `gorm:"size:255;not null"                               json:"title"`
	RawText   string            `gorm:"not null"                                        json:"raw_text"`
	Sentences []ReadingSentence `gorm:"foreignKey:ArticleID;constraint:OnDelete:CASCADE" json:"sentences"`
	CreatedAt time.Time         `json:"created_at"`
}

// TableName overrides the GORM table name.
func (ReadingArticle) TableName() string {
	return "reading_articles"
}

// ReadingSentence represents a parsed, translated, and grammatically analyzed sentence.
type ReadingSentence struct {
	ID             uint      `gorm:"primaryKey"                json:"id"`
	ArticleID      uint      `gorm:"not null"                  json:"article_id"`
	SentenceIndex  int       `gorm:"not null"                  json:"sentence_index"`
	ParagraphIndex int       `gorm:"not null;default:0"        json:"paragraph_index"`
	OriginalText   string    `gorm:"not null"                  json:"original_text"`
	Translation    string    `gorm:"not null"                  json:"translation"`
	Explanation    string    `gorm:"not null"                  json:"explanation"`
	AudioPath      *string   `gorm:"column:audio_path"         json:"audio_path"`
	CreatedAt      time.Time `json:"created_at"`
}

// TableName overrides the GORM table name.
func (ReadingSentence) TableName() string {
	return "reading_sentences"
}

// AnalyzeReadingRequest represents the payload for creating a reading analysis.
type AnalyzeReadingRequest struct {
	Title string `json:"title" binding:"required,max=255"`
	Text  string `json:"text"  binding:"max=5000"`
}

// AddSentenceRequest represents the payload for adding sentences to an existing article.
type AddSentenceRequest struct {
	Text string `json:"text" binding:"required,max=5000"`
}

