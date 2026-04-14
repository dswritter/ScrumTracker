import { useEffect, useRef } from 'react'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import {
  fetchJiraTokenStatusPayload,
  fetchJiraUserTokenStatusPayload,
  jiraTokenStatusAllowsSync,
} from '../lib/jiraApi'
import { isAdmin } from '../lib/permissions'
import { runJiraSyncFromStore } from '../lib/runJiraSync'
import { isTrackerSyncEnabled } from '../lib/syncConfigured'
import { useTrackerStore } from '../store/useTrackerStore'

function localTodayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dailySyncStorageKey(teamId: string, username: string) {
  return `st-jira-daily-sync:${teamId}:${username}`
}

/**
 * Once per local calendar day (per user + team), runs the same Jira sync as the header
 * button after hydrate + a short delay so the shared tracker snapshot can merge first.
 * Skips when no PAT, or when that day already synced successfully.
 */
export function JiraDailyAutoSync() {
  const user = useCurrentUser()
  const ctx = useTeamContextNullable()
  const exportSnapshotJson = useTrackerStore((s) => s.exportSnapshotJson)
  const importSnapshotJson = useTrackerStore((s) => s.importSnapshotJson)
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (!isTrackerSyncEnabled()) return
    if (!user?.username || !ctx?.teamId) return

    const teamId = ctx.teamId
    const storageKey = dailySyncStorageKey(teamId, user.username)
    if (localStorage.getItem(storageKey) === localTodayKey()) return

    let cancelled = false

    const run = async () => {
      await new Promise<void>((resolve) => {
        if (useTrackerStore.persist.hasHydrated()) resolve()
        else useTrackerStore.persist.onFinishHydration(() => resolve())
      })
      await new Promise((r) => setTimeout(r, 1200))
      if (cancelled || inFlightRef.current) return
      inFlightRef.current = true
      try {
        const admin = isAdmin(user)
        if (admin) {
          const tokenPayload = await fetchJiraTokenStatusPayload()
          if (!jiraTokenStatusAllowsSync(tokenPayload)) return
        } else {
          const tokenPayload = await fetchJiraUserTokenStatusPayload(user.username)
          if (!jiraTokenStatusAllowsSync(tokenPayload)) return
        }
        const r = await runJiraSyncFromStore(
          exportSnapshotJson,
          importSnapshotJson,
          teamId,
          admin
            ? { syncMode: 'admin' }
            : { syncMode: 'individual', trackerUsername: user.username },
        )
        if (r.ok) {
          localStorage.setItem(storageKey, localTodayKey())
        } else if (import.meta.env.DEV) {
          console.warn('[jira] daily auto-sync skipped:', r.message)
        }
      } finally {
        inFlightRef.current = false
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [
    user?.id,
    user?.username,
    user?.role,
    ctx?.teamId,
    exportSnapshotJson,
    importSnapshotJson,
  ])

  return null
}
