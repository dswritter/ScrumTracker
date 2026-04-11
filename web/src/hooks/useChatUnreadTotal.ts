import { useEffect, useMemo, useState } from 'react'
import { useCurrentUser } from './useCurrentUser'
import { useTeamContextNullable } from './useTeamContext'
import {
  subscribeChatReadUpdated,
  totalChatUnreadForUser,
} from '../lib/chatReadState'
import { useTrackerStore } from '../store/useTrackerStore'

/** Sum of unread DMs (messages from others since last open thread) for the nav badge. */
export function useChatUnreadTotal(): number {
  const user = useCurrentUser()
  const ctx = useTeamContextNullable()
  const [readTick, setReadTick] = useState(0)

  const threads = useTrackerStore((s) =>
    user?.teamId ? s.teamsData[user.teamId]?.teamChatThreads ?? {} : {},
  )

  useEffect(() => {
    const unsub = subscribeChatReadUpdated(() => setReadTick((t) => t + 1))
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('scrum-chat-read:')) setReadTick((t) => t + 1)
    }
    window.addEventListener('storage', onStorage)
    return () => {
      unsub()
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return useMemo(() => {
    void readTick
    if (!user?.id || !ctx) return 0
    const me = ctx.user.displayName.trim()
    const peers = ctx.teamMembers.filter(
      (n) => n.trim() && n.trim() !== me,
    )
    return totalChatUnreadForUser(user.id, me, peers, threads)
  }, [user?.id, ctx, threads, readTick])
}
