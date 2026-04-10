/** Headers that help ngrok free tier return JSON instead of an HTML interstitial page. */
const EXTRA_HEADERS: Record<string, string> = {
  'ngrok-skip-browser-warning': 'true',
}

function baseUrl(): string | null {
  const raw = import.meta.env.VITE_SYNC_API_URL?.trim()
  return raw ? raw.replace(/\/$/, '') : null
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
