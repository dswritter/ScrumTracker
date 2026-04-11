# ================================
# START ALL SERVICES (HIDDEN)
# ================================

Write-Host "🚀 Starting ScrumTracker services..."

# Step 1: Start backend (hidden)
Start-Process "cmd.exe" -ArgumentList "/c cd D:\ScrumTracker\server && npm start" -WindowStyle Hidden

Start-Sleep -Seconds 3

# Step 2: Start ngrok (hidden)
Start-Process "D:\ScrumTracker\ngrok.exe" -ArgumentList "http 3847" -WindowStyle Hidden

Start-Sleep -Seconds 5

# Step 3: Get ngrok URL via API
try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels"
    $url = ($response.tunnels | Where-Object { $_.public_url -like "https://*" })[0].public_url

    Write-Host "🌐 Ngrok URL: $url"
} catch {
    Write-Host "❌ Failed to get ngrok URL"
    exit
}

# Step 4: Update env file
$envPath = "D:\ScrumTracker\web\.env.production"
"VITE_SYNC_API_URL=$url" | Out-File -Encoding ASCII $envPath

Write-Host "✅ Updated .env.production"

# Step 5: Install deps (picks up package.json changes, e.g. recharts) then build
Set-Location "D:\ScrumTracker\web"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "npm install failed"
    exit $LASTEXITCODE
}
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "npm run build failed"
    exit $LASTEXITCODE
}

# Step 6: Start frontend (hidden)
Start-Process "cmd.exe" -ArgumentList "/c cd D:\ScrumTracker\web && npm run preview -- --host" -WindowStyle Hidden

Write-Host "✅ Frontend started"

Write-Host "🎉 All services running in background!"