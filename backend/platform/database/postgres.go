package database

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/0xHardfork/langstudy/platform/config"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type zapGormLogger struct {
	log           *zap.Logger
	level         logger.LogLevel
	slowThreshold time.Duration
}

func (l *zapGormLogger) LogMode(level logger.LogLevel) logger.Interface {
	return &zapGormLogger{
		log:           l.log,
		level:         level,
		slowThreshold: l.slowThreshold,
	}
}

func (l *zapGormLogger) Info(ctx context.Context, msg string, data ...interface{}) {
	if l.level >= logger.Info {
		l.log.Info(fmt.Sprintf(msg, data...))
	}
}

func (l *zapGormLogger) Warn(ctx context.Context, msg string, data ...interface{}) {
	if l.level >= logger.Warn {
		l.log.Warn(fmt.Sprintf(msg, data...))
	}
}

func (l *zapGormLogger) Error(ctx context.Context, msg string, data ...interface{}) {
	if l.level >= logger.Error {
		l.log.Error(fmt.Sprintf(msg, data...))
	}
}

func (l *zapGormLogger) Trace(ctx context.Context, begin time.Time, fc func() (string, int64), err error) {
	if l.level <= logger.Silent {
		return
	}

	elapsed := time.Since(begin)
	sql, rows := fc()

	switch {
	case err != nil && l.level >= logger.Error && !errors.Is(err, gorm.ErrRecordNotFound):
		l.log.Error("trace",
			zap.Error(err),
			zap.Duration("elapsed", elapsed),
			zap.Int64("rows", rows),
			zap.String("sql", sql),
		)
	case elapsed > l.slowThreshold && l.slowThreshold != 0 && l.level >= logger.Warn:
		l.log.Warn("slow sql",
			zap.Duration("elapsed", elapsed),
			zap.Int64("rows", rows),
			zap.String("sql", sql),
		)
	case l.level >= logger.Info:
		l.log.Info("trace",
			zap.Duration("elapsed", elapsed),
			zap.Int64("rows", rows),
			zap.String("sql", sql),
		)
	}
}

func NewPostgres(cfg config.PostgresConfig, log *zap.Logger) (*gorm.DB, error) {
	gormLog := &zapGormLogger{
		log:           log,
		level:         logger.Warn,
		slowThreshold: 200 * time.Millisecond,
	}

	db, err := gorm.Open(postgres.Open(cfg.DSN()), &gorm.Config{
		Logger: gormLog,
	})
	if err != nil {
		return nil, fmt.Errorf("connect postgres: %w", err)
	}
	return db, nil
}
