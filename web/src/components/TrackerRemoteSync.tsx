import { useEffect } from 'react'
import { syncFetch } from '../lib/syncFetch'
import { useTrackerStore } from '../store/useTrackerStore'

/**
 * When `VITE_SYNC_API_URL` is set (e.g. your ngrok URL for port 3847), keeps the
 * Zustand snapshot in sync with the Node server so Chrome, Safari, and other
 * machines share one workspace. See SERVER.md.
 */
export function TrackerRemoteSync() {
  useEffect(() => {
    const raw = import.meta.env.VITE_SYNC_API_URL?.trim()
    if (!raw) return

    const base = raw.replace(/\/$/, '') // used only for logging
    let cancelled = false
    let applyingRemote = false
    let lastRev = 0
    let pushTimer: ReturnType<typeof setTimeout> | null = null

    const waitHydrate = () =>
      new Promise<void>((resolve) => {
        if (useTrackerStore.persist.hasHydrated()) resolve()
        else useTrackerStore.persist.onFinishHydration(() => resolve())
      })

    const schedulePush = () => {
      if (pushTimer) clearTimeout(pushTimer)
      pushTimer = setTimeout(async () => {
        pushTimer = null
        if (cancelled || applyingRemote) return
        try {
          const snap = useTrackerStore.getState().exportSnapshotJson()
          const res = await syncFetch('/api/tracker', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ snapshot: snap }),
          })
          if (!res.ok) {
            if (import.meta.env.DEV) {
              console.warn('[sync] PUT failed', res.status, await res.text())
            }
            return
          }
          const j = (await res.json()) as { rev?: number }
          if (typeof j.rev === 'number') lastRev = j.rev
        } catch (e) {
          if (import.meta.env.DEV) {
            console.warn('[sync] PUT error', base, e)
          }
        }
      }, 900)
    }

    const pullOnce = async () => {
      if (cancelled) return
      try {
        const res = await syncFetch('/api/tracker')
        if (!res.ok) {
          if (import.meta.env.DEV) {
            console.warn('[sync] GET failed', res.status, await res.text())
          }
          return
        }
        const text = await res.text()
        let data: { rev: number; snapshot: string | null }
        try {
          data = JSON.parse(text) as { rev: number; snapshot: string | null }
        } catch {
          if (import.meta.env.DEV) {
            console.warn(
              '[sync] GET returned non-JSON (wrong URL or ngrok interstitial?). First 200 chars:',
              text.slice(0, 200),
            )
          }
          return
        }
        if (cancelled) return
        const rev = typeof data.rev === 'number' ? data.rev : 0
        if (rev < lastRev) return
        if (rev === lastRev) return
        lastRev = rev
        if (data.snapshot && data.snapshot.length >= 20) {
          applyingRemote = true
          useTrackerStore.getState().importSnapshotJson(data.snapshot)
          queueMicrotask(() => {
            applyingRemote = false
          })
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[sync] GET error', base, e)
        }
      }
    }

    let pollId: ReturnType<typeof setInterval> | null = null

    ;(async () => {
      await waitHydrate()
      if (cancelled) return
      await pullOnce()
      if (cancelled) return
      schedulePush()
      pollId = setInterval(pullOnce, 2500)
    })()

    const unsub = useTrackerStore.subscribe((state, prev) => {
      if (cancelled || applyingRemote) return
      if (
        state.teams === prev.teams &&
        state.teamsData === prev.teamsData &&
        state.users === prev.users
      ) {
        return
      }
      schedulePush()
    })

    return () => {
      cancelled = true
      if (pushTimer) clearTimeout(pushTimer)
      if (pollId) clearInterval(pollId)
      unsub()
    }
  }, [])

  return null
}
