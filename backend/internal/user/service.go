package user

import (
	"context"
	"crypto/rand"
	"encoding/hex"
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
	Login(ctx context.Context, req *LoginRequest, clientType string) (string, string, *ProfileResponse, error)
	Refresh(ctx context.Context, refreshToken string, clientType string) (string, string, error)
	GetProfile(ctx context.Context, userID uint) (*ProfileResponse, error)
	CreateUser(ctx context.Context, req *CreateUserRequest) error
	DeleteUser(ctx context.Context, id uint) error
	ListUsers(ctx context.Context, offset, limit int) ([]*ProfileResponse, error)
	ChangePassword(ctx context.Context, userID uint, req *ChangePasswordRequest) error
	ApproveUser(ctx context.Context, id uint) error

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
		Username:   req.Username,
		Password:   string(hashed),
		Role:       "user",
		IsApproved: false,
	}

	if err := s.store.Create(ctx, u); err != nil {
		return fmt.Errorf("register: %w", err)
	}

	return nil
}

func (s *service) Login(ctx context.Context, req *LoginRequest, clientType string) (string, string, *ProfileResponse, error) {
	u, err := s.store.GetByUsername(ctx, req.Username)
	if err != nil {
		return "", "", nil, fmt.Errorf("invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(req.Password)); err != nil {
		return "", "", nil, fmt.Errorf("invalid credentials")
	}

	if u.Role != "admin" && !u.IsApproved {
		return "", "", nil, fmt.Errorf("您的账号正在审核中，请联系管理员审核后再试")
	}

	// 1. Generate Access Token (30 mins default)
	accessClaims := jwt.MapClaims{
		"user_id": u.ID,
		"role":    u.Role,
		"exp":     time.Now().Add(time.Duration(s.cfg.JWT.AccessTokenExpireMinutes) * time.Minute).Unix(),
	}
	accessTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessToken, err := accessTokenObj.SignedString([]byte(s.cfg.JWT.Secret))
	if err != nil {
		return "", "", nil, fmt.Errorf("sign access token: %w", err)
	}

	// 2. Generate Refresh Token
	refreshToken, err := generateRandomHex(32)
	if err != nil {
		return "", "", nil, fmt.Errorf("generate refresh token: %w", err)
	}

	// 3. Store Refresh Token in Redis
	key := fmt.Sprintf("refresh_token:%s", refreshToken)
	tokenData := map[string]interface{}{
		"user_id": u.ID,
		"role":    u.Role,
	}
	valBytes, err := json.Marshal(tokenData)
	if err != nil {
		return "", "", nil, fmt.Errorf("marshal token data: %w", err)
	}

	var ttl time.Duration
	if clientType == "app" {
		ttl = time.Duration(s.cfg.JWT.RefreshExpireHoursApp) * time.Hour
	} else {
		ttl = time.Duration(s.cfg.JWT.RefreshExpireHoursWeb) * time.Hour
	}

	if err := s.rdb.Set(ctx, key, valBytes, ttl).Err(); err != nil {
		return "", "", nil, fmt.Errorf("store refresh token: %w", err)
	}

	return accessToken, refreshToken, &ProfileResponse{
		ID:         u.ID,
		Username:   u.Username,
		Role:       u.Role,
		IsApproved: u.IsApproved,
		CreatedAt:  u.CreatedAt,
	}, nil
}

func (s *service) GetProfile(ctx context.Context, userID uint) (*ProfileResponse, error) {
	u, err := s.store.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &ProfileResponse{
		ID:         u.ID,
		Username:   u.Username,
		Role:       u.Role,
		IsApproved: u.IsApproved,
		CreatedAt:  u.CreatedAt,
	}, nil
}

func (s *service) CreateUser(ctx context.Context, req *CreateUserRequest) error {
	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	u := &User{
		Username:   req.Username,
		Password:   string(hashed),
		Role:       req.Role,
		IsApproved: true,
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
			ID:         u.ID,
			Username:   u.Username,
			Role:       u.Role,
			IsApproved: u.IsApproved,
			CreatedAt:  u.CreatedAt,
		}
	}
	return resp, nil
}

func (s *service) ApproveUser(ctx context.Context, id uint) error {
	u, err := s.store.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}
	u.IsApproved = true
	return s.store.Update(ctx, u)
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

func (s *service) ChangePassword(ctx context.Context, userID uint, req *ChangePasswordRequest) error {
	u, err := s.store.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(req.OldPassword)); err != nil {
		return fmt.Errorf("incorrect old password")
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	u.Password = string(hashed)
	return s.store.Update(ctx, u)
}

func (s *service) Refresh(ctx context.Context, oldRefreshToken string, clientType string) (string, string, error) {
	key := fmt.Sprintf("refresh_token:%s", oldRefreshToken)
	val, err := s.rdb.Get(ctx, key).Result()
	if err != nil {
		return "", "", fmt.Errorf("invalid or expired refresh token")
	}

	var data struct {
		UserID uint   `json:"user_id"`
		Role   string `json:"role"`
	}
	if err := json.Unmarshal([]byte(val), &data); err != nil {
		return "", "", fmt.Errorf("decode token data: %w", err)
	}

	// Generate new access token (30 mins default)
	accessClaims := jwt.MapClaims{
		"user_id": data.UserID,
		"role":    data.Role,
		"exp":     time.Now().Add(time.Duration(s.cfg.JWT.AccessTokenExpireMinutes) * time.Minute).Unix(),
	}
	accessTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	newAccessToken, err := accessTokenObj.SignedString([]byte(s.cfg.JWT.Secret))
	if err != nil {
		return "", "", fmt.Errorf("sign access token: %w", err)
	}

	// Generate new refresh token
	newRefreshToken, err := generateRandomHex(32)
	if err != nil {
		return "", "", fmt.Errorf("generate refresh token: %w", err)
	}

	// Store new refresh token
	newKey := fmt.Sprintf("refresh_token:%s", newRefreshToken)
	var ttl time.Duration
	if clientType == "app" {
		ttl = time.Duration(s.cfg.JWT.RefreshExpireHoursApp) * time.Hour
	} else {
		ttl = time.Duration(s.cfg.JWT.RefreshExpireHoursWeb) * time.Hour
	}

	if err := s.rdb.Set(ctx, newKey, val, ttl).Err(); err != nil {
		return "", "", fmt.Errorf("store new refresh token: %w", err)
	}

	// Delete old refresh token
	s.rdb.Del(ctx, key)

	return newAccessToken, newRefreshToken, nil
}

func generateRandomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
