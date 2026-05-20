import { syncFetch } from './syncFetch'

export async function postConfluenceToken(token: string, baseUrl: string) {
  return syncFetch('/api/confluence/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, baseUrl }),
  })
}

export async function getConfluenceTokenStatus(): Promise<{ configured: boolean }> {
  try {
    const res = await syncFetch('/api/confluence/token-status')
    if (!res.ok) return { configured: false }
    return (await res.json()) as { configured: boolean }
  } catch {
    return { configured: false }
  }
}

export async function runConfluenceSync(
  teamId: string,
  snapshot: string,
): Promise<{ ok: true; snapshot: string; pageCount: number } | { ok: false; error: string }> {
  try {
    const res = await syncFetch('/api/confluence/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, snapshot }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error ?? `HTTP ${res.status}` }
    }
    return { ok: true, snapshot: json.snapshot as string, pageCount: json.pageCount as number }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed' }
  }
}
