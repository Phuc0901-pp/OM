@echo off
set PORT=4001
set DB_HOST=192.168.31.254
set DB_NAME=solar_om
set DATABASE_URL=postgres://phucraitek0539:090103Phuc@192.168.31.254:2602/solar_om?sslmode=disable
set MINIO_ENDPOINT=192.168.31.254:2603
echo ===================================================
echo [DEV ENVIRONMENT] Dang chay Backend tren PORT %PORT%...
echo Dung Ctrl+C de thoat.
echo ===================================================
go run ./cmd/api
