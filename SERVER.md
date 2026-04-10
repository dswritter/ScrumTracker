# Shared data server (Chrome ↔ Safari, multiple PCs)

**Step-by-step: copy this project from Mac to a Windows host and go live:** see [`WINDOWS-MIGRATION.md`](./WINDOWS-MIGRATION.md).

The web UI normally stores everything in **each browser’s `localStorage`**, so **Chrome and Safari never see the same data**. To share one team workspace across browsers and machines, run the small **sync server** on a machine that everyone can reach (for example your Windows PC on the office LAN), then point the web app at it with `VITE_SYNC_API_URL`.

## 1. Run the sync service (Windows or any OS with Node 18+)

```bash
cd server
npm install
npm start
```

By default it listens on **all interfaces** at port **3847** (`0.0.0.0:3847`), so teammates can use `http://YOUR_WINDOWS_LAN_IP:3847`.

- State file: `server/data/tracker-state.json` (full app snapshot as JSON text).
- **Security:** this prototype has **no auth**. Use only on a trusted network, or put **HTTPS + reverse proxy + auth** in front for production.

### Windows: allow inbound connections

1. **Firewall:** Windows Defender Firewall → Advanced → Inbound Rules → New Rule → Port → TCP **3847** → Allow.
2. Find your IPv4 address: `ipconfig` (e.g. `192.168.1.50`).
3. Teammates’ browsers (and the Windows app, if it wraps the same URL) use `http://192.168.1.50:3847` only for the API; the **web UI** is still served by Vite/nginx as today.

Optional env:

- `PORT=3847` — API port  
- `HOST=0.0.0.0` — bind address (default exposes LAN)

### ngrok (different PCs / internet)

You need **two concepts**:

1. **Tunnel for the sync API only** — ngrok must forward to **`3847`** (the Node server), not to Vite’s `5173`.
2. **`VITE_SYNC_API_URL` = that tunnel’s public URL** — must be **`https://….ngrok-free.app`** (or your ngrok domain) **with no trailing slash**.  
   The app bakes this in at **`npm run build`** (or `npm run dev`). Every machine that opens the UI must use a build that points at **this same API URL**.

**Common mistakes (sync silently fails):**

| Mistake | What happens |
|--------|----------------|
| `VITE_SYNC_API_URL=http://localhost:3847` | Other PCs talk to **their own** localhost, not your Windows box. |
| Only one ngrok to port **5173** (Vite) | The app still calls **3847** for `/api/tracker`; that must be reachable on the public URL you set. |
| Forgot to **rebuild** after changing `.env` | Old bundle has no sync URL or wrong URL. |
| ngrok returns **HTML** instead of JSON | The client sends `ngrok-skip-browser-warning` (see `web/src/lib/syncFetch.ts`); if sync still fails, open DevTools → Network → `api/tracker` and confirm **200** + JSON body. |

**Example:**

```bash
# Terminal 1 — sync server (already on 3847)
cd server && npm start

# Terminal 2 — ngrok to the API port only
ngrok http 3847
```

Copy the **https** forwarding URL (e.g. `https://abc123.ngrok-free.app`).

In `web/.env.production` (or `.env.local` for dev):

```env
VITE_SYNC_API_URL=https://abc123.ngrok-free.app
```

Then:

```bash
cd web && npm run build
```

Host `web/dist` (or `npm run preview`) and open that site from **another PC**. In DevTools → Console (dev mode), look for `[sync]` warnings if something is wrong.

## 2. Point the web app at the server

In `web/`, create `.env.local`:

```env
VITE_SYNC_API_URL=http://192.168.1.50:3847
```

Use the **same** URL from every browser (Chrome, Safari, etc.). Rebuild or restart `npm run dev` after changing env.

Behavior:

- On load, the app pulls `/api/tracker` if the server already has data; otherwise it **uploads** the current local snapshot.
- Changes are **debounced** and pushed with `PUT /api/tracker`.
- **Polling** every ~2.5s pulls newer revisions so other browsers update without refresh.
- **Conflict model:** last successful push wins (good enough for a small team demo).

### Jira (PAT on server, admin UI in Settings)

When `VITE_SYNC_API_URL` points at this Node server, the app can **save a Jira Personal Access Token** and run **Sync from Jira** (see `docs/JIRA Integration Architecture.md`).

- **Token file:** `server/data/jira-tokens.json` (created automatically; same folder as `tracker-state.json`, not committed).
- **Endpoints:**
  - `POST /api/jira/token` — body `{ "token": "<PAT>", "expiresAt": "<optional ISO>" }`
  - `GET /api/jira/token-status` — `{ status, daysRemaining, message }` (no token in response)
  - `POST /api/jira/sync` — body `{ "snapshot": "<full export JSON string>", "teamId": "<id>" }` optional `"jql": "..."` overrides team JQL

**Optional server env:**

- `JIRA_API_SECRET` — if set, clients must send `Authorization: Bearer <same>` on the three Jira routes (set `VITE_JIRA_API_SECRET` in `web/.env.local` to match).
- `JIRA_BASE_URL` — default `https://jira.corp.adobe.com` if team JIRA base URL cannot be derived.
- `JIRA_JQL` — fallback JQL if the team has no `jiraSyncJql` in the snapshot.
- `JIRA_SPRINT_FIELD` — optional default Sprint **custom field id** (e.g. `customfield_10020`) if the team snapshot has no `jiraSprintFieldId`. When set (per team in **Settings** or via this env), each sync pulls Jira comments into work items and maps Jira sprints onto the tracker.

Per-team **Settings** can store `jiraSprintFieldId` in the snapshot (exported with the rest of `teamsData`).

## 3. “Windows app” for teammates

This repo ships a **browser app** (`web/`). A **Windows desktop app** is usually one of:

1. **PWA / Edge WebView2** — package the built `web/dist` URL (hosted on your PC or internal IIS/nginx) inside a minimal WebView2 shell; API base stays `http://your-pc:3847`.
2. **Electron / Tauri** — same idea: load the site, set `VITE_SYNC_API_URL` at build time or via a small native config file.

The **sync server** does not need to change for either option; only the **shell** and where you host the static UI matter.

## 4. Production-style hardening (later)

- TLS (reverse proxy: Caddy, nginx, IIS ARR).
- Authentication (API keys, session cookies, or VPN-only network).
- Real database instead of one JSON file if many teams or large payloads.
- WebSockets for instant updates instead of polling.
