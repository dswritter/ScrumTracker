/**
 * Smart field-level merge for work items (split JSON / concurrent edit plan).
 * Uses per-field server timestamps vs client baseUpdatedAt to detect conflicts.
 */

const MIN_ISO = '1970-01-01T00:00:00.000Z'

/** Keys allowed through PATCH (comments / privacy use other flows). */
export const MERGEABLE_WORK_ITEM_KEYS = [
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

function isoNow() {
  return new Date().toISOString()
}

function normRev(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function cloneJson(x) {
  return JSON.parse(JSON.stringify(x))
}

export function pickMergeableChanges(raw) {
  if (!raw || typeof raw !== 'object') return {}
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const k of MERGEABLE_WORK_ITEM_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, k)) out[k] = raw[k]
  }
  return out
}

/**
 * @param {unknown} snapshotParsed - TrackerSnapshot
 * @param {string} teamId
 * @param {string} itemId
 * @param {{ baseRev?: unknown, baseUpdatedAt?: unknown, clientTimestamp?: unknown, changes?: unknown }} body
 */
export function patchWorkItemInSnapshot(snapshotParsed, teamId, itemId, body) {
  if (!snapshotParsed || typeof snapshotParsed !== 'object') {
    return { ok: false, status: 400, error: 'Invalid snapshot' }
  }
  const teamsData = snapshotParsed.teamsData
  if (!teamsData || typeof teamsData !== 'object' || !teamsData[teamId]) {
    return { ok: false, status: 404, error: 'Unknown team' }
  }
  const team = teamsData[teamId]
  const workItems = Array.isArray(team.workItems) ? team.workItems : []
  const idx = workItems.findIndex((w) => w && w.id === itemId)
  if (idx < 0) {
    return { ok: false, status: 404, error: 'Unknown work item' }
  }

  const changes = pickMergeableChanges(body?.changes)
  if (Object.keys(changes).length === 0) {
    return { ok: false, status: 400, error: 'No mergeable changes' }
  }

  const clientTs =
    typeof body?.clientTimestamp === 'string' && body.clientTimestamp
      ? body.clientTimestamp
      : isoNow()
  const baseUpdatedAt =
    typeof body?.baseUpdatedAt === 'string' && body.baseUpdatedAt
      ? body.baseUpdatedAt
      : MIN_ISO
  const baseRev = normRev(body?.baseRev)

  const serverItem = workItems[idx]
  const serverRev = normRev(serverItem.rev)
  const serverUpdatedAt =
    typeof serverItem.updated_at === 'string' && serverItem.updated_at
      ? serverItem.updated_at
      : MIN_ISO
  const serverFieldUpdates =
    serverItem.field_updates && typeof serverItem.field_updates === 'object'
      ? serverItem.field_updates
      : {}

  /** Fast path: client had latest revision */
  if (baseRev === serverRev) {
    const next = applyAllChanges(serverItem, changes, clientTs)
    const nextItems = workItems.slice()
    nextItems[idx] = next
    const nextSnapshot = {
      ...snapshotParsed,
      teamsData: {
        ...teamsData,
        [teamId]: { ...team, workItems: nextItems },
      },
    }
    return { ok: true, snapshot: nextSnapshot, workItem: next }
  }

  /** Field-level merge */
  const conflicts = []
  const merged = cloneJson(serverItem)
  merged.field_updates =
    merged.field_updates && typeof merged.field_updates === 'object'
      ? { ...merged.field_updates }
      : {}
  let applied = 0
  for (const key of Object.keys(changes)) {
    const serverTouchRaw = serverFieldUpdates[key] || serverUpdatedAt
    const serverTouch =
      typeof serverTouchRaw === 'string' ? serverTouchRaw : MIN_ISO
    if (serverTouch > baseUpdatedAt) {
      conflicts.push(key)
      continue
    }
    merged[key] = changes[key]
    merged.field_updates[key] = clientTs
    applied++
  }

  if (applied > 0) {
    merged.updated_at = isoNow()
    merged.rev = serverRev + 1
  }

  const nextItems = workItems.slice()
  nextItems[idx] = merged
  const nextSnapshot = {
    ...snapshotParsed,
    teamsData: {
      ...teamsData,
      [teamId]: { ...team, workItems: nextItems },
    },
  }

  if (conflicts.length > 0) {
    return {
      ok: false,
      status: 409,
      body: {
        type: 'CONFLICT',
        conflicts,
        serverItem: cloneJson(serverItem),
        mergedPartial: merged,
      },
    }
  }

  return { ok: true, snapshot: nextSnapshot, workItem: merged }
}

function applyAllChanges(serverItem, changes, clientTs) {
  const merged = cloneJson(serverItem)
  merged.field_updates =
    merged.field_updates && typeof merged.field_updates === 'object'
      ? { ...merged.field_updates }
      : {}
  for (const key of Object.keys(changes)) {
    merged[key] = changes[key]
    merged.field_updates[key] = clientTs
  }
  merged.updated_at = isoNow()
  merged.rev = normRev(serverItem.rev) + 1
  return merged
}
