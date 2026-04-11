export function formatChatListTime(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(t).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

/** Canonical DM thread id for two display names (order-independent). */
export function dmThreadKey(displayNameA: string, displayNameB: string): string {
  const [x, y] = [displayNameA.trim(), displayNameB.trim()].sort((a, b) =>
    a.localeCompare(b),
  )
  return `${x}|||${y}`
}

/** The other participant in a DM thread, or null if `me` is not in the key. */
export function peerFromThreadKey(threadKey: string, me: string): string | null {
  const parts = threadKey.split('|||')
  if (parts.length !== 2) return null
  const m = me.trim()
  if (parts[0] === m) return parts[1]
  if (parts[1] === m) return parts[0]
  return null
}
