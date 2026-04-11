#requires -Version 5.1
[CmdletBinding()]
param(
    [string] $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    # Single port for UI (static), /api/*, and /ws/tracker — match Windows Firewall + ngrok to this.
    [int] $Port = 3847
)

$ErrorActionPreference = 'Stop'
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

# cmd: set PORT for this session, then npm start (PS 5.1-safe; no "&&").
$startCmd = "/c set PORT=$Port& npm start"
Start-Process -FilePath 'cmd.exe' -ArgumentList $startCmd -WorkingDirectory $ServerDir -WindowStyle Hidden
Start-Sleep -Seconds 4

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

try {
    $lanIp = (
        Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.IPAddress -notlike '127.*' -and
            $_.IPAddress -notlike '169.254.*' -and
            $_.PrefixOrigin -ne 'WellKnown'
        } |
        Select-Object -First 1
    ).IPAddress
    if ($lanIp) {
        Write-Host ""
        Write-Host "Same network: http://${lanIp}:$Port/ (one port: UI + API + WebSocket)"
        Write-Host ""
    }
}
catch { }

Write-Host "Listening on port $Port (stop Node with Task Manager if needed)."
Write-Host "If LAN access is blocked: New-NetFirewallRule -DisplayName ScrumTracker -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow (run PowerShell as Administrator)."
