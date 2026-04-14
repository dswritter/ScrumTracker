import { syncFetch } from './syncFetch'

function jiraHeaders(): Headers {
  const h = new Headers({ 'Content-Type': 'application/json' })
  const secret = import.meta.env.VITE_JIRA_API_SECRET?.trim()
  if (secret) h.set('Authorization', `Bearer ${secret}`)
  return h
}

export async function postJiraToken(token: string, expiresAt?: string) {
  return syncFetch('/api/jira/token', {
    method: 'POST',
    headers: jiraHeaders(),
    body: JSON.stringify({ token, expiresAt }),
  })
}

export async function getJiraTokenStatus() {
  return syncFetch('/api/jira/token-status', { headers: jiraHeaders() })
}

export async function postJiraUserToken(
  username: string,
  token: string,
  expiresAt?: string,
) {
  return syncFetch('/api/jira/user-token', {
    method: 'POST',
    headers: jiraHeaders(),
    body: JSON.stringify({ username, token, expiresAt }),
  })
}

export async function getJiraUserTokenStatus(username: string) {
  const q = new URLSearchParams({ username })
  return syncFetch(`/api/jira/user-token-status?${q}`, {
    headers: jiraHeaders(),
  })
}

export type JiraTokenStatusPayload = {
  status?: string
  daysRemaining?: number | null
  message?: string
}

export async function fetchJiraTokenStatusPayload(): Promise<JiraTokenStatusPayload | null> {
  try {
    const res = await getJiraTokenStatus()
    if (!res.ok) return null
    return (await res.json()) as JiraTokenStatusPayload
  } catch {
    return null
  }
}

export async function fetchJiraUserTokenStatusPayload(
  username: string,
): Promise<JiraTokenStatusPayload | null> {
  try {
    const res = await getJiraUserTokenStatus(username)
    if (!res.ok) return null
    return (await res.json()) as JiraTokenStatusPayload
  } catch {
    return null
  }
}

/** True when the sync server has an active (non-expired) Jira PAT — sync can run. */
export function jiraTokenStatusAllowsSync(
  payload: JiraTokenStatusPayload | null,
): boolean {
  const s = payload?.status
  if (!s || s === 'none' || s === 'expired') return false
  return true
}

export async function postJiraSync(body: {
  snapshot: string
  teamId: string
  jql?: string
  syncMode?: 'admin' | 'individual'
  trackerUsername?: string
}) {
  return syncFetch('/api/jira/sync', {
    method: 'POST',
    headers: jiraHeaders(),
    body: JSON.stringify(body),
  })
}
