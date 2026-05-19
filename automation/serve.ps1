#requires -Version 5.1
<#
.SYNOPSIS
    Start the ScrumTracker sync server and ngrok tunnel WITHOUT rebuilding the web app.
    Use this for auto-start at login. Run start-all.ps1 when you want to rebuild first.
#>
[CmdletBinding()]
param(
    [string] $RepoRoot = '',
    [int]    $Port = 3847,
    [switch] $ShowServerWindow
)

$ErrorActionPreference = 'Stop'

if (-not $RepoRoot) {
    $scriptDir = $PSScriptRoot
    if ([string]::IsNullOrWhiteSpace($scriptDir) -and $MyInvocation.MyCommand.Path) {
        $scriptDir = Split-Path -LiteralPath $MyInvocation.MyCommand.Path -Parent
    }
    if ([string]::IsNullOrWhiteSpace($scriptDir)) {
        Write-Error "Could not determine repo root. Pass -RepoRoot explicitly."
        exit 1
    }
    $RepoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
}

$ServerDir = Join-Path $RepoRoot 'server'
$NgrokExe  = Join-Path $RepoRoot 'ngrok.exe'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not in PATH. Install Node LTS and re-open."
    exit 1
}

if (-not (Test-Path (Join-Path $ServerDir 'server.mjs'))) {
    Write-Error "server.mjs not found at $ServerDir — check RepoRoot."
    exit 1
}

# Kill any existing node process on this port (stale from previous session)
$existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    $pid = ($existing | Select-Object -First 1).OwningProcess
    Write-Host "Port $Port already in use by PID $pid — stopping it first..."
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Write a tiny .cmd that sets PORT and launches node directly (avoids npm overhead)
$runner = Join-Path $env:TEMP ("scrum-tracker-serve-{0}.cmd" -f $Port)
@"
@echo off
set PORT=$Port
cd /d "$ServerDir"
node server.mjs
"@ | Set-Content -LiteralPath $runner -Encoding ascii

$winStyle = if ($ShowServerWindow) { 'Normal' } else { 'Hidden' }
Start-Process -FilePath $runner -WindowStyle $winStyle
Start-Sleep -Seconds 4

# Health check
try {
    $h = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/health" -UseBasicParsing -TimeoutSec 5
    if ($h.StatusCode -eq 200) {
        Write-Host "OK: sync server is up on http://127.0.0.1:$Port"
    }
} catch {
    Write-Warning "Server did not respond on /api/health — it may still be starting."
}

# Start ngrok
if (Test-Path -LiteralPath $NgrokExe) {
    Start-Process -FilePath $NgrokExe -ArgumentList 'http', ([string]$Port) -WindowStyle Hidden
    Start-Sleep -Seconds 4
    try {
        $t     = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 5
        $https = @($t.tunnels | Where-Object { $_.public_url -like 'https://*' })
        if ($https.Count -gt 0) {
            Write-Host "Public URL: $($https[0].public_url)"
        }
    } catch { }
} else {
    Write-Warning "ngrok.exe not found at $NgrokExe — skipping tunnel."
}

Write-Host "ScrumTracker running on port $Port."
