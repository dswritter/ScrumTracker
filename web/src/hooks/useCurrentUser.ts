import { useMemo } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useTrackerStore } from '../store/useTrackerStore'
import type { TrackerUserAccount } from '../types'

export function useCurrentUser(): TrackerUserAccount | null {
  const currentUserId = useAuthStore((s) => s.currentUserId)
  const users = useTrackerStore((s) => s.users)

  return useMemo(() => {
    if (!currentUserId) return null
    return users.find((u) => u.id === currentUserId) ?? null
  }, [currentUserId, users])
}
