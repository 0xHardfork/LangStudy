package grammar

import (
	"net/http"
	"strconv"

	"github.com/0xHardfork/langstudy/platform/auth"
	"github.com/0xHardfork/langstudy/platform/response"
	"github.com/0xHardfork/langstudy/platform/validator"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Analyze(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req AnalyzeRequest
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

func (h *Handler) SubmitAnswer(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req SubmitQuizAnswerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, validator.Translate(err))
		return
	}

	if err := h.svc.RecordAnswer(c.Request.Context(), userID, &req); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, gin.H{"recorded": true})
}

func (h *Handler) GetDueReviews(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
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

func (h *Handler) RegisterRoutes(authed *gin.RouterGroup) {
	authed.POST("/grammar/analyze", h.Analyze)
	authed.GET("/grammar/history", h.GetHistory)
	authed.GET("/grammar/article/:id", h.GetArticle)
	authed.POST("/grammar/quiz/answer", h.SubmitAnswer)
	authed.GET("/grammar/reviews/due", h.GetDueReviews)
	authed.POST("/grammar/sentence/:id/regenerate", h.RegenerateSentence)
}
