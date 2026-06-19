package dialogue

import (
	"net/http"
	"strconv"

	"github.com/0xHardfork/langstudy/platform/response"
	"github.com/gin-gonic/gin"
)

// Handler handles HTTP requests for dialogue operations.
type Handler struct {
	svc Service
}

// NewHandler creates a new Handler.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// GetTopics handles GET /api/v1/dialogue/topics
func (h *Handler) GetTopics(c *gin.Context) {
	types, err := h.svc.GetTopics(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, types)
}

// Generate handles POST /api/v1/dialogue/generate
func (h *Handler) Generate(c *gin.Context) {
	userID, err := currentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req GenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	d, err := h.svc.GenerateDialogue(c.Request.Context(), userID, &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, d)
}

// GetDialogue handles GET /api/v1/dialogue/:id
func (h *Handler) GetDialogue(c *gin.Context) {
	userID, err := currentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid id")
		return
	}

	d, err := h.svc.GetDialogue(c.Request.Context(), uint(id), userID)
	if err != nil {
		response.Fail(c, http.StatusNotFound, err.Error())
		return
	}
	response.Success(c, http.StatusOK, d)
}

// ListDialogues handles GET /api/v1/dialogue
func (h *Handler) ListDialogues(c *gin.Context) {
	userID, err := currentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	dialogues, err := h.svc.ListDialogues(c.Request.Context(), userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, dialogues)
}

// currentUserID extracts the authenticated user's ID (uint) set by JWTMiddleware.
func currentUserID(c *gin.Context) (uint, error) {
	raw, exists := c.Get("userID")
	if !exists {
		return 0, http.ErrNoCookie
	}
	id, ok := raw.(uint)
	if !ok {
		return 0, http.ErrNoCookie
	}
	return id, nil
}
