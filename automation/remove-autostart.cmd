@echo off
:: Remove the ScrumTracker Task Scheduler auto-start task.
setlocal

set "TASKNAME=ScrumTracker Autostart"

schtasks /query /tn "%TASKNAME%" >nul 2>&1
if %errorlevel% neq 0 (
    echo Task "%TASKNAME%" not found — nothing to remove.
    pause
    exit /b 0
)

schtasks /delete /tn "%TASKNAME%" /f
if %errorlevel% equ 0 (
    echo ScrumTracker autostart removed successfully.
) else (
    echo ERROR — could not remove task. Try running as Administrator.
)

pause
