package redis

import (
	"context"
	"fmt"
	"os"
	"strconv"

	goredis "github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"github.com/phuc/cmms-backend/internal/platform/logger"
)

// Client is a thin wrapper around *goredis.Client with app-level helpers.
type Client struct {
	*goredis.Client
	log *zap.Logger
}

// NewClient reads REDIS_HOST / REDIS_PORT / REDIS_PASSWORD / REDIS_DB from env
// and returns a connected client.  Returns nil (not an error) when REDIS_HOST is
// not set, allowing the app to start without Redis in development.
func NewClient(ctx context.Context) *Client {
	host := os.Getenv("REDIS_HOST")
	if host == "" {
		logger.Get().Warn("[Redis] REDIS_HOST not set — Redis features disabled")
		return nil
	}

	port := os.Getenv("REDIS_PORT")
	if port == "" {
		port = "6379"
	}

	dbNum := 0
	if v := os.Getenv("REDIS_DB"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			dbNum = n
		}
	}

	rdb := goredis.NewClient(&goredis.Options{
		Addr:     fmt.Sprintf("%s:%s", host, port),
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       dbNum,
	})

	if err := rdb.Ping(ctx).Err(); err != nil {
		logger.Get().Error("[Redis] Connection failed — Redis features disabled", zap.Error(err))
		rdb.Close()
		return nil
	}

	logger.Get().Info("[Redis] Connected", zap.String("addr", fmt.Sprintf("%s:%s", host, port)))
	return &Client{Client: rdb, log: logger.Get()}
}
