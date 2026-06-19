package dialoguetype

import (
	"net/http"
	"strconv"

	"github.com/0xHardfork/langstudy/platform/response"
	"github.com/gin-gonic/gin"
)

// Handler handles HTTP requests for dialogue type operations.
type Handler struct {
	svc Service
}

// NewHandler creates a new Handler.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// List handles GET /api/v1/dialogue/types (public, authenticated)
func (h *Handler) List(c *gin.Context) {
	types, err := h.svc.List(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, types)
}

// AdminList handles GET /api/v1/admin/dialogue-types
func (h *Handler) AdminList(c *gin.Context) {
	h.List(c)
}

// AdminCreate handles POST /api/v1/admin/dialogue-types
func (h *Handler) AdminCreate(c *gin.Context) {
	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	dt, err := h.svc.Create(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, dt)
}

// AdminUpdate handles PUT /api/v1/admin/dialogue-types/:id
func (h *Handler) AdminUpdate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid id")
		return
	}
	var req UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	dt, err := h.svc.Update(c.Request.Context(), uint(id), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, dt)
}

// AdminDelete handles DELETE /api/v1/admin/dialogue-types/:id
func (h *Handler) AdminDelete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.svc.Delete(c.Request.Context(), uint(id)); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, gin.H{"deleted": id})
}
