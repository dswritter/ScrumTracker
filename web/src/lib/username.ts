/** LDAP-style input often includes a leading @; storage is always without it. */
export function normalizeLoginUsername(raw: string): string {
  return raw.trim().replace(/^@+/i, '').toLowerCase()
}
