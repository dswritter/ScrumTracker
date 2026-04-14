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

export async function postJiraCreateIssue(body: {
  teamId: string
  projectKey: string
  issueType: string
  summary: string
  description?: string
  syncMode?: 'admin' | 'individual'
  trackerUsername?: string
}) {
  return syncFetch('/api/jira/create-issue', {
    method: 'POST',
    headers: jiraHeaders(),
    body: JSON.stringify(body),
  })
}

export type JiraProjectOption = { key: string; name: string }
export type JiraIssueTypeOption = { id: string; name: string }

function jiraMetaQuery(
  teamId: string,
  syncMode: 'admin' | 'individual',
  trackerUsername: string | undefined,
  extra?: Record<string, string>,
) {
  const p = new URLSearchParams({ teamId, syncMode })
  if (trackerUsername) p.set('trackerUsername', trackerUsername)
  if (extra) {
    for (const [k, v] of Object.entries(extra)) p.set(k, v)
  }
  return p
}

export async function fetchJiraProjectsForTeam(q: {
  teamId: string
  syncMode: 'admin' | 'individual'
  trackerUsername?: string
}): Promise<
  | { ok: true; projects: JiraProjectOption[] }
  | { ok: false; message: string }
> {
  const params = jiraMetaQuery(q.teamId, q.syncMode, q.trackerUsername)
  try {
    const res = await syncFetch(`/api/jira/meta/projects?${params}`, {
      headers: jiraHeaders(),
    })
    if (!res.ok) {
      return { ok: false, message: await res.text() }
    }
    const data = (await res.json()) as { projects?: JiraProjectOption[] }
    return { ok: true, projects: Array.isArray(data.projects) ? data.projects : [] }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Request failed',
    }
  }
}

export async function fetchJiraIssueTypesForProject(q: {
  teamId: string
  projectKey: string
  syncMode: 'admin' | 'individual'
  trackerUsername?: string
}): Promise<
  | { ok: true; issueTypes: JiraIssueTypeOption[] }
  | { ok: false; message: string }
> {
  const params = jiraMetaQuery(q.teamId, q.syncMode, q.trackerUsername, {
    projectKey: q.projectKey,
  })
  try {
    const res = await syncFetch(`/api/jira/meta/issue-types?${params}`, {
      headers: jiraHeaders(),
    })
    if (!res.ok) {
      return { ok: false, message: await res.text() }
    }
    const data = (await res.json()) as { issueTypes?: JiraIssueTypeOption[] }
    return {
      ok: true,
      issueTypes: Array.isArray(data.issueTypes) ? data.issueTypes : [],
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Request failed',
    }
  }
}

export type JiraLookupResult =
  | { status: 'found'; key: string; summary: string }
  | { status: 'notfound'; error: string }
  | { status: 'failed'; message: string }

export async function fetchJiraLookupIssue(q: {
  teamId: string
  key: string
  syncMode: 'admin' | 'individual'
  trackerUsername?: string
}): Promise<JiraLookupResult> {
  const params = jiraMetaQuery(q.teamId, q.syncMode, q.trackerUsername, {
    key: q.key.trim().toUpperCase(),
  })
  try {
    const res = await syncFetch(`/api/jira/lookup-issue?${params}`, {
      headers: jiraHeaders(),
    })
    if (!res.ok) {
      return { status: 'failed', message: await res.text() }
    }
    const data = (await res.json()) as {
      ok?: boolean
      key?: string
      summary?: string
      error?: string
    }
    if (data.ok === true && typeof data.key === 'string') {
      return {
        status: 'found',
        key: data.key,
        summary: typeof data.summary === 'string' ? data.summary : '',
      }
    }
    return {
      status: 'notfound',
      error: typeof data.error === 'string' ? data.error : 'Not found',
    }
  } catch (e) {
    return {
      status: 'failed',
      message: e instanceof Error ? e.message : 'Request failed',
    }
  }
}
