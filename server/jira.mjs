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

function trackerReachedDone(prevStatus, nextStatus) {
  return prevStatus !== 'done' && nextStatus === 'done'
}

function hasJiraResolvedStamp(comments, issueKey) {
  const id = `jira-sys-resolved-${issueKey}`
  return (comments || []).some((c) => c && c.id === id)
}

/** When Jira moves to done/resolved, add a dated line so weekly view shows it even with no comments. */
function appendJiraResolvedStamp(comments, issueKey, _statusName, resolutionOrUpdatedIso) {
  const id = `jira-sys-resolved-${issueKey}`
  if ((comments || []).some((c) => c && c.id === id)) return comments || []
  const createdAt =
    typeof resolutionOrUpdatedIso === 'string' && resolutionOrUpdatedIso
      ? resolutionOrUpdatedIso
      : new Date().toISOString()
  const stamp = {
    id,
    authorName: 'Jira',
    /** Short plain text; UI uses `id` for compact “Jira closed” + clickable key. */
    body: 'Jira closed',
    createdAt,
  }
  return [...(comments || []), stamp].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )
}

function resolutionTimestampFromFields(fields) {
  if (!fields || typeof fields !== 'object') return null
  if (typeof fields.resolutiondate === 'string' && fields.resolutiondate)
    return fields.resolutiondate
  if (typeof fields.updated === 'string' && fields.updated) return fields.updated
  return null
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
  // Ship-ready: treat as done in the tracker. Must run before generic
  // "progress" / "development" checks so compound Jira names like
  // "In progress - Ready for production" do not map to in_progress.
  if (
    n.includes('ready for production') ||
    n.includes('ready for prod') ||
    n.includes('production ready') ||
    n === 'release ready' ||
    n === 'ready for release'
  )
    return 'done'
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
  if (typeof body === 'object') {
    const blocks =
      body.type === 'doc' && Array.isArray(body.content)
        ? body.content
        : Array.isArray(body.content)
          ? body.content
          : null
    if (blocks) return adfBlocksToPlainText(blocks).trim()
  }
  return ''
}

/** Plain text from inline nodes (paragraph contents, etc.). */
function adfInlineToText(nodes) {
  if (!Array.isArray(nodes)) return ''
  let s = ''
  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue
    if (n.type === 'text' && typeof n.text === 'string') s += n.text
    if (n.type === 'hardBreak') s += '\n'
    if (n.type === 'mention') {
      const t = n.attrs && (n.attrs.text || n.attrs.id)
      if (typeof t === 'string' && t) s += `@${t}`
    }
    if (n.type === 'emoji' && n.attrs && typeof n.attrs.shortName === 'string')
      s += `:${n.attrs.shortName}:`
    if (Array.isArray(n.content)) s += adfInlineToText(n.content)
  }
  return s
}

function adfParagraphToText(p) {
  if (!p || typeof p !== 'object') return ''
  const t = adfInlineToText(p.content || []).replace(/\n/g, ' ').trim()
  return t
}

function adfListItemToLines(item, depth, bulletPrefix) {
  if (!item || item.type !== 'listItem') return ''
  const parts = item.content || []
  let main = ''
  let nested = ''
  for (const p of parts) {
    if (!p || typeof p !== 'object') continue
    if (p.type === 'paragraph' || p.type === 'heading') {
      const t = adfParagraphToText(p)
      if (t) main = main ? `${main} ${t}` : t
    } else if (p.type === 'bulletList') {
      nested += adfBulletListToLines(p, depth + 1)
    } else if (p.type === 'orderedList') {
      nested += adfOrderedListToLines(p, depth + 1)
    } else if (p.type === 'codeBlock') {
      const lines = (p.content || [])
        .filter((x) => x && x.type === 'text' && x.text)
        .map((x) => x.text)
        .join('')
      if (lines.trim()) {
        const indent = '  '.repeat(depth + 1)
        nested += `${indent}• ${lines.trim()}\n`
      }
    } else if (Array.isArray(p.content)) {
      const t = adfInlineToText(p.content).replace(/\n/g, ' ').trim()
      if (t) main = main ? `${main} ${t}` : t
    }
  }
  const indent = '  '.repeat(depth)
  const line = (main || '').trim()
  if (!line && nested) return nested
  return `${indent}${bulletPrefix}${line || '(empty)'}\n${nested}`
}

function adfBulletListToLines(list, depth) {
  if (!list || list.type !== 'bulletList') return ''
  let s = ''
  for (const item of list.content || []) {
    if (item && item.type === 'listItem') {
      s += adfListItemToLines(item, depth, '• ')
    }
  }
  return s
}

function adfOrderedListToLines(list, depth) {
  if (!list || list.type !== 'orderedList') return ''
  let s = ''
  let ord = 1
  for (const item of list.content || []) {
    if (item && item.type === 'listItem') {
      s += adfListItemToLines(item, depth, `${ord++}. `)
    }
  }
  return s
}

/** Top-level ADF block nodes → plain text with 2-space indent + • / n. per list level (matches dashboard parser). */
function adfBlocksToPlainText(nodes) {
  if (!Array.isArray(nodes)) return ''
  let s = ''
  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue
    switch (n.type) {
      case 'bulletList':
        s += adfBulletListToLines(n, 0)
        break
      case 'orderedList':
        s += adfOrderedListToLines(n, 0)
        break
      case 'paragraph': {
        const t = adfParagraphToText(n)
        if (t) s += `${t}\n`
        break
      }
      case 'heading': {
        const t = adfParagraphToText(n)
        if (t) s += `${t}\n`
        break
      }
      case 'blockquote':
        s += adfBlocksToPlainText(n.content || [])
        break
      case 'codeBlock': {
        const lines = (n.content || [])
          .filter((x) => x && x.type === 'text' && x.text)
          .map((x) => x.text)
          .join('')
        if (lines.trim()) s += `${lines.trim()}\n`
        break
      }
      case 'rule':
        s += '—\n'
        break
      case 'mediaSingle':
      case 'mediaGroup':
      case 'table':
      case 'panel':
      case 'expand': {
        if (Array.isArray(n.content)) s += adfBlocksToPlainText(n.content)
        break
      }
      default:
        if (Array.isArray(n.content)) s += adfBlocksToPlainText(n.content)
    }
  }
  return s
}

/**
 * Merge Jira REST comments into a work item. `jiraFetchResult` is either a legacy
 * comment array or `{ ok: boolean, comments?: unknown[], error?: string }`.
 * When `ok === false` (per-issue fetch error), existing `jira-cmt-*` rows are kept
 * so a transient Jira failure does not wipe comments from the tracker snapshot.
 */
function mergeJiraCommentsIntoWorkItem(existingComments, jiraFetchResult, issueKey) {
  const key =
    typeof issueKey === 'string' && issueKey.trim()
      ? issueKey.trim().toUpperCase()
      : ''
  const fetchFailed =
    jiraFetchResult &&
    typeof jiraFetchResult === 'object' &&
    jiraFetchResult.ok === false
  const jiraList = fetchFailed
    ? []
    : Array.isArray(jiraFetchResult)
      ? jiraFetchResult
      : Array.isArray(jiraFetchResult?.comments)
        ? jiraFetchResult.comments
        : []

  const prevJiraMirror = (existingComments || []).filter(
    (c) => c && String(c.id).startsWith('jira-cmt-'),
  )
  /** For deduping local-only comments vs Jira: use API rows, or preserved mirrors on fetch failure. */
  const jiraRowsForDedupe = fetchFailed
    ? prevJiraMirror.map((c) => ({
        body: c.body,
        created: c.createdAt,
      }))
    : jiraList

  const local = (existingComments || []).filter((c) => {
    if (!c || String(c.id).startsWith('jira-cmt-')) return false
    const plain = (c.body || '').trim()
    if (!plain || !key) return true
    for (const jc of jiraRowsForDedupe) {
      const jb =
        typeof jc.body === 'string'
          ? jc.body.trim()
          : bodyToPlainText(jc.body).trim()
      if (jb !== plain) continue
      const ca = typeof c.createdAt === 'string' ? c.createdAt : ''
      const cb = typeof jc.created === 'string' ? jc.created : ''
      if (ca && cb) {
        const da = Date.parse(ca)
        const db = Date.parse(cb)
        if (!Number.isNaN(da) && !Number.isNaN(db) && Math.abs(da - db) <= 120_000) {
          return false
        }
      }
    }
    return true
  })

  const jiraMapped = fetchFailed
    ? prevJiraMirror
    : jiraList.map((jc) => ({
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
        ...(key ? { jiraIssueKey: key } : {}),
      }))
  return [...local, ...jiraMapped].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )
}

/**
 * When syncSprints is true, merge Jira board sprint ids into the item (manual sprint ids
 * kept). Union with existing `jira-sprint-*` so a narrow Jira payload does not drop prior
 * sprint tags (items stay visible under older tracker/Jira sprints after refetch).
 */
function mergeSprintIds(existingSprintIds, jiraSprintIds, syncSprints) {
  if (!syncSprints) return existingSprintIds || []
  const manual = (existingSprintIds || []).filter(
    (id) => !String(id).startsWith('jira-sprint-'),
  )
  const existingJira = (existingSprintIds || []).filter((id) =>
    String(id).startsWith('jira-sprint-'),
  )
  const list = jiraSprintIds || []
  // Keep existing sprint ids when Jira returns no sprint payload (avoid wiping jira-sprint-*).
  if (list.length === 0) return existingSprintIds || []
  const seen = new Set(manual)
  const merged = [...manual]
  for (const id of existingJira) {
    if (!seen.has(id)) {
      seen.add(id)
      merged.push(id)
    }
  }
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
        const startM = t.match(/\bstartDate=([^,[\]]+)/)
        const endM = t.match(/\bendDate=([^,[\]]+)/)
        if (idM) {
          const nm = nameM ? nameM[1].trim() : `Sprint ${idM[1]}`
          const row = { id: idM[1], name: nm }
          const sd = startM ? startM[1].trim() : ''
          const ed = endM ? endM[1].trim() : ''
          if (sd && sd !== '<null>') row.startDate = sd
          if (ed && ed !== '<null>') row.endDate = ed
          out.push(row)
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

    const idx = out.findIndex((s) => s.id === sid)
    const existing = idx >= 0 ? out[idx] : null
    /** Preserve previously-stored dates when JIRA returns the sprint without them
     * (older JIRA installs surface the Sprint field as bare ids or `{value}` envelopes
     * that carry no startDate/endDate). Falling back to today would clobber every
     * sprint touched in a single sync with the same artificial date range. */
    if (!start) start = existing?.start || new Date().toISOString().slice(0, 10)
    if (!end) end = existing?.end || addDaysYmd(start, 14)

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

function findTrackerSprintById(sprints, sprintId) {
  const id = String(sprintId ?? '').trim()
  if (!id) return null
  const list = Array.isArray(sprints) ? sprints : []
  return list.find((s) => s && s.id === id) ?? null
}

/** Board sprint id from tracker sprint row `jira-sprint-123` (numeric only for JQL `Sprint =`). */
function jiraBoardNumericFromTrackerSprint(sp) {
  if (!sp || typeof sp.id !== 'string') return null
  const m = sp.id.match(/^jira-sprint-(\d+)$/)
  return m ? m[1] : null
}

/**
 * Leading `project in (...)` or `project = X` so we can run `… AND Sprint = n` when the
 * saved JQL already filters on sprint (e.g. openSprints) and would otherwise exclude closed sprints.
 */
function extractLeadingProjectClause(jql) {
  let t = String(jql).trim()
  if (!t) return null
  /** Strip redundant outer `( … )` wrappers so `(project in (...)) AND sprint in ...` works. */
  for (let guard = 0; guard < 4; guard++) {
    if (t.startsWith('(') && t.endsWith(')')) {
      const inner = t.slice(1, -1).trim()
      if (inner.toLowerCase().startsWith('project ')) {
        t = inner
        continue
      }
    }
    break
  }
  const low = t.toLowerCase()
  if (!low.startsWith('project ')) return null
  if (low.startsWith('project in')) {
    const openIdx = t.indexOf('(')
    if (openIdx === -1) return null
    let depth = 0
    for (let i = openIdx; i < t.length; i++) {
      const c = t[i]
      if (c === '(') depth++
      else if (c === ')') {
        depth--
        if (depth === 0) return t.slice(0, i + 1).trim()
      }
    }
    return null
  }
  const m = t.match(/^project\s*=\s*("[^"]+"|'[^']+'|\w+)/i)
  return m ? m[0].trim() : null
}

/**
 * When team JQL uses `sprint in openSprints()`, replace with `Sprint = n` so scoped sync
 * fetches closed-board-sprint issues instead of relying on a second query (which may fail silently).
 * @param {string} jql
 * @param {string} n board sprint id for JQL
 * @returns {string | null} rewritten JQL, or null if pattern not found
 */
function rewriteOpenSprintsToSprintEquals(jql, n) {
  const probe = /\bsprint\s+in\s+openSprints\s*\(\s*\)/i
  if (!probe.test(jql)) return null
  return jql.replace(/\bsprint\s+in\s+openSprints\s*\(\s*\)/gi, `Sprint = ${n}`)
}

/**
 * When `syncSprintId` maps to a Jira board sprint, narrow the primary search so closed
 * sprints still sync when the user picks that sprint in the UI.
 * @returns {{ primary: string, extraJqls: string[] }}
 */
function buildPrimaryJqlVariantsForSync(jqlBase, sprints, syncSprintId) {
  const trimmed = String(jqlBase ?? '').trim()
  if (!trimmed || !syncSprintId) return { primary: trimmed, extraJqls: [] }
  const sp = findTrackerSprintById(sprints, syncSprintId)
  const n = jiraBoardNumericFromTrackerSprint(sp)
  if (!n) return { primary: trimmed, extraJqls: [] }
  if (!/\bsprint\b/i.test(trimmed)) {
    return { primary: `(${trimmed}) AND Sprint = ${n}`, extraJqls: [] }
  }
  const rewritten = rewriteOpenSprintsToSprintEquals(trimmed, n)
  if (rewritten && rewritten !== trimmed) {
    return { primary: rewritten, extraJqls: [] }
  }
  const proj = extractLeadingProjectClause(trimmed)
  if (!proj) return { primary: trimmed, extraJqls: [] }
  return {
    primary: trimmed,
    extraJqls: [`(${proj}) AND Sprint = ${n}`],
  }
}

/** @param {{ start: string, end: string }} sprint */
function sprintBoundsToJql(sprint) {
  if (!sprint || typeof sprint.start !== 'string' || typeof sprint.end !== 'string')
    return null
  const jqlStart = String(sprint.start).replace(/-/g, '/')
  const jqlEnd = String(sprint.end).replace(/-/g, '/')
  return { start: sprint.start, end: sprint.end, jqlStart, jqlEnd }
}

/**
 * When client passes a tracker sprint id, use that sprint for Jira board matching and
 * reporter date windows; otherwise keep calendar-today behaviour.
 * @param {unknown[]} sprints
 */
function buildActiveJiraSprintIdSetForSync(sprints, syncSprintId, todayYmd) {
  const sp = findTrackerSprintById(sprints, syncSprintId)
  if (sp && typeof sp.id === 'string') {
    const m = sp.id.match(/^jira-sprint-(.+)$/)
    if (m) return new Set([m[1]])
    return new Set()
  }
  return activeJiraSprintIdSetFromTracker(sprints, todayYmd)
}

/** @param {unknown[]} sprints */
function reporterDateBoundsForSync(sprints, syncSprintId) {
  const sp = findTrackerSprintById(sprints, syncSprintId)
  if (sp) return sprintBoundsToJql(sp)
  return currentSprintDateBoundsForJql(sprints)
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
  /** @type {unknown[] | { ok: boolean, comments?: unknown[] }} */
  jiraCommentsOrFetchResult,
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
    let comments = mergeJiraCommentsIntoWorkItem(
      w.comments,
      jiraCommentsOrFetchResult,
      key,
    )
    const resTs = resolutionTimestampFromFields(fields)
    if (
      trackerReachedDone(w.status, status) &&
      !hasJiraResolvedStamp(comments, key)
    ) {
      comments = appendJiraResolvedStamp(
        comments,
        key,
        statusName,
        resTs,
      )
    }
    const sprintIds = mergeSprintIds(w.sprintIds, jiraSprintIds, syncSprintsFromJira)
    const next = {
      ...w,
      title: summary || w.title,
      status,
      jiraStatusName: statusName || undefined,
      assignees: assignees.length > 0 ? assignees : w.assignees,
      comments,
      sprintIds,
      jiraNeedsSprintLabel,
    }
    return workItems.map((x, i) => (i === idx ? next : x))
  }

  const id = `wi-jira-${key.replace(/[^a-zA-Z0-9_-]/g, '')}`
  let createdComments = mergeJiraCommentsIntoWorkItem(
    [],
    jiraCommentsOrFetchResult,
    key,
  )
  const resTsNew = resolutionTimestampFromFields(fields)
  if (
    status === 'done' &&
    !hasJiraResolvedStamp(createdComments, key) &&
    (Array.isArray(jiraCommentsOrFetchResult)
      ? jiraCommentsOrFetchResult
      : jiraCommentsOrFetchResult?.comments || []
    ).length === 0
  ) {
    createdComments = appendJiraResolvedStamp(
      createdComments,
      key,
      statusName,
      resTsNew,
    )
  }
  const created = {
    id,
    section: 'JIRA',
    component: projectKey,
    title: summary || key,
    eta: '',
    assignees,
    status,
    jiraStatusName: statusName || undefined,
    sprintIds: syncSprintsFromJira ? [...jiraSprintIds] : [],
    jiraKeys: [key],
    comments: createdComments,
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

async function jiraGet(jiraBase, pat, pathWithLeadingSlash) {
  const base = jiraBase.replace(/\/$/, '')
  const res = await fetch(`${base}${pathWithLeadingSlash}`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/json',
    },
  })
  return res
}

async function createJiraIssueRest(jiraBase, pat, fields) {
  const base = jiraBase.replace(/\/$/, '')
  const res = await fetch(`${base}/rest/api/2/issue`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Jira create issue failed ${res.status}: ${t.slice(0, 500)}`)
  }
  return res.json()
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
    if (issues.length === 0) break
    startAt += issues.length
    const totalKnown = typeof data.total === 'number' ? data.total : null
    if (totalKnown != null && startAt >= totalKnown) break
    if (issues.length < maxResults) break
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
    if (list.length === 0) break
    startAt += list.length
    const totalKnown = typeof data.total === 'number' ? data.total : null
    if (totalKnown != null && startAt >= totalKnown) break
    if (list.length < maxResults) break
  }
  return all
}

/**
 * Add a plain-text comment on a Jira issue (REST v2). Uses the same PAT as sync.
 * @param {string} jiraBase
 * @param {string} pat
 * @param {string} issueKey
 * @param {string} bodyText
 */
async function postIssueComment(jiraBase, pat, issueKey, bodyText) {
  const base = jiraBase.replace(/\/$/, '')
  const url = `${base}/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: bodyText }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Jira add comment ${res.status} for ${issueKey}: ${t.slice(0, 400)}`)
  }
  return res.json()
}

/**
 * Update an existing Jira issue comment (REST v2).
 * @param {string} jiraBase
 * @param {string} pat
 * @param {string} issueKey
 * @param {string} jiraCommentNumericId
 * @param {string} bodyText
 */
async function updateIssueComment(jiraBase, pat, issueKey, jiraCommentNumericId, bodyText) {
  const base = jiraBase.replace(/\/$/, '')
  const url = `${base}/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment/${encodeURIComponent(jiraCommentNumericId)}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: bodyText }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Jira update comment ${res.status} for ${issueKey}/${jiraCommentNumericId}: ${t.slice(0, 400)}`)
  }
  return res.json()
}

/**
 * Per-issue Jira comment list. `ok: false` means the REST call failed — merge will
 * retain existing `jira-cmt-*` rows for that issue instead of replacing with [].
 * @returns {Map<string, { ok: boolean, comments: unknown[], error?: string }>}
 */
async function fetchCommentsForIssues(jiraBase, pat, issueKeys, concurrency = 8) {
  const map = new Map()
  for (let i = 0; i < issueKeys.length; i += concurrency) {
    const batch = issueKeys.slice(i, i + concurrency)
    const results = await Promise.all(
      batch.map(async (key) => {
        try {
          const comments = await fetchIssueComments(jiraBase, pat, key)
          return [key, { ok: true, comments }]
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          console.warn(`[jira sync] comments fetch failed for ${key}: ${msg}`)
          return [key, { ok: false, comments: [], error: msg }]
        }
      }),
    )
    for (const [k, v] of results) map.set(k, v)
  }
  return map
}

/**
 * @param {import('express').Express} app
 * @param {{
 *   dataDir: string
 *   jiraBaseUrl?: string
 *   readTrackerSnapshot?: () => { snapshot: string | null }
 * }} opts
 */
export function registerJiraRoutes(app, opts) {
  const dataDir = opts.dataDir
  const readTrackerSnapshot =
    typeof opts.readTrackerSnapshot === 'function'
      ? opts.readTrackerSnapshot
      : () => ({ snapshot: null })
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

  /**
   * @returns {Promise<{ ok: true, pat: string, jiraBase: string } | { ok: false, status: number, error: string }>}
   */
  async function resolvePatAndJiraBase(teamId, syncMode, trackerUsername) {
    if (!teamId) {
      return { ok: false, status: 400, error: 'teamId is required' }
    }
    if (syncMode === 'individual' && !trackerUsername) {
      return {
        ok: false,
        status: 400,
        error: 'individual mode requires trackerUsername',
      }
    }
    let pat = null
    if (syncMode === 'individual') {
      const ust = userTokenStatusPayload(trackerUsername)
      if (ust.status === 'expired' || ust.status === 'none') {
        return {
          ok: false,
          status: 400,
          error:
            ust.status === 'none'
              ? 'Save your Jira PAT first (POST /api/jira/user-token)'
              : 'Your Jira token expired; save a new one',
        }
      }
      pat = getActiveUserToken(trackerUsername)?.token ?? null
    } else {
      const status = tokenStatusPayload()
      if (status.status === 'expired' || status.status === 'none') {
        return {
          ok: false,
          status: 400,
          error:
            status.status === 'none'
              ? 'Configure a JIRA PAT first (POST /api/jira/token)'
              : 'JIRA token expired; add a new token',
        }
      }
      pat = getActiveToken()?.token ?? null
    }
    if (!pat) {
      return { ok: false, status: 400, error: 'No active token' }
    }

    const { snapshot: snapStr } = readTrackerSnapshot()
    if (!snapStr || typeof snapStr !== 'string') {
      return {
        ok: false,
        status: 400,
        error: 'Server has no tracker snapshot; open the app with sync enabled once',
      }
    }
    let snap
    try {
      snap = JSON.parse(snapStr)
    } catch {
      return { ok: false, status: 400, error: 'Invalid server snapshot' }
    }
    const teamData = snap.teamsData?.[teamId]
    if (!teamData) {
      return { ok: false, status: 404, error: 'Unknown teamId in server snapshot' }
    }
    const jiraBase =
      typeof teamData.jiraBaseUrl === 'string' && teamData.jiraBaseUrl.includes('browse')
        ? teamData.jiraBaseUrl.split('/browse')[0].replace(/\/$/, '') || defaultJiraBase
        : defaultJiraBase
    return { ok: true, pat, jiraBase }
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
    const syncSprintId =
      typeof req.body?.syncSprintId === 'string' ? req.body.syncSprintId.trim() : ''
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
    const jqlBase =
      jqlOverride ||
      (typeof teamData.jiraSyncJql === 'string' && teamData.jiraSyncJql.trim()) ||
      process.env.JIRA_JQL?.trim() ||
      ''
    if (!jqlBase) {
      res.status(400).json({
        error:
          'Set jiraSyncJql on the team, pass jql in the request body, or set JIRA_JQL',
      })
      return
    }

    const { primary: jqlPrimary, extraJqls } = buildPrimaryJqlVariantsForSync(
      jqlBase,
      teamData.sprints,
      syncSprintId,
    )

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
      const searchFields = [
        'key',
        'summary',
        'assignee',
        'status',
        'reporter',
        'created',
        'resolutiondate',
        'updated',
      ]
      if (sprintFieldRaw) searchFields.push(sprintFieldRaw)

      const todayYmd = new Date().toISOString().slice(0, 10)
      const activeJiraSprintIds = buildActiveJiraSprintIdSetForSync(
        teamData.sprints,
        syncSprintId,
        todayYmd,
      )

      const mergedPrimary = new Map()
      const runPrimary = async (q) => {
        const rows = await fetchAllIssues(jiraBase, pat, q, searchFields)
        for (const issue of rows) {
          if (issue?.key && !mergedPrimary.has(issue.key))
            mergedPrimary.set(issue.key, issue)
        }
      }
      await runPrimary(jqlPrimary)
      for (const q of extraJqls) {
        try {
          await runPrimary(q)
        } catch {
          /* optional sprint-scoped query may fail on unusual JQL; keep primary results */
        }
      }
      const primaryIssues = [...mergedPrimary.values()]

      let secondaryIssues = []
      const secondaryKeySet = new Set()
      if (syncMode === 'individual') {
        const bounds = reporterDateBoundsForSync(teamData.sprints, syncSprintId)
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
      let commentFetchFailureCount = 0

      for (const issue of issues) {
        const jiraCommentResult = commentMap.get(issue.key) ?? {
          ok: true,
          comments: [],
        }
        if (jiraCommentResult.ok === false) commentFetchFailureCount += 1
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
          jiraCommentResult,
          jiraSprintIds,
          syncSprintsFromJira,
          syncMode === 'individual' ? jiraNeedsSprintLabel : false,
        )
      }

      snap.teamsData[tid] = { ...teamData, workItems, sprints }
      const out = JSON.stringify(snap)
      res.json({
        ok: true,
        snapshot: out,
        issueCount: issues.length,
        commentFetchFailureCount,
      })
    } catch (e) {
      res.status(502).json({
        error: e instanceof Error ? e.message : 'Jira sync failed',
      })
    }
  })

  app.post('/api/jira/create-issue', requireJiraSecret, async (req, res) => {
    const teamId = typeof req.body?.teamId === 'string' ? req.body.teamId.trim() : ''
    const projectKey =
      typeof req.body?.projectKey === 'string' ? req.body.projectKey.trim().toUpperCase() : ''
    const issueType =
      typeof req.body?.issueType === 'string' ? req.body.issueType.trim() : ''
    const summary = typeof req.body?.summary === 'string' ? req.body.summary.trim() : ''
    const description =
      typeof req.body?.description === 'string' ? req.body.description.trim() : ''
    const syncMode =
      req.body?.syncMode === 'individual' ? 'individual' : 'admin'
    const trackerUsername = normalizeTrackerUsername(req.body?.trackerUsername)

    if (!teamId || !projectKey || !issueType || !summary) {
      res.status(400).json({
        error:
          'Body must include { teamId, projectKey, issueType, summary } (optional description)',
      })
      return
    }

    const conn = await resolvePatAndJiraBase(teamId, syncMode, trackerUsername)
    if (!conn.ok) {
      res.status(conn.status).json({ error: conn.error })
      return
    }
    const { pat, jiraBase } = conn

    const rawCustomFields =
      req.body?.customFields && typeof req.body.customFields === 'object'
        ? req.body.customFields
        : {}

    /** @type {Record<string, unknown>} */
    const fields = {
      project: { key: projectKey },
      summary,
      issuetype: { name: issueType },
    }
    if (description) {
      fields.description = description
    }
    const reservedFields = new Set(['project', 'summary', 'issuetype', 'description', 'reporter'])
    for (const [k, v] of Object.entries(rawCustomFields)) {
      if (typeof k === 'string' && !reservedFields.has(k) && v != null) {
        fields[k] = v
      }
    }

    try {
      const created = await createJiraIssueRest(jiraBase, pat, fields)
      res.json({
        ok: true,
        key: created.key,
        id: created.id,
        self: created.self,
      })
    } catch (e) {
      res.status(502).json({
        error: e instanceof Error ? e.message : 'Jira create failed',
      })
    }
  })

  app.post('/api/jira/issue-comment', requireJiraSecret, async (req, res) => {
    const teamId = typeof req.body?.teamId === 'string' ? req.body.teamId.trim() : ''
    const issueKey =
      typeof req.body?.issueKey === 'string' ? req.body.issueKey.trim().toUpperCase() : ''
    const bodyText = typeof req.body?.body === 'string' ? req.body.body : ''
    const syncMode = req.body?.syncMode === 'individual' ? 'individual' : 'admin'
    const trackerUsername = normalizeTrackerUsername(req.body?.trackerUsername)

    if (!teamId || !issueKey || !bodyText.trim()) {
      res.status(400).json({
        error:
          'Body must include { teamId, issueKey, body } (optional syncMode, trackerUsername)',
      })
      return
    }

    const conn = await resolvePatAndJiraBase(teamId, syncMode, trackerUsername)
    if (!conn.ok) {
      res.status(conn.status).json({ error: conn.error })
      return
    }
    const { pat, jiraBase } = conn

    try {
      const created = await postIssueComment(jiraBase, pat, issueKey, bodyText.trim())
      const jiraCommentId =
        created && (typeof created.id === 'string' || typeof created.id === 'number')
          ? String(created.id)
          : null
      res.json({ ok: true, jiraCommentId })
    } catch (e) {
      res.status(502).json({
        error: e instanceof Error ? e.message : 'Jira comment failed',
      })
    }
  })

  app.put('/api/jira/issue-comment', requireJiraSecret, async (req, res) => {
    const teamId = typeof req.body?.teamId === 'string' ? req.body.teamId.trim() : ''
    const issueKey =
      typeof req.body?.issueKey === 'string' ? req.body.issueKey.trim().toUpperCase() : ''
    const jiraCommentId =
      typeof req.body?.jiraCommentId === 'string'
        ? req.body.jiraCommentId.trim()
        : typeof req.body?.jiraCommentId === 'number'
          ? String(req.body.jiraCommentId)
          : ''
    const bodyText = typeof req.body?.body === 'string' ? req.body.body : ''
    const syncMode = req.body?.syncMode === 'individual' ? 'individual' : 'admin'
    const trackerUsername = normalizeTrackerUsername(req.body?.trackerUsername)

    if (!teamId || !issueKey || !jiraCommentId || !bodyText.trim()) {
      res.status(400).json({
        error:
          'Body must include { teamId, issueKey, jiraCommentId, body } (optional syncMode, trackerUsername)',
      })
      return
    }

    const conn = await resolvePatAndJiraBase(teamId, syncMode, trackerUsername)
    if (!conn.ok) {
      res.status(conn.status).json({ error: conn.error })
      return
    }
    const { pat, jiraBase } = conn

    try {
      await updateIssueComment(jiraBase, pat, issueKey, jiraCommentId, bodyText.trim())
      res.json({ ok: true })
    } catch (e) {
      res.status(502).json({
        error: e instanceof Error ? e.message : 'Jira comment update failed',
      })
    }
  })

  app.get('/api/jira/meta/projects', requireJiraSecret, async (req, res) => {
    const teamId = typeof req.query.teamId === 'string' ? req.query.teamId.trim() : ''
    const syncMode =
      req.query.syncMode === 'individual' ? 'individual' : 'admin'
    const trackerUsername = normalizeTrackerUsername(req.query.trackerUsername)
    const conn = await resolvePatAndJiraBase(teamId, syncMode, trackerUsername)
    if (!conn.ok) {
      res.status(conn.status).json({ error: conn.error })
      return
    }
    try {
      const jiraRes = await jiraGet(conn.jiraBase, conn.pat, '/rest/api/2/project')
      if (!jiraRes.ok) {
        const t = await jiraRes.text()
        res.status(502).json({
          error: `Jira project list failed ${jiraRes.status}: ${t.slice(0, 400)}`,
        })
        return
      }
      const raw = await jiraRes.json()
      const arr = Array.isArray(raw) ? raw : []
      const projects = arr
        .filter((p) => p && typeof p.key === 'string')
        .map((p) => ({ key: p.key, name: typeof p.name === 'string' ? p.name : p.key }))
        .sort((a, b) => a.key.localeCompare(b.key))
      res.json({ projects })
    } catch (e) {
      res.status(502).json({
        error: e instanceof Error ? e.message : 'Jira meta failed',
      })
    }
  })

  app.get('/api/jira/meta/issue-types', requireJiraSecret, async (req, res) => {
    const teamId = typeof req.query.teamId === 'string' ? req.query.teamId.trim() : ''
    const projectKey =
      typeof req.query.projectKey === 'string' ? req.query.projectKey.trim().toUpperCase() : ''
    const syncMode =
      req.query.syncMode === 'individual' ? 'individual' : 'admin'
    const trackerUsername = normalizeTrackerUsername(req.query.trackerUsername)
    if (!projectKey) {
      res.status(400).json({ error: 'Query projectKey is required' })
      return
    }
    const conn = await resolvePatAndJiraBase(teamId, syncMode, trackerUsername)
    if (!conn.ok) {
      res.status(conn.status).json({ error: conn.error })
      return
    }
    try {
      /** Prefer GET /project/{key} — some Jira builds route /issue/createmeta as /issue/{issueId} ("Issue Does Not Exist"). */
      const projPath = `/rest/api/2/project/${encodeURIComponent(projectKey)}`
      const projRes = await jiraGet(conn.jiraBase, conn.pat, projPath)
      if (projRes.ok) {
        const projData = await projRes.json()
        const types = Array.isArray(projData.issueTypes) ? projData.issueTypes : []
        const issueTypes = types
          .filter((t) => t && typeof t.name === 'string' && !t.subtask)
          .map((t) => ({
            id: String(t.id ?? ''),
            name: String(t.name),
          }))
          .filter((t) => t.name)
          .sort((a, b) => a.name.localeCompare(b.name))
        if (issueTypes.length > 0) {
          res.json({ issueTypes })
          return
        }
      }
      const q = new URLSearchParams({
        projectKeys: projectKey,
        expand: 'projects.issuetypes',
      })
      const metaPath = `/rest/api/2/issue/createmeta?${q}`
      const jiraRes = await jiraGet(conn.jiraBase, conn.pat, metaPath)
      if (!jiraRes.ok) {
        const t = await jiraRes.text()
        res.status(502).json({
          error: `Jira issue types failed ${jiraRes.status}: ${t.slice(0, 400)}`,
        })
        return
      }
      const data = await jiraRes.json()
      const projects = Array.isArray(data.projects) ? data.projects : []
      const proj = projects.find((p) => p && String(p.key).toUpperCase() === projectKey)
      const types = Array.isArray(proj?.issuetypes) ? proj.issuetypes : []
      const issueTypes = types
        .filter((t) => t && typeof t.name === 'string' && !t.subtask)
        .map((t) => ({
          id: String(t.id ?? ''),
          name: String(t.name),
        }))
        .filter((t) => t.name)
        .sort((a, b) => a.name.localeCompare(b.name))
      res.json({ issueTypes })
    } catch (e) {
      res.status(502).json({
        error: e instanceof Error ? e.message : 'Jira meta failed',
      })
    }
  })

  app.get('/api/jira/meta/required-fields', requireJiraSecret, async (req, res) => {
    const teamId = typeof req.query.teamId === 'string' ? req.query.teamId.trim() : ''
    const projectKey =
      typeof req.query.projectKey === 'string' ? req.query.projectKey.trim().toUpperCase() : ''
    const issueTypeId =
      typeof req.query.issueTypeId === 'string' ? req.query.issueTypeId.trim() : ''
    const syncMode =
      req.query.syncMode === 'individual' ? 'individual' : 'admin'
    const trackerUsername = normalizeTrackerUsername(req.query.trackerUsername)
    if (!projectKey || !issueTypeId) {
      res.status(400).json({ error: 'Query projectKey and issueTypeId are required' })
      return
    }
    const conn = await resolvePatAndJiraBase(teamId, syncMode, trackerUsername)
    if (!conn.ok) {
      res.status(conn.status).json({ error: conn.error })
      return
    }
    try {
      const knownAutoFields = new Set([
        'project', 'summary', 'issuetype', 'description', 'reporter',
      ])

      function extractRequiredFields(fieldsObj) {
        const requiredFields = []
        for (const [fieldKey, meta] of Object.entries(fieldsObj)) {
          if (!meta || !meta.required) continue
          if (knownAutoFields.has(fieldKey)) continue
          requiredFields.push({
            key: fieldKey,
            name: typeof meta.name === 'string' ? meta.name : fieldKey,
            type: meta.schema?.type ?? 'string',
            allowedValues: Array.isArray(meta.allowedValues)
              ? meta.allowedValues.map((v) => ({
                  id: String(v.id ?? ''),
                  name: String(v.name ?? v.value ?? v.id ?? ''),
                  value: v.value ?? undefined,
                }))
              : null,
          })
        }
        return requiredFields
      }

      /** Try newer per-issueType createmeta endpoint first (Jira Cloud + Server 9+). */
      const newPath = `/rest/api/2/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes/${encodeURIComponent(issueTypeId)}`
      const newRes = await jiraGet(conn.jiraBase, conn.pat, newPath)
      console.log(`[jira required-fields] new API ${newPath} → ${newRes.status}`)
      if (newRes.ok) {
        const data = await newRes.json()
        const values = Array.isArray(data.values) ? data.values : []
        console.log(`[jira required-fields] new API returned ${values.length} field(s)`)
        const fieldsObj = {}
        for (const f of values) {
          if (f && typeof f.fieldId === 'string') {
            fieldsObj[f.fieldId] = f
          }
        }
        const requiredFields = extractRequiredFields(fieldsObj)
        console.log(`[jira required-fields] extracted ${requiredFields.length} required field(s):`, requiredFields.map((f) => f.key))
        res.json({ requiredFields })
        return
      }

      /** Fall back to legacy createmeta with expand (older Jira Server). */
      const q = new URLSearchParams({
        projectKeys: projectKey,
        issuetypeIds: issueTypeId,
        expand: 'projects.issuetypes.fields',
      })
      const metaPath = `/rest/api/2/issue/createmeta?${q}`
      const jiraRes = await jiraGet(conn.jiraBase, conn.pat, metaPath)
      console.log(`[jira required-fields] legacy API ${metaPath.slice(0, 80)} → ${jiraRes.status}`)
      if (!jiraRes.ok) {
        const t = await jiraRes.text()
        console.log(`[jira required-fields] legacy API error body:`, t.slice(0, 300))
        res.status(502).json({
          error: `Jira createmeta failed ${jiraRes.status}: ${t.slice(0, 400)}`,
        })
        return
      }
      const data = await jiraRes.json()
      const projects = Array.isArray(data.projects) ? data.projects : []
      const proj = projects.find((p) => p && String(p.key).toUpperCase() === projectKey)
      const types = Array.isArray(proj?.issuetypes) ? proj.issuetypes : []
      const issueType = types.find((t) => String(t.id) === issueTypeId)
      const fieldsObj = issueType?.fields ?? {}
      const requiredFields = extractRequiredFields(fieldsObj)
      console.log(`[jira required-fields] legacy API extracted ${requiredFields.length} required field(s):`, requiredFields.map((f) => f.key))
      res.json({ requiredFields })
    } catch (e) {
      res.status(502).json({
        error: e instanceof Error ? e.message : 'Jira required-fields meta failed',
      })
    }
  })

  app.get('/api/jira/issue-suggest', requireJiraSecret, async (req, res) => {
    const teamId = typeof req.query.teamId === 'string' ? req.query.teamId.trim() : ''
    const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const syncMode =
      req.query.syncMode === 'individual' ? 'individual' : 'admin'
    const trackerUsername = normalizeTrackerUsername(req.query.trackerUsername)
    if (qRaw.length < 2) {
      res.json({ issues: [] })
      return
    }
    const safe = qRaw.replace(/[^a-zA-Z0-9\-_\s]/g, '').slice(0, 80)
    if (safe.length < 2) {
      res.json({ issues: [] })
      return
    }
    const conn = await resolvePatAndJiraBase(teamId, syncMode, trackerUsername)
    if (!conn.ok) {
      res.status(conn.status).json({ error: conn.error })
      return
    }
    const esc = safe.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    let jql
    if (/^[A-Z][A-Z0-9]+-\d+$/i.test(safe)) {
      jql = `key = "${safe.toUpperCase()}"`
    } else {
      jql = `summary ~ "${esc}*" OR key ~ "${esc}*"`
    }
    try {
      const sp = new URLSearchParams({
        jql,
        maxResults: '15',
        fields: 'key,summary',
      })
      let jiraRes = await jiraGet(
        conn.jiraBase,
        conn.pat,
        `/rest/api/2/search?${sp}`,
      )
      if (!jiraRes.ok && jql.includes('key ~')) {
        const sp2 = new URLSearchParams({
          jql: `summary ~ "${esc}*"`,
          maxResults: '15',
          fields: 'key,summary',
        })
        jiraRes = await jiraGet(conn.jiraBase, conn.pat, `/rest/api/2/search?${sp2}`)
      }
      if (!jiraRes.ok) {
        const t = await jiraRes.text()
        res.status(502).json({
          error: `Jira search failed ${jiraRes.status}: ${t.slice(0, 400)}`,
        })
        return
      }
      const data = await jiraRes.json()
      const issues = Array.isArray(data.issues) ? data.issues : []
      const out = issues
        .filter((iss) => iss && typeof iss.key === 'string')
        .map((iss) => ({
          key: iss.key,
          summary:
            iss.fields && typeof iss.fields.summary === 'string'
              ? iss.fields.summary
              : '',
        }))
      res.json({ issues: out })
    } catch (e) {
      res.status(502).json({
        error: e instanceof Error ? e.message : 'Jira search failed',
      })
    }
  })

  app.get('/api/jira/lookup-issue', requireJiraSecret, async (req, res) => {
    const teamId = typeof req.query.teamId === 'string' ? req.query.teamId.trim() : ''
    const keyRaw = typeof req.query.key === 'string' ? req.query.key.trim() : ''
    const key = keyRaw.toUpperCase()
    const syncMode =
      req.query.syncMode === 'individual' ? 'individual' : 'admin'
    const trackerUsername = normalizeTrackerUsername(req.query.trackerUsername)
    if (!key) {
      res.status(400).json({ error: 'Query key is required (e.g. PROJ-123)' })
      return
    }
    const conn = await resolvePatAndJiraBase(teamId, syncMode, trackerUsername)
    if (!conn.ok) {
      res.status(conn.status).json({ error: conn.error })
      return
    }
    try {
      const jiraRes = await jiraGet(
        conn.jiraBase,
        conn.pat,
        `/rest/api/2/issue/${encodeURIComponent(key)}?fields=summary,key`,
      )
      if (jiraRes.status === 404) {
        res.json({ ok: false, error: 'Issue not found in Jira' })
        return
      }
      if (!jiraRes.ok) {
        const t = await jiraRes.text()
        res.status(502).json({
          error: `Jira lookup failed ${jiraRes.status}: ${t.slice(0, 400)}`,
        })
        return
      }
      const data = await jiraRes.json()
      const k = typeof data.key === 'string' ? data.key : key
      const summary =
        data.fields && typeof data.fields.summary === 'string' ? data.fields.summary : ''
      res.json({ ok: true, key: k, summary })
    } catch (e) {
      res.status(502).json({
        error: e instanceof Error ? e.message : 'Jira lookup failed',
      })
    }
  })
}
