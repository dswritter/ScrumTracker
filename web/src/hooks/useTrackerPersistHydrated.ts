import { useEffect, useState } from 'react'
import { useTrackerStore } from '../store/useTrackerStore'

/**
 * True after zustand-persist has merged storage into the tracker store.
 * If rehydration errors or never completes (Windows / storage edge cases), we
 * still flip true after a short timeout so the UI is not stuck forever.
 */
export function useTrackerPersistHydrated(): boolean {
  const [ready, setReady] = useState(() => useTrackerStore.persist.hasHydrated())
  useEffect(() => {
    const p = useTrackerStore.persist
    const done = () => setReady(true)
    if (p.hasHydrated()) {
      done()
      return
    }
    const unsub = p.onFinishHydration(done)
    const t = window.setTimeout(done, 4000)
    return () => {
      unsub()
      window.clearTimeout(t)
    }
  }, [])
  return ready
}
