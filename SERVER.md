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
