# Plan: member password change + JIRA → work items (no implementation)

This document describes how we could add (1) voluntary password change and **forgot-password via master password** for members, and (2) JIRA import aligned with **`docs/JIRA Integration Architecture.md`**. **Scope here is planning only.**

**Related doc:** For production JIRA integration (PAT, backend APIs, token lifecycle), follow **`JIRA Integration Architecture.md`** as the source of truth; the JIRA section below summarizes it and ties it to Rapid Board / work-item mapping.

---

## 1. Password change (anytime) + forgot password (master password)

### Current behavior (baseline)

- **`/change-password`** is only for **first sign-in** when `mustChangePassword === true`. If the user has already set a password, the page **redirects away** (`ChangePassword.tsx`).
- **`completeFirstLoginPasswordChange`** verifies the **master password** from the admin and sets the new password.
- **Admins** can reset member passwords from **Settings** (`adminSetUserPassword`) and see **master passwords** for members where applicable (list in Settings).

### Goal

1. **Voluntary change:** Members (and optionally admins) can change password anytime using **current login password** + **new** + **confirm**.
2. **Forgot password:** Users who do not remember their **current** password must **always** have a path that accepts the **master password** instead (same secret the admin created or reset in Settings). The user obtains that value **from the admin**; the admin already has the **per-user master password in Settings** (existing pattern).

### Proposed UX

- **Single area** (e.g. **`/change-password`** or **`/account/password`**) with clear modes:
  - **First login (forced):** *Master password* + *New* + *Confirm* — unchanged behavior when `mustChangePassword` is true.
  - **Voluntary change:** *Current password* + *New* + *Confirm* — when user knows their password.
  - **Forgot current password:** *Master password* (from admin) + *New* + *Confirm* — **same verification** as first-login path (`completeFirstLoginPasswordChange` logic or shared validator), **not** “current password”. Label copy: e.g. “Forgot your password? Use the **master password** from your admin (shown in **Settings** for your account).”
- **Navigation:** “Change password” (and/or “Account”) visible to **all** authenticated users, including members.
- **Admin Settings:** No change to the rule that admin can look up **master password** for members; document that members should **ask the admin** for this value when they forget their **login** password.

### Proposed data / store changes

- **`changeOwnPassword(userId, currentPassword, next, confirm)`** — verifies **current login password**, then updates (only for `userId ===` session user).
- **Reuse** existing **`completeFirstLoginPasswordChange`-style verification** for flows that use **master password** (first login + forgot), so one code path checks master password + strength + confirm.
- Optional: **`resetOwnPasswordWithMaster(userId, masterPassword, next, confirm)`** that is an alias or thin wrapper around the same checks as first login, usable when `mustChangePassword` is false (forgot flow).

### Edge cases

- **Admin forgot password:** If admins also use this screen, they either use **current password** or an **admin-specific** recovery (e.g. another admin resets in Settings) — product decision; master-password list in Settings is primarily for **member** accounts the admin created.
- **Session after change:** Optional re-login; simplest is keep session.

### Documentation

- Update **`web/DEPLOY.md`** and in-app help: voluntary change, forgot flow via **master password**, admin as source of master password from **Settings**.

---

## 2. JIRA → work items (aligned with architecture doc)

### Canonical architecture

Implement the **production-ready** pattern documented in **`JIRA Integration Architecture.md`**:

| Area | Decision |
|------|----------|
| **Auth** | **Personal Access Token (PAT)** — stored **only on the backend**; never in frontend, logs, or API responses |
| **Sync trigger** | Admin-triggered **`POST /api/jira/sync`** (frontend triggers; backend executes) |
| **Token lifecycle** | Optional multi-token model, **rotation via admin UI**, **`GET /api/jira/token-status`** (valid / expiring_soon / expired), block sync when expired |
| **Admin UI** | Settings → **Jira Integration**: add/replace token (never show existing token), view expiry status, **manual sync** |
| **Data path** | Frontend → **Node backend** → **Jira REST** → transform → **upsert** work items in app store/DB |

Do **not** store PAT in `.env` for manual rotation as the primary story; prefer **admin UI** for add/replace (per architecture doc).

### Rapid Board URL (operational context only)

Example:

`https://jira.corp.adobe.com/secure/RapidBoard.jspa?rapidView=44411&selectedIssue=...&quickFilter=315554#`

- Use this URL to **identify** board / filter intent; **fetch data** via **Jira REST** (e.g. Agile board + sprint APIs, or **JQL** via `GET /rest/api/2/search` as in the architecture doc — confirm path for your Jira Server/Data Center version).
- **`quickFilter`** must be resolved to **JQL** or equivalent so the synced set matches what the team sees on the Rapid Board **active sprint** view.

### Mapping (unchanged intent)

| Jira | App |
|------|-----|
| `key` | `jiraKeys[]` |
| `summary` | `title` |
| `assignee` | `assignees[]` (with display-name or configured map) |
| `status` | mapped `WorkStatus` |

**Upsert:** `jiraKey` as unique id — update if exists, else create.

### Phased delivery (fits architecture doc)

| Phase | Outcome |
|-------|---------|
| **A** | Backend: PAT in secure storage + **test JQL** search + upsert by key (no UI). |
| **B** | **`POST /api/jira/sync`** + **`POST /api/jira/token`** + **`GET /api/jira/token-status`** per architecture doc. |
| **C** | Admin Settings **Jira Integration** section + banner on token expiry. |
| **D** | Optional: cron / webhooks; assignee auto-mapping; per-team config (see architecture **Future** section). |

### What we are not doing in implementation without review

- Scraping `RapidBoard.jspa` HTML.
- Sending PAT to the browser or persisting it in client storage.

---

## 3. Summary

| Item | Plan |
|------|------|
| **Password anytime** | Voluntary flow with **current password**; **Forgot** = **master password** + new + confirm (admin provides master password from **Settings**). |
| **JIRA** | Follow **`JIRA Integration Architecture.md`**: PAT on backend, admin UI token + sync, REST upsert by key; Rapid Board URL only informs board/JQL configuration. |

---

*Planning only — implementation to follow separately.*
