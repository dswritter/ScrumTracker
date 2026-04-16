import type { TrackerUserAccount, WorkItem, WorkStatus } from '../types'

export function workStatusLabel(s: WorkStatus): string {
  const m: Record<WorkStatus, string> = {
    done: 'Done',
    in_progress: 'In progress',
    to_test: 'To test',
    to_track: 'To track',
    blocked: 'Blocked',
    todo: 'Todo',
  }
  return m[s] ?? s
}

/** One line in a comment body (nested bullets use `depth` > 0). */
export type CommentBulletLine =
  | { depth: number; text: string }
  | { separator: true }

export function isCommentSeparator(
  line: CommentBulletLine,
): line is { separator: true } {
  return 'separator' in line && line.separator === true
}

export type WeeklyProgressCard = {
  id: string
  /** Person this row is grouped under (roster display name when possible). */
  personName: string
  authorRaw: string
  dateKey: string
  dateLabel: string
  createdAt: string
  bulletLines: CommentBulletLine[]
  section: string
  itemTitle: string
  itemId: string
  /** Tracker status on the work item (synced from Jira when linked). */
  itemStatus: WorkStatus
  /** Jira workflow name from last sync, when available. */
  jiraStatusName?: string
  jiraLinks: { key: string; href: string }[]
  source: 'jira' | 'tracker' | 'mixed'
}

/** One UI card per teammate: nested tasks are merged item+person rows from the week. */
export type WeeklyProgressPersonBundle = {
  id: string
  personName: string
  /** Latest comment timestamp in this bundle (sort across people). */
  createdAt: string
  tasks: WeeklyProgressCard[]
}

export function bundleWeeklyProgressByPerson(
  cards: WeeklyProgressCard[],
): WeeklyProgressPersonBundle[] {
  const byPerson = new Map<string, WeeklyProgressCard[]>()
  for (const c of cards) {
    const list = byPerson.get(c.personName) ?? []
    list.push(c)
    byPerson.set(c.personName, list)
  }
  const bundles: WeeklyProgressPersonBundle[] = []
  for (const [personName, tasks] of byPerson) {
    const sorted = [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const createdAt = sorted[0]?.createdAt ?? ''
    bundles.push({
      id: `person:${personName}`,
      personName,
      createdAt,
      tasks: sorted,
    })
  }
  bundles.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return bundles
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

export type BulletTreeNode = { text: string; children: BulletTreeNode[] }

/**
 * Turn flat depth lines (from Jira ADF export or wiki-style `*` / indented `•`) into a tree for nested <ul> rendering.
 */
export function buildBulletTree(
  lines: Array<{ depth: number; text: string }>,
): BulletTreeNode[] {
  const roots: BulletTreeNode[] = []
  const parents: BulletTreeNode[] = []
  for (const { depth, text } of lines) {
    const node: BulletTreeNode = { text, children: [] }
    if (depth === 0) {
      roots.push(node)
    } else {
      const p = parents[depth - 1]
      if (p) p.children.push(node)
      else roots.push(node)
    }
    parents[depth] = node
    parents.length = depth + 1
  }
  return roots
}

/**
 * Parse comment body into lines with nesting depth (Jira-style lists).
 * Supports:
 * - Indented `•`, `-`, `*`, or `1.` bullets (2 spaces per level, from server ADF export)
 * - Jira wiki lines: `* top`, `** nested`
 * - Plain lines → depth 0
 * - `—` alone → section separator (horizontal rule in UI)
 */
export function bulletLinesFromBody(body: string): CommentBulletLine[] {
  const raw = body.split(/\r?\n/)
  const out: CommentBulletLine[] = []
  for (const line of raw) {
    const trimmedEnd = line.trimEnd()
    const t = trimmedEnd.trim()
    if (!t) continue
    if (t === '—' || t === '---') {
      out.push({ separator: true })
      continue
    }
    const wiki = t.match(/^(\*+)\s+(.*)$/)
    if (wiki && wiki[1] && wiki[2] !== undefined) {
      const depth = Math.max(0, wiki[1].length - 1)
      out.push({ depth, text: wiki[2].trim() })
      continue
    }
    const m = trimmedEnd.match(/^(\s*)([•]|[*\-]|\d+\.)\s+(.*)$/)
    if (m && m[3] !== undefined) {
      const indent = (m[1] || '').replace(/\t/g, '  ')
      const depth = Math.min(12, Math.floor(indent.length / 2))
      out.push({ depth, text: m[3].trim() })
      continue
    }
    out.push({ depth: 0, text: t })
  }
  if (out.length === 0) return [{ depth: 0, text: '(empty)' }]
  return out
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
 * Jira comments from outsiders roll up to a roster assignee when possible.
 * `teamRoster` should list all teammates (including those who also have admin logins).
 */
export function resolveWeeklyCardPerson(
  commentAuthor: string,
  item: WorkItem,
  _commentId: string,
  teamRoster: string[],
): string | null {
  if (inEligible(commentAuthor, teamRoster)) {
    const match =
      teamRoster.find((e) => normName(e) === normName(commentAuthor)) ??
      commentAuthor.trim()
    return match
  }
  /** Jira + local ScrumTracker comments: if author is not on the roster, attribute to a roster assignee (bot / Jira user names, etc.). */
  const assignee = item.assignees.find((a) => inEligible(a, teamRoster))
  if (assignee) {
    return (
      teamRoster.find((e) => normName(e) === normName(assignee)) ??
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
    const mergedBulletLines = [...ex.bulletLines, ...c.bulletLines]
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
    const jiraStatusName =
      latest.jiraStatusName || ex.jiraStatusName || c.jiraStatusName
    map.set(key, {
      ...ex,
      id: `${c.itemId}:${c.personName}:week`,
      authorRaw: mergeWeeklyCardAuthors(ex.authorRaw, c.authorRaw),
      bulletLines: mergedBulletLines,
      createdAt: latest.createdAt,
      dateKey: latest.dateKey,
      dateLabel: latest.dateLabel,
      itemStatus: latest.itemStatus,
      jiraStatusName,
      jiraLinks: mergedLinks,
      source,
    })
  }
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function buildWeeklyProgressCards(
  items: WorkItem[],
  /** Full team roster (same names as assignees). Must include members with admin accounts or their items/comments are dropped. */
  teamRoster: string[],
  weekStart: Date,
  jiraBaseUrl: string,
): WeeklyProgressCard[] {
  const weekEnd = endOfWeekSunday(weekStart)
  const base = jiraBaseUrl.trim()
  const out: WeeklyProgressCard[] = []

  for (const item of items) {
    const hasRosterAssignee = item.assignees.some((a) =>
      inEligible(a, teamRoster),
    )
    if (!hasRosterAssignee) continue

    for (const c of item.comments) {
      if (!commentInWeek(c.createdAt, weekStart, weekEnd)) continue

      const person = resolveWeeklyCardPerson(
        c.authorName,
        item,
        c.id,
        teamRoster,
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
        bulletLines: bulletLinesFromBody(c.body),
        section: item.section.trim() || 'General',
        itemTitle: item.title.trim() || '(untitled)',
        itemId: item.id,
        itemStatus: item.status,
        jiraStatusName: item.jiraStatusName,
        jiraLinks,
        source:
          c.id.startsWith('jira-cmt-') || c.id.startsWith('jira-sys-resolved-')
            ? 'jira'
            : 'tracker',
      })
    }
  }

  return mergeWeeklyCardsForItemAndPerson(out)
}
