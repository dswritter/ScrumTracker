/** Headers that help ngrok free tier return JSON instead of an HTML interstitial page. */
const EXTRA_HEADERS: Record<string, string> = {
  'ngrok-skip-browser-warning': 'true',
}

export function syncApiBaseUrl(): string | null {
  const raw = import.meta.env.VITE_SYNC_API_URL?.trim()
  return raw ? raw.replace(/\/$/, '') : null
}

/** `ws:` / `wss:` URL for instant tracker revision notifications (same host as `VITE_SYNC_API_URL`). */
export function syncTrackerWebSocketUrl(): string | null {
  const b = syncApiBaseUrl()
  if (!b) return null
  try {
    const u = new URL(b)
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    u.pathname = '/ws/tracker'
    u.search = ''
    u.hash = ''
    return u.toString()
  } catch {
    return null
  }
}

function baseUrl(): string | null {
  return syncApiBaseUrl()
}

export async function syncFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const b = baseUrl()
  if (!b) throw new Error('VITE_SYNC_API_URL is not set')
  const headers = new Headers(init?.headers)
  for (const [k, v] of Object.entries(EXTRA_HEADERS)) {
    if (!headers.has(k)) headers.set(k, v)
  }
  return fetch(`${b}${path}`, { ...init, headers })
}
