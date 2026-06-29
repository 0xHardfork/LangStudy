package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"go.uber.org/zap"
)

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type Request struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
}

type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message"`
	FinishReason string  `json:"finish_reason"`
}

type Response struct {
	Choices []Choice `json:"choices"`
}

type Client struct {
	httpClient *http.Client
	log        *zap.Logger
}

func NewClient(log *zap.Logger) *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
		log: log,
	}
}

func (c *Client) Call(ctx context.Context, apiURL, apiKey, modelName, prompt string) (string, error) {
	var lastErr error
	backoff := 1 * time.Second

	for attempt := 1; attempt <= 3; attempt++ {
		reqBody := Request{
			Model: modelName,
			Messages: []Message{
				{Role: "user", Content: prompt},
			},
		}
		bodyBytes, err := json.Marshal(reqBody)
		if err != nil {
			return "", fmt.Errorf("marshal request: %w", err)
		}

		httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(bodyBytes))
		if err != nil {
			return "", fmt.Errorf("build request: %w", err)
		}
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", "Bearer "+apiKey)

		resp, err := c.httpClient.Do(httpReq)
		if err != nil {
			lastErr = fmt.Errorf("attempt %d failed: %w", attempt, err)
			c.log.Warn("llm call error, retrying", zap.Int("attempt", attempt), zap.Error(err))
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(backoff):
			}
			backoff *= 2
			continue
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()

			// Try to parse OpenAI/Gemini error structure
			var errResp struct {
				Error struct {
					Message string `json:"message"`
				} `json:"error"`
			}
			apiErrorMsg := ""
			if json.Unmarshal(body, &errResp) == nil && errResp.Error.Message != "" {
				apiErrorMsg = errResp.Error.Message
			} else {
				apiErrorMsg = string(body)
			}

			// Map to user-friendly messages in Chinese
			var friendlyErr error
			switch resp.StatusCode {
			case http.StatusUnauthorized:
				friendlyErr = fmt.Errorf("LLM 接口授权失败 (401)：请检查您的 API Key 是否正确填写或已失效。错误详情：%s", apiErrorMsg)
			case 402: // Payment Required / Insufficient Balance
				friendlyErr = fmt.Errorf("LLM 账户余额不足 (402)：请前往大模型服务商后台充值后重试。错误详情：%s", apiErrorMsg)
			case http.StatusTooManyRequests:
				friendlyErr = fmt.Errorf("LLM 请求过于频繁 (429)：已超出接口限频限制，请稍候再试。错误详情：%s", apiErrorMsg)
			case http.StatusNotFound:
				friendlyErr = fmt.Errorf("LLM 资源未找到 (404)：请检查配置的模型名称或接口端点 URL 是否正确。错误详情：%s", apiErrorMsg)
			case http.StatusInternalServerError, http.StatusServiceUnavailable, http.StatusBadGateway:
				friendlyErr = fmt.Errorf("LLM 服务端暂时不可用 (状态码 %d)：服务商接口故障或维护中，请稍后重试。错误详情：%s", resp.StatusCode, apiErrorMsg)
			default:
				friendlyErr = fmt.Errorf("LLM 接口调用失败 (状态码 %d)：%s", resp.StatusCode, apiErrorMsg)
			}

			lastErr = friendlyErr

			if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusServiceUnavailable {
				c.log.Warn("llm returned transient status, retrying", zap.Int("attempt", attempt), zap.Int("status", resp.StatusCode))
				select {
				case <-ctx.Done():
					return "", ctx.Err()
				case <-time.After(backoff):
				}
				backoff *= 2
				continue
			}
			return "", lastErr
		}

		var llmResp Response
		if err := json.NewDecoder(resp.Body).Decode(&llmResp); err != nil {
			resp.Body.Close()
			return "", fmt.Errorf("decode response: %w", err)
		}
		resp.Body.Close()

		if len(llmResp.Choices) == 0 {
			return "", fmt.Errorf("empty choices in response")
		}

		return llmResp.Choices[0].Message.Content, nil
	}

	return "", fmt.Errorf("llm failed after retries: %w", lastErr)
}
