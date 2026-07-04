package user

import (
	"net/http"
	"strconv"

	"github.com/0xHardfork/langstudy/platform/auth"
	"github.com/0xHardfork/langstudy/platform/config"
	"github.com/0xHardfork/langstudy/platform/response"
	"github.com/0xHardfork/langstudy/platform/validator"
	"github.com/gin-gonic/gin"
	"github.com/mojocn/base64Captcha"
)

type Handler struct {
	svc Service
	cfg *config.Config
}

func NewHandler(svc Service, cfg *config.Config) *Handler {
	return &Handler{svc: svc, cfg: cfg}
}

func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, validator.Translate(err))
		return
	}

	// Verify Captcha
	if !base64Captcha.DefaultMemStore.Verify(req.CaptchaID, req.CaptchaCode, true) {
		response.Fail(c, http.StatusBadRequest, "验证码错误或已过期")
		return
	}

	if err := h.svc.Register(c.Request.Context(), &req); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, http.StatusCreated, nil)
}

func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, validator.Translate(err))
		return
	}

	// Verify Captcha
	if !base64Captcha.DefaultMemStore.Verify(req.CaptchaID, req.CaptchaCode, true) {
		response.Fail(c, http.StatusBadRequest, "验证码错误或已过期")
		return
	}

	clientType := c.GetHeader("X-Client-Type")
	if clientType == "" {
		clientType = "web"
	}

	accessToken, refreshToken, prof, err := h.svc.Login(c.Request.Context(), &req, clientType)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}

	var accessMaxAge = 1800 // 30 mins
	var refreshMaxAge int
	if clientType == "app" {
		refreshMaxAge = 180 * 24 * 3600 // 6 months
	} else {
		refreshMaxAge = 24 * 3600 // 24 hours
	}

	c.SetCookie("token", accessToken, accessMaxAge, "/", "", false, true)
	c.SetCookie("refresh_token", refreshToken, refreshMaxAge, "/", "", false, true)

	if clientType == "app" {
		response.Success(c, http.StatusOK, gin.H{
			"token":         accessToken,
			"refresh_token": refreshToken,
			"user":          prof,
		})
	} else {
		response.Success(c, http.StatusOK, prof)
	}
}

func (h *Handler) GetCaptcha(c *gin.Context) {
	driver := base64Captcha.NewDriverDigit(80, 240, 4, 0.7, 80)
	capObj := base64Captcha.NewCaptcha(driver, base64Captcha.DefaultMemStore)
	id, b64s, _, err := capObj.Generate()
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "生成验证码失败: "+err.Error())
		return
	}

	response.Success(c, http.StatusOK, gin.H{
		"captcha_id":    id,
		"captcha_image": b64s,
	})
}

func (h *Handler) Logout(c *gin.Context) {
	c.SetCookie("token", "", -1, "/", "", false, true)
	c.SetCookie("refresh_token", "", -1, "/", "", false, true)
	response.Success(c, http.StatusOK, nil)
}

func (h *Handler) Refresh(c *gin.Context) {
	clientType := c.GetHeader("X-Client-Type")
	if clientType == "" {
		clientType = "web"
	}

	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	_ = c.ShouldBindJSON(&req) // Ignore bind error, could be in cookie

	refreshToken := req.RefreshToken
	if refreshToken == "" {
		cookie, err := c.Cookie("refresh_token")
		if err == nil {
			refreshToken = cookie
		}
	}

	if refreshToken == "" {
		response.Fail(c, http.StatusBadRequest, "refresh token is required")
		return
	}

	accessToken, newRefreshToken, err := h.svc.Refresh(c.Request.Context(), refreshToken, clientType)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}

	var accessMaxAge = 1800 // 30 mins
	var refreshMaxAge int
	if clientType == "app" {
		refreshMaxAge = 180 * 24 * 3600 // 6 months
	} else {
		refreshMaxAge = 24 * 3600 // 24 hours
	}

	c.SetCookie("token", accessToken, accessMaxAge, "/", "", false, true)
	c.SetCookie("refresh_token", newRefreshToken, refreshMaxAge, "/", "", false, true)

	response.Success(c, http.StatusOK, gin.H{
		"token":         accessToken,
		"refresh_token": newRefreshToken,
	})
}

func (h *Handler) GetProfile(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	prof, err := h.svc.GetProfile(c.Request.Context(), userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, prof)
}

func (h *Handler) CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, validator.Translate(err))
		return
	}

	if err := h.svc.CreateUser(c.Request.Context(), &req); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, http.StatusCreated, nil)
}

func (h *Handler) DeleteUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid user id")
		return
	}

	if err := h.svc.DeleteUser(c.Request.Context(), uint(id)); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, http.StatusOK, nil)
}

func (h *Handler) ApproveUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid user id")
		return
	}

	if err := h.svc.ApproveUser(c.Request.Context(), uint(id)); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, http.StatusOK, nil)
}

func (h *Handler) ListUsers(c *gin.Context) {
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("page_size", "20")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize < 1 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize

	list, err := h.svc.ListUsers(c.Request.Context(), offset, pageSize)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, http.StatusOK, list)
}

func (h *Handler) GetLearningProfile(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	profile, err := h.svc.GetLearningProfile(c.Request.Context(), userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, profile)
}

func (h *Handler) UpsertLearningProfile(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req UpsertProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, validator.Translate(err))
		return
	}

	profile, err := h.svc.UpsertLearningProfile(c.Request.Context(), userID, &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, profile)
}

func (h *Handler) ChangePassword(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, validator.Translate(err))
		return
	}

	if err := h.svc.ChangePassword(c.Request.Context(), userID, &req); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, http.StatusOK, gin.H{"ok": true})
}


func (h *Handler) RegisterRoutes(public *gin.RouterGroup, authed *gin.RouterGroup, admin *gin.RouterGroup) {
	public.POST("/register", h.Register)
	public.POST("/login", h.Login)
	public.POST("/logout", h.Logout)
	public.POST("/refresh", h.Refresh)
	public.GET("/captcha", h.GetCaptcha)

	authed.GET("/profile", h.GetProfile)
	authed.GET("/me/profile", h.GetLearningProfile)
	authed.PUT("/me/profile", h.UpsertLearningProfile)
	authed.PUT("/me/password", h.ChangePassword)

	admin.GET("/users", h.ListUsers)
	admin.POST("/users", h.CreateUser)
	admin.DELETE("/users/:id", h.DeleteUser)
	admin.PUT("/users/:id/approve", h.ApproveUser)
}
