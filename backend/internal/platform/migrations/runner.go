package migrations

import (
    "database/sql"
    "errors"
    "fmt"
    "log"
    "os"

    "github.com/golang-migrate/migrate/v4"
    "github.com/golang-migrate/migrate/v4/database/postgres"
    "github.com/golang-migrate/migrate/v4/source/iofs"
)

// RunMigrations executes golang-migrate migrations
func RunMigrations(db *sql.DB, migrationsDir string) error {
    log.Println("Starting Database Migrations (golang-migrate)...")

    driver, err := postgres.WithInstance(db, &postgres.Config{})
    if err != nil {
        return fmt.Errorf("could not create database driver: %w", err)
    }



    // Use iofs to avoid Windows file:// URL issues
    // migrationsDir is relative to where binary is run (e.g. "migrations")
    srcDriver, err := iofs.New(os.DirFS(migrationsDir), ".")
    if err != nil {
        return fmt.Errorf("could not create iofs source: %w", err)
    }
    
    log.Printf("Migration Source: iofs://%s", migrationsDir)

    m, err := migrate.NewWithInstance(
        "iofs",
        srcDriver,
        "postgres",
        driver,
    )
    if err != nil {
        return fmt.Errorf("could not create migrate instance: %w", err)
    }

    // Check current version
    version, dirty, err := m.Version()
    if err != nil && !errors.Is(err, migrate.ErrNilVersion) {
        log.Printf("Could not get current migration version: %v", err)
        return err
    }
    
    log.Printf("Current Migration Version: %d (Dirty: %v)", version, dirty)

    // Auto-heal: If dirty, legacy version (>1), or explicit version 0 (from Force(0))
    // We drop the schema_migrations table to force a fresh start determination.
    // version == 0 && err == nil means explicit version 0 (bad state).
    if dirty || version > 1 || (version == 0 && err == nil) {
        log.Println("Migration state is invalid (dirty, legacy, or stuck at 0). Resetting migration history...")
        
        // Execute Drop Table directly on the underlying DB connection passed to function
        if _, err := db.Exec("DROP TABLE IF EXISTS schema_migrations"); err != nil {
             return fmt.Errorf("failed to drop schema_migrations: %w", err)
        }
        
        log.Println("Migration history reset. Retrying migrations...")
        // Recursive call to start fresh
        return RunMigrations(db, migrationsDir)
    }

    // Run Up
    if err := m.Up(); err != nil {
        if errors.Is(err, migrate.ErrNoChange) {
            log.Println("Database is up to date.")
            return nil
        }
        return fmt.Errorf("migration failed: %w", err)
    }

    log.Println("Database Migrations Completed Successfully.")
    return nil
}
