#requires -Version 5.1

# ============================ [TOKEN-KEY-NOTE] ============================
# MIGRATION / NEW-HOST SETUP — READ BEFORE MOVING THIS APP TO ANOTHER MACHINE
#
# When copying ScrumTracker to a new host, copy the ENTIRE `server/data/`
# folder INCLUDING the hidden file `server/data/.token-key`.
#
# Why: `.token-key` is the AES-256 key that decrypts each user's stored Jira &
# Confluence Personal Access Tokens (PATs). It is a HIDDEN dotfile and the data
# dir is gitignored, so ordinary copies can miss it. If it is not carried over,
# the new host generates a fresh key, the old PATs can no longer be decrypted,
# and every user must re-enter their PAT. (Passwords and all other data are
# unaffected — only PATs are lost.)
#
# REMOVE THIS NOTE if PAT storage moves off the local key-file approach
# (e.g. SCRUM_TOKEN_KEY set everywhere, OAuth, or an external secrets manager).
# See docs/security.md.
# =========================== [/TOKEN-KEY-NOTE] ===========================

[CmdletBinding()]
param(
    # Repo root (folder that contains server/, web/). Omit to infer parent of this script's folder.
    [string] $RepoRoot = '',
    # Single port for UI (static), /api/*, and /ws/tracker - match Windows Firewall + ngrok to this.
    [int] $Port = 3847,
    # Show a console for Node so startup errors are visible (debug).
    [switch] $ShowServerWindow
)

$ErrorActionPreference = 'Stop'

if (-not $RepoRoot) {
    $scriptDir = $PSScriptRoot
    if ([string]::IsNullOrWhiteSpace($scriptDir) -and $MyInvocation.MyCommand.Path) {
        $scriptDir = Split-Path -LiteralPath $MyInvocation.MyCommand.Path -Parent
    }
    if ([string]::IsNullOrWhiteSpace($scriptDir)) {
        Write-Error @"
Could not determine repo root: `$PSScriptRoot is empty and MyCommand.Path is missing.
Fix: run from automation folder, or pass an explicit path, e.g.:
  .\start-all.ps1 -RepoRoot 'D:\ScrumTracker-main'
Or use start-all.cmd (calls PowerShell with -ExecutionPolicy Bypass).
"@
        exit 1
    }
    $RepoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
}

$ServerDir = Join-Path $RepoRoot 'server'
$WebDir = Join-Path $RepoRoot 'web'
$EnvFile = Join-Path $WebDir '.env.production'
$NgrokExe = Join-Path $RepoRoot 'ngrok.exe'

if (-not (Test-Path -LiteralPath $NgrokExe)) {
    Write-Error "ngrok.exe not found at $NgrokExe - public tunnel is required."
    exit 1
}

Write-Host "ScrumTracker: repo=$RepoRoot"

# One process, one port: Node serves web/dist + API + WebSocket (server/server.mjs).
Set-Content -Path $EnvFile -Value 'VITE_SYNC_SAME_ORIGIN=true' -Encoding ascii

Push-Location $WebDir
try {
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Pop-Location
}

Push-Location $ServerDir
try {
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Pop-Location
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not in PATH. Install Node LTS and re-open PowerShell."
    exit 1
}

# Avoid npm.cmd + hidden window (errors were invisible). Run node directly with PORT set.
$runner = Join-Path $env:TEMP ("scrum-tracker-server-{0}.cmd" -f $Port)
@"
@echo off
set PORT=$Port
cd /d "$ServerDir"
node server.mjs
"@ | Set-Content -LiteralPath $runner -Encoding ascii

$winStyle = if ($ShowServerWindow) { 'Normal' } else { 'Hidden' }
Start-Process -FilePath $runner -WindowStyle $winStyle
Start-Sleep -Seconds 5

try {
    $health = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/health" -UseBasicParsing -TimeoutSec 5
    if ($health.StatusCode -ne 200) {
        Write-Warning "Server returned HTTP $($health.StatusCode) from /api/health"
    }
    else {
        Write-Host "OK: sync server responding on http://127.0.0.1:$Port/api/health"
    }
}
catch {
    Write-Warning "Cannot reach http://127.0.0.1:$Port/api/health"
    Write-Host "Fix: run once with a visible server window to see the error:"
    Write-Host "  .\start-all.ps1 -ShowServerWindow"
    Write-Host "Or manually:  cd `"$ServerDir`"; `$env:PORT='$Port'; node server.mjs"
}

Start-Process -FilePath $NgrokExe -ArgumentList 'http', ([string]$Port) -WindowStyle Hidden
Start-Sleep -Seconds 5

try {
    $t = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 5
    $https = @($t.tunnels | Where-Object { $_.public_url -like 'https://*' })
    if ($https.Count -gt 0) {
        Write-Host ""
        Write-Host "Open this URL in the browser (UI + sync + Jira + chat on one origin):"
        Write-Host $https[0].public_url
        Write-Host ""
    }
    else {
        Write-Warning "Ngrok has no HTTPS tunnel yet; check http://127.0.0.1:4040"
    }
}
catch {
    Write-Warning "Could not read ngrok API (is ngrok running?): $_"
}

# Prefer IPs on adapters that have a default gateway; skip Hyper-V/WSL/vEthernet (often .231.1 etc.).
try {
    $excludeIf = 'Loopback|vEthernet|WSL|VirtualBox|VMware|Hyper-V|Bluetooth|Default Switch'
    $list = New-Object System.Collections.Generic.List[string]

    $withGw = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
        Where-Object {
            $_.NetAdapter.Status -eq 'Up' -and
            $_.IPv4DefaultGateway -and
            $_.IPv4Address -and
            $_.IPv4Address.IPAddress -notlike '169.254.*' -and
            $_.InterfaceAlias -notmatch $excludeIf
        }
    foreach ($n in $withGw) {
        $list.Add($n.IPv4Address.IPAddress)
    }

    if ($list.Count -eq 0) {
        Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object {
                $_.IPAddress -notlike '127.*' -and
                $_.IPAddress -notlike '169.254.*' -and
                $_.InterfaceAlias -notmatch $excludeIf -and
                $_.PrefixOrigin -ne 'WellKnown'
            } |
            ForEach-Object { $list.Add($_.IPAddress) }
    }

    $ips = $list | Select-Object -Unique
    if ($ips.Count -gt 0) {
        Write-Host ""
        Write-Host "LAN (same Wi-Fi/VPN) - try from your Mac/phone:"
        foreach ($ip in $ips) {
            Write-Host "  http://${ip}:$Port/"
        }
        Write-Host "If these fail, run ipconfig and use the IPv4 under your active Ethernet or Wi-Fi adapter."
        Write-Host ""
    }
}
catch { }

Write-Host "Listening on port $Port (stop Node with Task Manager if needed)."
Write-Host "If LAN access is blocked: New-NetFirewallRule -DisplayName ScrumTracker -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow (run PowerShell as Administrator)."
