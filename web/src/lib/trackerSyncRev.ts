/** Persists last known `/api/tracker` ETag rev so reloads don't GET with rev=0 and import stale server JSON over local edits. */
const KEY = 'scrum-tracker-last-server-rev'

export function readPersistedTrackerServerRev(): number {
  try {
    const v = localStorage.getItem(KEY)
    if (v == null || v === '') return 0
    const n = Number.parseInt(v, 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

export function writePersistedTrackerServerRev(rev: number): void {
  try {
    if (!Number.isFinite(rev) || rev < 0) return
    if (rev === 0) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, String(rev))
  } catch {
    /* private mode / quota */
  }
}
