package dialogue

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/0xHardfork/langstudy/platform/response"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
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

// GetSharedDialogue handles GET /api/v1/dialogue/shared?topic=X&language=Y&level=Z
func (h *Handler) GetSharedDialogue(c *gin.Context) {
	userID, err := currentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	topic := c.Query("topic")
	language := c.Query("language")
	level := c.Query("level")
	if topic == "" || language == "" || level == "" {
		response.Fail(c, http.StatusBadRequest, "topic, language and level are required")
		return
	}
	result, err := h.svc.GetSharedDialogue(c.Request.Context(), topic, language, level, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.Fail(c, http.StatusNotFound, "no shared dialogue found for this topic/language/level")
			return
		}
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, result)
}

// GetActiveDialogue handles GET /api/v1/dialogue/active
func (h *Handler) GetActiveDialogue(c *gin.Context) {
	userID, err := currentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	result, err := h.svc.GetActiveDialogue(c.Request.Context(), userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	if result == nil {
		response.Fail(c, http.StatusNotFound, "no active dialogue")
		return
	}
	response.Success(c, http.StatusOK, result)
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

// RegenerateDialogue handles POST /api/v1/dialogue/regenerate
func (h *Handler) RegenerateDialogue(c *gin.Context) {
	userID, err := currentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req RegenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	d, err := h.svc.RegenerateDialogue(c.Request.Context(), userID, &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, d)
}

// UpdateProgress handles PUT /api/v1/dialogue/:id/progress
func (h *Handler) UpdateProgress(c *gin.Context) {
	userID, err := currentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	dialogueID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid dialogue id")
		return
	}

	var req UpdateProgressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.svc.UpdateProgress(c.Request.Context(), userID, uint(dialogueID), req.CurrentLineIndex, req.IsCompleted); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, gin.H{"ok": true})
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
