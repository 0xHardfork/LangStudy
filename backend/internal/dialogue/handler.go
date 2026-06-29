package dialogue

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/0xHardfork/langstudy/platform/auth"
	"github.com/0xHardfork/langstudy/platform/response"
	"github.com/0xHardfork/langstudy/platform/validator"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) GetTopics(c *gin.Context) {
	types, err := h.svc.GetTopics(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, types)
}

func (h *Handler) GetSharedDialogue(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
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

func (h *Handler) GetActiveDialogue(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
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

func (h *Handler) Generate(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req GenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, validator.Translate(err))
		return
	}

	d, err := h.svc.GenerateDialogue(c.Request.Context(), userID, &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, d)
}

func (h *Handler) RegenerateDialogue(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req RegenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, validator.Translate(err))
		return
	}

	d, err := h.svc.RegenerateDialogue(c.Request.Context(), userID, &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, d)
}

func (h *Handler) UpdateProgress(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
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
		response.Fail(c, http.StatusBadRequest, validator.Translate(err))
		return
	}

	if err := h.svc.UpdateProgress(c.Request.Context(), userID, uint(dialogueID), req.CurrentLineIndex, req.IsCompleted); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) GetDialogue(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
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

func (h *Handler) ListDialogues(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
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

func (h *Handler) ListTopics(c *gin.Context) {
	types, err := h.svc.ListTopics(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, types)
}

func (h *Handler) AdminList(c *gin.Context) {
	h.ListTopics(c)
}

func (h *Handler) AdminCreate(c *gin.Context) {
	var req CreateTopicRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, validator.Translate(err))
		return
	}
	dt, err := h.svc.CreateTopic(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, dt)
}

func (h *Handler) AdminUpdate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid id")
		return
	}
	var req UpdateTopicRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, validator.Translate(err))
		return
	}
	dt, err := h.svc.UpdateTopic(c.Request.Context(), uint(id), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, dt)
}

func (h *Handler) RejectDialogue(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid dialogue id")
		return
	}

	d, err := h.svc.GetDialogue(c.Request.Context(), uint(id), userID)
	if err != nil {
		response.Fail(c, http.StatusNotFound, "dialogue not found")
		return
	}

	if err := h.svc.RejectDialogue(c.Request.Context(), d.ID); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) AdminDelete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.svc.DeleteTopic(c.Request.Context(), uint(id)); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, gin.H{"deleted": id})
}

func (h *Handler) RegisterRoutes(authed *gin.RouterGroup, admin *gin.RouterGroup) {
	authed.GET("/dialogue/topics", h.GetTopics)
	authed.GET("/dialogue/types", h.ListTopics)
	authed.GET("/dialogue/active", h.GetActiveDialogue)
	authed.GET("/dialogue/shared", h.GetSharedDialogue)
	authed.POST("/dialogue/generate", h.Generate)
	authed.POST("/dialogue/regenerate", h.RegenerateDialogue)
	authed.POST("/dialogue/:id/reject", h.RejectDialogue)
	authed.PUT("/dialogue/:id/progress", h.UpdateProgress)
	authed.GET("/dialogue/:id", h.GetDialogue)
	authed.GET("/dialogue", h.ListDialogues)

	admin.GET("/dialogue-types", h.AdminList)
	admin.POST("/dialogue-types", h.AdminCreate)
	admin.PUT("/dialogue-types/:id", h.AdminUpdate)
	admin.DELETE("/dialogue-types/:id", h.AdminDelete)
}
