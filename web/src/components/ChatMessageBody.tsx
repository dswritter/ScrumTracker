import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

/**
 * Renders plain text with @Display Name segments linked to that teammate’s DM (`/chat/...`).
 */
export function ChatMessageBody({
  body,
  mentionNames,
  messageId,
}: {
  body: string
  /** Roster names (e.g. teamMembers); longest match wins for multi-word names. */
  mentionNames: string[]
  messageId: string
}) {
  const sorted = [...mentionNames].sort(
    (a, b) => b.trim().length - a.trim().length,
  )
  const parts: ReactNode[] = []
  let i = 0
  let partIdx = 0
  while (i < body.length) {
    const at = body.indexOf('@', i)
    if (at < 0) {
      parts.push(body.slice(i))
      break
    }
    if (at > i) parts.push(body.slice(i, at))
    const afterAt = body.slice(at + 1)
    let matched: string | null = null
    for (const rawName of sorted) {
      const name = rawName.trim()
      if (!name) continue
      if (!afterAt.startsWith(name)) continue
      const nextCh = afterAt[name.length]
      if (
        nextCh !== undefined &&
        nextCh !== ' ' &&
        nextCh !== '\n' &&
        nextCh !== ',' &&
        nextCh !== '.' &&
        nextCh !== '!' &&
        nextCh !== '?' &&
        nextCh !== ':'
      ) {
        continue
      }
      matched = name
      break
    }
    if (matched) {
      partIdx += 1
      parts.push(
        <Link
          key={`${messageId}-@${partIdx}-${at}`}
          to={`/chat/${encodeURIComponent(matched)}`}
          className="font-semibold text-amber-400 hover:text-amber-300 hover:underline"
        >
          @{matched}
        </Link>,
      )
      i = at + 1 + matched.length
    } else {
      parts.push('@')
      i = at + 1
    }
  }
  return (
    <span className="whitespace-pre-wrap break-words text-slate-100">
      {parts}
    </span>
  )
}

export { initials }
