package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/0xHardfork/langstudy/internal/auth"
	"github.com/0xHardfork/langstudy/internal/dialogue"
	"github.com/0xHardfork/langstudy/internal/dialoguetype"
	"github.com/0xHardfork/langstudy/internal/ebbinghaus"
	"github.com/0xHardfork/langstudy/internal/llmconfig"
	"github.com/0xHardfork/langstudy/internal/user"
	"github.com/0xHardfork/langstudy/internal/userprofile"
	"github.com/0xHardfork/langstudy/migrations"
	"github.com/0xHardfork/langstudy/platform/cache"
	"github.com/0xHardfork/langstudy/platform/config"
	"github.com/0xHardfork/langstudy/platform/database"
	"github.com/0xHardfork/langstudy/platform/devenv"
	"github.com/0xHardfork/langstudy/platform/logger"
	"github.com/0xHardfork/langstudy/platform/response"
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
	db, err := database.NewPostgres(cfg.Postgres)
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
	userService := user.NewService(userStore, cfg)
	userHandler := user.NewHandler(userService)

	llmStore := llmconfig.NewStore(db)
	llmService := llmconfig.NewService(llmStore)
	llmHandler := llmconfig.NewHandler(llmService)

	profileStore := userprofile.NewStore(db)
	profileService := userprofile.NewService(profileStore)
	profileHandler := userprofile.NewHandler(profileService)

	dialogueStore := dialogue.NewStore(db)
	typeStore := dialoguetype.NewStore(db)
	typeService := dialoguetype.NewService(typeStore)
	typeHandler := dialoguetype.NewHandler(typeService)

	dialogueService := dialogue.NewService(dialogueStore, llmStore, typeStore, log, "static")
	dialogueHandler := dialogue.NewHandler(dialogueService)

	ebbStore := ebbinghaus.NewStore(db)
	ebbService := ebbinghaus.NewService(ebbStore)
	ebbHandler := ebbinghaus.NewHandler(ebbService)

	// 10. Router
	ginMode := gin.DebugMode
	if cfg.App.Env == "production" {
		ginMode = gin.ReleaseMode
	}
	gin.SetMode(ginMode)

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(zapLoggerMiddleware(log))

	// Serve generated audio files
	r.Static("/static", "./static")

	r.GET("/health", func(c *gin.Context) {
		response.Success(c, http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api/v1")
	{
		api.POST("/register", userHandler.Register)
		api.POST("/login", userHandler.Login)

		authed := api.Group("")
		authed.Use(auth.JWTMiddleware(cfg))
		{
			authed.GET("/profile", userHandler.GetProfile)
			authed.GET("/me/profile", profileHandler.GetProfile)
			authed.PUT("/me/profile", profileHandler.UpsertProfile)

			authed.GET("/dialogue/topics", dialogueHandler.GetTopics)
			authed.GET("/dialogue/types", typeHandler.List)
			authed.GET("/dialogue/active", dialogueHandler.GetActiveDialogue)
			authed.GET("/dialogue/shared", dialogueHandler.GetSharedDialogue)
			authed.POST("/dialogue/generate", dialogueHandler.Generate)
			authed.POST("/dialogue/regenerate", dialogueHandler.RegenerateDialogue)
			authed.PUT("/dialogue/:id/progress", dialogueHandler.UpdateProgress)
			authed.GET("/dialogue/:id", dialogueHandler.GetDialogue)
			authed.GET("/dialogue", dialogueHandler.ListDialogues)

			authed.GET("/reviews/due", ebbHandler.GetDueReviews)
			authed.GET("/reviews/schedule", ebbHandler.GetReviewSchedule)
			authed.POST("/reviews/answer", ebbHandler.SubmitAnswer)
		}

		adminGroup := api.Group("/admin")
		adminGroup.Use(auth.JWTMiddleware(cfg))
		adminGroup.Use(auth.AdminRequired(userStore))
		{
			adminGroup.GET("/users", userHandler.ListUsers)
			adminGroup.POST("/users", userHandler.CreateUser)
			adminGroup.DELETE("/users/:id", userHandler.DeleteUser)

			adminGroup.GET("/llm-config", llmHandler.GetConfig)
			adminGroup.PUT("/llm-config", llmHandler.UpdateConfig)

			adminGroup.GET("/dialogue-types", typeHandler.AdminList)
			adminGroup.POST("/dialogue-types", typeHandler.AdminCreate)
			adminGroup.PUT("/dialogue-types/:id", typeHandler.AdminUpdate)
			adminGroup.DELETE("/dialogue-types/:id", typeHandler.AdminDelete)
		}
	}

	// 11. HTTP Server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.App.Port),
		Handler:      r,
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  120 * time.Second,
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
		log.Info("request",
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.Int("status", c.Writer.Status()),
			zap.Duration("latency", time.Since(start)),
		)
	}
}
