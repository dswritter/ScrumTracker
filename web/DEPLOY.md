# Deployment (Phase 1)

Phase 1 is a **static single-page app**. All teams, sprints, work items, and users persist in **`localStorage`**; the signed-in session uses **`sessionStorage`**. Passwords are stored **in plain text** in the browser (demo only) — use a real backend and hashing for production.

## Teams and auth

- **Multiple teams**: Each team has its own sprints, items, roster, and JIRA base URL. Users belong to exactly one `teamId` and only ever load that team’s data after sign-in.
- **New team**: Use **Create a new team (admin)** on the sign-in page (`/register`). That creates a workspace and an admin account (LDAP-style username + password you choose). The password is also visible later under **Settings** for that admin.
- **Seed sample team** (“Color & Graphics”): Admin **`chakraba`** / **`12345678`** (display name Saikat Chakrabarty). Members get an auto-generated **8-character master password** (`mustChangePassword: true`); the admin sees it when creating the account and in Settings. On first sign-in, members must enter the master password and set a new password (≥ 8 characters).
- **Change password anytime:** signed-in users can open **Change password** in the header. They can use their **current password**, or the **master password** (same value the admin sees in Settings) if they forgot their login password.
- **Sprints** are created automatically when the current sprint is within 10 days of ending. **Non-done** work on a sprint whose end date has passed is **rolled forward** to the next sprint in order. There is no separate Sprints admin page.
- **Roster** is driven by **login accounts** (display names). The old “Team roster” section was removed.

## Export / import (schema v3)

**Export JSON** includes the full database: `teams`, `teamsData` (per team: `sprints`, `workItems`, `teamMembers`, `jiraBaseUrl`, optional `jiraSyncJql`, optional `jiraSprintFieldId`), and `users` (with `teamId`, `password`, `mustChangePassword`). **Import** replaces the entire local store with the file so data round-trips. Legacy **v2** (flat) and **v1** imports are wrapped into a single imported team.

## Build

```bash
cd web
npm install
npm run build
```

Output: `dist/` (HTML, JS, CSS assets).

## Local preview

```bash
npm run preview
```

### Friendly hostname (e.g. `http://scrum-tracker:4173`)

Browsers use **hostnames**, not bare names without a port. To open the app as `http://scrum-tracker:4173` instead of an IP:

1. Pick a hostname (e.g. `scrum-tracker`).
2. On each PC that should use it, edit the **hosts** file (Windows: `C:\Windows\System32\drivers\etc\hosts`) and add a line:
   `10.41.38.49 scrum-tracker`
   (use your real LAN IP of the machine running `npm run preview -- --host`).
3. Start preview bound to all interfaces: `npm run preview -- --host 0.0.0.0`.
4. Visit **`http://scrum-tracker:4173`** (port **4173** is Vite’s default preview port unless you change it).

`http://scrum-tracker` alone (port 80) only works if something listens on 80 (e.g. IIS/nginx) with a reverse proxy to port 4173.

## Hosting on an internal Windows PC (IIS) — outline

> Full IIS steps can follow in a later pass. Summary:

1. Copy the contents of **`dist/`** to a folder served by IIS (e.g. `C:\inetpub\scrum-tracker\`).
2. Create a site or virtual directory pointing at that folder.
3. Add a **URL Rewrite** rule so client-side routes (`/items`, `/people`, `/register`, …) fall back to `index.html` (SPA fallback).
4. Allow **HTTPS** (or HTTP on a trusted intranet) and open the firewall for your team’s subnet.
5. If the app is not at the site root, set Vite **`base`** (e.g. `base: '/scrum-tracker/'`) before `npm run build`, then redeploy.

Team members open the site in **Edge/Chrome** on their own machines; they do not need Remote Desktop for daily use.

## Slack DM links and weekly wiki (in-app)

- **Slack:** Admins configure **Slack DM / archive URLs** per roster display name under **Settings → Slack DM links** (stored in the team snapshot). Optional env **`VITE_SLACK_ENTERPRISE_BASE`** restricts pasted URLs to your Enterprise host.
- **Wiki:** Optional **weekly wiki page URL** per team; **Dashboard** (admins) has **Copy weekly wiki table** (Confluence wiki markup) and **Open wiki page**.

## Subpath deploy

If the app will live at `https://server/scrum-tracker/`, set in `vite.config.ts`:

```ts
export default defineConfig({
  base: '/scrum-tracker/',
  // ...
})
```

Rebuild and redeploy `dist/`.
