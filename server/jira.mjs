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

function upsertWorkItemFromIssue(workItems, issue) {
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
    const next = {
      ...w,
      title: summary || w.title,
      status,
      assignees: assignees.length > 0 ? assignees : w.assignees,
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
    sprintIds: [],
    jiraKeys: [key],
    comments: [],
  }
  return [created, ...workItems]
}

async function fetchAllIssues(jiraBase, pat, jql) {
  const base = jiraBase.replace(/\/$/, '')
  const out = []
  let startAt = 0
  const maxResults = 50
  for (;;) {
    const url = `${base}/rest/api/2/search?${new URLSearchParams({
      jql,
      startAt: String(startAt),
      maxResults: String(maxResults),
      fields: 'key,summary,assignee,status',
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

/**
 * @param {import('express').Express} app
 * @param {{ dataDir: string, jiraBaseUrl?: string }} opts
 */
export function registerJiraRoutes(app, opts) {
  const dataDir = opts.dataDir
  const tokenFile = path.join(dataDir, 'jira-tokens.json')
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

  function tokenStatusPayload() {
    const t = getActiveToken()
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

  app.post('/api/jira/sync', requireJiraSecret, async (req, res) => {
    const snapshotStr = req.body?.snapshot
    const teamId = typeof req.body?.teamId === 'string' ? req.body.teamId.trim() : ''
    const jqlOverride =
      typeof req.body?.jql === 'string' ? req.body.jql.trim() : ''
    if (typeof snapshotStr !== 'string' || !snapshotStr) {
      res.status(400).json({ error: 'Body must include { snapshot: string }' })
      return
    }

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

    const tok = getActiveToken()
    if (!tok?.token) {
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

    const jiraBase =
      typeof teamData.jiraBaseUrl === 'string' && teamData.jiraBaseUrl.includes('browse')
        ? teamData.jiraBaseUrl.split('/browse')[0].replace(/\/$/, '') || defaultJiraBase
        : defaultJiraBase

    try {
      const issues = await fetchAllIssues(jiraBase, tok.token, jql)
      let workItems = Array.isArray(teamData.workItems) ? [...teamData.workItems] : []
      for (const issue of issues) {
        workItems = upsertWorkItemFromIssue(workItems, issue)
      }
      snap.teamsData[tid] = { ...teamData, workItems }
      const out = JSON.stringify(snap)
      res.json({ ok: true, snapshot: out, issueCount: issues.length })
    } catch (e) {
      res.status(502).json({
        error: e instanceof Error ? e.message : 'Jira sync failed',
      })
    }
  })
}
