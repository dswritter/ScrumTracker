const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/**
 * Local demo password for the seeded Color & Graphics admin (`chakraba`).
 * Previous releases used `ChakrA12!`; we migrate that to this value on load.
 */
export const DEMO_SEED_ADMIN_PASSWORD = '12345678'

/** Cryptographically random 8-character master password for new accounts. */
export function generateMasterPassword8(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  let s = ''
  for (let i = 0; i < 8; i++) s += ALPHANUM[bytes[i]! % ALPHANUM.length]
  return s
}

/** Deterministic 8-char password from a seed string (stable seed data). */
export function seedPasswordFromKey(key: string): string {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let out = ''
  for (let i = 0; i < 8; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
    out += ALPHANUM[h % ALPHANUM.length]
  }
  return out
}

export function isStrongEnoughPassword(p: string): boolean {
  return p.trim().length >= 8
}

/** Compare stored credential to user input (trimmed); avoids paste/space mismatches. */
export function passwordsMatch(stored: string, attempt: string): boolean {
  return stored.trim() === attempt.trim()
}
