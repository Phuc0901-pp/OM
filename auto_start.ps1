# Solar O&M Auto-Start Script
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Starting Solar O&M Development Environment   " -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

$backendDir = ".\backend"
$frontendDir = ".\frontend"
$logFile = "$backendDir\backend_tunnel.log"
$envFile = "$frontendDir\.env.local"

# 1. Start Backend API
Write-Host "1. Starting Backend API..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/k cd $backendDir && go run cmd/api/main.go" -WindowStyle Minimized

# 2. Start Backend Tunnel and Wait for URL
Write-Host "2. Starting Backend Tunnel..." -ForegroundColor Green
# Clean old log
if (Test-Path $logFile) { Remove-Item $logFile }

# Start Cloudflare Tunnel (Redirect output to log)
$tunnelProc = Start-Process cmd -ArgumentList "/c cd $backendDir && cloudflared tunnel --url http://localhost:3000 > backend_tunnel.log 2>&1" -PassThru -WindowStyle Minimized

Write-Host "   Waiting for Tunnel URL generation..." -NoNewline

$tunnelUrl = ""
$maxRetries = 30 # 30 seconds timeout
$retry = 0

while ($retry -lt $maxRetries) {
    if (Test-Path $logFile) {
        $content = Get-Content $logFile -Raw
        # Regex to find https://...trycloudflare.com
        if ($content -match '(https://[a-zA-Z0-9-]+\.trycloudflare\.com)') {
            $tunnelUrl = $matches[1]
            break
        }
    }
    Start-Sleep -Seconds 1
    Write-Host "." -NoNewline
    $retry++
}

Write-Host ""
if ($tunnelUrl -eq "") {
    Write-Error "Failed to retrieve Tunnel URL. Please check $logFile."
    exit
}

Write-Host "   -> Tunnel URL Found: $tunnelUrl" -ForegroundColor Yellow

# 3. Update Frontend Configuration
Write-Host "3. Updating Frontend Config (.env.local)..." -ForegroundColor Green

$apiUrl = "$tunnelUrl/api"
$envContent = "VITE_API_URL=$apiUrl"
Set-Content -Path $envFile -Value $envContent

Write-Host "   -> Updated VITE_API_URL to: $apiUrl" -ForegroundColor Gray

# 4. Start Frontend
Write-Host "4. Starting Frontend..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/k cd $frontendDir && npm run dev"

# 5. Start Frontend Tunnel
Write-Host "5. Starting Frontend Tunnel..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/k cd $frontendDir && cloudflared tunnel --url http://localhost:5173"

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  All services runnning!                       " -ForegroundColor Cyan
Write-Host "  Backend URL is synced to Frontend.           " -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
