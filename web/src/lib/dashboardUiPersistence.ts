const K = {
  weeklyOpen: 'scrumtracker:dashboard:weeklyOpen',
  weekKey: 'scrumtracker:dashboard:weekKey',
  wperson: 'scrumtracker:dashboard:wperson',
  wproject: 'scrumtracker:dashboard:wproject',
  wquery: 'scrumtracker:dashboard:wquery',
} as const

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore quota / private mode */
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export function loadPersistedWeeklyOpen(): boolean | null {
  const v = safeGet(K.weeklyOpen)
  if (v === '0') return false
  if (v === '1') return true
  return null
}

export function savePersistedWeeklyOpen(open: boolean): void {
  safeSet(K.weeklyOpen, open ? '1' : '0')
}

const WEEK_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export function loadPersistedWeekKey(): string | null {
  const v = safeGet(K.weekKey)
  if (v && WEEK_KEY_RE.test(v)) return v
  return null
}

export function savePersistedWeekKey(key: string): void {
  if (WEEK_KEY_RE.test(key)) safeSet(K.weekKey, key)
}

export type WeeklyFilterPersist = {
  person: string
  project: string
  query: string
}

export function loadPersistedWeeklyFilters(): WeeklyFilterPersist {
  return {
    person: safeGet(K.wperson) ?? '',
    project: safeGet(K.wproject) ?? '',
    query: safeGet(K.wquery) ?? '',
  }
}

export function savePersistedWeeklyFilters(f: WeeklyFilterPersist): void {
  if (f.person) safeSet(K.wperson, f.person)
  else safeRemove(K.wperson)
  if (f.project) safeSet(K.wproject, f.project)
  else safeRemove(K.wproject)
  if (f.query) safeSet(K.wquery, f.query)
  else safeRemove(K.wquery)
}
