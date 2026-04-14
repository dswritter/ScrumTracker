import type { TrackerUserAccount, WorkItem } from '../types'

const STORAGE_KEY = 'st-jira-project-usage-v1'

function jiraProjectFromIssueKey(key: string): string | null {
  const u = key.trim().toUpperCase()
  const i = u.indexOf('-')
  if (i <= 0) return null
  return u.slice(0, i)
}

function usageFromAssignedItems(
  workItems: WorkItem[],
  userDisplayName: string,
): Record<string, number> {
  const un = userDisplayName.trim()
  const counts: Record<string, number> = {}
  for (const w of workItems) {
    if (!w.assignees.some((a) => a.trim() === un)) continue
    for (const k of w.jiraKeys) {
      const p = jiraProjectFromIssueKey(k)
      if (p) counts[p] = (counts[p] ?? 0) + 1
    }
  }
  return counts
}

function readStored(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object') return {}
    return o as Record<string, number>
  } catch {
    return {}
  }
}

function writeStored(next: Record<string, number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota / private mode */
  }
}

/** Bump after a successful create so the picker favors recently used projects. */
export function bumpJiraProjectUsage(projectKey: string) {
  const u = projectKey.trim().toUpperCase()
  if (!u) return
  const cur = readStored()
  cur[u] = (cur[u] ?? 0) + 1
  writeStored(cur)
}

/**
 * Order: highest usage (assigned-task counts + stored bonus), then CT* keys with * zero score, then other keys — each tier sorted by key.
 */
export function sortJiraProjectsForPicker<T extends { key: string }>(
  projects: T[],
  workItems: WorkItem[],
  user: TrackerUserAccount | null,
): T[] {
  const fromItems = user
    ? usageFromAssignedItems(workItems, user.displayName)
    : {}
  const stored = readStored()
  const scoreFor = (key: string) => {
    const k = key.toUpperCase()
    return (fromItems[k] ?? 0) + (stored[k] ?? 0) * 3
  }
  const isCt = (key: string) => key.toUpperCase().startsWith('CT')

  return [...projects].sort((a, b) => {
    const sa = scoreFor(a.key)
    const sb = scoreFor(b.key)
    if (sa !== sb) return sb - sa
    if (sa === 0 && sb === 0) {
      const ca = isCt(a.key)
      const cb = isCt(b.key)
      if (ca !== cb) return ca ? -1 : 1
    }
    return a.key.localeCompare(b.key)
  })
}
