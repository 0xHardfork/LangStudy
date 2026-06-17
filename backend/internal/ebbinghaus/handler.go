package ebbinghaus

import (
	"net/http"

	"github.com/0xHardfork/langstudy/platform/response"
	"github.com/gin-gonic/gin"
)

// Handler handles HTTP requests for spaced repetition reviews.
type Handler struct {
	svc Service
}

// NewHandler creates a new Handler.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// GetDueReviews handles GET /api/v1/reviews/due
func (h *Handler) GetDueReviews(c *gin.Context) {
	userID, err := currentUserID(c)
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

// SubmitAnswer handles POST /api/v1/reviews/answer
func (h *Handler) SubmitAnswer(c *gin.Context) {
	userID, err := currentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req SubmitAnswerRequest
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
