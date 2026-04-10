import type { WorkItem } from '../types'

export type WeekRange = { start: Date; end: Date; label: string }

/** Monday 00:00:00 to Sunday 23:59:59.999 local time for a date inside that week. */
export function getLocalWeekRangeContaining(date = new Date()): WeekRange {
  const d = new Date(date)
  const day = d.getDay()
  const diffToMonday = (day + 6) % 7
  const start = new Date(d)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - diffToMonday)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  const fmt = (x: Date) =>
    x.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const y = start.getFullYear()
  return {
    start,
    end,
    label: `${fmt(start)}–${fmt(end)}, ${y}`,
  }
}

function inRange(iso: string, start: Date, end: Date): boolean {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return false
  return t >= start.getTime() && t <= end.getTime()
}

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/**
 * Confluence wiki-style table (legacy editor). One header row + one body row.
 */
export function buildWeeklyWikiTable(params: {
  week: WeekRange
  roster: string[]
  workItems: WorkItem[]
}): string {
  const { week, roster, workItems } = params
  const headerCells = ['Week', ...roster.map((n) => n.replace(/\|/g, ''))]
  const header = `||${headerCells.join('||')}||`

  const colForPerson = (displayName: string): string => {
    const lines: string[] = []
    const mine = workItems.filter((w) =>
      w.assignees.some((a) => a.trim() === displayName.trim()),
    )
    for (const w of mine) {
      if (!w.jiraKeys?.length) continue
      const key = w.jiraKeys[0]
      for (const c of w.comments) {
        if (!inRange(c.createdAt, week.start, week.end)) continue
        const excerpt = truncate(c.body, 200)
        lines.push(`* ${key} – ${truncate(w.title, 80)} – ${excerpt}`)
      }
    }
    return lines.length > 0 ? lines.join('\n') : '—'
  }

  const rowCells = [week.label, ...roster.map(colForPerson)]
  const row = `|${rowCells.join('|')}|`
  return `${header}\n${row}\n`
}
