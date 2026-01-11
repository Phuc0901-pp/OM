@echo off
cd backend
echo Starting Backend with visible logs...
go run cmd/api/main.go
pause
