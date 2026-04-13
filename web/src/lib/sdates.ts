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

const MONTH_ABBR: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}

function inferYearFromSprintStart(isoStart: string): number {
  const y = parseInt(isoStart.slice(0, 4), 10)
  return Number.isFinite(y) && y >= 2000 ? y : new Date().getFullYear()
}

/**
 * Sort key from the human-readable range in the sprint **name** (e.g. `16Oct`,
 * `01-15Apr`), not only `start`/`end` (which may be wrong or identical after Jira sync).
 */
export function sprintTimelineSortKey(s: Sprint): number {
  const y = inferYearFromSprintStart(s.start)
  const name = s.name

  const rangeOneMonth = name.match(
    /(\d{1,2})\s*-\s*(\d{1,2})\s*([A-Za-z]{3})\b/i,
  )
  if (rangeOneMonth) {
    const day = parseInt(rangeOneMonth[1], 10)
    const mon = MONTH_ABBR[rangeOneMonth[3].toLowerCase()]
    if (mon !== undefined && day >= 1 && day <= 31) {
      return new Date(y, mon, day).getTime()
    }
  }

  const dayMon = [...name.matchAll(/(\d{1,2})\s*([A-Za-z]{3})\b/gi)]
  if (dayMon.length > 0) {
    const first = dayMon[0]
    const day = parseInt(first[1], 10)
    const mon = MONTH_ABBR[first[2].toLowerCase()]
    if (mon !== undefined && day >= 1 && day <= 31) {
      return new Date(y, mon, day).getTime()
    }
  }

  return parseYMD(s.start).getTime()
}

/** Newest sprint first (label timeline, then ISO start, then id). */
export function compareSprintTimelineDesc(a: Sprint, b: Sprint): number {
  const ta = sprintTimelineSortKey(a)
  const tb = sprintTimelineSortKey(b)
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) {
    return tb - ta
  }
  const byStart = b.start.localeCompare(a.start)
  if (byStart !== 0) return byStart
  return a.id.localeCompare(b.id)
}

/** @deprecated prefer compareSprintTimelineDesc */
export function compareSprintStartDesc(a: Sprint, b: Sprint): number {
  return compareSprintTimelineDesc(a, b)
}

export function sprintsSortedNewestFirst(sprints: Sprint[]): Sprint[] {
  return [...sprints].sort(compareSprintTimelineDesc)
}

/**
 * Prefer the **newest** sprint whose range includes today (by start date, then id).
 * When several ranges overlap (e.g. duplicate Jira dates), the oldest match is not the active sprint.
 */
export function getCurrentSprint(
  sprints: Sprint[],
  today: Date = new Date(),
): Sprint | null {
  const todayStr = formatYMD(today)
  const candidates = sprints.filter((s) => isDateInSprint(todayStr, s))
  if (candidates.length === 0) return null
  return [...candidates].sort(compareSprintTimelineDesc)[0] ?? null
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
