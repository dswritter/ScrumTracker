import type { Sprint } from '../types'

export function parseYMD(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Inclusive calendar days from today through sprint end; 0 if already past end. */
export function daysInclusiveUntilEnd(
  sprintEnd: string,
  today: Date = new Date(),
): number {
  const t = formatYMD(today)
  if (t > sprintEnd) return 0
  const start = parseYMD(t)
  const end = parseYMD(sprintEnd)
  return (
    Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  )
}

export function formatYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(iso: string, days: number): string {
  const d = parseYMD(iso)
  d.setDate(d.getDate() + days)
  return formatYMD(d)
}

/** 15 calendar days inclusive: end = start + 14 */
export function defaultEndForStart(start: string): string {
  return addDays(start, 14)
}

export function suggestedNextSprintStart(last: Sprint): string {
  return addDays(last.end, 1)
}

export function isDateInSprint(isoDay: string, sprint: Sprint): boolean {
  return isoDay >= sprint.start && isoDay <= sprint.end
}

export function getCurrentSprint(
  sprints: Sprint[],
  today: Date = new Date(),
): Sprint | null {
  const todayStr = formatYMD(today)
  const sorted = [...sprints].sort(
    (a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id),
  )
  return sorted.find((s) => isDateInSprint(todayStr, s)) ?? null
}

export function sprintDayProgress(
  sprint: Sprint,
  today: Date = new Date(),
): { current: number; total: number; fraction: number } {
  const start = parseYMD(sprint.start)
  const end = parseYMD(sprint.end)
  const total = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86400000) + 1,
  )
  const t = formatYMD(today)
  if (t < sprint.start) return { current: 0, total, fraction: 0 }
  if (t > sprint.end) return { current: total, total, fraction: 1 }
  const cur = parseYMD(t)
  const current =
    Math.round((cur.getTime() - start.getTime()) / 86400000) + 1
  return {
    current: Math.min(current, total),
    total,
    fraction: Math.min(1, current / total),
  }
}
