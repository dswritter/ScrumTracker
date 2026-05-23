/**
 * Tracker sprint dates are stored as `YYYY-MM-DD` calendar days in the **local**
 * timezone (same convention as `weeklyCommentRange` on the Dashboard). Use these
 * helpers when comparing Jira/ISO comment timestamps so we do not use the UTC date
 * prefix of an ISO string, which excludes valid comments near timezone boundaries.
 */
export function sprintDayStart(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  const x = new Date(y, (m || 1) - 1, d || 1)
  x.setHours(0, 0, 0, 0)
  return x
}

export function sprintDayEnd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  const x = new Date(y, (m || 1) - 1, d || 1)
  x.setHours(23, 59, 59, 999)
  return x
}

/** True if `createdAt` (ISO or leading `YYYY-MM-DD`) falls inside [startYmd, endYmd] inclusive, local calendar. */
export function commentIsoInSprintWindow(
  createdAt: string,
  startYmd: string,
  endYmd: string,
): boolean {
  let t = Date.parse(createdAt)
  if (Number.isNaN(t)) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(createdAt).trim())
    if (!m) return false
    const y = Number(m[1])
    const mo = Number(m[2])
    const da = Number(m[3])
    t = new Date(y, mo - 1, da, 12, 0, 0, 0).getTime()
  }
  const a = sprintDayStart(startYmd).getTime()
  const b = sprintDayEnd(endYmd).getTime()
  return t >= a && t <= b
}
