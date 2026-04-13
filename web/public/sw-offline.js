/* Offline fallback: cache offline-instructions.html and show it when navigation fails. */
const CACHE = 'scrum-offline-instructions-v1'

function offlinePageUrl() {
  return new URL('offline-instructions.html', self.location).href
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(offlinePageUrl()))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

async function refreshOfflineCopy() {
  try {
    const cache = await caches.open(CACHE)
    const res = await fetch(offlinePageUrl(), { cache: 'no-cache' })
    if (res.ok) await cache.put(offlinePageUrl(), res.clone())
  } catch {
    /* ignore */
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const accept = req.headers.get('accept') || ''
  const isHtmlNavigation =
    req.mode === 'navigate' ||
    (req.destination === 'document' && accept.includes('text/html'))

  if (!isHtmlNavigation) return

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) event.waitUntil(refreshOfflineCopy())
        return res
      })
      .catch(() =>
        caches.match(offlinePageUrl()).then((cached) => {
          if (cached) return cached
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unavailable</title></head><body><p>Server unreachable and no offline page was cached yet. Open the app once while online.</p></body></html>',
            {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            },
          )
        }),
      ),
  )
})
