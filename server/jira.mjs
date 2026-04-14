/**
 * JIRA PAT storage + sync (backend only). See docs/JIRA Integration Architecture.md
 */
import fs from 'fs'
import path from 'path'

/** @typedef {{ token: string, createdAt: string, expiresAt: string | null, isActive: boolean }} JiraTokenRow */

function readJsonFile(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8')
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeJsonFile(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
}

function daysBetween(a, b) {
  return Math.floor((b - a) / (24 * 60 * 60 * 1000))
}

function mapJiraStatus(name) {
  if (!name || typeof name !== 'string') return 'todo'
  const n = name.trim().toLowerCase()
  if (
    n.includes('done') ||
    n.includes('closed') ||
    n.includes('resolved') ||
    n === 'complete'
  )
    return 'done'
  if (n.includes('block')) return 'blocked'
  if (n.includes('progress') || n.includes('development') || n.includes('implement'))
    return 'in_progress'
  if (n.includes('test') || n.includes('qa') || n.includes('verify'))
    return 'to_test'
  if (n.includes('track') || n.includes('review') || n.includes('ready'))
    return 'to_track'
  if (n.includes('to do') || n === 'open' || n === 'new' || n === 'backlog')
    return 'todo'
  return 'todo'
}

function addDaysYmd(startYmd, days) {
  const [y, m, d] = startYmd.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function ymdFromJiraDate(d) {
  if (!d || typeof d !== 'string') return null
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10)
  const t = Date.parse(d)
  if (Number.isNaN(t)) return null
  return new Date(t).toISOString().slice(0, 10)
}

function bodyToPlainText(body) {
  if (body == null) return ''
  if (typeof body === 'string') return body
  if (typeof body === 'object' && Array.isArray(body.content)) {
    return walkAdfContent(body.content).trim()
  }
  return ''
}

function walkAdfContent(nodes) {
  if (!Array.isArray(nodes)) return ''
  let s = ''
  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue
    if (n.type === 'text' && typeof n.text === 'string') s += n.text
    if (Array.isArray(n.content)) s += walkAdfContent(n.content)
    if (n.type === 'hardBreak') s += '\n'
    if (n.type === 'paragraph' || n.type === 'heading') {
      if (Array.isArray(n.content)) s += walkAdfContent(n.content)
      s += '\n'
    }
  }
  return s
}

function mergeJiraCommentsIntoWorkItem(existingComments, jiraApiComments) {
  const local = (existingComments || []).filter(
    (c) => c && !String(c.id).startsWith('jira-cmt-'),
  )
  const jiraMapped = (jiraApiComments || []).map((jc) => ({
    id: `jira-cmt-${jc.id}`,
    authorName:
      (jc.author &&
        typeof jc.author.displayName === 'string' &&
        jc.author.displayName) ||
      (jc.author && typeof jc.author.name === 'string' && jc.author.name) ||
      'Jira',
    body: (() => {
      const t = bodyToPlainText(jc.body).trim()
      return t || '(empty)'
    })(),
    createdAt:
      typeof jc.created === 'string' ? jc.created : new Date().toISOString(),
  }))
  return [...local, ...jiraMapped].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )
}

/** When syncSprints is true, Jira sprint ids replace previous jira-sprint-* on the item (manual sprint ids kept). */
function mergeSprintIds(existingSprintIds, jiraSprintIds, syncSprints) {
  if (!syncSprints) return existingSprintIds || []
  const manual = (existingSprintIds || []).filter(
    (id) => !String(id).startsWith('jira-sprint-'),
  )
  const list = jiraSprintIds || []
  // Keep existing sprint ids when Jira returns no sprint payload (avoid wiping jira-sprint-*).
  if (list.length === 0) return existingSprintIds || []
  const seen = new Set(manual)
  const merged = [...manual]
  for (const id of list) {
    if (!seen.has(id)) {
      seen.add(id)
      merged.push(id)
    }
  }
  return merged
}

/**
 * Jira Software "Sprint" shape differs by version: full objects, or bare numeric ids
 * (e.g. [212006, 213503]) which our older code skipped because there is no `.id`.
 */
function normalizeJiraSprintRows(jiraSprintObjs) {
  const list = Array.isArray(jiraSprintObjs) ? jiraSprintObjs : []
  const out = []
  for (const js of list) {
    if (js == null) continue
    if (typeof js === 'number' && Number.isFinite(js)) {
      out.push({ id: js, name: `Jira sprint ${js}` })
      continue
    }
    if (typeof js === 'string') {
      const t = js.trim()
      if (/^\d+$/.test(t)) {
        out.push({ id: t, name: `Jira sprint ${t}` })
        continue
      }
      // GreenHopper toString: com.atlassian.greenhopper... name=Foo,id=123,...
      if (
        t.includes('com.atlassian.greenhopper') ||
        (t.includes('id=') && t.includes('name='))
      ) {
        const idM = t.match(/\bid=(\d+)/)
        const nameM = t.match(/\bname=([^,[\]]+)/)
        if (idM) {
          const nm = nameM ? nameM[1].trim() : `Sprint ${idM[1]}`
          out.push({ id: idM[1], name: nm })
          continue
        }
      }
      try {
        const parsed = JSON.parse(t)
        const inner = Array.isArray(parsed)
          ? parsed
          : parsed && typeof parsed === 'object'
            ? [parsed]
            : []
        for (const x of inner) {
          if (typeof x === 'number' && Number.isFinite(x)) {
            out.push({ id: x, name: `Jira sprint ${x}` })
          } else if (
            x &&
            typeof x === 'object' &&
            (typeof x.id === 'number' || typeof x.id === 'string')
          ) {
            out.push(x)
          }
        }
      } catch {
        /* ignore */
      }
      continue
    }
    if (typeof js === 'object') {
      if (typeof js.id === 'number' || typeof js.id === 'string') {
        out.push(js)
        continue
      }
      if (js.value != null) {
        const v = js.value
        if (typeof v === 'number' && Number.isFinite(v)) {
          out.push({
            id: v,
            name: typeof js.name === 'string' ? js.name : `Jira sprint ${v}`,
          })
          continue
        }
        if (typeof v === 'string' && /^\d+$/.test(v.trim())) {
          const vid = v.trim()
          out.push({
            id: vid,
            name: typeof js.name === 'string' ? js.name : `Jira sprint ${vid}`,
          })
        }
      }
    }
  }
  return out
}

function upsertSprintsFromJiraObjects(sprints, jiraSprintObjs) {
  const sprintIds = []
  let out = Array.isArray(sprints) ? [...sprints] : []
  const rows = normalizeJiraSprintRows(jiraSprintObjs)
  for (const js of rows) {
    const sid = `jira-sprint-${js.id}`
    sprintIds.push(sid)
    const name =
      typeof js.name === 'string' && js.name.trim() ? js.name.trim() : `Sprint ${js.id}`
    let start = ymdFromJiraDate(js.startDate) || ymdFromJiraDate(js.start)
    let end = ymdFromJiraDate(js.endDate) || ymdFromJiraDate(js.end)
    if (!start) start = new Date().toISOString().slice(0, 10)
    if (!end) end = addDaysYmd(start, 14)

    const idx = out.findIndex((s) => s.id === sid)
    const row = { id: sid, name, start, end }
    if (idx >= 0) {
      out[idx] = { ...out[idx], ...row }
    } else {
      out = [...out, row]
    }
  }
  return { sprints: out, sprintIds }
}

function normalizeTrackerUsername(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/^@+/i, '')
    .toLowerCase()
}

/** @param {unknown[]} sprints */
function currentSprintDateBoundsForJql(sprints) {
  const today = new Date().toISOString().slice(0, 10)
  const list = Array.isArray(sprints) ? sprints : []
  const hits = list.filter(
    (s) =>
      s &&
      typeof s.start === 'string' &&
      typeof s.end === 'string' &&
      s.start <= today &&
      s.end >= today,
  )
  if (hits.length === 0) return null
  let minStart = hits[0].start
  let maxEnd = hits[0].end
  for (const h of hits) {
    if (h.start < minStart) minStart = h.start
    if (h.end > maxEnd) maxEnd = h.end
  }
  const jqlStart = String(minStart).replace(/-/g, '/')
  const jqlEnd = String(maxEnd).replace(/-/g, '/')
  return { start: minStart, end: maxEnd, jqlStart, jqlEnd }
}

/** Sprint ids like jira-sprint-123 active on today's calendar. */
function activeJiraSprintIdSetFromTracker(sprints, todayYmd) {
  const set = new Set()
  for (const s of Array.isArray(sprints) ? sprints : []) {
    if (!s || typeof s.id !== 'string') continue
    if (
      typeof s.start === 'string' &&
      typeof s.end === 'string' &&
      s.start <= todayYmd &&
      s.end >= todayYmd &&
      s.id.startsWith('jira-sprint-')
    ) {
      const m = s.id.match(/^jira-sprint-(.+)$/)
      if (m) set.add(m[1])
    }
  }
  return set
}

function jiraWorkItemSprintIdsIntersectActive(jiraSprintIds, activeIdSet) {
  for (const sid of Array.isArray(jiraSprintIds) ? jiraSprintIds : []) {
    const m = String(sid).match(/^jira-sprint-(.+)$/)
    if (m && activeIdSet.has(m[1])) return true
  }
  return false
}

function extractJiraSprintFieldValue(issue, sprintFieldId) {
  if (!issue?.fields) return null
  let raw = sprintFieldId ? issue.fields[sprintFieldId] : null
  if (raw == null && sprintFieldId) {
    const agile = issue.fields
    raw = agile.sprint ?? agile.Sprint ?? null
  }
  if (raw == null && sprintFieldId) {
    for (const v of Object.values(issue.fields)) {
      if (!Array.isArray(v) || v.length === 0) continue
      const first = v[0]
      if (
        typeof first === 'string' &&
        (first.includes('com.atlassian.greenhopper') ||
          (first.includes('id=') && first.includes('name=')))
      ) {
        raw = v
        break
      }
    }
  }
  if (raw == null) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return [raw]
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'object') return [raw]
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (/^\d+$/.test(t)) return [t]
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
      if (parsed && typeof parsed === 'object') return [parsed]
    } catch {
      return null
    }
  }
  return null
}

function upsertWorkItemFromIssue(
  workItems,
  issue,
  jiraComments,
  jiraSprintIds,
  syncSprintsFromJira,
  jiraNeedsSprintLabel,
) {
  const key = issue.key
  const fields = issue.fields || {}
  const summary = typeof fields.summary === 'string' ? fields.summary : ''
  const assignee = fields.assignee
  const assignees =
    assignee && typeof assignee.displayName === 'string'
      ? [assignee.displayName]
      : []
  const statusName = fields.status?.name
  const status = mapJiraStatus(statusName)
  const projectKey = key.includes('-') ? key.split('-')[0] : 'JIRA'

  const idx = workItems.findIndex(
    (w) => Array.isArray(w.jiraKeys) && w.jiraKeys.includes(key),
  )

  if (idx >= 0) {
    const w = workItems[idx]
    const comments = mergeJiraCommentsIntoWorkItem(w.comments, jiraComments)
    const sprintIds = mergeSprintIds(w.sprintIds, jiraSprintIds, syncSprintsFromJira)
    const next = {
      ...w,
      title: summary || w.title,
      status,
      assignees: assignees.length > 0 ? assignees : w.assignees,
      comments,
      sprintIds,
      jiraNeedsSprintLabel,
    }
    return workItems.map((x, i) => (i === idx ? next : x))
  }

  const id = `wi-jira-${key.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const created = {
    id,
    section: 'JIRA',
    component: projectKey,
    title: summary || key,
    eta: '',
    assignees,
    status,
    sprintIds: syncSprintsFromJira ? [...jiraSprintIds] : [],
    jiraKeys: [key],
    comments: mergeJiraCommentsIntoWorkItem([], jiraComments),
    jiraNeedsSprintLabel,
  }
  return [created, ...workItems]
}

async function fetchIssueFields(jiraBase, pat, issueKey, fieldsCsv) {
  const base = jiraBase.replace(/\/$/, '')
  const url = `${base}/rest/api/2/issue/${encodeURIComponent(issueKey)}?${new URLSearchParams({
    fields: fieldsCsv,
  })}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Jira issue ${issueKey} ${res.status}: ${t.slice(0, 300)}`)
  }
  return res.json()
}

/** Jira Software agile endpoint; some instances expose Sprint here when /issue search omits it. */
async function fetchAgileIssueFields(jiraBase, pat, issueKey, sprintFieldId) {
  const base = jiraBase.replace(/\/$/, '')
  const q = sprintFieldId
    ? `?fields=${encodeURIComponent(sprintFieldId)}`
    : ''
  const url = `${base}/rest/agile/1.0/issue/${encodeURIComponent(issueKey)}${q}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) return null
  try {
    return await res.json()
  } catch {
    return null
  }
}

async function fetchAllIssues(jiraBase, pat, jql, fieldList) {
  const base = jiraBase.replace(/\/$/, '')
  const out = []
  let startAt = 0
  const maxResults = 50
  const fields = fieldList.join(',')
  for (;;) {
    const url = `${base}/rest/api/2/search?${new URLSearchParams({
      jql,
      startAt: String(startAt),
      maxResults: String(maxResults),
      fields,
    })}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`Jira search failed ${res.status}: ${t.slice(0, 500)}`)
    }
    const data = await res.json()
    const issues = Array.isArray(data.issues) ? data.issues : []
    out.push(...issues)
    const total = typeof data.total === 'number' ? data.total : issues.length
    startAt += issues.length
    if (startAt >= total || issues.length === 0) break
  }
  return out
}

async function fetchIssueComments(jiraBase, pat, issueKey) {
  const base = jiraBase.replace(/\/$/, '')
  const all = []
  let startAt = 0
  const maxResults = 100
  for (;;) {
    const url = `${base}/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment?${new URLSearchParams({
      startAt: String(startAt),
      maxResults: String(maxResults),
      orderBy: 'created',
    })}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`Jira comments ${res.status} for ${issueKey}: ${t.slice(0, 300)}`)
    }
    const data = await res.json()
    const list = Array.isArray(data.comments) ? data.comments : []
    all.push(...list)
    const total = typeof data.total === 'number' ? data.total : list.length
    startAt += list.length
    if (startAt >= total || list.length === 0) break
  }
  return all
}

async function fetchCommentsForIssues(jiraBase, pat, issueKeys, concurrency = 8) {
  const map = new Map()
  for (let i = 0; i < issueKeys.length; i += concurrency) {
    const batch = issueKeys.slice(i, i + concurrency)
    const results = await Promise.all(
      batch.map(async (key) => {
        try {
          const comments = await fetchIssueComments(jiraBase, pat, key)
          return [key, comments]
        } catch {
          return [key, []]
        }
      }),
    )
    for (const [k, v] of results) map.set(k, v)
  }
  return map
}

/**
 * @param {import('express').Express} app
 * @param {{ dataDir: string, jiraBaseUrl?: string }} opts
 */
export function registerJiraRoutes(app, opts) {
  const dataDir = opts.dataDir
  const tokenFile = path.join(dataDir, 'jira-tokens.json')
  const userTokenFile = path.join(dataDir, 'jira-user-tokens.json')
  const defaultJiraBase =
    (opts.jiraBaseUrl || process.env.JIRA_BASE_URL || '').trim() ||
    'https://jira.corp.adobe.com'

  function readTokenStore() {
    const o = readJsonFile(tokenFile, { tokens: [] })
    return {
      tokens: Array.isArray(o.tokens) ? o.tokens : [],
    }
  }

  function writeTokenStore(store) {
    writeJsonFile(tokenFile, store)
  }

  function getActiveToken() {
    const { tokens } = readTokenStore()
    const active = [...tokens].filter((t) => t && t.isActive && t.token).sort(
      (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
    )
    return active[0] || null
  }

  function tokenRowStatusPayload(t) {
    if (!t || !t.token) {
      return { status: 'none', daysRemaining: null, message: 'No token configured' }
    }
    const exp = t.expiresAt ? new Date(t.expiresAt) : null
    if (!exp || Number.isNaN(exp.getTime())) {
      return { status: 'valid', daysRemaining: null, message: 'Token active (no expiry set)' }
    }
    const now = Date.now()
    if (exp.getTime() < now) {
      return { status: 'expired', daysRemaining: 0, message: 'Token expired' }
    }
    const daysRemaining = daysBetween(now, exp.getTime())
    if (daysRemaining <= 7) {
      return {
        status: 'expiring_soon',
        daysRemaining,
        message: `Expires in ${daysRemaining} day(s)`,
      }
    }
    return { status: 'valid', daysRemaining, message: 'Token valid' }
  }

  function tokenStatusPayload() {
    return tokenRowStatusPayload(getActiveToken())
  }

  function readUserTokenStore() {
    const o = readJsonFile(userTokenFile, { users: {} })
    const users = o.users && typeof o.users === 'object' ? o.users : {}
    return { users }
  }

  function writeUserTokenStore(store) {
    writeJsonFile(userTokenFile, store)
  }

  function getActiveUserToken(username) {
    const u = normalizeTrackerUsername(username)
    if (!u) return null
    const { users } = readUserTokenStore()
    const row = users[u]
    if (!row || !row.isActive || !row.token) return null
    return row
  }

  function userTokenStatusPayload(username) {
    const u = normalizeTrackerUsername(username)
    if (!u) {
      return { status: 'none', daysRemaining: null, message: 'No user' }
    }
    return tokenRowStatusPayload(getActiveUserToken(u))
  }

  function requireJiraSecret(req, res, next) {
    const secret = process.env.JIRA_API_SECRET?.trim()
    if (!secret) return next()
    const h = req.headers.authorization?.replace(/^Bearer\s+/i, '') || ''
    if (h !== secret) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    next()
  }

  app.post('/api/jira/token', requireJiraSecret, (req, res) => {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
    const expiresAt =
      typeof req.body?.expiresAt === 'string' ? req.body.expiresAt.trim() : null
    if (!token) {
      res.status(400).json({ error: 'Body must include { token: string }' })
      return
    }
    const store = readTokenStore()
    const createdAt = new Date().toISOString()
    for (const x of store.tokens) {
      if (x) x.isActive = false
    }
    store.tokens.push({
      token,
      createdAt,
      expiresAt,
      isActive: true,
    })
    writeTokenStore(store)
    res.json({ ok: true })
  })

  app.get('/api/jira/token-status', requireJiraSecret, (_req, res) => {
    res.json(tokenStatusPayload())
  })

  app.post('/api/jira/user-token', requireJiraSecret, (req, res) => {
    const username = normalizeTrackerUsername(req.body?.username)
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
    const expiresAt =
      typeof req.body?.expiresAt === 'string' ? req.body.expiresAt.trim() : null
    if (!username) {
      res.status(400).json({ error: 'Body must include { username: string }' })
      return
    }
    if (!token) {
      res.status(400).json({ error: 'Body must include { token: string }' })
      return
    }
    const store = readUserTokenStore()
    const createdAt = new Date().toISOString()
    store.users[username] = {
      token,
      createdAt,
      expiresAt,
      isActive: true,
    }
    writeUserTokenStore(store)
    res.json({ ok: true })
  })

  app.get('/api/jira/user-token-status', requireJiraSecret, (req, res) => {
    const username = normalizeTrackerUsername(req.query?.username)
    if (!username) {
      res.status(400).json({ error: 'Query username is required' })
      return
    }
    res.json(userTokenStatusPayload(username))
  })

  app.post('/api/jira/sync', requireJiraSecret, async (req, res) => {
    const snapshotStr = req.body?.snapshot
    const teamId = typeof req.body?.teamId === 'string' ? req.body.teamId.trim() : ''
    const jqlOverride =
      typeof req.body?.jql === 'string' ? req.body.jql.trim() : ''
    const syncMode =
      req.body?.syncMode === 'individual' ? 'individual' : 'admin'
    const trackerUsername = normalizeTrackerUsername(req.body?.trackerUsername)
    if (typeof snapshotStr !== 'string' || !snapshotStr) {
      res.status(400).json({ error: 'Body must include { snapshot: string }' })
      return
    }

    if (syncMode === 'individual' && !trackerUsername) {
      res.status(400).json({
        error: 'individual sync requires { trackerUsername: string }',
      })
      return
    }

    let pat = null
    if (syncMode === 'individual') {
      const ust = userTokenStatusPayload(trackerUsername)
      if (ust.status === 'expired' || ust.status === 'none') {
        res.status(400).json({
          error:
            ust.status === 'none'
              ? 'Save your Jira PAT first (POST /api/jira/user-token)'
              : 'Your Jira token expired; save a new one',
        })
        return
      }
      pat = getActiveUserToken(trackerUsername)?.token ?? null
    } else {
      const status = tokenStatusPayload()
      if (status.status === 'expired' || status.status === 'none') {
        res.status(400).json({
          error:
            status.status === 'none'
              ? 'Configure a JIRA PAT first (POST /api/jira/token)'
              : 'JIRA token expired; add a new token',
        })
        return
      }
      pat = getActiveToken()?.token ?? null
    }

    if (!pat) {
      res.status(400).json({ error: 'No active token' })
      return
    }

    let snap
    try {
      snap = JSON.parse(snapshotStr)
    } catch {
      res.status(400).json({ error: 'Invalid snapshot JSON' })
      return
    }

    if (!snap.teamsData || typeof snap.teamsData !== 'object') {
      res.status(400).json({ error: 'Snapshot missing teamsData' })
      return
    }

    const tid =
      teamId && snap.teamsData[teamId]
        ? teamId
        : snap.teams?.[0]?.id && snap.teamsData[snap.teams[0].id]
          ? snap.teams[0].id
          : null
    if (!tid || !snap.teamsData[tid]) {
      res.status(400).json({ error: 'Invalid or missing teamId' })
      return
    }

    const teamData = snap.teamsData[tid]
    const jql =
      jqlOverride ||
      (typeof teamData.jiraSyncJql === 'string' && teamData.jiraSyncJql.trim()) ||
      process.env.JIRA_JQL?.trim() ||
      ''
    if (!jql) {
      res.status(400).json({
        error:
          'Set jiraSyncJql on the team, pass jql in the request body, or set JIRA_JQL',
      })
      return
    }

    const sprintFieldRaw =
      (typeof teamData.jiraSprintFieldId === 'string' &&
        teamData.jiraSprintFieldId.trim()) ||
      process.env.JIRA_SPRINT_FIELD?.trim() ||
      ''

    const jiraBase =
      typeof teamData.jiraBaseUrl === 'string' && teamData.jiraBaseUrl.includes('browse')
        ? teamData.jiraBaseUrl.split('/browse')[0].replace(/\/$/, '') || defaultJiraBase
        : defaultJiraBase

    try {
      const searchFields = ['key', 'summary', 'assignee', 'status', 'reporter', 'created']
      if (sprintFieldRaw) searchFields.push(sprintFieldRaw)

      const todayYmd = new Date().toISOString().slice(0, 10)
      const activeJiraSprintIds = activeJiraSprintIdSetFromTracker(
        teamData.sprints,
        todayYmd,
      )

      const primaryIssues = await fetchAllIssues(jiraBase, pat, jql, searchFields)
      let secondaryIssues = []
      const secondaryKeySet = new Set()
      if (syncMode === 'individual') {
        const bounds = currentSprintDateBoundsForJql(teamData.sprints)
        if (bounds) {
          const jqlReporter = `reporter = currentUser() AND created >= "${bounds.jqlStart}" AND created <= "${bounds.jqlEnd}"`
          secondaryIssues = await fetchAllIssues(
            jiraBase,
            pat,
            jqlReporter,
            searchFields,
          )
          for (const i of secondaryIssues) {
            if (i?.key) secondaryKeySet.add(i.key)
          }
        }
      }

      const mergedByKey = new Map()
      for (const issue of primaryIssues) {
        if (issue?.key) mergedByKey.set(issue.key, issue)
      }
      for (const issue of secondaryIssues) {
        if (issue?.key && !mergedByKey.has(issue.key))
          mergedByKey.set(issue.key, issue)
      }
      const issues = [...mergedByKey.values()]

      const keys = issues.map((i) => i.key).filter(Boolean)
      const commentMap = await fetchCommentsForIssues(jiraBase, pat, keys)

      let workItems = Array.isArray(teamData.workItems) ? [...teamData.workItems] : []
      let sprints = Array.isArray(teamData.sprints) ? [...teamData.sprints] : []

      for (const issue of issues) {
        const jiraComments = commentMap.get(issue.key) || []
        let jiraSprintIds = []
        let issueForSync = issue
        let rawSprints = extractJiraSprintFieldValue(issueForSync, sprintFieldRaw)

        let missing =
          rawSprints == null ||
          (Array.isArray(rawSprints) && rawSprints.length === 0)

        if (missing && sprintFieldRaw) {
          try {
            const one = await fetchIssueFields(
              jiraBase,
              pat,
              issue.key,
              sprintFieldRaw,
            )
            if (one?.fields && one.fields[sprintFieldRaw] != null) {
              issueForSync = {
                ...issue,
                fields: { ...issue.fields, ...one.fields },
              }
              rawSprints = extractJiraSprintFieldValue(
                issueForSync,
                sprintFieldRaw,
              )
            }
          } catch {
            /* keep search payload */
          }
        }

        missing =
          rawSprints == null ||
          (Array.isArray(rawSprints) && rawSprints.length === 0)
        if (missing && sprintFieldRaw) {
          const agile = await fetchAgileIssueFields(
            jiraBase,
            pat,
            issue.key,
            sprintFieldRaw,
          )
          if (agile?.fields && agile.fields[sprintFieldRaw] != null) {
            issueForSync = {
              ...issueForSync,
              fields: { ...issueForSync.fields, ...agile.fields },
            }
            rawSprints = extractJiraSprintFieldValue(
              issueForSync,
              sprintFieldRaw,
            )
          }
        }

        missing =
          rawSprints == null ||
          (Array.isArray(rawSprints) && rawSprints.length === 0)
        if (missing && sprintFieldRaw) {
          try {
            const wide = await fetchIssueFields(
              jiraBase,
              pat,
              issue.key,
              '*navigable*',
            )
            if (wide?.fields) {
              issueForSync = {
                ...issueForSync,
                fields: { ...issueForSync.fields, ...wide.fields },
              }
              let rs = extractJiraSprintFieldValue(issueForSync, sprintFieldRaw)
              if (
                rs == null ||
                (Array.isArray(rs) && rs.length === 0)
              ) {
                rs = extractJiraSprintFieldValue(issueForSync, null)
              }
              rawSprints = rs
            }
          } catch {
            /* ignore */
          }
        }

        missing =
          rawSprints == null ||
          (Array.isArray(rawSprints) && rawSprints.length === 0)
        if (missing) {
          rawSprints = extractJiraSprintFieldValue(issueForSync, null)
        }

        const syncSprintsFromJira =
          Boolean(sprintFieldRaw) ||
          Boolean(rawSprints && rawSprints.length > 0)

        if (
          syncSprintsFromJira &&
          rawSprints != null &&
          !(Array.isArray(rawSprints) && rawSprints.length === 0)
        ) {
          const { sprints: nextSprints, sprintIds } = upsertSprintsFromJiraObjects(
            sprints,
            rawSprints,
          )
          sprints = nextSprints
          jiraSprintIds = sprintIds
        }

        const onActiveBoardSprint = jiraWorkItemSprintIdsIntersectActive(
          jiraSprintIds,
          activeJiraSprintIds,
        )
        const jiraNeedsSprintLabel =
          syncMode === 'individual' &&
          activeJiraSprintIds.size > 0 &&
          secondaryKeySet.has(issue.key) &&
          !onActiveBoardSprint

        workItems = upsertWorkItemFromIssue(
          workItems,
          issueForSync,
          jiraComments,
          jiraSprintIds,
          syncSprintsFromJira,
          syncMode === 'individual' ? jiraNeedsSprintLabel : false,
        )
      }

      snap.teamsData[tid] = { ...teamData, workItems, sprints }
      const out = JSON.stringify(snap)
      res.json({ ok: true, snapshot: out, issueCount: issues.length })
    } catch (e) {
      res.status(502).json({
        error: e instanceof Error ? e.message : 'Jira sync failed',
      })
    }
  })
}
