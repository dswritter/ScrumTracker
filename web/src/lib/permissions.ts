import type { TrackerUserAccount, WorkItem } from '../types'

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
  if (isAdmin(user)) return true
  return isAssignedToItem(user.displayName, item)
}

export function canDeleteWorkItem(user: TrackerUserAccount | null): boolean {
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

/** Remove a single comment (admin only). */
export function canDeleteComment(user: TrackerUserAccount | null): boolean {
  return isAdmin(user)
}

export function canChangeAssignees(user: TrackerUserAccount | null): boolean {
  return isAdmin(user)
}

export function canViewPersonProfile(
  viewer: TrackerUserAccount | null,
  personName: string,
  teamMembers: string[],
  workItems: WorkItem[],
): boolean {
  if (!viewer) return false
  if (viewer.displayName.trim() === personName.trim()) return true
  if (!isAdmin(viewer)) return false
  if (teamMembers.includes(personName)) return true
  return workItems.some((w) =>
    w.assignees.some((a) => a.trim() === personName.trim()),
  )
}
