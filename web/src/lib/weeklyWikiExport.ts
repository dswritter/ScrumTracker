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

/** Confluence-style "06 Apr 2026" (day + short month + year). */
export function formatWikiDay(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const mon = d.toLocaleDateString('en-GB', { month: 'short' })
  const y = d.getFullYear()
  return `${day} ${mon} ${y}`
}

export function formatWikiWeekRangeLine(week: WeekRange): string {
  return `${formatWikiDay(week.start)} to ${formatWikiDay(week.end)}`
}

/**
 * Parse first row "Week" cell like "06 Apr 2026 to 10 Apr 2026".
 * Returns null if the pattern does not match.
 */
export function parseWikiWeekRangeCell(cellText: string): {
  start: Date
  end: Date
} | null {
  const t = cellText.replace(/\s+/g, ' ').trim()
  const m = t.match(
    /^(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\s+to\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i,
  )
  if (!m) return null
  const start = Date.parse(m[1])
  const end = Date.parse(m[2])
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return { start: new Date(start), end: new Date(end) }
}

export type MyWikiColumnUpdate = {
  mode: 'new_row' | 'append_to_top_row'
  weekRangeLabel: string
  cellContent: string
  instructions: string
}

/**
 * Builds Confluence wiki-style checklist lines for the signed-in user's **done** items,
 * plus paste instructions for Weekly Tasks (append vs new top row).
 */
export function buildMyWeeklyWikiColumnUpdate(params: {
  displayName: string
  workItems: WorkItem[]
  /** Exact text from the top data row "Week" column on the wiki page (optional). */
  wikiTopWeekCell?: string | null
  now?: Date
}): MyWikiColumnUpdate {
  const { displayName, workItems, wikiTopWeekCell, now = new Date() } = params
  const week = getLocalWeekRangeContaining(now)
  const weekRangeLabel = formatWikiWeekRangeLine(week)

  const mineDone = workItems.filter(
    (w) =>
      w.status === 'done' &&
      w.assignees.some((a) => a.trim() === displayName.trim()),
  )
  const lines = mineDone.map((w) => {
    const t = (w.title || '(untitled)').replace(/\s+/g, ' ').trim()
    return `* ${t}`
  })
  const cellContent = lines.length
    ? lines.join('\n')
    : '* (no done items for this update)'

  let mode: MyWikiColumnUpdate['mode'] = 'new_row'
  const trimmedTop = wikiTopWeekCell?.trim()
  if (trimmedTop) {
    const parsed = parseWikiWeekRangeCell(trimmedTop)
    if (parsed) {
      const nowT = now.getTime()
      const endT = parsed.end.getTime()
      if (nowT <= endT) mode = 'append_to_top_row'
      else mode = 'new_row'
    }
  }

  const instructions =
    mode === 'append_to_top_row'
      ? `Append under YOUR column on the existing top Weekly Tasks row (Week: "${trimmedTop}"). Paste the checklist block below into that cell.`
      : `Insert a NEW row at the TOP of the Weekly Tasks table. Set Week to "${weekRangeLabel}" and paste the block below into YOUR column (@${displayName.replace(/\|/g, '')}).`

  return { mode, weekRangeLabel, cellContent, instructions }
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
