import { useEffect } from 'react'
import { syncFetch, syncTrackerWebSocketUrl } from '../lib/syncFetch'
import { useTrackerStore } from '../store/useTrackerStore'

/**
 * When `VITE_SYNC_API_URL` is set (e.g. your ngrok URL for port 3847), keeps the
 * Zustand snapshot in sync with the Node server so Chrome, Safari, and other
 * machines share one workspace. See SERVER.md.
 *
 * Uses WebSocket `/ws/tracker` for push when the snapshot rev changes (no 2.5s polling).
 * Falls back to slow polling if the socket is down. GET `/api/tracker` uses
 * If-None-Match when possible to avoid re-downloading an unchanged snapshot.
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
    let pulling = false
    let wsLive = false
    let fallbackPollId: ReturnType<typeof setInterval> | null = null
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let reconnectAttempt = 0
    let wsPullDebounce: ReturnType<typeof setTimeout> | null = null

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

    const startFallbackPoll = () => {
      if (fallbackPollId) return
      fallbackPollId = window.setInterval(() => {
        if (!wsLive && !cancelled) void pullOnceSafe()
      }, 15_000)
    }

    const stopFallbackPoll = () => {
      if (fallbackPollId) {
        clearInterval(fallbackPollId)
        fallbackPollId = null
      }
    }

    const pullOnce = async () => {
      if (cancelled) return
      try {
        const inm =
          lastRev > 0
            ? ({ 'If-None-Match': `"${lastRev}"` } as Record<string, string>)
            : undefined
        const res = await syncFetch('/api/tracker', {
          headers: inm,
        })
        if (res.status === 304) return
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

    const pullOnceSafe = async () => {
      if (pulling) return
      pulling = true
      try {
        await pullOnce()
      } finally {
        pulling = false
      }
    }

    const schedulePullFromWs = () => {
      if (wsPullDebounce) clearTimeout(wsPullDebounce)
      wsPullDebounce = window.setTimeout(() => {
        wsPullDebounce = null
        void pullOnceSafe()
      }, 80)
    }

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimer) return
      const delay = Math.min(30_000, 800 * 2 ** reconnectAttempt)
      reconnectAttempt = Math.min(reconnectAttempt + 1, 8)
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        connectWebSocket()
      }, delay)
    }

    const connectWebSocket = () => {
      const url = syncTrackerWebSocketUrl()
      if (!url || cancelled) return

      try {
        ws = new WebSocket(url)
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[sync] WebSocket construct failed', e)
        wsLive = false
        startFallbackPoll()
        scheduleReconnect()
        return
      }

      ws.onopen = () => {
        if (cancelled) return
        wsLive = true
        reconnectAttempt = 0
        stopFallbackPoll()
        void pullOnceSafe()
        schedulePush()
      }

      ws.onmessage = (ev) => {
        if (cancelled) return
        try {
          const j = JSON.parse(String(ev.data)) as { type?: string; rev?: number }
          if (j.type !== 'tracker_rev' || typeof j.rev !== 'number') return
          if (j.rev <= lastRev) return
          schedulePullFromWs()
        } catch {
          /* ignore */
        }
      }

      ws.onclose = () => {
        wsLive = false
        ws = null
        if (cancelled) return
        startFallbackPoll()
        scheduleReconnect()
      }

      ws.onerror = () => {
        /* onclose runs after */
      }
    }

    ;(async () => {
      await waitHydrate()
      if (cancelled) return
      await pullOnceSafe()
      if (cancelled) return
      schedulePush()
      connectWebSocket()
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
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (wsPullDebounce) clearTimeout(wsPullDebounce)
      stopFallbackPoll()
      if (ws) {
        ws.onopen = null
        ws.onmessage = null
        ws.onclose = null
        ws.onerror = null
        ws.close()
        ws = null
      }
      unsub()
    }
  }, [])

  return null
}
