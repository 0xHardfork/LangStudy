package subtitle

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/0xHardfork/langstudy/platform/auth"
	"github.com/0xHardfork/langstudy/platform/response"
	"github.com/gin-gonic/gin"
)

// Handler handles HTTP requests for subtitle features.
type Handler struct {
	svc Service
}

// NewHandler creates a new subtitle Handler.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// Upload handles uploading a subtitle file and dividing it into chunks.
func (h *Handler) Upload(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "file parameter is required")
		return
	}

	title := c.PostForm("title")
	if strings.TrimSpace(title) == "" {
		title = file.Filename
	}

	targetLang := c.PostForm("target_language")
	if targetLang == "" {
		targetLang = "en"
	}

	nativeLang := c.PostForm("native_language")
	if nativeLang == "" {
		nativeLang = "zh"
	}

	src, err := file.Open()
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "failed to open uploaded file")
		return
	}
	defer src.Close()

	contentBytes, err := io.ReadAll(src)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "failed to read uploaded file")
		return
	}

	topic, err := h.svc.ProcessSubtitle(c.Request.Context(), userID, file.Filename, title, targetLang, nativeLang, contentBytes)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	_ = h.svc.StartTopicProcessing(userID, topic.ID)

	response.Success(c, http.StatusOK, topic)
}

// ProcessChunk triggers translation and analysis for a single subtitle chunk.
func (h *Handler) ProcessChunk(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := c.Param("id")
	chunkID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid chunk id")
		return
	}

	err = h.svc.ProcessChunk(c.Request.Context(), userID, uint(chunkID))
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, http.StatusOK, gin.H{"ok": true})
}

// ProcessTopic triggers background queue processing of chunks for a topic.
func (h *Handler) ProcessTopic(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := c.Param("id")
	topicID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid topic id")
		return
	}

	err = h.svc.StartTopicProcessing(userID, uint(topicID))
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, http.StatusOK, gin.H{"ok": true})
}

// MergeTopic marks the subtitle topic status as completed once all chunks succeeded.
func (h *Handler) MergeTopic(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := c.Param("id")
	topicID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid topic id")
		return
	}

	err = h.svc.MergeTopic(c.Request.Context(), uint(topicID), userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, http.StatusOK, gin.H{"ok": true})
}

// GetHistory returns the user's previously analyzed subtitle topics.
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

// GetTopic returns details of a single subtitle topic.
func (h *Handler) GetTopic(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid topic id")
		return
	}

	topic, err := h.svc.GetTopic(c.Request.Context(), uint(id), userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	if topic == nil {
		response.Fail(c, http.StatusNotFound, "subtitle topic not found")
		return
	}
	response.Success(c, http.StatusOK, topic)
}

// RegenerateSentence handles AI re-analysis for a single sentence.
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

// DeleteTopic handles deleting a subtitle topic.
func (h *Handler) DeleteTopic(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid topic id")
		return
	}

	err = h.svc.DeleteTopic(c.Request.Context(), uint(id), userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, gin.H{"ok": true})
}

// DownloadLearning handles downloading the learning-language subtitle file.
func (h *Handler) DownloadLearning(c *gin.Context) {
	h.downloadFile(c, "learning")
}

// DownloadBilingual handles downloading the bilingual subtitle file.
func (h *Handler) DownloadBilingual(c *gin.Context) {
	h.downloadFile(c, "bilingual")
}

func (h *Handler) downloadFile(c *gin.Context, langType string) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		c.String(http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.String(http.StatusBadRequest, "invalid topic id")
		return
	}

	topic, err := h.svc.GetTopic(c.Request.Context(), uint(id), userID)
	if err != nil {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	if topic == nil {
		c.String(http.StatusNotFound, "subtitle topic not found")
		return
	}

	if topic.Status != "completed" {
		c.String(http.StatusBadRequest, "subtitle analysis has not completed yet")
		return
	}

	var sb strings.Builder
	for _, b := range topic.Blocks {
		sb.WriteString(fmt.Sprintf("%d\n", b.BlockIndex))
		sb.WriteString(fmt.Sprintf("%s --> %s\n", b.StartTime, b.EndTime))
		if langType == "learning" {
			sb.WriteString(fmt.Sprintf("%s\n\n", b.TargetText))
		} else {
			sb.WriteString(fmt.Sprintf("%s\n%s\n\n", b.TargetText, b.NativeText))
		}
	}

	filename := fmt.Sprintf("%s_%s.srt", strings.TrimSuffix(topic.OriginalFileName, ".srt"), langType)
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/x-subrip", []byte(sb.String()))
}

// ShareTopic handles sharing a subtitle topic.
func (h *Handler) ShareTopic(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid topic id")
		return
	}

	err = h.svc.ShareTopic(c.Request.Context(), uint(id), userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, gin.H{"ok": true})
}

// UnshareTopic handles unsharing a subtitle topic.
func (h *Handler) UnshareTopic(c *gin.Context) {
	userID, err := auth.CurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid topic id")
		return
	}

	err = h.svc.UnshareTopic(c.Request.Context(), uint(id), userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, gin.H{"ok": true})
}

// GetSharedHistory handles listing public shared subtitles.
func (h *Handler) GetSharedHistory(c *gin.Context) {
	list, err := h.svc.GetSharedHistory(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, list)
}

// RegisterRoutes registers endpoints.
func (h *Handler) RegisterRoutes(authed *gin.RouterGroup) {
	authed.POST("/subtitle/upload", h.Upload)
	authed.GET("/subtitle/history", h.GetHistory)
	authed.GET("/subtitle/shared", h.GetSharedHistory)
	authed.GET("/subtitle/topic/:id", h.GetTopic)
	authed.POST("/subtitle/sentence/:id/regenerate", h.RegenerateSentence)
	authed.DELETE("/subtitle/topic/:id", h.DeleteTopic)
	authed.GET("/subtitle/topic/:id/download/learning", h.DownloadLearning)
	authed.GET("/subtitle/topic/:id/download/bilingual", h.DownloadBilingual)

	authed.POST("/subtitle/chunk/:id/process", h.ProcessChunk)
	authed.POST("/subtitle/topic/:id/process", h.ProcessTopic)
	authed.POST("/subtitle/topic/:id/merge", h.MergeTopic)
	authed.POST("/subtitle/topic/:id/share", h.ShareTopic)
	authed.POST("/subtitle/topic/:id/unshare", h.UnshareTopic)
}
