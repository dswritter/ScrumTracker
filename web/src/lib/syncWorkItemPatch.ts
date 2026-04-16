import { isTrackerSyncEnabled } from './syncConfigured'
import { syncFetch } from './syncFetch'
import { writePersistedTrackerServerRev } from './trackerSyncRev'
import type { WorkItem } from '../types'

const MERGEABLE_KEYS: (keyof WorkItem)[] = [
  'title',
  'section',
  'component',
  'eta',
  'status',
  'assignees',
  'sprintIds',
  'jiraKeys',
  'jiraStatusName',
  'jiraNeedsSprintLabel',
]

export function pickMergeableWorkItemPatch(
  patch: Partial<WorkItem>,
): Partial<WorkItem> {
  const out: Partial<WorkItem> = {}
  for (const k of MERGEABLE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, k)) {
      ;(out as Record<string, unknown>)[k as string] = patch[k] as unknown
    }
  }
  return out
}

type Pending = {
  timer: ReturnType<typeof setTimeout> | null
  baseRev: number
  baseUpdatedAt: string
  changes: Record<string, unknown>
}

const pending = new Map<string, Pending>()

function pendingKey(teamId: string, itemId: string) {
  return `${teamId}\0${itemId}`
}

const DEBOUNCE_MS = 380

/**
 * Debounced PATCH of mergeable work-item fields (HTTP sync). Avoids static import
 * cycle with the tracker store by dynamic-importing it in the flush step.
 */
export function scheduleRemoteWorkItemPatch(
  teamId: string,
  itemId: string,
  before: WorkItem,
  patch: Partial<WorkItem>,
): void {
  if (!isTrackerSyncEnabled()) return
  const delta = pickMergeableWorkItemPatch(patch)
  if (Object.keys(delta).length === 0) return

  const k = pendingKey(teamId, itemId)
  let p = pending.get(k)
  if (!p) {
    p = {
      timer: null,
      baseRev: before.rev ?? 0,
      baseUpdatedAt: before.updated_at ?? '1970-01-01T00:00:00.000Z',
      changes: {},
    }
    pending.set(k, p)
  }
  Object.assign(p.changes, delta as Record<string, unknown>)
  if (p.timer) clearTimeout(p.timer)
  p.timer = setTimeout(() => {
    p!.timer = null
    void flushRemoteWorkItemPatch(teamId, itemId)
  }, DEBOUNCE_MS)
}

async function flushRemoteWorkItemPatch(teamId: string, itemId: string) {
  const k = pendingKey(teamId, itemId)
  const p = pending.get(k)
  if (!p || Object.keys(p.changes).length === 0) {
    pending.delete(k)
    return
  }
  const body = {
    baseRev: p.baseRev,
    baseUpdatedAt: p.baseUpdatedAt,
    clientTimestamp: new Date().toISOString(),
    changes: p.changes,
  }
  pending.delete(k)

  try {
    const res = await syncFetch(
      `/api/tracker/teams/${encodeURIComponent(teamId)}/work-items/${encodeURIComponent(itemId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    const text = await res.text()
    const { useTrackerStore } = await import('../store/useTrackerStore')

    if (res.status === 409) {
      let parsed: {
        conflicts?: string[]
        serverItem?: WorkItem
        mergedPartial?: WorkItem
      } = {}
      try {
        parsed = JSON.parse(text) as typeof parsed
      } catch {
        /* empty */
      }
      if (parsed.serverItem) {
        useTrackerStore.getState().setWorkItemSyncConflict({
          teamId,
          itemId,
          conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
          serverItem: parsed.serverItem,
          mergedPartial: parsed.mergedPartial,
        })
      }
      return
    }

    if (!res.ok) {
      if (import.meta.env.DEV) {
        console.warn('[sync] PATCH work item failed', res.status, text)
      }
      return
    }

    let j: { rev?: number; workItem?: WorkItem }
    try {
      j = JSON.parse(text) as { rev?: number; workItem?: WorkItem }
    } catch {
      return
    }
    if (typeof j.rev === 'number') {
      writePersistedTrackerServerRev(j.rev)
    }
    if (j.workItem) {
      useTrackerStore.getState().applyWorkItemFromPatch(teamId, j.workItem)
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[sync] PATCH work item error', e)
    }
  }
}
