@echo off
echo ===============================================
echo Starting Solar O&M Development Environment
echo ===============================================

echo 1. Starting Backend API (Go)...
start "Backend API" cmd /k "cd backend && go run cmd/api/main.go"

echo 2. Starting Frontend (React/Vite)...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo 3. Starting Backend Tunnel (Cloudflare)...
start "Backend Tunnel" cmd /k "cd backend && cloudflared tunnel --url http://localhost:3000"

echo 4. Starting Frontend Tunnel (Cloudflare)...
start "Frontend Tunnel" cmd /k "cd frontend && cloudflared tunnel --url http://localhost:5173"

echo ===============================================
echo All services are launching in separate windows.
echo Please check each window for status/errors.
echo ===============================================
pause
