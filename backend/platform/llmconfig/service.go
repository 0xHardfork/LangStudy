package llmconfig

import (
	"context"
	"fmt"
)

type Service interface {
	GetConfig(ctx context.Context) (*LLMConfig, error)
	UpdateConfig(ctx context.Context, req *UpdateConfigRequest) (*LLMConfig, error)
}

type service struct {
	store Store
}

func NewService(store Store) Service {
	return &service{store: store}
}

func (s *service) GetConfig(ctx context.Context) (*LLMConfig, error) {
	return s.store.Get(ctx)
}

func (s *service) UpdateConfig(ctx context.Context, req *UpdateConfigRequest) (*LLMConfig, error) {
	cfg, err := s.store.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetch existing config: %w", err)
	}

	cfg.ApiUrl = req.ApiUrl
	cfg.ApiKey = req.ApiKey
	cfg.ModelName = req.ModelName
	cfg.PromptTpl = req.PromptTpl

	if err := s.store.Update(ctx, cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}
