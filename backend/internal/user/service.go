package user

import (
	"context"
	"fmt"
	"time"

	"github.com/0xHardfork/langstudy/platform/config"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type Service interface {
	Register(ctx context.Context, req *RegisterRequest) error
	Login(ctx context.Context, req *LoginRequest) (string, error)
	GetProfile(ctx context.Context, userID uint) (*ProfileResponse, error)
	CreateUser(ctx context.Context, req *CreateUserRequest) error
	DeleteUser(ctx context.Context, id uint) error
	ListUsers(ctx context.Context, offset, limit int) ([]*ProfileResponse, error)
}

type service struct {
	store Store
	cfg   *config.Config
}

func NewService(store Store, cfg *config.Config) Service {
	return &service{store: store, cfg: cfg}
}

func (s *service) Register(ctx context.Context, req *RegisterRequest) error {
	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	u := &User{
		Username: req.Username,
		Password: string(hashed),
		Role:     "user",
	}

	if err := s.store.Create(ctx, u); err != nil {
		return fmt.Errorf("register: %w", err)
	}

	return nil
}

func (s *service) Login(ctx context.Context, req *LoginRequest) (string, error) {
	u, err := s.store.GetByUsername(ctx, req.Username)
	if err != nil {
		return "", fmt.Errorf("user not found: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(req.Password)); err != nil {
		return "", fmt.Errorf("invalid credentials")
	}

	claims := jwt.MapClaims{
		"user_id": u.ID,
		"exp":     time.Now().Add(time.Duration(s.cfg.JWT.ExpireHours) * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	signed, err := token.SignedString([]byte(s.cfg.JWT.Secret))
	if err != nil {
		return "", fmt.Errorf("sign token: %w", err)
	}

	return signed, nil
}

func (s *service) GetProfile(ctx context.Context, userID uint) (*ProfileResponse, error) {
	u, err := s.store.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get profile: %w", err)
	}

	return &ProfileResponse{
		ID:        u.ID,
		Username:  u.Username,
		Role:      u.Role,
		CreatedAt: u.CreatedAt,
	}, nil
}

func (s *service) CreateUser(ctx context.Context, req *CreateUserRequest) error {
	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	u := &User{
		Username: req.Username,
		Password: string(hashed),
		Role:     req.Role,
	}

	return s.store.Create(ctx, u)
}

func (s *service) DeleteUser(ctx context.Context, id uint) error {
	return s.store.Delete(ctx, id)
}

func (s *service) ListUsers(ctx context.Context, offset, limit int) ([]*ProfileResponse, error) {
	users, err := s.store.List(ctx, offset, limit)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}

	resp := make([]*ProfileResponse, len(users))
	for i, u := range users {
		resp[i] = &ProfileResponse{
			ID:        u.ID,
			Username:  u.Username,
			Role:      u.Role,
			CreatedAt: u.CreatedAt,
		}
	}
	return resp, nil
}

