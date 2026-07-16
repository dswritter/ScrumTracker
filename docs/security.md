# ScrumTracker — Security notes & roadmap

## Current state (implemented)

**PAT encryption at rest (AES-256-GCM).**
Jira and Confluence Personal Access Tokens are encrypted before they touch disk:

- Stores: `server/data/jira-tokens.json`, `server/data/jira-user-tokens.json`,
  `server/data/confluence-tokens.json`.
- Each token is stored as `enc:v1:<iv>:<tag>:<ciphertext>` (AES-256-GCM).
- Files are written with `0600` (owner-only) permissions.
- On server start, any pre-existing **plaintext** token is migrated to encrypted
  automatically (one-time, idempotent).
- Key source, in order:
  1. `SCRUM_TOKEN_KEY` env var (recommended — keep it off the data folder).
  2. Auto-generated key file `server/data/.token-key` (0600) if the env var is
     unset — works with zero configuration and persists across restarts.

### What this protects against
- Stolen disk / backup copy of `server/data/` taken to another machine.
- Other, non-admin users on the host.
- Casual file reads; accidental exposure; git leaks (data dir is gitignored).

### What it does NOT protect against (known limitations)
- **The host owner / admin.** Whoever controls the machine can read the key
  (env var or key file) and the running server's memory, so they can recover any
  PAT. This is structural: the server must hold the plaintext PAT to call Jira.
  Encryption-at-rest is not a defense against a privileged operator.
- **Network sniffing in transit** — see the HTTPS item below.

---

## Deferred (planned, not yet done)

### 1. HTTPS / TLS  — HIGH priority when revisited
Today the app is reachable over plain HTTP on the LAN
(`http://<host-ip>:3847/`), so a PAT sent to the server can be sniffed on the
wire. (The ngrok tunnel URL is already HTTPS; only the direct LAN path is HTTP.)

Plan when ready:
- Put a TLS reverse proxy in front of the Node server (e.g. **Caddy** for
  automatic certs, or nginx). It terminates HTTPS and forwards to
  `127.0.0.1:3847` (must also forward the `/__sync` WebSocket).
- For a clean, trusted padlock use a **hostname** + a cert from the corporate
  internal CA (e.g. `scrumtracker.corp.adobe.com`) or a public DNS name +
  Let's Encrypt. A bare IP + self-signed cert works but shows a browser warning.
- Consequence: the access URL changes (scheme/host/port). Because browser login
  state is per-origin, users will need to **log in once** on the new URL (with
  their existing passwords). No password changes required.

### 2. OAuth 2.0 / short-lived tokens — the real fix for secret exposure
The only approach that meaningfully reduces what a leaked token (or a privileged
operator) can do is to stop storing long-lived PATs and use OAuth with
short-lived, scoped, revocable tokens.
- Blocked today by: SSO-managed enterprise account + no stable HTTPS endpoint.
- Requires: Jira/Confluence admin to provision an OAuth app / Application Link
  (these are on-prem Data Center hosts), and a stable HTTPS callback URL.

### 3. Blast-radius controls (cheap, do anytime)
- Enforce short PAT **expiry** (refuse no-expiry tokens; auto-purge expired).
- Encourage **least-privilege** PAT scopes.

### 4. Break-glass admin reset (optional)
Single-admin lockout currently has no in-app recovery (no email reset). Mitigate
by keeping **≥2 admins** per team (admins can issue each other temp passwords).
Optional: a host-run `reset-admin` script for the sole-admin case.

---

## Setup

### Host owner
- **No action required** for encryption — it works out of the box via the
  auto-generated key file.
- **Recommended hardening:** set a persistent key off the data folder so a copied
  `server/data/` can't be decrypted:
  ```powershell
  [System.Environment]::SetEnvironmentVariable("SCRUM_TOKEN_KEY", "<long-random-string>", "User")
  ```
  Then start the server from a new shell. **Back up this string** — if lost, all
  stored PATs become undecryptable and users must re-enter them.

### Users
- No change. Existing PATs re-encrypt automatically on next server start; new
  PATs are encrypted on save.
