/** Path for a team member profile (display name in URL segment). */
export function personProfilePath(displayName: string): string {
  return `/people/${encodeURIComponent(displayName.trim())}`
}
