import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'

/** True after persisted `currentUserId` has been read from storage (avoids login flash on new tabs). */
export function useAuthHydrated(): boolean {
  const [ready, setReady] = useState(() => useAuthStore.persist.hasHydrated())
  useEffect(() => {
    const p = useAuthStore.persist
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
