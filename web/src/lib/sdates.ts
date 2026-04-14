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

/**
 * Names like `CG | M13 | Sprint 1 | 16-23Dec · 2026-04-13 → …`: sort by
 * milestone (M13 → 13) then intra-milestone sprint (Sprint 2 > Sprint 1).
 * Mid-segment calendar text is ignored (no reliable year).
 */
function milestoneAndSprintFromName(name: string): {
  milestone: number
  sprint: number
} | null {
  const m = name.match(/\|\s*M(\d+)\s*\|/i)
  const sp = name.match(/\|\s*Sprint\s*(\d+)\s*\|/i) ?? name.match(/\bSprint\s*(\d+)\b/i)
  if (!m && !sp) return null
  const milestone = m ? parseInt(m[1], 10) : 0
  const sprint = sp ? parseInt(sp[1], 10) : 0
  if (
    !Number.isFinite(milestone) ||
    !Number.isFinite(sprint) ||
    milestone < 0 ||
    sprint < 0
  ) {
    return null
  }
  return { milestone, sprint }
}

/** Larger = newer (for descending sort). Falls back to ISO start when name lacks M/Sprint. */
const SPRINT_NUM_SCALE = 1_000

export function sprintTimelineSortKey(s: Sprint): number {
  const parsed = milestoneAndSprintFromName(s.name)
  if (parsed) {
    return parsed.milestone * SPRINT_NUM_SCALE + parsed.sprint
  }
  return parseYMD(s.start).getTime()
}

/** Newest sprint first (M/Sprint from name, then ISO start, then id). */
export function compareSprintTimelineDesc(a: Sprint, b: Sprint): number {
  const pa = milestoneAndSprintFromName(a.name)
  const pb = milestoneAndSprintFromName(b.name)
  if (pa && pb) {
    if (pa.milestone !== pb.milestone) return pb.milestone - pa.milestone
    if (pa.sprint !== pb.sprint) return pb.sprint - pa.sprint
  } else if (pa && !pb) return -1
  else if (!pa && pb) return 1

  const ta = sprintTimelineSortKey(a)
  const tb = sprintTimelineSortKey(b)
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) {
    return tb - ta
  }
  const byStart = b.start.localeCompare(a.start)
  if (byStart !== 0) return byStart
  return b.id.localeCompare(a.id)
}

/** @deprecated prefer compareSprintTimelineDesc */
export function compareSprintStartDesc(a: Sprint, b: Sprint): number {
  return compareSprintTimelineDesc(a, b)
}

export function sprintsSortedNewestFirst(sprints: Sprint[]): Sprint[] {
  return [...sprints].sort(compareSprintTimelineDesc)
}

/**
 * Prefer the **newest** sprint whose range includes today (M/Sprint in name, then ISO/id).
 * When several ranges overlap (e.g. duplicate Jira dates), tie-break favors newer label order.
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
