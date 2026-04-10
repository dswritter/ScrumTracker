import type { TrackerUserAccount } from '../types'

const DEFAULT_ALLOWED_HOST = 'adobe.enterprise.slack.com'

function allowedSlackHost(): string {
  const fromEnv = import.meta.env.VITE_SLACK_ENTERPRISE_BASE?.trim()
  if (fromEnv) {
    try {
      return new URL(fromEnv.startsWith('http') ? fromEnv : `https://${fromEnv}`)
        .hostname
    } catch {
      return DEFAULT_ALLOWED_HOST
    }
  }
  return DEFAULT_ALLOWED_HOST
}

/** Returns trimmed URL if valid for team map, else null. */
export function parseSlackDmUrlInput(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  try {
    const u = new URL(t)
    if (u.protocol !== 'https:') return null
    const host = allowedSlackHost()
    if (u.hostname !== host) return null
    if (!u.pathname.includes('/archives/')) return null
    return u.toString()
  } catch {
    return null
  }
}

export function resolveSlackDmUrl(
  displayName: string,
  map: Record<string, string> | undefined,
  teamUsers?: TrackerUserAccount[],
): string | undefined {
  const dn = displayName.trim()
  if (teamUsers?.length && dn) {
    const acc = teamUsers.find((x) => x.displayName.trim() === dn)
    const fromUser = acc?.slackChatUrl?.trim()
    if (fromUser) return fromUser
  }
  if (!map) return undefined
  const u = map[displayName]?.trim()
  return u || undefined
}
