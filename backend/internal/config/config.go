// Package config centralizes all application configuration loaded from
// environment variables (populated by godotenv from .env or Docker env).
// All os.Getenv calls that were previously scattered across main.go and
// service files are consolidated here into a single typed Config struct.
package config

import "os"

// Config is the root configuration object for the entire application.
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Minio    MinioConfig
	RabbitMQ RabbitMQConfig
	Lark     LarkConfig
	Auth     AuthConfig
	CORS     CORSConfig
	App      AppConfig
}

// ServerConfig holds HTTP server settings.
type ServerConfig struct {
	Port    string
	AppEnv  string // "production" | "development"
}

// DatabaseConfig holds connection settings for PostgreSQL.
type DatabaseConfig struct {
	Driver string
	URL    string
}

// MinioConfig holds MinIO object-storage connection settings.
type MinioConfig struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	UseSSL    bool
}

// RabbitMQConfig holds AMQP connection settings for RabbitMQ.
type RabbitMQConfig struct {
	URL string
}

// LarkConfig holds credentials and table identifiers for the Lark Open API.
//
// Fields:
//   AppID / AppSecret     — identify the Lark Bot application
//   AppToken              — the Bitable App Token used by the completed-task sync
//   CompletedTableID      — TableID for the "Task Approved" Bitable table
//   RejectAppToken        — App Token for the dedicated "Task Rejected" Bitable
//   RejectTableID         — TableID for the "Task Rejected" Bitable table
//   SubmitAppToken        — App Token for the "NỘP DỮ LIỆU" Bitable (on submit)
//   SubmitTableID         — TableID for the "NỘP DỮ LIỆU" Bitable table
type LarkConfig struct {
	AppID            string
	AppSecret        string
	AppToken         string
	CompletedTableID string
	RejectAppToken   string
	RejectTableID    string
	SubmitAppToken   string
	SubmitTableID    string
}

// AuthConfig holds JWT and session settings.
type AuthConfig struct {
	JWTSecret string
}

// CORSConfig holds allowed origins for Cross-Origin Resource Sharing.
type CORSConfig struct {
	AllowedOrigins string // Comma-separated list
}

// AppConfig holds miscellaneous application-level settings.
type AppConfig struct {
	UploadStageDir string // Temporary staging directory for MinIO uploads
}

// Load reads all environment variables and returns a populated Config.
// Call this once in main() after godotenv.Load().
func Load() Config {
	return Config{
		Server: ServerConfig{
			Port:   getEnvOrDefault("PORT", "4000"),
			AppEnv: getEnvOrDefault("APP_ENV", "development"),
		},
		Database: DatabaseConfig{
			Driver: getEnvOrDefault("DB_DRIVER", "postgres"),
			URL:    os.Getenv("DATABASE_URL"),
		},
		Minio: MinioConfig{
			Endpoint:  os.Getenv("MINIO_ENDPOINT"),
			AccessKey: os.Getenv("MINIO_ACCESS_KEY"),
			SecretKey: os.Getenv("MINIO_SECRET_KEY"),
			Bucket:    getEnvOrDefault("MINIO_BUCKET", "dev"),
			UseSSL:    os.Getenv("MINIO_USE_SSL") == "true",
		},
		RabbitMQ: RabbitMQConfig{
			URL: os.Getenv("RABBITMQ_URL"),
		},
		Lark: LarkConfig{
			AppID:            getEnvOrDefault("LARK_APP_ID", "cli_a9c1e8eef3b8ded3"),
			AppSecret:        getEnvOrDefault("LARK_APP_SECRET", "dD3ftSuHZ66oLf7pAiGM2F5MtBKBqISr"),
			AppToken:         getEnvOrDefault("LARK_APP_TOKEN", "JbTBbo3QQaz7r5smJZilen5EgXg"),
			CompletedTableID: os.Getenv("LARK_COMPLETED_TASK_TABLE_ID"),
			RejectAppToken:   getEnvOrDefault("LARK_REJECT_APP_TOKEN", "JbTBbo3QQaz7r5smJZilen5EgXg"),
			RejectTableID:    getEnvOrDefault("LARK_REJECT_TABLE_ID", "tblkCQwQANfv8E7g"),
			// "RAITEK | NỘP DỮ LIỆU" table — synced immediately on each worker Submit
			SubmitAppToken: getEnvOrDefault("LARK_SUBMIT_APP_TOKEN", "JbTBbo3QQaz7r5smJZilen5EgXg"),
			SubmitTableID:  getEnvOrDefault("LARK_SUBMIT_TABLE_ID", "tblUjGzPhLDSNGq8"),
		},
		Auth: AuthConfig{
			JWTSecret: getEnvOrDefault("JWT_SECRET", "changeme-in-production"),
		},
		CORS: CORSConfig{
			AllowedOrigins: os.Getenv("ALLOWED_ORIGINS"),
		},
		App: AppConfig{
			UploadStageDir: getEnvOrDefault("UPLOAD_STAGE_DIR", "/tmp/om_uploads"),
		},
	}
}

// getEnvOrDefault returns the environment variable value or the provided
// fallback if the variable is not set or is empty.
func getEnvOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
