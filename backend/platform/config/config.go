package config

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	App      AppConfig      `mapstructure:"app"`
	JWT      JWTConfig      `mapstructure:"jwt"`
	Postgres PostgresConfig `mapstructure:"postgres"`
	Redis    RedisConfig    `mapstructure:"redis"`
	Log      LogConfig      `mapstructure:"log"`
	LLM      LLMConfig      `mapstructure:"llm"`
}

type LogConfig struct {
	Level       string   `mapstructure:"level"`
	OutputPaths []string `mapstructure:"output_paths"`
}

type LLMConfig struct {
	TimeoutSeconds int `mapstructure:"timeout_seconds"`
}

type AppConfig struct {
	Name      string `mapstructure:"name"`
	Port      int    `mapstructure:"port"`
	Env       string `mapstructure:"env"`
	StaticDir string `mapstructure:"static_dir"`
}

type JWTConfig struct {
	Secret                   string `mapstructure:"secret"`
	ExpireHours              int    `mapstructure:"expire_hours"`
	AccessTokenExpireMinutes int    `mapstructure:"access_token_expire_minutes"`
	RefreshExpireHoursWeb    int    `mapstructure:"refresh_expire_hours_web"`
	RefreshExpireHoursApp    int    `mapstructure:"refresh_expire_hours_app"`
}

type PostgresConfig struct {
	Host         string `mapstructure:"host"`
	Port         int    `mapstructure:"port"`
	User         string `mapstructure:"user"`
	Password     string `mapstructure:"password"`
	PasswordFile string `mapstructure:"password_file"`
	DBName       string `mapstructure:"dbname"`
	SSLMode      string `mapstructure:"sslmode"`
}

func (p PostgresConfig) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		p.Host, p.Port, p.User, p.Password, p.DBName, p.SSLMode,
	)
}

type RedisConfig struct {
	Host         string `mapstructure:"host"`
	Port         int    `mapstructure:"port"`
	Password     string `mapstructure:"password"`
	PasswordFile string `mapstructure:"password_file"`
	DB           int    `mapstructure:"db"`
}

var v = viper.New()

func Viper() *viper.Viper {
	return v
}

func Load() (*Config, error) {
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath("configs")
	v.AddConfigPath(".")

	v.SetDefault("app.port", 8080)
	v.SetDefault("app.env", "development")
	v.SetDefault("app.static_dir", "static")
	v.SetDefault("postgres.host", "localhost")
	v.SetDefault("postgres.port", 5432)
	v.SetDefault("postgres.sslmode", "disable")
	v.SetDefault("redis.host", "localhost")
	v.SetDefault("jwt.expire_hours", 24)
	v.SetDefault("jwt.access_token_expire_minutes", 30)
	v.SetDefault("jwt.refresh_expire_hours_web", 24)
	v.SetDefault("jwt.refresh_expire_hours_app", 4320)
	v.SetDefault("log.level", "info")
	v.SetDefault("log.output_paths", []string{"stdout"})
	v.SetDefault("llm.timeout_seconds", 120)

	v.AutomaticEnv()
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	if err := v.ReadInConfig(); err != nil {
		var notFound viper.ConfigFileNotFoundError
		if !errors.As(err, &notFound) {
			return nil, fmt.Errorf("read config: %w", err)
		}
	}

	return unmarshal()
}

func Reload() (*Config, error) {
	return unmarshal()
}

func unmarshal() (*Config, error) {
	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}

	// Resolve postgres password from file if configured
	if cfg.Postgres.PasswordFile != "" {
		data, err := os.ReadFile(cfg.Postgres.PasswordFile)
		if err != nil {
			return nil, fmt.Errorf("read postgres password file %q: %w", cfg.Postgres.PasswordFile, err)
		}
		cfg.Postgres.Password = strings.TrimSpace(string(data))
	}

	// Resolve redis password from file if configured
	if cfg.Redis.PasswordFile != "" {
		data, err := os.ReadFile(cfg.Redis.PasswordFile)
		if err != nil {
			return nil, fmt.Errorf("read redis password file %q: %w", cfg.Redis.PasswordFile, err)
		}
		cfg.Redis.Password = strings.TrimSpace(string(data))
	}

	return &cfg, nil
}
