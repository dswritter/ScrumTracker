import type { TrackerUserAccount } from '../types'

/** Shown on new comments and in the composer label. */
export function commentAuthorLabel(user: TrackerUserAccount): string {
  const name = user.displayName.trim() || user.username
  return `${name} (@${user.username})`
}
