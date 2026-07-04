package logger

import (
	"fmt"

	"github.com/0xHardfork/langstudy/platform/config"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func New(logCfg config.LogConfig, env string) (*zap.Logger, error) {
	var cfg zap.Config
	if env == "production" {
		cfg = zap.NewProductionConfig()
	} else {
		cfg = zap.NewDevelopmentConfig()
		cfg.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	}

	// 1. Configure custom log level
	if logCfg.Level != "" {
		var level zapcore.Level
		if err := level.UnmarshalText([]byte(logCfg.Level)); err == nil {
			cfg.Level = zap.NewAtomicLevelAt(level)
		}
	}

	// 2. Configure custom output paths
	if len(logCfg.OutputPaths) > 0 {
		cfg.OutputPaths = logCfg.OutputPaths
	}

	log, err := cfg.Build(zap.AddStacktrace(zap.ErrorLevel))
	if err != nil {
		return nil, fmt.Errorf("build logger: %w", err)
	}
	return log, nil
}
