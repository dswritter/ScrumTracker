import type { Sprint, WorkItem } from '../types'
import { filterItemsBySprint } from './stats'

export type DashboardScope =
  | { type: 'sprint'; sprintId: string }
  | { type: 'all' }
  | { type: 'month'; year: number; month: number }
  | { type: 'year'; year: number }

export function scopeToParams(scope: DashboardScope): Record<string, string> {
  switch (scope.type) {
    case 'sprint':
      return { scope: 'sprint', sprint: scope.sprintId }
    case 'all':
      return { scope: 'all' }
    case 'month':
      return {
        scope: 'month',
        year: String(scope.year),
        month: String(scope.month),
      }
    case 'year':
      return { scope: 'year', year: String(scope.year) }
  }
}

export function parseDashboardScope(
  sp: URLSearchParams,
  sprints: Sprint[],
  defaultSprintId: string | null,
): DashboardScope {
  const scope = sp.get('scope')
  const sprintParam = sp.get('sprint')

  if (scope === 'all') return { type: 'all' }
  if (scope === 'month') {
    const y = Number(sp.get('year'))
    const m = Number(sp.get('month'))
    if (Number.isFinite(y) && m >= 1 && m <= 12)
      return { type: 'month', year: y, month: m }
    const now = new Date()
    return { type: 'month', year: now.getFullYear(), month: now.getMonth() + 1 }
  }
  if (scope === 'year') {
    const y = Number(sp.get('year'))
    if (Number.isFinite(y)) return { type: 'year', year: y }
    return { type: 'year', year: new Date().getFullYear() }
  }

  const sid =
    sprintParam && sprints.some((s) => s.id === sprintParam)
      ? sprintParam
      : defaultSprintId
  if (sid) return { type: 'sprint', sprintId: sid }
  return { type: 'all' }
}

function sprintOverlapsMonth(s: Sprint, y: number, month: number): boolean {
  const pad = (n: number) => String(n).padStart(2, '0')
  const last = new Date(y, month, 0).getDate()
  const startM = `${y}-${pad(month)}-01`
  const endM = `${y}-${pad(month)}-${pad(last)}`
  return s.start <= endM && s.end >= startM
}

function sprintOverlapsYear(s: Sprint, y: number): boolean {
  return s.start <= `${y}-12-31` && s.end >= `${y}-01-01`
}

export function filterWorkItemsByScope(
  items: WorkItem[],
  sprints: Sprint[],
  scope: DashboardScope,
): WorkItem[] {
  const byId = new Map(sprints.map((s) => [s.id, s]))
  switch (scope.type) {
    case 'sprint':
      return filterItemsBySprint(items, scope.sprintId)
    case 'all':
      return items
    case 'month':
      return items.filter((w) =>
        w.sprintIds.some((id) => {
          const sp = byId.get(id)
          return sp && sprintOverlapsMonth(sp, scope.year, scope.month)
        }),
      )
    case 'year':
      return items.filter((w) =>
        w.sprintIds.some((id) => {
          const sp = byId.get(id)
          return sp && sprintOverlapsYear(sp, scope.year)
        }),
      )
  }
}

export function buildItemsHref(
  scope: DashboardScope,
  extra?: { status?: string; group?: string },
): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(scopeToParams(scope))) p.set(k, v)
  if (extra?.status) p.set('status', extra.status)
  if (extra?.group) p.set('group', extra.group)
  const q = p.toString()
  return q ? `/items?${q}` : '/items'
}

export function personDetailHref(
  personName: string,
  scope: DashboardScope,
): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(scopeToParams(scope))) p.set(k, v)
  return `/people/${encodeURIComponent(personName)}?${p.toString()}`
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Sprint label for selects and compact UI (no trailing ISO date range). */
export function sprintSelectOptionLabel(s: Sprint): string {
  return `${s.emoji ?? ''} ${s.name}`.trim()
}

export function scopeShortLabel(scope: DashboardScope, sprints: Sprint[]): string {
  switch (scope.type) {
    case 'sprint': {
      const s = sprints.find((x) => x.id === scope.sprintId)
      return s ? `${s.emoji ?? ''} ${s.name}`.trim() : 'Sprint'
    }
    case 'all':
      return 'All sprints to date'
    case 'month':
      return `${MONTH_NAMES[scope.month - 1]} ${scope.year}`
    case 'year':
      return `Year ${scope.year}`
  }
}

export function scopeSelectValue(scope: DashboardScope): string {
  switch (scope.type) {
    case 'sprint':
      return `sprint:${scope.sprintId}`
    case 'all':
      return 'all'
    case 'month':
      return `month:${scope.year}:${scope.month}`
    case 'year':
      return `year:${scope.year}`
  }
}

export function parseScopeSelectValue(
  raw: string,
  sprints: Sprint[],
  defaultSprintId: string | null,
): DashboardScope {
  if (raw === 'all') return { type: 'all' }
  if (raw.startsWith('sprint:')) {
    const id = raw.slice(7)
    if (sprints.some((s) => s.id === id)) return { type: 'sprint', sprintId: id }
  }
  if (raw.startsWith('month:')) {
    const parts = raw.split(':')
    const y = Number(parts[1])
    const m = Number(parts[2])
    if (Number.isFinite(y) && m >= 1 && m <= 12)
      return { type: 'month', year: y, month: m }
  }
  if (raw.startsWith('year:')) {
    const y = Number(raw.slice(5))
    if (Number.isFinite(y)) return { type: 'year', year: y }
  }
  if (defaultSprintId) return { type: 'sprint', sprintId: defaultSprintId }
  return { type: 'all' }
}

function parseYMDLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Month options (YYYY-M) that overlap any sprint. */
export function monthOptionsFromSprints(sprints: Sprint[]): {
  year: number
  month: number
  label: string
}[] {
  const seen = new Set<string>()
  const out: { year: number; month: number; label: string }[] = []
  for (const sp of sprints) {
    let d = parseYMDLocal(sp.start)
    const endD = parseYMDLocal(sp.end)
    while (d <= endD) {
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const key = `${y}-${m}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push({
          year: y,
          month: m,
          label: `${MONTH_NAMES[m - 1]} ${y}`,
        })
      }
      d = new Date(y, m, 1)
    }
  }
  out.sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month,
  )
  return out
}

export function yearOptionsFromSprints(sprints: Sprint[]): number[] {
  const ys = new Set<number>()
  for (const sp of sprints) {
    ys.add(Number(sp.start.slice(0, 4)))
    ys.add(Number(sp.end.slice(0, 4)))
  }
  return [...ys].sort((a, b) => a - b)
}
