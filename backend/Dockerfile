# Build Stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache gcc musl-dev

# Download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build statically linked binary
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/api

# Run Stage
FROM alpine:latest

# Install timezone and CA certificates for external HTTPS calls
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/main .

# Copy migrations folder (for runtime migrations if supported)
COPY --from=builder /app/migrations ./migrations

# Expose backend port
EXPOSE 4000

# Execute
CMD ["./main"]
