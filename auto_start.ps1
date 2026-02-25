# Solar O&M Auto-Start Script (Ngrok)
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Starting Solar O&M Development Environment   " -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

$backendDir = ".\backend"
$frontendDir = ".\frontend"
$envFile = "$frontendDir\.env.local"
$ngrokAuthtoken = "39UIIFQJBZSpeplFpaDaa1GHrBY_7UjSxjpXrdTuVrJeXW7TE"

# 1. Start Backend API
Write-Host "1. Starting Backend API (port 4000)..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/k cd $backendDir && go run cmd/api/main.go" -WindowStyle Minimized

# 2. Start Frontend Dev Server (port 8080, has Vite proxy /api -> localhost:4000)
Write-Host "2. Starting Frontend (port 8080)..." -ForegroundColor Green
# Set VITE_API_URL to relative path so Vite proxy handles /api requests
$envContent = "VITE_API_URL=/api"
Set-Content -Path $envFile -Value $envContent
Write-Host "   -> Set VITE_API_URL=/api (Vite proxy -> localhost:4000)" -ForegroundColor Gray
Start-Process cmd -ArgumentList "/k cd $frontendDir && npm run dev"

# 3. Start Ngrok Tunnel (single tunnel for frontend, Vite proxies /api to backend)
Write-Host "3. Starting Ngrok Tunnel (port 8080)..." -ForegroundColor Green
Start-Process cmd -ArgumentList "/c ngrok http 8080 --authtoken $ngrokAuthtoken --log=stdout" -WindowStyle Minimized

Write-Host "   Waiting for Ngrok URL..." -NoNewline

$tunnelUrl = ""
$maxRetries = 30
$retry = 0

while ($retry -lt $maxRetries) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction SilentlyContinue
        if ($response.tunnels.Count -gt 0) {
            $tunnelUrl = ($response.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1).public_url
            if (-not $tunnelUrl) {
                $tunnelUrl = $response.tunnels[0].public_url
            }
            if ($tunnelUrl) { break }
        }
    } catch {}
    Start-Sleep -Seconds 1
    Write-Host "." -NoNewline
    $retry++
}

Write-Host ""

if ($tunnelUrl -eq "") {
    Write-Host "   WARNING: Could not auto-detect Ngrok URL." -ForegroundColor Red
    Write-Host "   Please check: http://localhost:4040" -ForegroundColor Red
} else {
    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host "  DEPLOYMENT SUCCESSFUL! " -ForegroundColor Green
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Web App: $tunnelUrl" -ForegroundColor Yellow
    Write-Host "  (Frontend + API all through one URL)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Local:   http://localhost:8080" -ForegroundColor Gray
    Write-Host "  Ngrok:   http://localhost:4040" -ForegroundColor Gray
    Write-Host "===============================================" -ForegroundColor Cyan
}

