package llmconfig

import (
	"net/http"

	"github.com/0xHardfork/langstudy/platform/response"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) GetConfig(c *gin.Context) {
	cfg, err := h.svc.GetConfig(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, cfg)
}

func (h *Handler) UpdateConfig(c *gin.Context) {
	var req UpdateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	cfg, err := h.svc.UpdateConfig(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, http.StatusOK, cfg)
}
