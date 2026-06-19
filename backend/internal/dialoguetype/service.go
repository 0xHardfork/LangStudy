package dialoguetype

import "context"

// Service defines the business logic for dialogue types.
type Service interface {
	List(ctx context.Context) ([]DialogueType, error)
	GetByName(ctx context.Context, name string) (*DialogueType, error)
	Create(ctx context.Context, req *CreateRequest) (*DialogueType, error)
	Update(ctx context.Context, id uint, req *UpdateRequest) (*DialogueType, error)
	Delete(ctx context.Context, id uint) error
}

type service struct {
	store Store
}

// NewService creates a new Service.
func NewService(store Store) Service {
	return &service{store: store}
}

func (s *service) List(ctx context.Context) ([]DialogueType, error) {
	return s.store.List(ctx)
}

func (s *service) GetByName(ctx context.Context, name string) (*DialogueType, error) {
	return s.store.GetByName(ctx, name)
}

func (s *service) Create(ctx context.Context, req *CreateRequest) (*DialogueType, error) {
	emoji := req.Emoji
	if emoji == "" {
		emoji = "💬"
	}
	dt := &DialogueType{
		Name:        req.Name,
		Description: req.Description,
		Emoji:       emoji,
		SortOrder:   req.SortOrder,
	}
	if err := s.store.Create(ctx, dt); err != nil {
		return nil, err
	}
	return dt, nil
}

func (s *service) Update(ctx context.Context, id uint, req *UpdateRequest) (*DialogueType, error) {
	emoji := req.Emoji
	if emoji == "" {
		emoji = "💬"
	}
	dt := &DialogueType{
		ID:          id,
		Name:        req.Name,
		Description: req.Description,
		Emoji:       emoji,
		SortOrder:   req.SortOrder,
	}
	if err := s.store.Update(ctx, dt); err != nil {
		return nil, err
	}
	return dt, nil
}

func (s *service) Delete(ctx context.Context, id uint) error {
	return s.store.Delete(ctx, id)
}
