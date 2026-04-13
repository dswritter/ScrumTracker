/**
 * Caches public/offline-instructions.html via a service worker so repeat visitors
 * see instructions when the host is down (requires secure context: HTTPS or localhost).
 */
export function registerOfflineFallbackServiceWorker(): void {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return
  if (!window.isSecureContext) {
    console.info(
      '[ScrumTracker] Offline backup page needs a secure context (HTTPS or localhost). LAN http may not register a service worker.',
    )
    return
  }

  const raw = import.meta.env.BASE_URL || '/'
  const base = raw.endsWith('/') ? raw : `${raw}/`
  const swPath = `${base}sw-offline.js`

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(swPath, { scope: base })
      .catch((err) =>
        console.warn('[ScrumTracker] Offline service worker registration failed:', err),
      )
  })
}
