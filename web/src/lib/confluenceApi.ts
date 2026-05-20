import type { ConfluencePageRef } from '../types'
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

/** Sync all pages in the configured space. Returns lightweight metadata refs (no body). */
export async function runConfluenceSync(
  teamId: string,
): Promise<{ ok: true; pages: ConfluencePageRef[]; pageCount: number } | { ok: false; error: string }> {
  try {
    const res = await syncFetch('/api/confluence/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error ?? `HTTP ${res.status}` }
    }
    return { ok: true, pages: (json.pages ?? []) as ConfluencePageRef[], pageCount: json.pageCount as number }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed' }
  }
}

/** Fetch the full body of a single Confluence page from the server (on-demand). */
export async function fetchConfluencePageBody(
  teamId: string,
  pageId: string,
): Promise<{ ok: true; body: string; syncError: string | null } | { ok: false; error: string }> {
  try {
    const res = await syncFetch(`/api/confluence/body?teamId=${encodeURIComponent(teamId)}&pageId=${encodeURIComponent(pageId)}`)
    const json = await res.json()
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error ?? `HTTP ${res.status}` }
    }
    return { ok: true, body: json.body as string, syncError: json.syncError as string | null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed' }
  }
}
