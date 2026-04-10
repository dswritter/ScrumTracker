# ================================
# STOP ALL SERVICES
# ================================

Write-Host "🛑 Stopping ScrumTracker services..."

# Kill Node (backend + frontend)
taskkill /IM node.exe /F 2>$null

# Kill ngrok
taskkill /IM ngrok.exe /F 2>$null

Write-Host "✅ All services stopped"