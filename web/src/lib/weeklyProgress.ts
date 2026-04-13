import type { TrackerUserAccount, WorkItem } from '../types'

export type WeeklyProgressCard = {
  id: string
  /** Person this row is grouped under (roster display name when possible). */
  personName: string
  authorRaw: string
  dateKey: string
  dateLabel: string
  createdAt: string
  bullets: string[]
  section: string
  itemTitle: string
  itemId: string
  jiraLinks: { key: string; href: string }[]
  source: 'jira' | 'tracker' | 'mixed'
}

/** Team roster names excluding anyone with an admin login on this team. */
export function eligibleMemberDisplayNames(
  teamUsers: TrackerUserAccount[],
  teamMembers: string[],
): string[] {
  const adminLower = new Set(
    teamUsers
      .filter((u) => u.role === 'admin')
      .map((u) => u.displayName.trim().toLowerCase()),
  )
  return [...teamMembers]
    .map((m) => m.trim())
    .filter(Boolean)
    .filter((m) => !adminLower.has(m.toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
}

function normName(s: string): string {
  return s.trim().toLowerCase()
}

function inEligible(name: string, eligible: string[]): boolean {
  const n = normName(name)
  return eligible.some((e) => normName(e) === n)
}

/** Monday00:00:00 local for the week containing `d`. */
export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = x.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}

export function endOfWeekSunday(startMonday: Date): Date {
  const x = new Date(startMonday)
  x.setDate(x.getDate() + 6)
  x.setHours(23, 59, 59, 999)
  return x
}

export function formatWeekRangeLabel(startMonday: Date): string {
  const end = endOfWeekSunday(startMonday)
  const opts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }
  const a = startMonday.toLocaleDateString(undefined, opts)
  const b = end.toLocaleDateString(undefined, opts)
  return `${a} – ${b}`
}

export function weekMondayOffsets(weeksBack: number): Date[] {
  const cur = startOfWeekMonday(new Date())
  const out: Date[] = []
  for (let i = 0; i <= weeksBack; i++) {
    const x = new Date(cur)
    x.setDate(x.getDate() - i * 7)
    out.push(startOfWeekMonday(x))
  }
  return out
}

/** Local YYYY-MM-DD for a Monday date (stable for <select> values). */
export function mondayDateKey(m: Date): string {
  const y = m.getFullYear()
  const mo = String(m.getMonth() + 1).padStart(2, '0')
  const da = String(m.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

export function parseMondayKey(key: string): Date {
  const [y, mo, da] = key.split('-').map(Number)
  if (!y || !mo || !da) return startOfWeekMonday(new Date())
  return startOfWeekMonday(new Date(y, mo - 1, da))
}

function commentInWeek(iso: string, weekStart: Date, weekEnd: Date): boolean {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return false
  return t >= weekStart.getTime() && t <= weekEnd.getTime()
}

function bulletsFromBody(body: string): string[] {
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return ['(empty)']
  return lines
}

function jiraKeysInBody(body: string, itemKeys: string[]): string[] {
  const found = new Set<string>()
  for (const k of itemKeys) found.add(k.toUpperCase())
  const re = /\b([A-Z][A-Z0-9]{1,14}-\d+)\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    found.add(m[1].toUpperCase())
  }
  return [...found].sort()
}

function jiraHref(base: string, key: string): string {
  const b = base.trim().replace(/\/$/, '')
  return `${b}/${key}`
}

/**
 * Who this update is attributed to for filters / wiki-style columns.
 * Jira comments from outsiders roll up to an eligible assignee when possible.
 */
export function resolveWeeklyCardPerson(
  commentAuthor: string,
  item: WorkItem,
  _commentId: string,
  eligible: string[],
): string | null {
  if (inEligible(commentAuthor, eligible)) {
    const match =
      eligible.find((e) => normName(e) === normName(commentAuthor)) ??
      commentAuthor.trim()
    return match
  }
  /** Jira + local ScrumTracker comments: if author is not on the eligible roster, attribute to an eligible assignee (admin / bot / Jira user names). */
  const assignee = item.assignees.find((a) => inEligible(a, eligible))
  if (assignee) {
    return (
      eligible.find((e) => normName(e) === normName(assignee)) ??
      assignee.trim()
    )
  }
  return null
}

function mergeWeeklyCardAuthors(a: string, b: string): string {
  const seen = new Set<string>()
  for (const raw of [a, b]) {
    for (const part of raw.split('·')) {
      const t = part.trim()
      if (t) seen.add(t)
    }
  }
  return [...seen].join(' · ')
}

/** One card per work item + attributed person per week; all comments merged. */
function mergeWeeklyCardsForItemAndPerson(
  cards: WeeklyProgressCard[],
): WeeklyProgressCard[] {
  const chronological = [...cards].sort((x, y) =>
    x.createdAt.localeCompare(y.createdAt),
  )
  const map = new Map<string, WeeklyProgressCard>()
  for (const c of chronological) {
    const key = `${c.itemId}\0${c.personName}`
    const ex = map.get(key)
    if (!ex) {
      map.set(key, { ...c })
      continue
    }
    const sep = ex.bullets.length && c.bullets.length ? (['—'] as string[]) : []
    const mergedBullets = [...ex.bullets, ...sep, ...c.bullets]
    const jiraSeen = new Set(ex.jiraLinks.map((j) => j.key))
    const mergedLinks = [...ex.jiraLinks]
    for (const j of c.jiraLinks) {
      if (!jiraSeen.has(j.key)) {
        jiraSeen.add(j.key)
        mergedLinks.push(j)
      }
    }
    let source: WeeklyProgressCard['source'] = ex.source
    if (ex.source !== c.source) source = 'mixed'
    const latest = ex.createdAt >= c.createdAt ? ex : c
    map.set(key, {
      ...ex,
      id: `${c.itemId}:${c.personName}:week`,
      authorRaw: mergeWeeklyCardAuthors(ex.authorRaw, c.authorRaw),
      bullets: mergedBullets,
      createdAt: latest.createdAt,
      dateKey: latest.dateKey,
      dateLabel: latest.dateLabel,
      jiraLinks: mergedLinks,
      source,
    })
  }
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function buildWeeklyProgressCards(
  items: WorkItem[],
  eligible: string[],
  weekStart: Date,
  jiraBaseUrl: string,
): WeeklyProgressCard[] {
  const weekEnd = endOfWeekSunday(weekStart)
  const base = jiraBaseUrl.trim()
  const out: WeeklyProgressCard[] = []

  for (const item of items) {
    const hasEligibleAssignee = item.assignees.some((a) =>
      inEligible(a, eligible),
    )
    if (!hasEligibleAssignee) continue

    for (const c of item.comments) {
      if (!commentInWeek(c.createdAt, weekStart, weekEnd)) continue

      const person = resolveWeeklyCardPerson(
        c.authorName,
        item,
        c.id,
        eligible,
      )
      if (!person) continue

      const d = new Date(c.createdAt)
      const dateKey = Number.isNaN(d.getTime())
        ? c.createdAt.slice(0, 10)
        : d.toISOString().slice(0, 10)
      const dateLabel = Number.isNaN(d.getTime())
        ? dateKey
        : d.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })

      const keys = jiraKeysInBody(c.body, item.jiraKeys)
      const jiraLinks = base
        ? keys.map((key) => ({ key, href: jiraHref(base, key) }))
        : keys.map((key) => ({ key, href: '#' }))

      out.push({
        id: `${item.id}:${c.id}`,
        personName: person,
        authorRaw: c.authorName.trim(),
        dateKey,
        dateLabel,
        createdAt: c.createdAt,
        bullets: bulletsFromBody(c.body),
        section: item.section.trim() || 'General',
        itemTitle: item.title.trim() || '(untitled)',
        itemId: item.id,
        jiraLinks,
        source: c.id.startsWith('jira-cmt-') ? 'jira' : 'tracker',
      })
    }
  }

  return mergeWeeklyCardsForItemAndPerson(out)
}
