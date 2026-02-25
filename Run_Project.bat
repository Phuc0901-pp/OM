@echo off
title Running Solar O&M Project...
echo ========================================================
echo   Running Solar O&M Project (via auto_start.ps1)
echo ========================================================

rem Run the PowerShell script in the same directory
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0auto_start.ps1"

echo.
if %errorlevel% neq 0 (
    echo [ERROR] Script failed with error code %errorlevel%.
    pause
)
