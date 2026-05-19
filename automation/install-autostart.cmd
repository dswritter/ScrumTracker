@echo off
:: ============================================================
:: ScrumTracker — register auto-start via Windows Task Scheduler
:: Runs serve.cmd (Node + ngrok, NO rebuild) at every login.
:: Run once as Administrator, or approve the UAC prompt.
:: ============================================================
setlocal

set "TASKNAME=ScrumTracker Autostart"
set "SCRIPT=%~dp0serve.cmd"

echo ScrumTracker Autostart Installer
echo =================================
echo Task name : %TASKNAME%
echo Script    : %SCRIPT%
echo Trigger   : At log on of current user
echo.

:: Remove existing task silently so we can recreate cleanly
schtasks /query /tn "%TASKNAME%" >nul 2>&1
if %errorlevel% equ 0 (
    echo Removing existing task...
    schtasks /delete /tn "%TASKNAME%" /f >nul 2>&1
)

:: Register the task
::   /sc ONLOGON   — fires when ANY user logs on
::   /rl HIGHEST   — run with highest available privileges (no UAC popup at start)
::   /delay 0001:00 — wait 1 minute after logon before starting (lets network settle)
::   /f            — force overwrite if somehow still present
schtasks /create ^
    /tn "%TASKNAME%" ^
    /tr "\"%SCRIPT%\"" ^
    /sc ONLOGON ^
    /rl HIGHEST ^
    /delay 0001:00 ^
    /f >nul 2>&1

if %errorlevel% equ 0 (
    echo.
    echo SUCCESS — ScrumTracker will start automatically after your next login.
    echo.
    echo  - To start NOW without rebooting: double-click serve.cmd
    echo  - To rebuild the web app first  : double-click start-all.cmd
    echo  - To remove autostart           : double-click remove-autostart.cmd
) else (
    echo.
    echo ERROR — could not register the task.
    echo Try right-clicking this file and choosing "Run as administrator".
)

echo.
pause
