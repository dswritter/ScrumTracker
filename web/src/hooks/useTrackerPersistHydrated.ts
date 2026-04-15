import { useEffect, useState } from 'react'
import { useTrackerStore } from '../store/useTrackerStore'

/** True after zustand-persist has merged storage into the tracker store (client only). */
export function useTrackerPersistHydrated(): boolean {
  const [hydrated, setHydrated] = useState(
    () => useTrackerStore.persist.hasHydrated(),
  )
  useEffect(() => {
    const p = useTrackerStore.persist
    if (p.hasHydrated()) {
      setHydrated(true)
      return
    }
    return p.onFinishHydration(() => setHydrated(true))
  }, [])
  return hydrated
}
