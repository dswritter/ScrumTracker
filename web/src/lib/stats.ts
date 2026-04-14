import type { Sprint, WorkItem, WorkStatus } from '../types'

const STATUS_WEIGHT: Record<WorkStatus, number> = {
  done: 100,
  in_progress: 55,
  to_test: 40,
  to_track: 25,
  blocked: 0,
  todo: 5,
}

export function statusWeight(status: WorkStatus): number {
  return STATUS_WEIGHT[status] ?? 0
}

export function countByStatus(items: WorkItem[]): Record<WorkStatus, number> {
  const init: Record<WorkStatus, number> = {
    done: 0,
    in_progress: 0,
    to_test: 0,
    to_track: 0,
    blocked: 0,
    todo: 0,
  }
  for (const w of items) init[w.status]++
  return init
}

export function allAssignees(
  teamMembers: string[],
  items: WorkItem[],
): string[] {
  const set = new Set<string>(teamMembers.map((t) => t.trim()).filter(Boolean))
  for (const w of items) {
    for (const a of w.assignees) {
      if (a.trim()) set.add(a.trim())
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export function itemsForAssignee(name: string, items: WorkItem[]): WorkItem[] {
  return items.filter((w) => w.assignees.some((a) => a.trim() === name))
}

/** Share of assigned items marked done (0–100). Matches dashboard pie “done” semantics. */
export function personCompletionPercent(
  name: string,
  items: WorkItem[],
): number {
  const mine = itemsForAssignee(name, items)
  if (mine.length === 0) return 0
  const done = mine.filter((w) => w.status === 'done').length
  return Math.round((done / mine.length) * 100)
}

/** Short Y-axis label for charts; avoids duplicate first names (e.g. two “Shubham”). */
export function assigneeChartAxisLabel(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return displayName.trim() || '—'
  if (parts.length === 1) {
    const p = parts[0]
    return p.length > 14 ? `${p.slice(0, 13)}…` : p
  }
  const first = parts[0]
  const last = parts[parts.length - 1]
  const initial = last[0] ?? ''
  const s = `${first} ${initial}.`
  return s.length > 16 ? `${first} ${initial}` : s
}

/** Unique short labels per roster (e.g. two “S. K.” → “Shivendra Kum.” vs “Sunil Kum.”). */
export function assigneeChartUniqueLabels(names: string[]): Map<string, string> {
  const sorted = [...names].sort((a, b) => a.localeCompare(b))
  const base = sorted.map((n) => ({ n, b: assigneeChartAxisLabel(n) }))
  const counts = new Map<string, number>()
  for (const x of base) counts.set(x.b, (counts.get(x.b) ?? 0) + 1)
  const out = new Map<string, string>()
  for (const { n, b } of base) {
    if ((counts.get(b) ?? 0) <= 1) {
      out.set(n, b)
      continue
    }
    const parts = n.trim().split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      const first = parts[0]
      const last = parts[parts.length - 1]
      const label = `${first} ${last.length > 3 ? `${last.slice(0, 3)}.` : `${last}.`}`
      out.set(n, label.length > 20 ? `${first} ${last.slice(0, 2)}.` : label)
    } else {
      out.set(n, b)
    }
  }
  return out
}

export function itemsInSprint(sprint: Sprint, items: WorkItem[]): WorkItem[] {
  return items.filter((w) => w.sprintIds.includes(sprint.id))
}

export function matrixCellItems(
  person: string,
  sprintId: string,
  items: WorkItem[],
): WorkItem[] {
  return items.filter(
    (w) =>
      w.sprintIds.includes(sprintId) &&
      w.assignees.some((a) => a.trim() === person),
  )
}

export function matrixCellTitles(
  person: string,
  sprintId: string,
  items: WorkItem[],
): string[] {
  return matrixCellItems(person, sprintId, items).map((w) => w.title)
}

/** Items tagged with the sprint (excludes items with no link to that sprint). */
export function filterItemsBySprint(
  items: WorkItem[],
  sprintId: string,
): WorkItem[] {
  return items.filter((w) => w.sprintIds.includes(sprintId))
}

export const IN_PROGRESS_GROUP: WorkStatus[] = [
  'in_progress',
  'to_test',
  'to_track',
]

export const BLOCKED_TODO_GROUP: WorkStatus[] = ['blocked', 'todo']

export function formerAssigneesOnItem(
  item: WorkItem,
  teamMembers: string[],
): string[] {
  const set = new Set(teamMembers.map((t) => t.trim()))
  return item.assignees.filter((a) => a.trim() && !set.has(a.trim()))
}

/** Assignees on items who are no longer on the active roster. */
export function formerTeammatesWithItems(
  teamMembers: string[],
  items: WorkItem[],
): string[] {
  const team = new Set(teamMembers.map((t) => t.trim()))
  const names = new Set<string>()
  for (const w of items) {
    for (const a of w.assignees) {
      const n = a.trim()
      if (n && !team.has(n)) names.add(n)
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

export function filterWorkItemsView(
  items: WorkItem[],
  opts: {
    sprintId?: string | null
    status?: WorkStatus | null
    group?: 'inProgress' | 'blockedTodo' | null
  },
): WorkItem[] {
  let out = items
  if (opts.sprintId) out = filterItemsBySprint(out, opts.sprintId)
  if (opts.status) out = out.filter((w) => w.status === opts.status)
  if (opts.group === 'inProgress')
    out = out.filter((w) => IN_PROGRESS_GROUP.includes(w.status))
  if (opts.group === 'blockedTodo')
    out = out.filter((w) => BLOCKED_TODO_GROUP.includes(w.status))
  return out
}

/** Newest sprint end date first; items with no sprints sort last. */
export function sortWorkItemsByNewestSprintFirst(
  items: WorkItem[],
  sprints: Sprint[],
): WorkItem[] {
  const endById = new Map(sprints.map((s) => [s.id, s.end]))
  function latestEnd(w: WorkItem): string {
    let best = ''
    for (const id of w.sprintIds) {
      const e = endById.get(id)
      if (e && e > best) best = e
    }
    return best || '0000-00-00'
  }
  return [...items].sort(
    (a, b) =>
      latestEnd(b).localeCompare(latestEnd(a)) || a.id.localeCompare(b.id),
  )
}

/** Other items that share at least one assignee with `item` (excludes `item`). */
export function otherItemsSharingAssignees(
  item: WorkItem,
  allItems: WorkItem[],
  sprints: Sprint[],
): WorkItem[] {
  const mine = new Set(
    item.assignees.map((a) => a.trim()).filter(Boolean),
  )
  const others = allItems.filter(
    (w) =>
      w.id !== item.id &&
      w.assignees.some((a) => mine.has(a.trim())),
  )
  return sortWorkItemsByNewestSprintFirst(others, sprints)
}
