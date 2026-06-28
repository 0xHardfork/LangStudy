package grammar

import (
	"net/http"
	"strconv"

	"github.com/0xHardfork/langstudy/platform/response"
	"github.com/gin-gonic/gin"
)

// Handler handles HTTP requests for the grammar analysis and practice features.
type Handler struct {
	svc Service
}

// NewHandler creates a new grammar Handler.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// Analyze handles POST /api/v1/grammar/analyze
func (h *Handler) Analyze(c *gin.Context) {
	userID, err := currentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req AnalyzeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	art, err := h.svc.AnalyzeText(c.Request.Context(), userID, &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, art)
}

// GetHistory handles GET /api/v1/grammar/history
func (h *Handler) GetHistory(c *gin.Context) {
	_, err := currentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	list, err := h.svc.GetHistory(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, list)
}

// GetArticle handles GET /api/v1/grammar/article/:id
func (h *Handler) GetArticle(c *gin.Context) {
	_, err := currentUserID(c)
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

	art, err := h.svc.GetArticle(c.Request.Context(), uint(id))
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

// SubmitAnswer handles POST /api/v1/grammar/quiz/answer
func (h *Handler) SubmitAnswer(c *gin.Context) {
	userID, err := currentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req SubmitQuizAnswerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.svc.RecordAnswer(c.Request.Context(), userID, &req); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, gin.H{"recorded": true})
}

// GetDueReviews handles GET /api/v1/grammar/reviews/due
func (h *Handler) GetDueReviews(c *gin.Context) {
	userID, err := currentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	list, err := h.svc.GetDueReviews(c.Request.Context(), userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, list)
}

// RegenerateSentence handles POST /api/v1/grammar/sentence/:id/regenerate
func (h *Handler) RegenerateSentence(c *gin.Context) {
	_, err := currentUserID(c)
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

	updatedSent, err := h.svc.RegenerateSentence(c.Request.Context(), uint(id))
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, updatedSent)
}

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
