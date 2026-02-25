// Package jobs provides a lightweight background Job Queue backed by Redis Lists.
//
// Architecture:
//   - Queue (producer): pushes JSON-encoded NotificationJobs onto a Redis List.
//   - Worker (consumer): runs in a goroutine, uses BLPOP to block-wait for jobs
//     and dispatches them to the appropriate handler (Email, Web Push, Telegram).
//
// Graceful degradation: when Redis is not configured, Queue methods are no-ops
// and jobs are executed synchronously (same behaviour as before Phase 3).
package jobs

import (
	"context"
	"encoding/json"
	"time"

	goredis "github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"github.com/google/uuid"
	infraredis "github.com/phuc/cmms-backend/internal/infrastructure/redis"
	"github.com/phuc/cmms-backend/internal/platform/logger"
)

const (
	queueKey        = "jobs:notifications"
	blpopTimeout    = 5 * time.Second  // How long BLPOP waits before returning nil
	workerConcurrency = 4             // Goroutines processing the queue
)

// ─── Job types ────────────────────────────────────────────────────────────────

type JobType string

const (
	JobTypePush     JobType = "push"
	JobTypeEmail    JobType = "email"
	JobTypeTelegram JobType = "telegram"
)

// NotificationJob is the message pushed onto the Redis List.
type NotificationJob struct {
	Type     JobType                `json:"type"`
	UserID   uuid.UUID              `json:"user_id"`
	Title    string                 `json:"title"`
	Message  string                 `json:"message"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
	Retries  int                    `json:"retries,omitempty"` // For tracking retry attempts
}

// ─── Queue (Producer) ─────────────────────────────────────────────────────────

// Queue is the job producer — call Enqueue from the request handler.
// It is nil-safe: when Redis is not available, Enqueue returns (false, nil)
// and the caller falls back to synchronous dispatch.
type Queue struct {
	rdb *infraredis.Client
	log *zap.Logger
}

// NewQueue creates a Queue. Returns nil when rdb is nil.
func NewQueue(rdb *infraredis.Client) *Queue {
	if rdb == nil {
		return nil
	}
	return &Queue{rdb: rdb, log: logger.Get()}
}

// Enqueue serialises the job and pushes it onto the Redis List.
// Returns (true, nil) on success, (false, nil) when Queue is disabled,
// or (false, err) on serialisation/network error.
func (q *Queue) Enqueue(ctx context.Context, job NotificationJob) (enqueued bool, err error) {
	if q == nil {
		return false, nil // Redis disabled — caller will dispatch synchronously
	}

	data, err := json.Marshal(job)
	if err != nil {
		return false, err
	}

	if err := q.rdb.RPush(ctx, queueKey, data).Err(); err != nil {
		q.log.Error("[Queue] Enqueue failed", zap.Error(err), zap.String("type", string(job.Type)))
		return false, err
	}

	q.log.Debug("[Queue] Job enqueued",
		zap.String("type", string(job.Type)),
		zap.String("user_id", job.UserID.String()),
	)
	return true, nil
}

// ─── Worker (Consumer) ────────────────────────────────────────────────────────

// Handler is the function signature for processing a single job.
type Handler func(ctx context.Context, job NotificationJob) error

// Worker consumes jobs from the Redis List and dispatches them.
type Worker struct {
	rdb      *infraredis.Client
	handlers map[JobType]Handler
	log      *zap.Logger
}

// NewWorker creates a Worker. Returns nil when rdb is nil.
func NewWorker(rdb *infraredis.Client) *Worker {
	if rdb == nil {
		return nil
	}
	return &Worker{
		rdb:      rdb,
		handlers: make(map[JobType]Handler),
		log:      logger.Get(),
	}
}

// Register binds a job type to a handler function.
func (w *Worker) Register(t JobType, h Handler) {
	if w == nil {
		return
	}
	w.handlers[t] = h
}

// Start spawns workerConcurrency goroutines that block-wait on the Redis queue.
// The goroutines exit when ctx is cancelled (e.g., on server shutdown).
func (w *Worker) Start(ctx context.Context) {
	if w == nil {
		return
	}
	w.log.Info("[Worker] Starting", zap.Int("concurrency", workerConcurrency))
	for i := 0; i < workerConcurrency; i++ {
		go w.run(ctx, i)
	}
}

func (w *Worker) run(ctx context.Context, id int) {
	log := w.log.With(zap.Int("worker_id", id))
	log.Info("[Worker] Started")

	for {
		select {
		case <-ctx.Done():
			log.Info("[Worker] Stopping")
			return
		default:
		}

		// BLPOP blocks for up to blpopTimeout — gives us a chance to check ctx.Done
		results, err := w.rdb.BLPop(ctx, blpopTimeout, queueKey).Result()
		if err != nil {
			if err == goredis.Nil || err == context.Canceled || err == context.DeadlineExceeded {
				continue
			}
			log.Error("[Worker] BLPOP error", zap.Error(err))
			time.Sleep(time.Second) // back off before retrying
			continue
		}

		// results[0] = key name, results[1] = value
		if len(results) < 2 {
			continue
		}

		var job NotificationJob
		if err := json.Unmarshal([]byte(results[1]), &job); err != nil {
			log.Error("[Worker] Unmarshal failed", zap.Error(err), zap.String("raw", results[1]))
			continue
		}

		handler, ok := w.handlers[job.Type]
		if !ok {
			log.Warn("[Worker] No handler for job type", zap.String("type", string(job.Type)))
			continue
		}

		log.Info("[Worker] Processing job",
			zap.String("type", string(job.Type)),
			zap.String("user_id", job.UserID.String()),
		)

		if err := handler(ctx, job); err != nil {
			log.Error("[Worker] Handler failed",
				zap.String("type", string(job.Type)),
				zap.Error(err),
			)
			
			// Simple DLQ / Retry mechanism
			if job.Retries < 3 {
				job.Retries++
				log.Info("[Worker] Re-queuing failed job", zap.Int("attempt", job.Retries))
				if data, mErr := json.Marshal(job); mErr == nil {
					// Push to the back of the queue (or another DLQ list if needed)
					w.rdb.RPush(ctx, queueKey, data)
				}
			} else {
				log.Error("[Worker] Job dropped after max retries", zap.String("job_data", results[1]))
			}
		}
	}
}
