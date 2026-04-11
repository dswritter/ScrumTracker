import { isTrackerSyncEnabled } from './syncConfigured'

function ngrokSkipHeaderWanted(base: string): boolean {
  if (!base || base.startsWith('/')) return false
  try {
    const h = new URL(base).hostname
    return h.includes('ngrok')
  } catch {
    return false
  }
}

/** Base URL for sync HTTP calls: empty string = same origin as the page. */
export function syncApiBaseUrl(): string {
  if (import.meta.env.VITE_SYNC_SAME_ORIGIN === 'true') return ''
  const raw = import.meta.env.VITE_SYNC_API_URL?.trim()
  if (raw) return raw.replace(/\/$/, '')
  throw new Error(
    'Sync API not configured: set VITE_SYNC_SAME_ORIGIN=true or VITE_SYNC_API_URL',
  )
}

/** `ws:` / `wss:` for tracker rev push (same host as HTTP sync). */
export function syncTrackerWebSocketUrl(): string | null {
  if (!isTrackerSyncEnabled()) return null

  if (import.meta.env.VITE_SYNC_SAME_ORIGIN === 'true') {
    if (typeof window === 'undefined') return null
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProto}//${window.location.host}/ws/tracker`
  }

  const raw = import.meta.env.VITE_SYNC_API_URL?.trim()
  if (!raw) return null

  if (raw.startsWith('/')) {
    if (typeof window === 'undefined') return null
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProto}//${window.location.host}${raw.replace(/\/$/, '')}/ws/tracker`
  }

  try {
    const u = new URL(raw)
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    u.pathname = '/ws/tracker'
    u.search = ''
    u.hash = ''
    return u.toString()
  } catch {
    return null
  }
}

export async function syncFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const b = syncApiBaseUrl()
  const headers = new Headers(init?.headers)
  if (ngrokSkipHeaderWanted(b)) {
    if (!headers.has('ngrok-skip-browser-warning')) {
      headers.set('ngrok-skip-browser-warning', 'true')
    }
  }
  return fetch(`${b}${path}`, { ...init, headers })
}
