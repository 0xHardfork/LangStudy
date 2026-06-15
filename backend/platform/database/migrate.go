package database

import (
	"database/sql"
	"errors"
	"fmt"
	"io/fs"

	"github.com/golang-migrate/migrate/v4"
	migratepostgres "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"go.uber.org/zap"
)

func RunMigrations(db *sql.DB, fsys fs.FS, log *zap.Logger) error {
	sourceDriver, err := iofs.New(fsys, ".")
	if err != nil {
		return fmt.Errorf("create iofs source: %w", err)
	}

	dbDriver, err := migratepostgres.WithInstance(db, &migratepostgres.Config{})
	if err != nil {
		return fmt.Errorf("create postgres driver: %w", err)
	}

	m, err := migrate.NewWithInstance("iofs", sourceDriver, "postgres", dbDriver)
	if err != nil {
		return fmt.Errorf("create migrator: %w", err)
	}

	if err := m.Up(); err != nil {
		if errors.Is(err, migrate.ErrNoChange) {
			log.Info("migrations: no new changes")
			return nil
		}
		return fmt.Errorf("run migrations: %w", err)
	}

	version, _, err := m.Version()
	if err != nil {
		return fmt.Errorf("get migration version: %w", err)
	}

	log.Info("migrations applied", zap.Uint("version", version))
	return nil
}
