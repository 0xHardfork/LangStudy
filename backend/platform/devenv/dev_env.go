//go:build dev

package devenv

import (
	"context"
	"fmt"

	"github.com/spf13/viper"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
)

const (
	pgContainerName    = "langstudy-dev-postgres"
	redisContainerName = "langstudy-dev-redis"
)

func Setup(ctx context.Context) (func(), error) {
	pgContainer, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image: "postgres:15-alpine",
			Name:  pgContainerName,
			ExposedPorts: []string{"5432/tcp"},
			Env: map[string]string{
				"POSTGRES_USER":     "postgres",
				"POSTGRES_PASSWORD": "postgres",
				"POSTGRES_DB":       "langstudy",
			},
			WaitingFor: wait.ForListeningPort("5432/tcp"),
		},
		Started: true,
		Reuse:   true,
	})
	if err != nil {
		return nil, fmt.Errorf("start postgres container: %w", err)
	}

	pgHost, err := pgContainer.Host(ctx)
	if err != nil {
		return nil, fmt.Errorf("get postgres host: %w", err)
	}

	pgPort, err := pgContainer.MappedPort(ctx, "5432")
	if err != nil {
		return nil, fmt.Errorf("get postgres port: %w", err)
	}

	viper.Set("postgres.host", pgHost)
	viper.Set("postgres.port", int(pgPort.Num()))
	viper.Set("postgres.password", "postgres")
	viper.Set("postgres.dbname", "langstudy")

	redisContainer, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        "redis:7-alpine",
			Name:         redisContainerName,
			ExposedPorts: []string{"6379/tcp"},
			WaitingFor:   wait.ForListeningPort("6379/tcp"),
		},
		Started: true,
		Reuse:   true,
	})
	if err != nil {
		return nil, fmt.Errorf("start redis container: %w", err)
	}

	redisHost, err := redisContainer.Host(ctx)
	if err != nil {
		return nil, fmt.Errorf("get redis host: %w", err)
	}

	redisPort, err := redisContainer.MappedPort(ctx, "6379")
	if err != nil {
		return nil, fmt.Errorf("get redis port: %w", err)
	}

	viper.Set("redis.host", redisHost)
	viper.Set("redis.port", int(redisPort.Num()))

	return func() {}, nil
}
