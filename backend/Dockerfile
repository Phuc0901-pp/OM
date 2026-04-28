# Build Stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN sed -i 's/https/http/g' /etc/apk/repositories && \
    apk add --no-cache gcc musl-dev

# Use pre-vendored dependencies (avoids Docker DNS issues with external Go proxies)
COPY go.mod go.sum ./
COPY vendor ./vendor

# Copy source code
COPY . .

# Build statically linked binary (use vendor dir, no network access needed)
RUN CGO_ENABLED=0 GOOS=linux go build -mod=vendor -o main ./cmd/api

# Run Stage
FROM alpine:latest

# Install timezone and CA certificates
RUN sed -i 's/https/http/g' /etc/apk/repositories && \
    apk add --no-cache ca-certificates tzdata

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/main .

# Copy migrations folder (for runtime migrations if supported)
COPY --from=builder /app/migrations ./migrations

# Copy assets folder (fonts, templates, etc.)
COPY --from=builder /app/assets ./assets

# Expose backend port
EXPOSE 4000

# Execute
CMD ["./main"]
