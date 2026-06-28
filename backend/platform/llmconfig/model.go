package llmconfig

import "time"

type LLMConfig struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	ApiUrl    string    `gorm:"column:api_url;size:255;not null" json:"api_url"`
	ApiKey    string    `gorm:"column:api_key;size:255;not null" json:"api_key"`
	ModelName string    `gorm:"column:model_name;size:100;not null" json:"model_name"`
	PromptTpl string    `gorm:"column:prompt_tpl;not null" json:"prompt_tpl"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type UpdateConfigRequest struct {
	ApiUrl    string `json:"api_url" binding:"required"`
	ApiKey    string `json:"api_key" binding:"required"`
	ModelName string `json:"model_name" binding:"required"`
	PromptTpl string `json:"prompt_tpl" binding:"required"`
}
