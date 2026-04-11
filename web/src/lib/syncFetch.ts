import { isTrackerSyncEnabled } from './syncConfigured'

/** Vite may inline env as string; be tolerant at runtime. */
function envFlagTrue(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1'
}

function ngrokSkipHeaderWanted(base: string): boolean {
  if (!base || base.startsWith('/')) return false
  try {
    const h = new URL(base).hostname
    return h.includes('ngrok')
  } catch {
    return false
  }
}

function defaultPortForProtocol(protocol: string): string {
  return protocol === 'https:' ? '443' : '80'
}

function effectivePagePort(): string {
  if (typeof window === 'undefined') return ''
  return (
    window.location.port ||
    defaultPortForProtocol(window.location.protocol)
  )
}

/** Vite dev server / preview — keep using VITE_SYNC_API_URL (usually localhost:3847). */
const DEV_VITE_UI_PORTS = new Set(['5173', '4173'])

/**
 * Use relative /api and same-host WebSocket when the SPA is served from the real app host
 * (LAN, ngrok, etc.) but the build still contains a loopback VITE_SYNC_API_URL from .env.local.
 *
 * If the address bar is already localhost/127.0.0.1, we keep the baked URL (same as relative).
 * Connection refused then means the Node server is not running on that machine.
 */
function shouldUsePageOriginForSync(): boolean {
  if (envFlagTrue(import.meta.env.VITE_SYNC_SAME_ORIGIN)) return true

  const raw = import.meta.env.VITE_SYNC_API_URL?.trim()
  if (!raw || raw.startsWith('/')) return false

  let api: URL
  try {
    api = new URL(raw)
  } catch {
    return false
  }

  const apiLoop =
    api.hostname === 'localhost' || api.hostname === '127.0.0.1'
  if (!apiLoop) return false

  if (typeof window === 'undefined') return false

  const host = window.location.hostname
  const pageLoop = host === 'localhost' || host === '127.0.0.1'
  if (pageLoop) return false

  if (DEV_VITE_UI_PORTS.has(effectivePagePort())) return false

  return true
}

/** Base URL for sync HTTP calls: empty string = same origin as the page. */
export function syncApiBaseUrl(): string {
  if (shouldUsePageOriginForSync()) return ''

  const raw = import.meta.env.VITE_SYNC_API_URL?.trim()
  if (raw) return raw.replace(/\/$/, '')

  throw new Error(
    'Sync API not configured: set VITE_SYNC_SAME_ORIGIN=true or VITE_SYNC_API_URL',
  )
}

/** `ws:` / `wss:` for tracker rev push (same host as HTTP sync). */
export function syncTrackerWebSocketUrl(): string | null {
  if (!isTrackerSyncEnabled()) return null

  if (shouldUsePageOriginForSync()) {
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
