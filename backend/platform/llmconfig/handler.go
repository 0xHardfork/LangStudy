package llmconfig

import (
	"net/http"

	"github.com/0xHardfork/langstudy/platform/llm"
	"github.com/0xHardfork/langstudy/platform/response"
	"github.com/0xHardfork/langstudy/platform/validator"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc    Service
	llmCli *llm.Client
}

func NewHandler(svc Service, llmCli *llm.Client) *Handler {
	return &Handler{svc: svc, llmCli: llmCli}
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
		response.Fail(c, http.StatusBadRequest, validator.Translate(err))
		return
	}

	cfg, err := h.svc.UpdateConfig(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, http.StatusOK, cfg)
}

func (h *Handler) TestConfig(c *gin.Context) {
	var req TestConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, validator.Translate(err))
		return
	}

	// Send a quick test prompt to verify connectivity and authentication
	testPrompt := "Say OK"
	respText, err := h.llmCli.Call(c.Request.Context(), req.ApiUrl, req.ApiKey, req.ModelName, testPrompt)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c, http.StatusOK, gin.H{
		"ok":       true,
		"response": respText,
	})
}

func (h *Handler) RegisterRoutes(admin *gin.RouterGroup) {
	admin.GET("/llm-config", h.GetConfig)
	admin.PUT("/llm-config", h.UpdateConfig)
	admin.POST("/llm-config/test", h.TestConfig)
}
