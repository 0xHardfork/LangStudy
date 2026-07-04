package main

import (
	"fmt"
	"os"

	"github.com/0xHardfork/langstudy/migrations"
	"github.com/0xHardfork/langstudy/platform/config"
	"github.com/0xHardfork/langstudy/platform/database"
	"github.com/0xHardfork/langstudy/platform/logger"
	"go.uber.org/zap"
)

func main() {
	// 1. Config
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "load config: %v\n", err)
		os.Exit(1)
	}

	// 2. Logger
	log, err := logger.New(cfg.Log, cfg.App.Env)
	if err != nil {
		fmt.Fprintf(os.Stderr, "init logger: %v\n", err)
		os.Exit(1)
	}
	defer func() {
		if syncErr := log.Sync(); syncErr != nil {
			fmt.Fprintf(os.Stderr, "sync logger: %v\n", syncErr)
		}
	}()

	log.Info("running migrate tool", zap.String("env", cfg.App.Env))

	// 3. Connect to Database
	db, err := database.NewPostgres(cfg.Postgres, log)
	if err != nil {
		log.Fatal("postgres connect failed", zap.Error(err))
	}
	log.Info("postgres connected",
		zap.String("host", cfg.Postgres.Host),
		zap.String("dbname", cfg.Postgres.DBName),
	)

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal("failed to get sql.DB instance", zap.Error(err))
	}

	// 4. Run Migrations
	log.Info("starting database migrations...")
	if err := database.RunMigrations(sqlDB, migrations.FS, log); err != nil {
		log.Fatal("database migrations failed", zap.Error(err))
	}

	log.Info("database migrations completed successfully")
}
