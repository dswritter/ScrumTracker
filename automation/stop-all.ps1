# ================================
# STOP ALL SERVICES
# ================================

Write-Host "Stopping ScrumTracker services..."

# Kill Node (backend + frontend)
taskkill /IM node.exe /F 2>$null

# Kill ngrok
taskkill /IM ngrok.exe /F 2>$null

Write-Host "All services stopped."
Write-Host ""
Write-Host "Tip (green offline page): Service workers only run in a secure context (HTTPS or http://127.0.0.1 / localhost)."
Write-Host "  If you use http://<LAN-IP>:3847, a refresh while Node is stopped may show the browser's generic error."
Write-Host "  Use your ngrok https URL or http://127.0.0.1:3847 and open the app once while online so the page is cached."
Write-Host ""
