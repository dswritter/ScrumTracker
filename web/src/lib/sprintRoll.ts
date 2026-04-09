import type { Sprint, WorkItem } from '../types'
import { formatYMD } from './sdates'

/**
 * For each sprint that has already ended (end < today), non-done items lose that
 * sprint tag and gain the chronologically next sprint in the list (if any).
 */
export function rollIncompleteItemsToNextSprint(
  sprints: Sprint[],
  workItems: WorkItem[],
  todayStr: string = formatYMD(new Date()),
): WorkItem[] {
  const sorted = [...sprints].sort(
    (a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id),
  )
  const indexById = new Map(sorted.map((s, i) => [s.id, i]))
  const nextIdBySprintId = new Map<string, string | undefined>()
  for (let i = 0; i < sorted.length - 1; i++) {
    nextIdBySprintId.set(sorted[i]!.id, sorted[i + 1]!.id)
  }

  return workItems.map((w) => {
    if (w.status === 'done') return w
    let sprintIds = [...w.sprintIds]
    let changed = true
    while (changed) {
      changed = false
      for (const sid of [...sprintIds]) {
        const sp = sprints.find((s) => s.id === sid)
        if (!sp || sp.end >= todayStr) continue
        const idx = indexById.get(sid)
        if (idx === undefined) continue
        const nextId = nextIdBySprintId.get(sid)
        sprintIds = sprintIds.filter((id) => id !== sid)
        if (nextId && !sprintIds.includes(nextId)) sprintIds.push(nextId)
        changed = true
        break
      }
    }
    return sprintIds.length === w.sprintIds.length &&
      sprintIds.every((id, i) => id === w.sprintIds[i])
      ? w
      : { ...w, sprintIds }
  })
}
