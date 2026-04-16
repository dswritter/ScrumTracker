import type { TrackerUserAccount, WorkItem } from '../types'
import { isPrivateWorkItem, workItemVisibleToViewer } from './workItemPrivacy'

export function isAdmin(u: TrackerUserAccount | null | undefined): boolean {
  return u?.role === 'admin'
}

export function isAssignedToItem(
  displayName: string,
  item: WorkItem,
): boolean {
  return item.assignees.some((a) => a.trim() === displayName.trim())
}

/** Full row edit (fields, sprints, JIRA, status) except delete. */
export function canEditWorkItem(
  user: TrackerUserAccount | null,
  item: WorkItem,
): boolean {
  if (!user) return false
  if (isPrivateWorkItem(item)) {
    return user.id === item.privateOwnerUserId
  }
  if (isAdmin(user)) return true
  return isAssignedToItem(user.displayName, item)
}

export function canDeleteWorkItem(
  user: TrackerUserAccount | null,
  item: WorkItem,
): boolean {
  if (!user) return false
  if (isPrivateWorkItem(item) && user.id === item.privateOwnerUserId) {
    return true
  }
  return isAdmin(user)
}

export function canAddWorkItem(user: TrackerUserAccount | null): boolean {
  return Boolean(user)
}

export function canAddComment(
  user: TrackerUserAccount | null,
  item: WorkItem,
): boolean {
  return canEditWorkItem(user, item)
}

/** Remove a single comment (admin, or private item owner while still private). */
export function canDeleteComment(
  user: TrackerUserAccount | null,
  item: WorkItem,
): boolean {
  if (!user) return false
  if (isPrivateWorkItem(item) && user.id === item.privateOwnerUserId) {
    return true
  }
  return isAdmin(user)
}

export function canChangeAssignees(
  user: TrackerUserAccount | null,
  item?: WorkItem,
): boolean {
  if (item && isPrivateWorkItem(item)) return false
  return isAdmin(user)
}

export function canViewPersonProfile(
  viewer: TrackerUserAccount | null,
  personName: string,
  teamMembers: string[],
  workItems: WorkItem[],
): boolean {
  if (!viewer) return false
  const pn = personName.trim()
  if (viewer.displayName.trim() === pn) return true
  if (teamMembers.some((m) => m.trim() === pn)) return true
  if (!isAdmin(viewer)) return false
  return workItems.some((w) =>
    w.assignees.some((a) => a.trim() === pn),
  )
}

/** Read-only item page: teammates may open any team work item; editing uses canEditWorkItem. */
export function canViewWorkItemDetail(
  user: TrackerUserAccount | null,
  item: WorkItem,
  teamWorkItems: WorkItem[],
): boolean {
  if (!user) return false
  if (!workItemVisibleToViewer(item, user)) return false
  if (canEditWorkItem(user, item)) return true
  if (isAdmin(user)) return true
  return teamWorkItems.some((w) => w.id === item.id)
}
