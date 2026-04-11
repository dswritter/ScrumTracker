#requires -Version 5.1
[CmdletBinding()]
param(
    [string] $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
$ServerDir = Join-Path $RepoRoot 'server'
$WebDir = Join-Path $RepoRoot 'web'
$EnvFile = Join-Path $WebDir '.env.production'
$NgrokExe = Join-Path $RepoRoot 'ngrok.exe'

if (-not (Test-Path -LiteralPath $NgrokExe)) {
    Write-Error "ngrok.exe not found at $NgrokExe — public tunnel is required."
    exit 1
}

Write-Host "ScrumTracker: repo=$RepoRoot"

# One public URL: SPA + /api + /ws are all served from :3847 (see server/server.mjs).
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

Start-Process cmd.exe -ArgumentList '/c', "cd /d `"$ServerDir`" && npm start" -WindowStyle Hidden
Start-Sleep -Seconds 4

Start-Process -FilePath $NgrokExe -ArgumentList 'http', '3847' -WindowStyle Hidden
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

Write-Host "Backend: port3847 (stop with Task Manager if needed)."
