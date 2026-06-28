package user

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/0xHardfork/langstudy/platform/config"
	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

type Service interface {
	Register(ctx context.Context, req *RegisterRequest) error
	Login(ctx context.Context, req *LoginRequest) (string, *ProfileResponse, error)
	GetProfile(ctx context.Context, userID uint) (*ProfileResponse, error)
	CreateUser(ctx context.Context, req *CreateUserRequest) error
	DeleteUser(ctx context.Context, id uint) error
	ListUsers(ctx context.Context, offset, limit int) ([]*ProfileResponse, error)

	GetLearningProfile(ctx context.Context, userID uint) (*UserProfile, error)
	UpsertLearningProfile(ctx context.Context, userID uint, req *UpsertProfileRequest) (*UserProfile, error)
}

type service struct {
	store Store
	cfg   *config.Config
	rdb   *redis.Client
}

func NewService(store Store, cfg *config.Config, rdb *redis.Client) Service {
	return &service{
		store: store,
		cfg:   cfg,
		rdb:   rdb,
	}
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

func (s *service) Login(ctx context.Context, req *LoginRequest) (string, *ProfileResponse, error) {
	u, err := s.store.GetByUsername(ctx, req.Username)
	if err != nil {
		return "", nil, fmt.Errorf("invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(req.Password)); err != nil {
		return "", nil, fmt.Errorf("invalid credentials")
	}

	claims := jwt.MapClaims{
		"user_id": u.ID,
		"role":    u.Role,
		"exp":     time.Now().Add(time.Duration(s.cfg.JWT.ExpireHours) * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	signed, err := token.SignedString([]byte(s.cfg.JWT.Secret))
	if err != nil {
		return "", nil, fmt.Errorf("sign token: %w", err)
	}

	return signed, &ProfileResponse{
		ID:        u.ID,
		Username:  u.Username,
		Role:      u.Role,
		CreatedAt: u.CreatedAt,
	}, nil
}

func (s *service) GetProfile(ctx context.Context, userID uint) (*ProfileResponse, error) {
	u, err := s.store.GetByID(ctx, userID)
	if err != nil {
		return nil, err
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
	list, err := s.store.List(ctx, offset, limit)
	if err != nil {
		return nil, err
	}
	resp := make([]*ProfileResponse, len(list))
	for i, u := range list {
		resp[i] = &ProfileResponse{
			ID:        u.ID,
			Username:  u.Username,
			Role:      u.Role,
			CreatedAt: u.CreatedAt,
		}
	}
	return resp, nil
}

func (s *service) GetLearningProfile(ctx context.Context, userID uint) (*UserProfile, error) {
	cacheKey := fmt.Sprintf("profile:%d", userID)
	if val, err := s.rdb.Get(ctx, cacheKey).Result(); err == nil {
		var p UserProfile
		if json.Unmarshal([]byte(val), &p) == nil {
			return &p, nil
		}
	}

	p, err := s.store.GetProfileByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get profile: %w", err)
	}

	if p == nil {
		p = &UserProfile{
			UserID:          userID,
			NativeLanguage:  "zh",
			TargetLanguages: TargetLanguages{},
			FillBlankLevel:  1,
		}
	}

	if valBytes, err := json.Marshal(p); err == nil {
		s.rdb.Set(ctx, cacheKey, valBytes, 24*time.Hour)
	}

	return p, nil
}

func (s *service) UpsertLearningProfile(ctx context.Context, userID uint, req *UpsertProfileRequest) (*UserProfile, error) {
	profile := &UserProfile{
		UserID:          userID,
		Nickname:        req.Nickname,
		NativeLanguage:  req.NativeLanguage,
		TargetLanguages: req.TargetLanguages,
		FillBlankLevel:  req.FillBlankLevel,
	}
	if err := s.store.UpsertProfile(ctx, profile); err != nil {
		return nil, fmt.Errorf("upsert profile: %w", err)
	}

	cacheKey := fmt.Sprintf("profile:%d", userID)
	if valBytes, err := json.Marshal(profile); err == nil {
		s.rdb.Set(ctx, cacheKey, valBytes, 24*time.Hour)
	}

	return profile, nil
}
