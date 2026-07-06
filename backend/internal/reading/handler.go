package reading

import (
	"net/http"
	"strconv"

	"github.com/0xHardfork/langstudy/platform/auth"
	"github.com/0xHardfork/langstudy/platform/response"
	"github.com/0xHardfork/langstudy/platform/validator"
	"github.com/gin-gonic/gin"
)

// Handler handles HTTP requests for reading study.
type Handler struct {
	svc Service
}

// NewHandler creates a new reading Handler.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// Analyze handles text splitting and LLM parsing requests.
func (h *Handler) Analyze(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req AnalyzeReadingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, validator.Translate(err))
		return
	}

	art, err := h.svc.AnalyzeText(c.Request.Context(), userID, &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, art)
}

// GetHistory returns the user's previously analyzed articles.
func (h *Handler) GetHistory(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	list, err := h.svc.GetHistory(c.Request.Context(), userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, list)
}

// GetArticle returns a single article and its parsed sentences.
func (h *Handler) GetArticle(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid article id")
		return
	}

	art, err := h.svc.GetArticle(c.Request.Context(), uint(id), userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	if art == nil {
		response.Fail(c, http.StatusNotFound, "article not found")
		return
	}
	response.Success(c, http.StatusOK, art)
}

// RegenerateSentence handles AI re-analysis for a single failed/imprecise sentence.
func (h *Handler) RegenerateSentence(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid sentence id")
		return
	}

	updatedSent, err := h.svc.RegenerateSentence(c.Request.Context(), userID, uint(id))
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, updatedSent)
}

// RegisterRoutes sets up routes under the authorized router group.
func (h *Handler) RegisterRoutes(authed *gin.RouterGroup) {
	authed.POST("/reading/analyze", h.Analyze)
	authed.GET("/reading/history", h.GetHistory)
	authed.GET("/reading/article/:id", h.GetArticle)
	authed.POST("/reading/sentence/:id/regenerate", h.RegenerateSentence)
}
