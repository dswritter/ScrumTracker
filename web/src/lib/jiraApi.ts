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

export async function postJiraSync(body: {
  snapshot: string
  teamId: string
  jql?: string
}) {
  return syncFetch('/api/jira/sync', {
    method: 'POST',
    headers: jiraHeaders(),
    body: JSON.stringify(body),
  })
}
