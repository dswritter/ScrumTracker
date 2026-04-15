import { useSyncExternalStore } from 'react'
import { useAuthStore } from '../store/useAuthStore'

/** True after persisted `currentUserId` has been read from storage (avoids login flash on new tabs). */
export function useAuthHydrated(): boolean {
   return useSyncExternalStore(
    (onStoreChange) => useAuthStore.persist.onFinishHydration(onStoreChange),
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  )
}
