# 🔐 JIRA Integration Architecture (Production-Ready)

## 🎯 Goal

Enable **admin-triggered JIRA sync** to import work items into the Scrum Tracker app, with:

* Secure authentication (PAT-based)
* Token lifecycle management (expiry + rotation)
* Zero exposure of secrets to frontend users

---

## Reference JQL (active sprint items)

Use this JQL when configuring sync to load issues in **open sprints** for the CoreTech / Color-related projects:

```text
project in ("CT AGM", "CT SVG", "CT Color-ACE", "CT ARE", "CT AGM-Print", "CoreTech Research") AND sprint in openSprints()
```

---

# 🧱 High-Level Architecture

```text
Frontend (Admin UI)
   ↓
POST /api/jira/sync
   ↓
Backend (Node service)
   ↓
Jira REST API (using PAT)
   ↓
Transform + Upsert Work Items
```

---

# 🔐 Authentication Strategy

## ✅ Use: Personal Access Token (PAT)

* Stored **only on backend**
* Never exposed to frontend
* Acts as the identity for all Jira API calls

---

## ❌ Never do:

* Store PAT in frontend
* Send PAT in API responses
* Log PAT anywhere

---

# 🗄️ Token Storage Design

## 🔹 Primary Storage (Recommended)

Store in backend secure config:

```env
JIRA_TOKENS=[{
  "token": "abc123",
  "createdAt": "2026-04-11",
  "expiresAt": "2026-07-10",
  "createdBy": "admin@company.com"
}]
```

---

## 🔹 In-Memory Usage

On server start:

* Load tokens into memory
* Always use **latest valid token**

---

# 🔄 Token Management System (Advanced)

## ✅ Support Multiple Tokens

Maintain:

```ts
type JiraToken = {
  token: string
  createdAt: string
  expiresAt: string
  createdBy: string
  isActive: boolean
}
```

---

## 🔁 Token Rotation Logic

* New token added → mark as `isActive = true`
* Old tokens → `isActive = false` (or keep as fallback)
* Always pick:

```ts
latestActiveToken
```

---

## ⏰ Expiry Handling

### Backend should:

* Check token expiry before each sync
* Warn if:

  * < 7 days remaining → "expiring soon"
  * expired → block sync

---

## 🔔 Expiry Warning Strategy

Expose API:

```http
GET /api/jira/token-status
```

Response:

```json
{
  "status": "valid | expiring_soon | expired",
  "daysRemaining": 5
}
```

Frontend:

* Show warning banner for admin

---

# 🧑‍💼 Admin Controls (Frontend)

## 🔹 Settings Page → “Jira Integration”

### Features:

* Add new token
* View token expiry status
* Trigger sync manually

---

## 🔹 Add Token Flow

```text
Admin enters new PAT
   ↓
POST /api/jira/token
   ↓
Backend validates (optional test call)
   ↓
Store securely
   ↓
Mark as active
```

---

## 🔐 Important Rule

👉 Admin **never sees existing tokens**
👉 Only allowed to **add/replace**

---

# ⚙️ Backend APIs

## 1. Sync JIRA

```http
POST /api/jira/sync
```

* Uses active token
* Fetches issues via JQL
* Upserts into DB

---

## 2. Add Token

```http
POST /api/jira/token
```

Body:

```json
{
  "token": "new_pat",
  "expiresAt": "2026-07-10"
}
```

---

## 3. Token Status

```http
GET /api/jira/token-status
```

---

# 🔄 Sync Logic

## Fetch from Jira

```http
GET /rest/api/2/search?jql=<your_query>
Authorization: Bearer <PAT>
```

---

## Upsert Strategy

* Use `jiraKey` as unique identifier
* If exists → update
* Else → create

---

## Mapping

| Jira     | App           |
| -------- | ------------- |
| key      | jiraKeys[]    |
| summary  | title         |
| assignee | assignees[]   |
| status   | mapped status |

---

# ⚠️ Security Constraints

## 🔒 Backend Responsibilities

* Store tokens securely
* Never expose tokens in logs or API
* Validate admin permissions before token update

---

## 🚫 Forbidden

* Showing token in UI
* Sending token to frontend
* Storing token in client storage

---

# 🔁 Deployment / Rotation Process

## When token expires:

1. Admin generates new PAT in Jira
2. Enters in app UI
3. Backend stores it
4. Old token deprecated automatically
5. No server restart required

---

# ❌ DO NOT DO THIS

* ❌ Manually updating `.env` via terminal for rotation
* ❌ Restarting server for token changes
* ❌ Sharing tokens via Slack/email

👉 All rotation must happen via **admin UI**

---

# 🧠 Design Principles

* **System-owned integration**, not developer-owned
* **Zero trust for frontend**
* **Graceful degradation on expiry**
* **No manual ops dependency**

---

# 🚀 Future Improvements (Optional)

* Scheduled sync (cron)
* Jira webhook integration
* Per-team Jira config
* Assignee auto-mapping

---

# ✅ Summary

| Area     | Decision           |
| -------- | ------------------ |
| Auth     | PAT (backend only) |
| Rotation | Admin UI           |
| Expiry   | Warning + blocking |
| Storage  | Secure backend     |
| Sync     | Manual trigger     |

---

# 🧩 Final Mental Model

```text
Admin controls token
Backend owns execution
Frontend triggers actions
Jira remains source of truth
```
