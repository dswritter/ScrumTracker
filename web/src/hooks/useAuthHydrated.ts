import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'

/** True after persisted `currentUserId` has been read from storage (avoids login flash on new tabs). */
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(
    () => useAuthStore.persist.hasHydrated(),
  )
  useEffect(() => {
    const p = useAuthStore.persist
    if (p.hasHydrated()) {
      setHydrated(true)
      return
    }
    return p.onFinishHydration(() => setHydrated(true))
  }, [])
  return hydrated
}
