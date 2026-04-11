# Future todos (backlog)

Short-lived parking lot for ideas that are out of scope for current sprints. Trim or promote items into real issues when you pick them up.

---

## Confluence: live “one-click” Weekly Tasks column update

**Status:** Deferred (higher complexity than copy-to-clipboard).

**Why it’s non-trivial:** Needs backend-held credentials, Confluence Cloud vs Data Center API choice, page/version locking, and safe edits to **ADF** or **storage** XML (find table → row → column; optional `@mention` / `accountId` mapping).

**When picking this up, confirm:**

- Confluence **Cloud** vs **Server/DC**
- Auth: **service account + API token** vs **OAuth per user**
- Stable **page ID** (and space) for the Weekly Tasks table
- Tracker user → Confluence **`accountId`** mapping strategy
- Append vs replace rules and conflict handling (version mismatch)

---

## Team chat + notification sound (in-app)

**Goal:** Lightweight team chat inside the tracker, with an optional sound when new messages arrive.

**Options (rough effort vs fit):**

| Approach | Pros | Cons |
|----------|------|------|
| **Keep polling (~2.5s)** + sound on new `messageId` | No new infra; matches current sync model; trivial to add client-side “beep” when `lastMessageAt` changes | Higher DB/API load at scale; not “instant”; battery/tab cost |
| **WebSockets** (or SSE) | Instant delivery; fewer redundant full snapshots if you push deltas | Server sticky sessions, reconnect logic, auth on the socket, ops complexity |
| **Slack embedded in UI** | Users already live in Slack | **Not realistically “easy”:** Slack blocks arbitrary iframe embeds; building a full chat clone inside the app needs **Slack APIs** (socket mode / Events API), bot tokens, channel/DM mapping, and compliance review |

**Recommendation:** For a hackathon-sized app, **polling + sound** (and optional “only poll when tab focused”) is the pragmatic first step. Move to **SSE or a single WebSocket room per team** if message volume or latency becomes painful.

**Sound notification (polling-friendly):**

- Store `messages` with monotonic `id` or `createdAt`.
- Client keeps `lastSeenMessageId`; if fetch returns a newer id and the document is focused (or user opted in), play a short **`<audio>`** clip (user gesture may be required on first play in some browsers).

---

## Slack: “bring chat here” without full integration

**Easiest path:** Keep **deep links** to Slack DMs/channels (already aligned with `slackChatUrl` / roster). Optional: a small **“Open team channel”** link in the header if everyone shares one channel URL.

**Harder path:** Embedded Slack experience generally means a **Slack app** with proper OAuth, not an iframe of `slack.com`.
