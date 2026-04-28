<#
.SYNOPSIS
    Đăng ký Windows Task Scheduler để tự động chạy sync_nas_storage.ps1 mỗi 30 phút.

.DESCRIPTION
    Script này chỉ cần chạy MỘT LẦN duy nhất (với quyền Administrator).
    Sau đó, Windows sẽ tự gọi sync_nas_storage.ps1 lặp lại định kỳ ở chế độ ẩn.

.NOTES
    Chạy lệnh trong PowerShell với quyền Administrator:
    powershell -ExecutionPolicy Bypass -File "scripts\register_sync_task.ps1"
#>

$TaskName     = "RaitakOM_SyncNAS"
$TaskDesc     = "Tu dong dong bo du lieu anh tu MinIO len NAS cong ty (192.168.31.205). Chay moi 30 phut."
$ScriptDir    = Split-Path -Parent $MyInvocation.MyCommand.Definition
$SyncScript   = Join-Path $ScriptDir "sync_nas_storage.ps1"

# Xác nhận file tồn tại
if (-not (Test-Path $SyncScript)) {
    Write-Host "[LOI] Khong tim thay file: $SyncScript" -ForegroundColor Red
    Write-Host "      Hay chay script nay tu thu muc OM\scripts\" -ForegroundColor Red
    exit 1
}

# Xóa task cũ nếu tồn tại (để cập nhật)
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[OK] Da xoa task cu: $TaskName" -ForegroundColor Yellow
}

# Tạo Action: gọi PowerShell chạy ẩn
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$SyncScript`""

# Trigger: lặp mỗi 30 phút, bắt đầu ngay khi đăng ký
$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 30) -Once -At (Get-Date)

# Settings: chạy ngầm kể cả khi không có người đăng nhập
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

# Đăng ký Task với quyền SYSTEM (không cần password)
Register-ScheduledTask `
    -TaskName    $TaskName `
    -Description $TaskDesc `
    -Action      $action `
    -Trigger     $trigger `
    -Settings    $settings `
    -RunLevel    Highest `
    -Force | Out-Null

Write-Host ""
Write-Host "=================================================" -ForegroundColor Green
Write-Host " DANG KY TASK THANH CONG!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host " Task Name : $TaskName" -ForegroundColor White
Write-Host " Tan suat  : Moi 30 phut" -ForegroundColor White
Write-Host " Script    : $SyncScript" -ForegroundColor White
Write-Host ""
Write-Host " Quan ly task tai: Task Scheduler --> Task Scheduler Library" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Green
