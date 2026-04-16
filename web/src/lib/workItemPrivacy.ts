import type { TrackerUserAccount, WorkItem } from '../types'

export function isPrivateWorkItem(item: WorkItem): boolean {
  return item.isPrivate === true && Boolean(item.privateOwnerUserId)
}

export function workItemVisibleToViewer(
  item: WorkItem,
  viewer: TrackerUserAccount | null | undefined,
): boolean {
  if (!isPrivateWorkItem(item)) return true
  if (!viewer) return false
  return item.privateOwnerUserId === viewer.id
}

export function filterWorkItemsForViewer(
  items: WorkItem[],
  viewer: TrackerUserAccount | null | undefined,
): WorkItem[] {
  if (!viewer) return []
  return items.filter((w) => workItemVisibleToViewer(w, viewer))
}

/** Block turning public items private or re-setting owner; clear owner when promoting. */
export function sanitizeWorkItemUpdate(
  existing: WorkItem,
  patch: Partial<WorkItem>,
): Partial<WorkItem> {
  const out = { ...patch }
  const wasPublic = existing.isPrivate !== true

  if (wasPublic) {
    if (out.isPrivate === true) {
      delete out.isPrivate
      delete out.privateOwnerUserId
    }
    if (out.privateOwnerUserId != null) {
      delete out.privateOwnerUserId
    }
  } else {
    if (out.isPrivate === true && out.privateOwnerUserId != null) {
      if (out.privateOwnerUserId !== existing.privateOwnerUserId) {
        delete out.privateOwnerUserId
      }
    }
    if (out.isPrivate === false) {
      out.privateOwnerUserId = undefined
    }
  }
  return out
}
