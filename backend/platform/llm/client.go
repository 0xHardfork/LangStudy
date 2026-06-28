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
			lastErr = fmt.Errorf("attempt %d returned %d: %s", attempt, resp.StatusCode, string(body))
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
