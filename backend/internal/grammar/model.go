package grammar

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// JSONOptions is a JSONB-backed slice of strings for quiz options.
type JSONOptions []string

func (jo JSONOptions) Value() (driver.Value, error) {
	if jo == nil {
		return "[]", nil
	}
	b, err := json.Marshal(jo)
	if err != nil {
		return nil, fmt.Errorf("marshal JSONOptions: %w", err)
	}
	return string(b), nil
}

func (jo *JSONOptions) Scan(value interface{}) error {
	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	case nil:
		*jo = JSONOptions{}
		return nil
	default:
		return fmt.Errorf("unsupported type for JSONOptions: %T", value)
	}
	return json.Unmarshal(bytes, jo)
}

// JSONExplanations is a JSONB-backed map representing explanations for each option index (e.g. {"0": "explanation A", ...}).
type JSONExplanations map[string]string

func (je JSONExplanations) Value() (driver.Value, error) {
	if je == nil {
		return "{}", nil
	}
	b, err := json.Marshal(je)
	if err != nil {
		return nil, fmt.Errorf("marshal JSONExplanations: %w", err)
	}
	return string(b), nil
}

func (je *JSONExplanations) Scan(value interface{}) error {
	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	case nil:
		*je = JSONExplanations{}
		return nil
	default:
		return fmt.Errorf("unsupported type for JSONExplanations: %T", value)
	}
	return json.Unmarshal(bytes, je)
}

// PostgresTags is a custom Scanner/Valuer for parsing PostgreSQL TEXT[] tags columns.
type PostgresTags []string

func (pt PostgresTags) Value() (driver.Value, error) {
	if len(pt) == 0 {
		return "{}", nil
	}
	quoted := make([]string, len(pt))
	for i, s := range pt {
		escaped := strings.ReplaceAll(s, "\\", "\\\\")
		escaped = strings.ReplaceAll(escaped, "\"", "\\\"")
		quoted[i] = "\"" + escaped + "\""
	}
	return "{" + strings.Join(quoted, ",") + "}", nil
}

func (pt *PostgresTags) Scan(value interface{}) error {
	if value == nil {
		*pt = PostgresTags{}
		return nil
	}
	var str string
	switch v := value.(type) {
	case string:
		str = v
	case []byte:
		str = string(v)
	default:
		return fmt.Errorf("unsupported type for PostgresTags: %T", value)
	}
	if str == "{}" || str == "" {
		*pt = PostgresTags{}
		return nil
	}
	trimmed := strings.Trim(str, "{}")
	parts := strings.Split(trimmed, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.Trim(p, "\"")
		p = strings.ReplaceAll(p, "\\\"", "\"")
		p = strings.ReplaceAll(p, "\\\\", "\\")
		result = append(result, p)
	}
	*pt = result
	return nil
}

// GrammarArticle represents a user-uploaded article.
type GrammarArticle struct {
	ID        uint              `gorm:"primaryKey"                                         json:"id"`
	UserID    uint              `gorm:"not null"                                           json:"user_id"`
	Title     string            `gorm:"size:255;not null"                                  json:"title"`
	RawText   string            `gorm:"not null"                                           json:"raw_text"`
	Sentences []GrammarSentence `gorm:"foreignKey:ArticleID;constraint:OnDelete:CASCADE"    json:"sentences"`
	CreatedAt time.Time         `json:"created_at"`
}

// TableName overrides the GORM table name.
func (GrammarArticle) TableName() string {
	return "grammar_articles"
}

// GrammarSentence represents an analyzed sentence within an article.
type GrammarSentence struct {
	ID            uint          `gorm:"primaryKey"                                         json:"id"`
	ArticleID     uint          `gorm:"not null"                                           json:"article_id"`
	SentenceIndex int           `gorm:"not null"                                           json:"sentence_index"`
	OriginalText  string        `gorm:"not null"                                           json:"original_text"`
	Translation   string        `gorm:"not null"                                           json:"translation"`
	Explanation   string        `gorm:"not null"                                           json:"explanation"`
	AudioPath     *string       `gorm:"column:audio_path"                                  json:"audio_path"`
	Quizzes       []GrammarQuiz `gorm:"foreignKey:SentenceID;constraint:OnDelete:CASCADE"   json:"quizzes"`
	CreatedAt     time.Time     `json:"created_at"`
}

// TableName overrides the GORM table name.
func (GrammarSentence) TableName() string {
	return "grammar_sentences"
}

// GrammarQuiz represents an AI-generated Cloze question.
type GrammarQuiz struct {
	ID            uint             `gorm:"primaryKey"                                         json:"id"`
	SentenceID    uint             `gorm:"not null"                                           json:"sentence_id"`
	Question      string           `gorm:"not null"                                           json:"question"`
	Options       JSONOptions      `gorm:"type:jsonb;not null"                                json:"options"`
	CorrectOption int              `gorm:"not null"                                           json:"correct_option"`
	Explanations  JSONExplanations `gorm:"type:jsonb;not null"                                json:"explanations"`
	Tags          PostgresTags     `gorm:"type:text[];not null"                               json:"tags"`
	CreatedAt     time.Time        `json:"created_at"`
}

// TableName overrides the GORM table name.
func (GrammarQuiz) TableName() string {
	return "grammar_quizzes"
}

// GrammarReview tracks spaced repetition for a grammar quiz.
type GrammarReview struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	UserID        uint      `gorm:"not null"   json:"user_id"`
	GrammarQuizID uint      `gorm:"not null"   json:"grammar_quiz_id"`
	NextReviewAt  time.Time `gorm:"not null"   json:"next_review_at"`
	ReviewCount   int       `gorm:"not null"   json:"review_count"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// TableName overrides the GORM table name.
func (GrammarReview) TableName() string {
	return "grammar_reviews"
}

// AnalyzeRequest represents the text analysis request payload.
type AnalyzeRequest struct {
	Title string `json:"title" binding:"required,max=255"`
	Text  string `json:"text"  binding:"required,max=5000"`
}

// SubmitQuizAnswerRequest represents the answer payload.
type SubmitQuizAnswerRequest struct {
	GrammarQuizID uint `json:"grammar_quiz_id" binding:"required"`
	IsCorrect     bool `json:"is_correct"`
}

// Service defines the business logic interface for grammar study.
type Service interface {
	AnalyzeText(ctx context.Context, userID uint, req *AnalyzeRequest) (*GrammarArticle, error)
	GetHistory(ctx context.Context) ([]GrammarArticle, error)
	GetArticle(ctx context.Context, id uint) (*GrammarArticle, error)
	RecordAnswer(ctx context.Context, userID uint, req *SubmitQuizAnswerRequest) error
	GetDueReviews(ctx context.Context, userID uint) ([]GrammarQuizReviewDetail, error)
	RegenerateSentence(ctx context.Context, sentenceID uint) (*GrammarSentence, error)
}

// GrammarQuizReviewDetail holds the quiz details alongside the review progress.
type GrammarQuizReviewDetail struct {
	ReviewID        uint             `json:"review_id"`
	GrammarQuizID   uint             `json:"grammar_quiz_id"`
	Question        string           `json:"question"`
	Options         JSONOptions      `json:"options"`
	CorrectOption   int              `json:"correct_option"`
	Explanations    JSONExplanations `json:"explanations"`
	Tags            PostgresTags     `json:"tags"`
	NextReviewAt    string           `json:"next_review_at"`
	ReviewCount     int              `json:"review_count"`
	SentenceText    string           `json:"sentence_text"`
	SentenceTrans   string           `json:"sentence_trans"`
	SentenceExplain string           `json:"sentence_explain"`
	AudioPath       *string          `json:"audio_path"`
}
