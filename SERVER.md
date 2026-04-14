# Shared data server (Chrome ↔ Safari, multiple PCs)

**Step-by-step: copy this project from Mac to a Windows host and go live:** see [`WINDOWS-MIGRATION.md`](./WINDOWS-MIGRATION.md).

The web UI normally stores everything in **each browser’s `localStorage`**, so **Chrome and Safari never see the same data**. To share one workspace, run the **Node server** on a machine everyone can reach. **Use a single TCP port** (default **3847**) for **everything**: the built SPA, `/api/*`, and `/ws/tracker`. Production-style runs use **`VITE_SYNC_SAME_ORIGIN=true`** at build time so the browser calls `/api/...` on the same host (see `automation/start-all.ps1`). You can still use **`VITE_SYNC_API_URL`** for dev (e.g. UI on Vite, API on another host).

## 1. Run the sync service (Windows or any OS with Node 18+)

```bash
cd server
npm install
npm start
```

By default it listens on **all interfaces** at port **3847** (`0.0.0.0:3847`). After `npm run build` in `web/`, the same process also serves **`web/dist`**, so teammates open **`http://YOUR_WINDOWS_LAN_IP:3847/`** for the full app (not a second port).

- State file: `server/data/tracker-state.json` (full app snapshot as JSON text).
- **Security:** this prototype has **no auth**. Use only on a trusted network, or put **HTTPS + reverse proxy + auth** in front for production.

### Windows: allow inbound connections

1. **Firewall:** Windows Defender Firewall → Advanced → Inbound Rules → New Rule → Port → TCP **3847** (or whatever you set `PORT` to) → Allow.  
   Or elevated PowerShell:  
   `New-NetFirewallRule -DisplayName "ScrumTracker" -Direction Inbound -LocalPort 3847 -Protocol TCP -Action Allow`
2. Find your IPv4 address: `ipconfig` (e.g. `192.168.1.50`).
3. On the LAN, open **`http://192.168.1.50:3847/`** in the browser (UI + API + WebSocket on that one port).

Optional env:

- `PORT=3847` — **only** port to expose (UI + API + WS)  
- `HOST=0.0.0.0` — bind address (default exposes LAN)

### ngrok (internet / Mac ↔ Windows)

Tunnel **the same** port the Node server uses (default **3847**):

```bash
ngrok http 3847
```

**Recommended:** build with **`VITE_SYNC_SAME_ORIGIN=true`** (see `automation/start-all.ps1`), then open the **https** ngrok URL in the browser. UI and API share one origin; no cross-origin CORS to the API.

**Alternate (dev / split hosting):** set **`VITE_SYNC_API_URL=https://your-tunnel.ngrok-free.app`** and host the UI separately; see `web/src/lib/syncFetch.ts` for ngrok headers.

**Common mistakes:**

| Mistake | What happens |
|--------|----------------|
| `VITE_SYNC_API_URL=http://localhost:3847` | Other PCs talk to **their own** localhost, not your Windows box. |
| Forgot to **rebuild** after changing `.env` | Old bundle has wrong sync settings. |
| Firewall blocks **3847** | LAN URL loads nothing or times out. |

## 2. Point the web app at the server

**One port (production):** in `web/.env.production`:

```env
VITE_SYNC_SAME_ORIGIN=true
```

Rebuild `web/`, run `server/`, open **`http://<server-ip>:3847/`** (or your ngrok URL tunneling to 3847).

**Split UI/API (dev):** in `web/.env.local`:

```env
VITE_SYNC_API_URL=http://192.168.1.50:3847
```

Rebuild or restart `npm run dev` after changing env.

Behavior:

- On load, the app pulls `/api/tracker` if the server already has data; otherwise it **uploads** the current local snapshot.
- Changes are **debounced** and pushed with `PUT /api/tracker`.
- **WebSocket** `WS /ws/tracker` pushes `{ type: 'tracker_rev', rev }` whenever the snapshot changes so other browsers pull **immediately** (no fixed 2.5s polling). If the socket is down, the client falls back to **slow polling** (~15s).
- **GET** `/api/tracker` supports **`ETag` / `If-None-Match`** so a client that already has the latest `rev` can receive **304** and skip re-downloading the full snapshot JSON.
- **Browser:** the app still **persists** the workspace in `localStorage` (Zustand persist) as the primary offline cache; HTTP revalidation complements that when online.
- **Conflict model:** last successful push wins for the **stored** snapshot. On **pull** (`GET /api/tracker`), the web client **merges** the server snapshot into the hydrated store instead of replacing it outright: work-item **comments** and **team chat** messages are union-merged by id so local-only entries (e.g. before a push or after a rebuild with the same browser profile) are not discarded. Other team fields (sprints, Jira settings, work item fields from the server) follow the remote slice for that pull.
- **Recovery after outage:** the server **cannot** pull data from users’ browsers (browsers do not accept inbound connections). When the client can reach the host again, it **pushes** the snapshot with `PUT /api/tracker`. The web client also performs an **immediate flush** after connectivity was lost (failed PUT/GET or WebSocket drop) so local edits are less likely to be stranded behind the debounced push if the tab is closed quickly. **Multi-user caveat:** the model is still **last full snapshot wins**—two people editing offline at the same time can overwrite each other; true merge would need per-change ops or CRDTs.

### Jira (PAT on server, admin UI in Settings)

When sync is enabled (`VITE_SYNC_SAME_ORIGIN` or `VITE_SYNC_API_URL`), the app can **save a Jira Personal Access Token** and run **Sync from Jira** (see `docs/JIRA Integration Architecture.md`).

- **Token files:** `server/data/jira-tokens.json` (team admin PAT) and `server/data/jira-user-tokens.json` (per login username for **member** sync), created automatically; same folder as `tracker-state.json`, not committed.
- **Endpoints:**
  - `POST /api/jira/token` — body `{ "token": "<PAT>", "expiresAt": "<optional ISO>" }` (team admin)
  - `GET /api/jira/token-status` — `{ status, daysRemaining, message }` (no token in response)
  - `POST /api/jira/user-token` — body `{ "username": "<login>", "token": "<PAT>", "expiresAt": "<optional ISO>" }` (individual member; username is normalized like the login field)
  - `GET /api/jira/user-token-status?username=<login>` — same shape as token-status for that user
  - `POST /api/jira/sync` — body `{ "snapshot": "<full export JSON string>", "teamId": "<id>" }`; optional `"jql": "..."` overrides team JQL; optional `"syncMode": "admin" | "individual"` and `"trackerUsername": "<login>"` — **admin** uses the team PAT and team JQL only; **individual** uses that user’s PAT, the same team JQL, plus Jira issues where `reporter = currentUser()` and `created` falls in the tracker’s **current calendar sprint** window. Items in that second set that are not on a Jira sprint matching the active tracker sprint get `jiraNeedsSprintLabel` in the returned snapshot for admins.

**Optional server env:**

- `JIRA_API_SECRET` — if set, clients must send `Authorization: Bearer <same>` on the three Jira routes (set `VITE_JIRA_API_SECRET` in `web/.env.local` to match).
- `JIRA_BASE_URL` — default `https://jira.corp.adobe.com` if team JIRA base URL cannot be derived.
- `JIRA_JQL` — fallback JQL if the team has no `jiraSyncJql` in the snapshot.
- `JIRA_SPRINT_FIELD` — optional default Sprint **custom field id** (e.g. `customfield_10020`) if the team snapshot has no `jiraSprintFieldId`. When set (per team in **Settings** or via this env), each sync pulls Jira comments into work items and maps Jira sprints onto the tracker.

Per-team **Settings** can store `jiraSprintFieldId` in the snapshot (exported with the rest of `teamsData`).

## 3. “Windows app” for teammates

This repo ships a **browser app** (`web/`). A **Windows desktop app** is usually one of:

1. **PWA / Edge WebView2** — point the shell at **`http://your-pc:3847/`** (or ngrok HTTPS) so UI and API are one origin, or use `VITE_SYNC_API_URL` if the UI is hosted elsewhere.
2. **Electron / Tauri** — same: load the single-port URL, or set `VITE_SYNC_API_URL` at build time.

The **Node server** can serve both static UI and API on **`PORT`** (default **3847**).

## 4. Production-style hardening (later)

- TLS (reverse proxy: Caddy, nginx, IIS ARR).
- Authentication (API keys, session cookies, or VPN-only network).
- Real database instead of one JSON file if many teams or large payloads.
- ~~WebSockets for instant updates instead of polling.~~ (basic `WS /ws/tracker` + ETag is implemented; scale-out would need shared pub/sub.)
