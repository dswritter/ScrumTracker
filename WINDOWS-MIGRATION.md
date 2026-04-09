# Move from Mac dev to a Windows host (central data + web app)

## Why cross-browser did not sync

| Situation | What happens |
|-----------|----------------|
| **Same browser, different accounts** | One shared `localStorage` for the tracker store; switching users still reads the same blob. |
| **Chrome vs Safari (or two PCs)** | **Separate** `localStorage` per browser profile. **No shared data** unless something copies it between them. |
| **Optional sync server + `VITE_SYNC_API_URL`** | All clients talk to **one** HTTP API; the server file `server/data/tracker-state.json` is the shared snapshot. **This is what fixes cross-browser sync.** |

If sync still failed, typical causes are: sync server not running on the Windows machine, firewall blocking port **3847**, or the web app was built/run **without** `VITE_SYNC_API_URL` (Vite only injects that at **dev/build** time).

**Yes — a centralized Windows machine running the sync server (and optionally hosting the built UI) is the right approach** for one shared dataset for everyone. A “Windows app” (WebView2 / Electron) is optional; it still loads the same web UI and the same `VITE_SYNC_API_URL` API base.

---

## Prerequisites

- **Windows PC** (always on or reachable when the team works): fixed LAN IP or DNS name, same subnet as teammates (or VPN).
- **Node.js 18+** on Windows ([nodejs.org](https://nodejs.org)).
- **Git** (optional) or a **zip** of this project folder from the Mac.
- **Administrator** access on Windows for firewall rules (once).

---

## Step 1 — Copy the project to Windows

**Option A — Git**

1. On the Mac, commit and push the repo to your Git remote (or use a USB drive).
2. On Windows, open **PowerShell** or **cmd**:
   - `cd` to where you want the project (e.g. `C:\dev\`).
   - `git clone <your-repo-url> ScrumDoc`
   - `cd ScrumDoc`

**Option B — Zip**

1. On the Mac, zip the `ScrumDoc` folder (exclude `node_modules`, `web/node_modules`, `server/node_modules` if present to save space).
2. Copy the zip to Windows (network share, USB, OneDrive).
3. Unzip to e.g. `C:\dev\ScrumDoc`.

---

## Step 2 — Install dependencies on Windows

In **PowerShell** (run from the repo root `ScrumDoc`):

```powershell
cd server
npm install
cd ..\web
npm install
```

---

## Step 3 — Start the sync server (data API)

1. **Find the Windows LAN IPv4 address** (same network as teammates):

   ```powershell
   ipconfig
   ```

   Example: `192.168.1.50` — use this everywhere below as `YOUR_WINDOWS_IP`.

2. Start the sync server (from `ScrumDoc\server`):

   ```powershell
   npm start
   ```

   Default: listen on **0.0.0.0:3847** (all interfaces).

3. **Windows Firewall — allow inbound TCP 3847**

   - Windows Defender Firewall → **Advanced settings** → **Inbound Rules** → **New Rule** → **Port** → **TCP** → **3847** → **Allow** → name it e.g. `Scrum Tracker Sync`.

4. Quick test on the **Windows machine** in a browser:

   - `http://127.0.0.1:3847/api/health` → should return JSON `{ "ok": true }`.

5. **Persist data:** the live snapshot is `server\data\tracker-state.json`. Back it up if you care about this environment.

---

## Step 4 — Point the web app at the sync server (build-time)

Vite reads `VITE_*` only when you run **`npm run dev`** or **`npm run build`**.

1. On the **Windows** machine (or on the machine where you build), in `web\`:

2. Create **`web\.env.production`** (or `.env.local` for dev only):

   ```env
   VITE_SYNC_API_URL=http://YOUR_WINDOWS_IP:3847
   ```

   Replace `YOUR_WINDOWS_IP` with the address from step 3. Use the IP teammates will use **from their machines** (Mac, other PCs, phones on Wi‑Fi).

3. Build the static site:

   ```powershell
   cd web
   npm run build
   ```

   Output: `web\dist\`.

If you skip this file, the built app **will not** sync across browsers.

---

## Step 5 — Host the web UI on Windows (or elsewhere)

**Option A — Quick test on Windows**

```powershell
cd web
npm run preview -- --host
```

   Often serves at `http://localhost:4173` — use `--host` so other devices on the LAN can open `http://YOUR_WINDOWS_IP:4173`.

**Option B — IIS (intranet)**

1. Copy **`web\dist\`** contents to a folder IIS serves (e.g. `C:\inetpub\scrum-tracker\`).
2. Create a site or app pointing at that folder.
3. Add a **URL Rewrite** rule so all routes fall back to **`index.html`** (SPA).
4. Open firewall for **HTTP/HTTPS** port you use (e.g. 80 or 443).

Teammates open: `http://YOUR_WINDOWS_IP/` (or your hostname).

---

## Step 6 — Every client (Mac, Safari, Chrome, etc.)

1. **Same URL** for the **web app** (hosted UI).
2. **Same `VITE_SYNC_API_URL`** must be baked into the build they use (step 4). If you rebuild on another machine, copy `.env.production` or set the variable before `npm run build`.

3. **Mac Safari dev** against the same Windows server:

   - In `web/.env.local` on the Mac:

     ```env
     VITE_SYNC_API_URL=http://YOUR_WINDOWS_IP:3847
     ```

   - Run `npm run dev` in `web/` and open the Vite URL. **Safari must reach `YOUR_WINDOWS_IP` on the LAN** (same Wi‑Fi/VPN, firewall allows 3847).

---

## Step 7 — Verify cross-browser sync

1. Start **sync server** on Windows (step 3).
2. Open the **hosted app** (or `npm run preview`) in **Chrome** and **Safari** (or two PCs).
3. Sign in as two different users (or same user) — data should **converge within a few seconds** after edits (poll + push).
4. If not: check **Network** tab for failed requests to `http://YOUR_WINDOWS_IP:3847/api/tracker`, and that `VITE_SYNC_API_URL` was present at **build** time.

---

## Optional — “Windows app” for teammates

- **WebView2** or **Electron**: load the **same** hosted URL as the SPA; no change to the sync server.
- Optionally ship a **small config** (JSON) with `syncApiUrl` if you later add native reading of config (not in this repo by default).

---

## Troubleshooting

| Problem | What to check |
|--------|----------------|
| Still no sync | `VITE_SYNC_API_URL` missing at **build**; rebuild `web`. |
| Connection refused | Sync server not running; wrong IP; firewall on Windows or client network. |
| CORS errors | Sync server uses `cors` for all origins; if you see CORS, check proxy/VPN and that you’re hitting the correct host. |
| Mixed content | If UI is **https**, API must be **https** too (reverse proxy) or browser will block. |

---

## Summary checklist

- [ ] Project copied to Windows; `npm install` in `server` and `web`.
- [ ] Sync server runs; `api/health` works; firewall **TCP 3847** open.
- [ ] `web/.env.production` has `VITE_SYNC_API_URL=http://YOUR_WINDOWS_IP:3847`.
- [ ] `npm run build` in `web`; `dist/` deployed or `npm run preview -- --host`.
- [ ] All browsers use the **built** app that included the env var.
- [ ] Optional: back up `server/data/tracker-state.json`.
