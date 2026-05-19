import type { WorkComment } from '../types'

function closeTimes(aIso: string, bIso: string, maxMs: number): boolean {
  const a = Date.parse(aIso)
  const b = Date.parse(bIso)
  if (Number.isNaN(a) || Number.isNaN(b)) return false
  return Math.abs(a - b) <= maxMs
}

/**
 * Drop tracker-only rows that duplicate a Jira-mirrored row (same body, close timestamps).
 * Prefers keeping the `jira-cmt-*` id so sync stays stable.
 */
export function dedupeWorkCommentsForDisplay(comments: WorkComment[]): WorkComment[] {
  const list = [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const drop = new Set<string>()
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]
      const b = list[j]
      const ta = (a.body || '').trim()
      const tb = (b.body || '').trim()
      if (!ta || ta !== tb) continue
      if (!closeTimes(a.createdAt, b.createdAt, 180_000)) continue
      const aJ = a.id.startsWith('jira-cmt-')
      const bJ = b.id.startsWith('jira-cmt-')
      if (aJ && !bJ) drop.add(b.id)
      else if (!aJ && bJ) drop.add(a.id)
    }
  }
  return list.filter((c) => !drop.has(c.id))
}
