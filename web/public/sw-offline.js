/* Offline fallback: cache offline-instructions.html; on network failure serve it for HTML navigations. */
const CACHE = 'scrum-offline-instructions-v2'

function offlinePageUrl() {
  return new URL('offline-instructions.html', self.location).href
}

/** Same content as offline-instructions.html so the cache is never empty if install-time fetch fails. */
function offlineDocumentResponse() {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Scrum tracker — server unavailable</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.45;
        color: #f0fdf4;
        background: linear-gradient(160deg, #004d26 0%, #007a3d 35%, #00b050 100%);
        padding: clamp(1.25rem, 4vw, 2rem);
      }
      .wrap { max-width: 38rem; margin: 0 auto; }
      .hero {
        font-size: clamp(1.35rem, 4.2vw, 1.85rem);
        font-weight: 700;
        margin: 0 0 1rem;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        letter-spacing: -0.02em;
      }
      .sub {
        font-size: clamp(1rem, 2.8vw, 1.15rem);
        font-weight: 600;
        margin: 0 0 1.5rem;
        color: #dcfce7;
        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.15);
      }
      .note {
        font-size: 0.95rem;
        color: rgba(240, 253, 244, 0.92);
        margin: 0 0 1.25rem;
      }
      .card {
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.28);
        border-radius: 0.875rem;
        padding: 1.25rem 1.35rem;
        backdrop-filter: blur(8px);
      }
      .card h2 {
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin: 0 0 0.85rem;
        color: #bbf7d0;
      }
      ul { margin: 0; padding-left: 1.2rem; font-size: 0.9rem; color: #f0fdf4; }
      li { margin-bottom: 0.65rem; }
      li:last-child { margin-bottom: 0; }
      strong { font-weight: 700; color: #fff; }
      code {
        font-size: 0.85em;
        padding: 0.12em 0.4em;
        border-radius: 0.3rem;
        background: rgba(0, 0, 0, 0.2);
      }
      .hint {
        font-size: 0.82rem;
        color: rgba(240, 253, 244, 0.78);
        margin-top: 1.35rem;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <p class="hero">That's not your fault, the only machine that hosts the content might be down.</p>
      <p class="sub">Are you in-office? Re-start the machine at seat N132-04-286.</p>
      <p class="note">Your browser could not connect to the app server. This page was saved on your device from a previous visit.</p>
      <div class="card">
        <h2>What to try</h2>
        <ul>
          <li>If your team uses an <strong>HTTPS tunnel (ngrok)</strong>, open that URL instead of a raw LAN address when the office PC is reachable.</li>
          <li>Confirm the <strong>Windows PC</strong> that runs the server is powered on, awake, and on the network.</li>
          <li>On that PC, run your startup script (e.g. <code>.\\start-all.ps1</code>) or start Node on port <strong>3847</strong> so the app and API listen again.</li>
          <li>Check firewall rules allow inbound <strong>TCP 3847</strong> (or your team's port).</li>
          <li>When the server is back, <strong>reload this tab</strong> or open the app URL again.</li>
        </ul>
      </div>
      <p class="hint">First-time visitors won't see this backup until they load the app at least once while the server is online. Contact your team admin if this keeps happening.</p>
    </div>
  </body>
</html>`
  return new Response(html, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => {
        try {
          const res = await fetch(offlinePageUrl(), { cache: 'reload' })
          if (res.ok) {
            await cache.put(offlinePageUrl(), res.clone())
            return
          }
        } catch {
          /* use inline */
        }
        await cache.put(offlinePageUrl(), offlineDocumentResponse())
      })
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

function isHtmlDocumentRequest(req) {
  if (req.method !== 'GET') return false
  const accept = req.headers.get('accept') || ''
  if (req.mode === 'navigate') return true
  if (req.destination === 'document') return true
  if (accept.includes('text/html')) return true
  return false
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (!isHtmlDocumentRequest(req)) return

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) event.waitUntil(refreshOfflineCopy())
        return res
      })
      .catch(() =>
        caches.match(offlinePageUrl()).then((cached) => {
          if (cached) return cached
          return offlineDocumentResponse()
        }),
      ),
  )
})
