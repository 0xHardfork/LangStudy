package main

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/0xHardfork/langstudy/internal/dialogue"
	"github.com/0xHardfork/langstudy/internal/ebbinghaus"
	"github.com/0xHardfork/langstudy/internal/grammar"
	"github.com/0xHardfork/langstudy/internal/user"
	"github.com/0xHardfork/langstudy/migrations"
	"github.com/0xHardfork/langstudy/platform/auth"
	"github.com/0xHardfork/langstudy/platform/cache"
	"github.com/0xHardfork/langstudy/platform/config"
	"github.com/0xHardfork/langstudy/platform/database"
	"github.com/0xHardfork/langstudy/platform/devenv"
	"github.com/0xHardfork/langstudy/platform/logger"
	"github.com/0xHardfork/langstudy/platform/llm"
	"github.com/0xHardfork/langstudy/platform/llmconfig"
	"github.com/0xHardfork/langstudy/platform/response"
	"github.com/0xHardfork/langstudy/platform/validator"
	"github.com/gin-gonic/gin"
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
	log, err := logger.New(cfg.App.Env)
	if err != nil {
		fmt.Fprintf(os.Stderr, "init logger: %v\n", err)
		os.Exit(1)
	}
	defer func() {
		if syncErr := log.Sync(); syncErr != nil {
			fmt.Fprintf(os.Stderr, "sync logger: %v\n", syncErr)
		}
	}()

	log.Info("config loaded", zap.String("env", cfg.App.Env))

	if err := validator.Init(); err != nil {
		log.Fatal("init validator translator failed", zap.Error(err))
	}

	// 3. DevEnv — overrides Viper config (dev mode only)
	ctx := context.Background()

	devShutdown, err := devenv.Setup(ctx)
	if err != nil {
		log.Fatal("devenv setup failed", zap.Error(err))
	}

	// Re-unmarshal config after devenv may have overwritten Viper keys
	cfg, err = config.Reload()
	if err != nil {
		log.Fatal("reload config after devenv", zap.Error(err))
	}

	// 4. Database
	db, err := database.NewPostgres(cfg.Postgres, log)
	if err != nil {
		log.Fatal("postgres connect", zap.Error(err))
	}
	log.Info("postgres connected",
		zap.String("host", cfg.Postgres.Host),
		zap.String("dbname", cfg.Postgres.DBName),
	)

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal("get sql.DB", zap.Error(err))
	}

	// 5. Cache
	redisClient, err := cache.NewRedis(cfg.Redis)
	if err != nil {
		log.Fatal("redis connect", zap.Error(err))
	}
	log.Info("redis connected",
		zap.String("host", cfg.Redis.Host),
		zap.Int("db", cfg.Redis.DB),
	)

	// 6. Migrations
	if err := database.RunMigrations(sqlDB, migrations.FS, log); err != nil {
		log.Fatal("run migrations", zap.Error(err))
	}

	// 7-9. User module wiring
	userStore := user.NewStore(db)
	userService := user.NewService(userStore, cfg, redisClient)
	userHandler := user.NewHandler(userService, cfg)

	llmStore := llmconfig.NewStore(db)
	llmService := llmconfig.NewService(llmStore)
	llmHandler := llmconfig.NewHandler(llmService)

	// Sync LLM config from environment variables if present (useful for local re-init)
	envApiUrl := os.Getenv("LLM_API_URL")
	envApiKey := os.Getenv("LLM_API_KEY")
	envModelName := os.Getenv("LLM_MODEL_NAME")
	if envApiUrl != "" || envApiKey != "" || envModelName != "" {
		ctx := context.Background()
		cfgRecord, err := llmStore.Get(ctx)
		if err == nil {
			updated := false
			if envApiUrl != "" && cfgRecord.ApiUrl != envApiUrl {
				cfgRecord.ApiUrl = envApiUrl
				updated = true
			}
			if envApiKey != "" && cfgRecord.ApiKey != envApiKey {
				cfgRecord.ApiKey = envApiKey
				updated = true
			}
			if envModelName != "" && cfgRecord.ModelName != envModelName {
				cfgRecord.ModelName = envModelName
				updated = true
			}
			if updated {
				if updateErr := llmStore.Update(ctx, cfgRecord); updateErr != nil {
					log.Warn("failed to update LLM config from environment variables", zap.Error(updateErr))
				} else {
					log.Info("LLM config updated from environment variables")
				}
			}
		} else {
			log.Warn("failed to fetch LLM config for environment variables sync", zap.Error(err))
		}
	}

	llmCli := llm.NewClient(log)

	dialogueStore := dialogue.NewStore(db)
	dialogueService := dialogue.NewService(dialogueStore, llmStore, log, "static", llmCli)
	dialogueHandler := dialogue.NewHandler(dialogueService)

	ebbStore := ebbinghaus.NewStore(db)
	ebbService := ebbinghaus.NewService(ebbStore)
	ebbHandler := ebbinghaus.NewHandler(ebbService)

	grammarStore := grammar.NewStore(db)
	grammarService := grammar.NewService(grammarStore, llmService, log, llmCli)
	grammarHandler := grammar.NewHandler(grammarService)

	// 10. Router
	ginMode := gin.DebugMode
	if cfg.App.Env == "production" {
		ginMode = gin.ReleaseMode
	}
	gin.SetMode(ginMode)

	r := gin.New()
	r.Use(zapRecoveryMiddleware(log))
	r.Use(zapLoggerMiddleware(log))

	// Serve generated audio files
	r.Static("/static", "./static")

	r.GET("/health", func(c *gin.Context) {
		response.Success(c, http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api/v1")
	{
		authed := api.Group("")
		authed.Use(auth.JWTMiddleware(cfg))

		adminGroup := api.Group("/admin")
		adminGroup.Use(auth.JWTMiddleware(cfg))
		adminGroup.Use(auth.AdminRequired())

		userHandler.RegisterRoutes(api, authed, adminGroup)
		dialogueHandler.RegisterRoutes(authed, adminGroup)
		ebbHandler.RegisterRoutes(authed)
		grammarHandler.RegisterRoutes(authed)
		llmHandler.RegisterRoutes(adminGroup)
	}

	// 11. HTTP Server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.App.Port),
		Handler:      r,
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info("server started", zap.Int("port", cfg.App.Port))
		if listenErr := srv.ListenAndServe(); listenErr != nil && !errors.Is(listenErr, http.ErrServerClosed) {
			log.Fatal("listen", zap.Error(listenErr))
		}
	}()

	// 12. Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("shutting down...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if shutdownErr := srv.Shutdown(shutdownCtx); shutdownErr != nil {
		log.Error("server shutdown", zap.Error(shutdownErr))
	}
	log.Info("server stopped")

	if closeErr := sqlDB.Close(); closeErr != nil {
		log.Error("close postgres", zap.Error(closeErr))
	}
	log.Info("postgres closed")

	if closeErr := redisClient.Close(); closeErr != nil {
		log.Error("close redis", zap.Error(closeErr))
	}
	log.Info("redis closed")

	devShutdown()
	log.Info("devenv terminated")
}

func zapLoggerMiddleware(log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		status := c.Writer.Status()
		fields := []zap.Field{
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.Int("status", status),
			zap.Duration("latency", time.Since(start)),
		}
		if status >= 500 {
			log.Error("request failed", fields...)
		} else if status >= 400 {
			log.Warn("request warning", fields...)
		} else {
			log.Info("request", fields...)
		}
	}
}

func zapRecoveryMiddleware(log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				var brokenPipe bool
				if ne, ok := err.(*net.OpError); ok {
					var se *os.SyscallError
					if errors.As(ne.Err, &se) {
						errStr := strings.ToLower(se.Error())
						if strings.Contains(errStr, "broken pipe") || strings.Contains(errStr, "connection reset by peer") {
							brokenPipe = true
						}
					}
				}

				stack := make([]byte, 2048)
				length := runtime.Stack(stack, false)
				stackStr := string(stack[:length])

				if brokenPipe {
					log.Error("broken pipe or connection reset",
						zap.Any("error", err),
						zap.String("path", c.Request.URL.Path),
					)
					c.Error(err.(error))
					c.Abort()
					return
				}

				log.Error("panic recovered",
					zap.Any("error", err),
					zap.String("path", c.Request.URL.Path),
					zap.String("query", c.Request.URL.RawQuery),
					zap.String("stack", stackStr),
				)
				response.Fail(c, http.StatusInternalServerError, "internal server error")
				c.Abort()
			}
		}()
		c.Next()
	}
}
