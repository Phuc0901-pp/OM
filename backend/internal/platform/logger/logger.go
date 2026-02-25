package logger

import (
	"os"
	"sync"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var (
	log  *zap.Logger
	once sync.Once
)

// Initialize sets up the global logger
func Initialize() {
	once.Do(func() {
		config := zap.NewProductionEncoderConfig()
		config.EncodeTime = zapcore.ISO8601TimeEncoder
		config.EncodeLevel = zapcore.CapitalLevelEncoder

		// Custom console encoder for human-readable output in dev
		// In production, we might want JSON. For now, let's stick to JSON for structure.
		// Or strictly distinguish based on ENV.
		var encoder zapcore.Encoder
		if os.Getenv("ENV") == "development" {
			encoder = zapcore.NewConsoleEncoder(config)
		} else {
			encoder = zapcore.NewJSONEncoder(config)
		}

		core := zapcore.NewCore(
			encoder,
			zapcore.AddSync(os.Stdout),
			zapcore.InfoLevel,
		)

		log = zap.New(core, zap.AddCaller(), zap.AddStacktrace(zapcore.ErrorLevel))
	})
}

// Get returns the global logger instance
func Get() *zap.Logger {
	if log == nil {
		Initialize()
	}
	return log
}

// Info logs an info message
func Info(msg string, fields ...zap.Field) {
	Get().Info(msg, fields...)
}

// Error logs an error message
func Error(msg string, fields ...zap.Field) {
	Get().Error(msg, fields...)
}

// Fatal logs a fatal message and exits
func Fatal(msg string, fields ...zap.Field) {
	Get().Fatal(msg, fields...)
}

// MiddlewareLogger for Gin (if needed later)
func MiddlewareLogger() func(func(time.Time, int, string, string)) {
	return nil // Placeholder
}
