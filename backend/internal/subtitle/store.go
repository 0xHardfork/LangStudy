package subtitle

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// Store defines database operations for the subtitle package.
type Store interface {
	CreateTopic(ctx context.Context, topic *SubtitleTopic) error
	GetTopics(ctx context.Context, userID uint) ([]SubtitleTopic, error)
	GetTopic(ctx context.Context, id, userID uint) (*SubtitleTopic, error)
	GetSentence(ctx context.Context, id uint) (*SubtitleSentence, error)
	UpdateSentence(ctx context.Context, sent *SubtitleSentence) error
	DeleteTopic(ctx context.Context, id, userID uint) error

	CreateChunk(ctx context.Context, chunk *SubtitleChunk) error
	GetChunk(ctx context.Context, chunkID uint) (*SubtitleChunk, error)
	UpdateChunkStatus(ctx context.Context, chunkID uint, status, errMsg string) error
	SaveChunkResults(ctx context.Context, blocks []SubtitleBlock, sentences []SubtitleSentence) error
	MergeTopic(ctx context.Context, id, userID uint) error
	GetSharedTopics(ctx context.Context) ([]SubtitleTopic, error)
	ToggleShareTopic(ctx context.Context, id, userID uint, isShared bool) error
	ResetStuckChunks(ctx context.Context, topicID uint) error
}

type gormStore struct {
	db *gorm.DB
}

// NewStore creates a new subtitle Store.
func NewStore(db *gorm.DB) Store {
	return &gormStore{db: db}
}

func (s *gormStore) CreateTopic(ctx context.Context, topic *SubtitleTopic) error {
	err := s.db.WithContext(ctx).Create(topic).Error
	if err != nil {
		return fmt.Errorf("create subtitle topic: %w", err)
	}
	return nil
}

func (s *gormStore) GetTopics(ctx context.Context, userID uint) ([]SubtitleTopic, error) {
	var list []SubtitleTopic
	err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at desc").
		Preload("Chunks", func(db *gorm.DB) *gorm.DB {
			return db.Order("subtitle_chunks.chunk_index asc")
		}).
		Find(&list).Error
	if err != nil {
		return nil, fmt.Errorf("get subtitle topics: %w", err)
	}
	return list, nil
}

func (s *gormStore) GetTopic(ctx context.Context, id, userID uint) (*SubtitleTopic, error) {
	var topic SubtitleTopic
	err := s.db.WithContext(ctx).
		Where("id = ? AND (user_id = ? OR is_shared = ?)", id, userID, true).
		Preload("Blocks", func(db *gorm.DB) *gorm.DB {
			return db.Order("subtitle_blocks.block_index asc")
		}).
		Preload("Sentences", func(db *gorm.DB) *gorm.DB {
			return db.Order("subtitle_sentences.sentence_index asc")
		}).
		Preload("Chunks", func(db *gorm.DB) *gorm.DB {
			return db.Order("subtitle_chunks.chunk_index asc")
		}).
		First(&topic).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get subtitle topic: %w", err)
	}
	return &topic, nil
}

func (s *gormStore) GetSentence(ctx context.Context, id uint) (*SubtitleSentence, error) {
	var sent SubtitleSentence
	err := s.db.WithContext(ctx).First(&sent, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get subtitle sentence: %w", err)
	}
	return &sent, nil
}

func (s *gormStore) UpdateSentence(ctx context.Context, sent *SubtitleSentence) error {
	err := s.db.WithContext(ctx).
		Model(sent).
		Select("Translation", "Explanation").
		Updates(sent).Error
	if err != nil {
		return fmt.Errorf("update subtitle sentence: %w", err)
	}
	return nil
}

func (s *gormStore) DeleteTopic(ctx context.Context, id, userID uint) error {
	err := s.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		Delete(&SubtitleTopic{}).Error
	if err != nil {
		return fmt.Errorf("delete subtitle topic: %w", err)
	}
	return nil
}

func (s *gormStore) CreateChunk(ctx context.Context, chunk *SubtitleChunk) error {
	err := s.db.WithContext(ctx).Create(chunk).Error
	if err != nil {
		return fmt.Errorf("create subtitle chunk: %w", err)
	}
	return nil
}

func (s *gormStore) GetChunk(ctx context.Context, chunkID uint) (*SubtitleChunk, error) {
	var chunk SubtitleChunk
	err := s.db.WithContext(ctx).First(&chunk, chunkID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get subtitle chunk: %w", err)
	}
	return &chunk, nil
}

func (s *gormStore) UpdateChunkStatus(ctx context.Context, chunkID uint, status, errMsg string) error {
	err := s.db.WithContext(ctx).
		Model(&SubtitleChunk{}).
		Where("id = ?", chunkID).
		Updates(map[string]interface{}{
			"status":        status,
			"error_message": errMsg,
			"updated_at":    time.Now(),
		}).Error
	if err != nil {
		return fmt.Errorf("update chunk status: %w", err)
	}
	return nil
}

func (s *gormStore) SaveChunkResults(ctx context.Context, blocks []SubtitleBlock, sentences []SubtitleSentence) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Insert blocks
		if len(blocks) > 0 {
			if err := tx.Create(&blocks).Error; err != nil {
				return fmt.Errorf("bulk insert blocks: %w", err)
			}
		}
		// Insert sentences
		if len(sentences) > 0 {
			if err := tx.Create(&sentences).Error; err != nil {
				return fmt.Errorf("bulk insert sentences: %w", err)
			}
		}
		return nil
	})
}

func (s *gormStore) MergeTopic(ctx context.Context, id, userID uint) error {
	err := s.db.WithContext(ctx).
		Model(&SubtitleTopic{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("status", "completed").Error
	if err != nil {
		return fmt.Errorf("merge subtitle topic: %w", err)
	}
	return nil
}

func (s *gormStore) GetSharedTopics(ctx context.Context) ([]SubtitleTopic, error) {
	var list []SubtitleTopic
	err := s.db.WithContext(ctx).
		Where("is_shared = ? AND status = ?", true, "completed").
		Order("created_at desc").
		Find(&list).Error
	if err != nil {
		return nil, fmt.Errorf("get shared subtitle topics: %w", err)
	}
	return list, nil
}

func (s *gormStore) ToggleShareTopic(ctx context.Context, id, userID uint, isShared bool) error {
	err := s.db.WithContext(ctx).
		Model(&SubtitleTopic{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("is_shared", isShared).Error
	if err != nil {
		return fmt.Errorf("toggle share subtitle topic: %w", err)
	}
	return nil
}

func (s *gormStore) ResetStuckChunks(ctx context.Context, topicID uint) error {
	err := s.db.WithContext(ctx).
		Model(&SubtitleChunk{}).
		Where("topic_id = ? AND status = ?", topicID, "processing").
		Update("status", "pending").Error
	if err != nil {
		return fmt.Errorf("reset stuck chunks: %w", err)
	}
	return nil
}
