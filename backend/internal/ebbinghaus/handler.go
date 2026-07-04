package ebbinghaus

import (
	"net/http"

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

func (h *Handler) GetDueReviews(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	reviews, err := h.svc.GetDueReviews(c.Request.Context(), userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, reviews)
}

func (h *Handler) GetReviewSchedule(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	reviews, err := h.svc.GetReviewSchedule(c.Request.Context(), userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, reviews)
}

func (h *Handler) SubmitAnswer(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req SubmitAnswerRequest
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

func (h *Handler) RegisterRoutes(authed *gin.RouterGroup) {
	authed.GET("/reviews/due", h.GetDueReviews)
	authed.GET("/reviews/schedule", h.GetReviewSchedule)
	authed.POST("/reviews/answer", h.SubmitAnswer)
}
