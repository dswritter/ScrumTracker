import { useEffect } from 'react'
import {
  readPersistedTrackerServerRev,
  writePersistedTrackerServerRev,
} from '../lib/trackerSyncRev'
import { isTrackerSyncEnabled } from '../lib/syncConfigured'
import { syncApiBaseUrl, syncFetch, syncTrackerWebSocketUrl } from '../lib/syncFetch'
import type { WorkItem } from '../types'
import { useTrackerStore } from '../store/useTrackerStore'

/**
 * When sync is enabled (`VITE_SYNC_SAME_ORIGIN` or `VITE_SYNC_API_URL`), keeps the
 * Zustand snapshot in sync with the Node server. Same-origin builds use relative `/api/*`
 * (SPA + API on one port, e.g. behind ngrok).
 *
 * Uses WebSocket `/ws/tracker` for push when the snapshot rev changes (no 2.5s polling).
 * Falls back to slow polling if the socket is down. GET `/api/tracker` uses
 * If-None-Match when possible to avoid re-downloading an unchanged snapshot.
 */
export function TrackerRemoteSync() {
  useEffect(() => {
    if (!isTrackerSyncEnabled()) return

    const base = syncApiBaseUrl() || '(same-origin)'
    let cancelled = false
    let applyingRemote = false
    let lastRev = readPersistedTrackerServerRev()
    let pushTimer: number | null = null
    let pulling = false
    let wsLive = false
    let fallbackPollId: number | null = null
    let ws: WebSocket | null = null
    let reconnectTimer: number | null = null
    let reconnectAttempt = 0
    let wsPullDebounce: number | null = null
    /** After PUT/GET errors or WS drop, next pull flushes local state with an immediate PUT (no debounce). */
    let pendingReconnectFlush = false

    const markSyncFailure = () => {
      pendingReconnectFlush = true
    }

    const waitHydrate = () =>
      new Promise<void>((resolve) => {
        if (useTrackerStore.persist.hasHydrated()) resolve()
        else useTrackerStore.persist.onFinishHydration(() => resolve())
      })

    const flushLocalSnapshotNow = async (): Promise<boolean> => {
      if (cancelled || applyingRemote) return false
      try {
        const snap = useTrackerStore.getState().exportSnapshotJson()
        const res = await syncFetch('/api/tracker', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshot: snap }),
        })
        if (!res.ok) {
          if (import.meta.env.DEV) {
            console.warn('[sync] PUT (flush) failed', res.status, await res.text())
          }
          return false
        }
        const j = (await res.json()) as { rev?: number }
        if (typeof j.rev === 'number') {
          lastRev = j.rev
          writePersistedTrackerServerRev(lastRev)
        }
        pendingReconnectFlush = false
        return true
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[sync] PUT (flush) error', base, e)
        }
        return false
      }
    }

    const schedulePush = () => {
      if (pushTimer) clearTimeout(pushTimer)
      pushTimer = window.setTimeout(async () => {
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
            markSyncFailure()
            return
          }
          const j = (await res.json()) as { rev?: number }
          if (typeof j.rev === 'number') {
            lastRev = j.rev
            writePersistedTrackerServerRev(lastRev)
          }
          pendingReconnectFlush = false
        } catch (e) {
          if (import.meta.env.DEV) {
            console.warn('[sync] PUT error', base, e)
          }
          markSyncFailure()
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
      if (pendingReconnectFlush && !applyingRemote) {
        await flushLocalSnapshotNow()
      }
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
          markSyncFailure()
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
          markSyncFailure()
          return
        }
        if (cancelled) return
        const rev = typeof data.rev === 'number' ? data.rev : 0
        if (rev < lastRev) return
        if (rev === lastRev) return
        lastRev = rev
        writePersistedTrackerServerRev(lastRev)
        if (data.snapshot && data.snapshot.length >= 20) {
          applyingRemote = true
          const r =
            useTrackerStore.getState().mergeRemoteSnapshotJson(data.snapshot)
          if (!r.ok && import.meta.env.DEV) {
            console.warn('[sync] mergeRemoteSnapshotJson failed', r.error)
          }
          queueMicrotask(() => {
            applyingRemote = false
          })
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[sync] GET error', base, e)
        }
        markSyncFailure()
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
        markSyncFailure()
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
          const j = JSON.parse(String(ev.data)) as {
            type?: string
            rev?: number
            teamId?: string
            workItem?: WorkItem
          }
          if (j.type === 'work_item_updated' && j.workItem && j.teamId) {
            if (typeof j.rev === 'number' && j.rev > lastRev) {
              lastRev = j.rev
              writePersistedTrackerServerRev(lastRev)
            }
            applyingRemote = true
            useTrackerStore
              .getState()
              .applyWorkItemFromPatch(j.teamId, j.workItem)
            queueMicrotask(() => {
              applyingRemote = false
            })
            return
          }
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
        markSyncFailure()
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
