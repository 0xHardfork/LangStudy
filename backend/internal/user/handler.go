package user

import (
	"net/http"
	"strconv"

	"github.com/0xHardfork/langstudy/platform/response"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
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
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	token, err := h.svc.Login(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}

	response.Success(c, http.StatusOK, gin.H{"token": token})
}

func (h *Handler) GetProfile(c *gin.Context) {
	raw, exists := c.Get("userID")
	if !exists {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	userID, ok := raw.(uint)
	if !ok {
		response.Fail(c, http.StatusInternalServerError, "invalid user id type")
		return
	}

	profile, err := h.svc.GetProfile(c.Request.Context(), userID)
	if err != nil {
		response.Fail(c, http.StatusNotFound, err.Error())
		return
	}

	response.Success(c, http.StatusOK, profile)
}

func (h *Handler) CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.svc.CreateUser(c.Request.Context(), &req); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, http.StatusCreated, nil)
}

func (h *Handler) DeleteUser(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
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

func (h *Handler) ListUsers(c *gin.Context) {
	offsetStr := c.DefaultQuery("offset", "0")
	limitStr := c.DefaultQuery("limit", "100")

	offset, err := strconv.Atoi(offsetStr)
	if err != nil {
		offset = 0
	}
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		limit = 100
	}

	users, err := h.svc.ListUsers(c.Request.Context(), offset, limit)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, http.StatusOK, users)
}

