import type { TrackerTeam, TrackerUserAccount, WorkComment, WorkItem } from '../types'
import { commentAuthorLabel } from './commentAuthor'
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
  overseerOverride = false,
): boolean {
  if (!user) return false
  if (isPrivateWorkItem(item)) {
    return user.id === item.privateOwnerUserId
  }
  if (isAdmin(user) || overseerOverride) return true
  return isAssignedToItem(user.displayName, item)
}

export function canDeleteWorkItem(
  user: TrackerUserAccount | null,
  item: WorkItem,
  overseerOverride = false,
): boolean {
  if (!user) return false
  if (isPrivateWorkItem(item) && user.id === item.privateOwnerUserId) {
    return true
  }
  return isAdmin(user) || overseerOverride
}

export function canAddWorkItem(user: TrackerUserAccount | null): boolean {
  return Boolean(user)
}

export function canAddComment(
  user: TrackerUserAccount | null,
  item: WorkItem,
  overseerOverride = false,
): boolean {
  return canEditWorkItem(user, item, overseerOverride)
}

/** Remove a single comment (admin, or private item owner while still private). */
export function canDeleteComment(
  user: TrackerUserAccount | null,
  item: WorkItem,
  overseerOverride = false,
): boolean {
  if (!user) return false
  if (isPrivateWorkItem(item) && user.id === item.privateOwnerUserId) {
    return true
  }
  return isAdmin(user) || overseerOverride
}

/** Edit own comment body (same people who may add comments on this item). */
export function canEditOwnWorkComment(
  user: TrackerUserAccount | null,
  item: WorkItem,
  comment: WorkComment,
): boolean {
  if (!user || !canEditWorkItem(user, item)) return false
  const an = comment.authorName.trim()
  if (an === commentAuthorLabel(user)) return true
  const dn = user.displayName.trim()
  if (dn && an === dn) return true
  if (dn && an.startsWith(`${dn} (`)) return true
  return false
}

export function canChangeAssignees(
  user: TrackerUserAccount | null,
  item?: WorkItem,
  overseerOverride = false,
): boolean {
  if (item && isPrivateWorkItem(item)) return false
  return isAdmin(user) || overseerOverride
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

// ─── Org-hierarchy helpers ────────────────────────────────────────────────────

export function isManager(u: TrackerUserAccount | null | undefined): boolean {
  return u?.role === 'manager'
}

export function isDirector(u: TrackerUserAccount | null | undefined): boolean {
  return u?.role === 'director'
}

export function isUpperManagement(
  u: TrackerUserAccount | null | undefined,
): boolean {
  return u?.role === 'manager' || u?.role === 'director'
}

/** Teams where this user is listed as the direct overseer. */
export function getManagedTeams(
  userId: string,
  teams: TrackerTeam[],
): TrackerTeam[] {
  return teams.filter((t) => t.parentManagerId === userId)
}

/** Users who report directly to this user and are themselves managers/directors. */
export function getManagedManagers(
  userId: string,
  users: TrackerUserAccount[],
): TrackerUserAccount[] {
  return users.filter(
    (u) =>
      u.parentManagerId === userId &&
      (u.role === 'manager' || u.role === 'director'),
  )
}

/**
 * Recursively collect all teamIds reachable from a manager/director.
 * Uses a visited set to guard against cycles.
 */
export function getFullOrgScope(
  userId: string,
  users: TrackerUserAccount[],
  teams: TrackerTeam[],
  _visited = new Set<string>(),
): string[] {
  if (_visited.has(userId)) return []
  _visited.add(userId)
  const directTeamIds = getManagedTeams(userId, teams).map((t) => t.id)
  const subManagers = getManagedManagers(userId, users)
  const subTeamIds = subManagers.flatMap((m) =>
    getFullOrgScope(m.id, users, teams, _visited),
  )
  return [...new Set([...directTeamIds, ...subTeamIds])]
}

export function canOverseeTeam(
  user: TrackerUserAccount | null | undefined,
  teamId: string,
  users: TrackerUserAccount[],
  teams: TrackerTeam[],
): boolean {
  if (!user || !isUpperManagement(user)) return false
  return getFullOrgScope(user.id, users, teams).includes(teamId)
}
