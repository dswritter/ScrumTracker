import type { TeamChatMessage } from '../types'
import { dmThreadKey } from './teamChat'

export const CHAT_READ_UPDATED_EVENT = 'scrum-chat-read-updated'

function storageKey(userId: string): string {
  return `scrum-chat-read:${userId}`
}

function loadMap(userId: string): Record<string, string> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof k === 'string' && typeof v === 'string' && v) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

function saveMap(userId: string, map: Record<string, string>) {
  localStorage.setItem(storageKey(userId), JSON.stringify(map))
  window.dispatchEvent(new Event(CHAT_READ_UPDATED_EVENT))
}

/** Last read message id for a DM thread (canonical `a|||b` key). */
export function getLastReadMessageId(
  userId: string,
  threadKey: string,
): string | null {
  const m = loadMap(userId)
  return m[threadKey] ?? null
}

/**
 * Mark all messages in this thread as read (typically the latest id after opening the DM).
 */
export function markThreadRead(
  userId: string,
  threadKey: string,
  lastMessageId: string | null,
) {
  const map = loadMap(userId)
  if (lastMessageId) {
    if (map[threadKey] === lastMessageId) return
    map[threadKey] = lastMessageId
  } else {
    if (!(threadKey in map)) return
    delete map[threadKey]
  }
  saveMap(userId, map)
}

/** Unread count: messages from others after `lastReadId`. */
export function countUnreadInThread(
  msgs: TeamChatMessage[],
  lastReadId: string | null,
  me: string,
): number {
  if (msgs.length === 0) return 0
  const myName = me.trim()
  let start = 0
  if (lastReadId) {
    const idx = msgs.findIndex((m) => m.id === lastReadId)
    start = idx >= 0 ? idx + 1 : 0
  }
  return msgs
    .slice(start)
    .filter((m) => m.authorName.trim() !== myName).length
}

export function totalChatUnreadForUser(
  userId: string,
  me: string,
  peerDisplayNames: string[],
  threads: Record<string, TeamChatMessage[]>,
): number {
  let n = 0
  for (const p of peerDisplayNames) {
    const key = dmThreadKey(me, p)
    const msgs = threads[key] ?? []
    const lastRead = getLastReadMessageId(userId, key)
    n += countUnreadInThread(msgs, lastRead, me)
  }
  return n
}

export function subscribeChatReadUpdated(cb: () => void) {
  window.addEventListener(CHAT_READ_UPDATED_EVENT, cb)
  return () => window.removeEventListener(CHAT_READ_UPDATED_EVENT, cb)
}
