/**
 * At-rest encryption for stored secrets (Jira / Confluence PATs).
 *
 * Secrets are encrypted with AES-256-GCM before they touch disk. The 32-byte key
 * comes from one of, in order of preference:
 *   1. process.env.SCRUM_TOKEN_KEY  — recommended; keep it off the host / in a
 *      secrets manager so a stolen disk or backup can't be decrypted.
 *   2. A persistent random key file (dataDir/.token-key, mode 0600) — created
 *      automatically so encryption works out of the box with no configuration.
 *      Weaker than (1) because the key sits next to the data, but still protects
 *      against casual reads and backups that exclude dotfiles.
 *
 * Values are stored as "enc:v1:<iv>:<tag>:<ciphertext>" (all base64). Any value
 * NOT matching that prefix is treated as legacy plaintext and returned as-is on
 * read, then re-encrypted on the next write — so existing token files migrate
 * transparently.
 */
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const PREFIX = 'enc:v1:'
const KEY_FILE = '.token-key'

/** @type {Buffer | null} */
let cachedKey = null

/** Resolve (and cache) the 32-byte AES key. `dataDir` is where the fallback key file lives. */
function getKey(dataDir) {
  if (cachedKey) return cachedKey
  const envKey = (process.env.SCRUM_TOKEN_KEY || '').trim()
  if (envKey) {
    // Any-length passphrase → deterministic 32 bytes.
    cachedKey = crypto.createHash('sha256').update(envKey, 'utf8').digest()
    return cachedKey
  }
  const keyPath = path.join(dataDir, KEY_FILE)
  try {
    const existing = fs.readFileSync(keyPath)
    if (existing.length === 32) {
      cachedKey = existing
      return cachedKey
    }
  } catch {
    // fall through and create one
  }
  fs.mkdirSync(dataDir, { recursive: true })
  const key = crypto.randomBytes(32)
  fs.writeFileSync(keyPath, key, { mode: 0o600 })
  try {
    fs.chmodSync(keyPath, 0o600)
  } catch {
    // best effort (e.g. Windows)
  }
  console.warn(
    `[token-crypto] SCRUM_TOKEN_KEY not set; using generated key file at ${keyPath}. ` +
      'Set SCRUM_TOKEN_KEY in the environment for stronger protection.',
  )
  cachedKey = key
  return cachedKey
}

/** True if a stored value is in our encrypted envelope. */
export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

/** Encrypt a plaintext string into the "enc:v1:..." envelope. Empty/nullish passes through. */
export function encryptSecret(plaintext, dataDir) {
  if (plaintext == null || plaintext === '') return plaintext
  if (isEncrypted(plaintext)) return plaintext
  const key = getKey(dataDir)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
}

/** Decrypt an "enc:v1:..." value. Legacy plaintext (no prefix) is returned unchanged. */
export function decryptSecret(value, dataDir) {
  if (!isEncrypted(value)) return value
  try {
    const [, , ivB64, tagB64, dataB64] = value.split(':')
    const key = getKey(dataDir)
    const iv = Buffer.from(ivB64, 'base64')
    const tag = Buffer.from(tagB64, 'base64')
    const data = Buffer.from(dataB64, 'base64')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const dec = Buffer.concat([decipher.update(data), decipher.final()])
    return dec.toString('utf8')
  } catch (e) {
    console.error(
      '[token-crypto] failed to decrypt a stored secret (wrong SCRUM_TOKEN_KEY or corrupt data):',
      e instanceof Error ? e.message : e,
    )
    return null
  }
}
