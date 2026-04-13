import { isTrackerSyncEnabled } from './syncConfigured'
import { syncFetch } from './syncFetch'
import { writePersistedTrackerServerRev } from './trackerSyncRev'
import { useTrackerStore } from '../store/useTrackerStore'

/** Immediate PUT so teammates see chat (and other) changes without waiting for debounced sync. */
export async function pushTrackerSnapshotNow(): Promise<boolean> {
  if (!isTrackerSyncEnabled()) return false
  try {
    const snap = useTrackerStore.getState().exportSnapshotJson()
    const res = await syncFetch('/api/tracker', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot: snap }),
    })
    if (!res.ok) return false
    try {
      const j = (await res.json()) as { rev?: number }
      if (typeof j.rev === 'number') {
        writePersistedTrackerServerRev(j.rev)
      }
    } catch {
      /* empty or non-JSON body */
    }
    return true
  } catch {
    return false
  }
}

export function isRemoteSyncConfigured(): boolean {
  return isTrackerSyncEnabled()
}
