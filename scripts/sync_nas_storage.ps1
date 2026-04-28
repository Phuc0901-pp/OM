<#
.SYNOPSIS
    Script đồng bộ dữ liệu từ MinIO lên NAS công ty (\\192.168.31.205\Raitek).

.DESCRIPTION
    Quy trình:
    1. Kết nối NAS nếu chưa mount (tài khoản PhucPH).
    2. Dùng MinIO Client (mc) mirror toàn bộ bucket MinIO --> Z:\07 Project Dept\09 Dev.
    3. Duyệt từng thư mục Project vừa sync, tự tạo thư mục "Reports" nếu chưa tồn tại.
    4. Ghi log kết quả vào nas_sync.log ngay trong thư mục scripts\.

.NOTES
    - Cấu hình MinIO: chỉnh các biến $MinioAlias, $MinioEndpoint, $MinioAccessKey, $MinioSecretKey, $MinioBucket phù hợp môi trường.
    - Có thể kết hợp Windows Task Scheduler để chạy định kỳ mỗi 15-30 phút.
#>

# ── Cấu hình ────────────────────────────────────────────────────────────────
$MinioAlias     = "om_prod"
$MinioEndpoint  = "http://192.168.31.254:2603"
$MinioAccessKey = "phucraitek0539"
$MinioSecretKey = "090103Phuc"
$MinioBucket    = "dev"

$NasHost        = "192.168.31.205"
$NasShare       = "Raitek"
$NasUser        = "PhucPH"
$NasPassword    = "E&cV9Y9t"
$NasDriveLetter = "Z:"
$NasTargetDir   = "Z:\07 Project Dept\09 Dev"
$ReportsDirName = "Reports"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$LogFile   = Join-Path $ScriptDir "nas_sync.log"

# ── Helper: ghi log có timestamp ─────────────────────────────────────────────
function Write-Log {
    param([string]$Message, [string]$Color = "White")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$timestamp] $Message"
    Write-Host $line -ForegroundColor $Color
    Add-Content -Path $LogFile -Value $line
}

Write-Log "============================================================" "Cyan"
Write-Log " BAT DAU DONG BO: MinIO --> NAS (\\$NasHost\$NasShare)" "Cyan"
Write-Log "============================================================" "Cyan"

# ── 1. Kiểm tra & Mount NAS ──────────────────────────────────────────────────
Write-Log "[1/4] Kiem tra ket noi NAS..." "Yellow"

$existingDrive = Get-PSDrive -Name ($NasDriveLetter -replace ":","") -ErrorAction SilentlyContinue
if (-not $existingDrive) {
    Write-Log "       NAS chua duoc mount. Dang ket noi..." "Yellow"
    try {
        $securePass = ConvertTo-SecureString $NasPassword -AsPlainText -Force
        $cred = New-Object System.Management.Automation.PSCredential("$NasHost\$NasUser", $securePass)
        New-PSDrive -Name ($NasDriveLetter -replace ":","") -PSProvider FileSystem `
            -Root "\\$NasHost\$NasShare" -Credential $cred -Persist -ErrorAction Stop | Out-Null
        Write-Log "       [OK] Ket noi NAS thanh cong tai $NasDriveLetter" "Green"
    } catch {
        Write-Log "       [LOI] Khong the ket noi NAS: $_" "Red"
        exit 1
    }
} else {
    Write-Log "       [OK] NAS da duoc mount tai $NasDriveLetter" "Green"
}

# ── 2. Đảm bảo thư mục đích tồn tại ─────────────────────────────────────────
if (-not (Test-Path $NasTargetDir)) {
    New-Item -ItemType Directory -Path $NasTargetDir -Force | Out-Null
    Write-Log "       [OK] Da tao thu muc dich: $NasTargetDir" "Green"
}

# ── 3. Kiểm tra MinIO Client (mc.exe) ────────────────────────────────────────
Write-Log "[2/4] Kiem tra MinIO Client (mc.exe)..." "Yellow"
$mcPath = where.exe mc 2>$null
if (-not $mcPath) {
    # Thử tìm trong thư mục scripts hoặc PATH cục bộ
    $localMc = Join-Path $ScriptDir "mc.exe"
    if (Test-Path $localMc) {
        $mcPath = $localMc
    } else {
        Write-Log "       [LOI] Khong tim thay mc.exe. Vui long cai dat MinIO Client:" "Red"
        Write-Log "             https://dl.min.io/client/mc/release/windows-amd64/mc.exe" "Red"
        Write-Log "             Luu vao thu muc scripts\ hoac them vao PATH." "Red"
        exit 1
    }
}
Write-Log "       [OK] Tim thay mc tai: $mcPath" "Green"

# ── 4. Cấu hình alias MinIO (idempotent) ─────────────────────────────────────
Write-Log "[3/4] Dang cau hinh alias MinIO va sync du lieu..." "Yellow"

# Kiểm tra MinIO có đang chạy không trước khi sync
Write-Log "       Dang kiem tra ket noi MinIO ($MinioEndpoint)..." "Yellow"
try {
    $response = Invoke-WebRequest -Uri "$MinioEndpoint/minio/health/live" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-Log "       [OK] MinIO dang hoat dong (HTTP $($response.StatusCode))." "Green"
} catch {
    Write-Log "       [LOI] Khong the ket noi MinIO tai $MinioEndpoint" "Red"
    Write-Log "             Vui long dam bao Docker containers dang chay (docker compose up -d)." "Red"
    Write-Log "             Dong bo du lieu se duoc thu lai lan chay ke tiep." "Yellow"
    exit 1
}
& $mcPath alias set $MinioAlias $MinioEndpoint $MinioAccessKey $MinioSecretKey --api S3v4 2>&1 | Out-Null

# Mirror MinIO bucket --> NAS target directory
# --overwrite   : Ghi de file da ton tai neu khac noi dung
# NOTE: --preserve khong duoc ho tro khi destination la Windows filesystem
Write-Log "       Dang mirror bucket [$MinioBucket] --> $NasTargetDir ..." "Yellow"
$mirrorOutput = & $mcPath mirror --overwrite `
    "${MinioAlias}/${MinioBucket}" $NasTargetDir 2>&1

$mirrorOutput | ForEach-Object { Write-Log "       $_" }

if ($LASTEXITCODE -ne 0) {
    Write-Log "       [CANH BAO] mc mirror ket thuc voi ma loi $LASTEXITCODE. Kiem tra log ben tren." "Yellow"
} else {
    Write-Log "       [OK] Mirror hoan tat." "Green"
}

# ── 5. Tự động tạo thư mục Reports trong mỗi Project ─────────────────────────
Write-Log "[4/4] Tu dong tao thu muc '$ReportsDirName' trong tung Thang cua Project..." "Yellow"

# Cấu trúc MinIO: <ProjectSlug>/<YYYY>/<MM-YYYY>/...
# Tương ứng trên NAS: <ProjectSlug>/<YYYY>/<MM-YYYY>/...
# Thư mục Reports sẽ nằm ở cấp <MM-YYYY>, vd:
#   Z:\07 Project Dept\09 Dev\ten-du-an\2025\04-2025\Reports\

$createdCount = 0
$projectDirs  = Get-ChildItem -Path $NasTargetDir -Directory -ErrorAction SilentlyContinue

if ($projectDirs.Count -eq 0) {
    Write-Log "       Chua co du lieu Project nao duoc sync. Bo qua buoc nay." "Yellow"
} else {
    foreach ($projectDir in $projectDirs) {
        # Bỏ qua thư mục Reports ở ngoài cùng (nếu còn sót lại từ logic cũ)
        if ($projectDir.Name -eq $ReportsDirName) { continue }
        
        $yearDirs = Get-ChildItem -Path $projectDir.FullName -Directory -ErrorAction SilentlyContinue
        foreach ($yearDir in $yearDirs) {
            # Bỏ qua nếu có thư mục nào không phải Năm
            if ($yearDir.Name -eq $ReportsDirName) { continue }
            
            $monthDirs = Get-ChildItem -Path $yearDir.FullName -Directory -ErrorAction SilentlyContinue
            foreach ($monthDir in $monthDirs) {
                # Chỉ lấy các thư mục có dạng MM-YYYY (VD: 04-2025) để tránh nhầm lẫn
                if ($monthDir.Name -match "^\d{2}-\d{4}$") {
                    $reportsPath = Join-Path $monthDir.FullName $ReportsDirName
                    if (-not (Test-Path $reportsPath)) {
                        New-Item -ItemType Directory -Path $reportsPath -Force | Out-Null
                        Write-Log "       [TAO MOI] $reportsPath" "Green"
                        $createdCount++
                    }
                }
            }
        }
    }
    if ($createdCount -eq 0) {
        Write-Log "       [OK] Tat ca thu muc Reports da ton tai. Khong can tao them." "Green"
    } else {
        Write-Log "       [OK] Da tao $createdCount thu muc Reports moi." "Green"
    }
}

Write-Log "============================================================" "Green"
Write-Log " HOAN TAT DONG BO!" "Green"
Write-Log " Thu muc dich : $NasTargetDir" "White"
Write-Log " Log file     : $LogFile" "White"
Write-Log "============================================================" "Green"
