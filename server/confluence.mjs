/**
 * Confluence wiki sync for ScrumTracker.
 *
 * Bodies are stored in data/teams/{teamId}/notes.json (server-side only).
 * The HTTP sync response returns only lightweight metadata refs (no body field)
 * so the client snapshot stays small regardless of how many pages exist.
 * Full page bodies are served on-demand via GET /api/confluence/body.
 *
 * Token file: data/confluence-tokens.json  →  { token, baseUrl }
 */
import fs from 'fs'
import path from 'path'
import { readTrackerStore } from './splitJsonStore.mjs'
import { decryptSecret, encryptSecret } from './tokenCrypto.mjs'

const TOKEN_FILE = 'confluence-tokens.json'

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function tokenPath(dataDir) {
  return path.join(dataDir, TOKEN_FILE)
}

function readToken(dataDir) {
  try {
    const raw = fs.readFileSync(tokenPath(dataDir), 'utf8')
    const o = JSON.parse(raw)
    if (typeof o.token !== 'string' || !o.token) return null
    const token = decryptSecret(o.token, dataDir)
    if (!token) return null
    return {
      token,
      baseUrl: typeof o.baseUrl === 'string' ? o.baseUrl.replace(/\/$/, '') : 'https://wiki.corp.adobe.com',
    }
  } catch {
    return null
  }
}

function writeToken(dataDir, token, baseUrl) {
  fs.mkdirSync(dataDir, { recursive: true })
  const tmp = tokenPath(dataDir) + `.${process.pid}.${Date.now()}.tmp`
  const body = JSON.stringify(
    { token: encryptSecret(token, dataDir), baseUrl },
    null,
    2,
  )
  fs.writeFileSync(tmp, body, { encoding: 'utf8', mode: 0o600 })
  fs.renameSync(tmp, tokenPath(dataDir))
  try {
    fs.chmodSync(tokenPath(dataDir), 0o600)
  } catch {
    // best effort (e.g. Windows)
  }
}

// ---------------------------------------------------------------------------
// Confluence API fetch helper
// ---------------------------------------------------------------------------

async function confluenceGet(baseUrl, apiPath, token) {
  const url = `${baseUrl}/rest/api${apiPath}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Confluence API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// HTML → Markdown converter (handles Confluence Storage Format)
// ---------------------------------------------------------------------------

function storageToMarkdown(html) {
  let md = html

  // Strip Confluence-specific XML elements entirely
  md = md.replace(/<ac:structured-macro[\s\S]*?<\/ac:structured-macro>/gi, '')
  md = md.replace(/<ac:plain-text-body[\s\S]*?<\/ac:plain-text-body>/gi, '')
  md = md.replace(/<ac:rich-text-body[\s\S]*?<\/ac:rich-text-body>/gi, '')
  md = md.replace(/<ac:[^>]*\/>/gi, '')
  md = md.replace(/<ac:[^>]*>[\s\S]*?<\/ac:\w[\w-]*>/gi, '')
  md = md.replace(/<ri:[^>]*\/>/gi, '')
  md = md.replace(/<ri:[^>]*>[\s\S]*?<\/ri:\w[\w-]*>/gi, '')

  // Code blocks (before inline code)
  md = md.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_, code) => {
    return '\n```\n' + decodeHtmlEntities(code) + '\n```\n'
  })
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, code) => {
    return '\n```\n' + decodeHtmlEntities(code) + '\n```\n'
  })

  // Headings
  for (let i = 6; i >= 1; i--) {
    const hashes = '#'.repeat(i)
    md = md.replace(new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\\/h${i}>`, 'gi'), `\n${hashes} $1\n`)
  }

  // Inline code
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')

  // Bold
  md = md.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**')

  // Italic
  md = md.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*')

  // Strikethrough
  md = md.replace(/<(?:s|del|strike)[^>]*>([\s\S]*?)<\/(?:s|del|strike)>/gi, '~~$1~~')

  // Links
  md = md.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')

  // Images
  md = md.replace(/<img[^>]+alt="([^"]*)"[^>]+src="([^"]*)"[^>]*\/?>/gi, '![$1]($2)')
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*\/?>/gi, '![]($1)')

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
    return inner.split('\n').map(l => '> ' + l.trim()).join('\n') + '\n'
  })

  // Tables — basic conversion
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, body) => {
    const rows = []
    const rowMatches = body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)
    for (const [, cells] of rowMatches) {
      const cellData = []
      const cellMatches = cells.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)
      for (const [, cell] of cellMatches) {
        cellData.push(stripTags(cell).replace(/\|/g, '\\|').trim())
      }
      rows.push('| ' + cellData.join(' | ') + ' |')
    }
    if (rows.length === 0) return ''
    const sep = '| ' + rows[0].split('|').slice(1, -1).map(() => '---').join(' | ') + ' |'
    return '\n' + rows[0] + '\n' + sep + '\n' + rows.slice(1).join('\n') + '\n'
  })

  // Lists (handle nesting crudely — flatten to single level)
  md = md.replace(/<ul[^>]*>/gi, '\n')
  md = md.replace(/<\/ul>/gi, '\n')
  md = md.replace(/<ol[^>]*>/gi, '\n')
  md = md.replace(/<\/ol>/gi, '\n')
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => '- ' + stripTags(inner).trim() + '\n')

  // Paragraphs and divs
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
  md = md.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '\n$1\n')

  // Horizontal rule
  md = md.replace(/<hr\s*\/?>/gi, '\n---\n')

  // Line breaks
  md = md.replace(/<br\s*\/?>/gi, '\n')

  // Strip all remaining HTML tags
  md = stripTags(md)

  // Decode HTML entities
  md = decodeHtmlEntities(md)

  // Normalize whitespace
  md = md.replace(/[ \t]+\n/g, '\n')
  md = md.replace(/\n{3,}/g, '\n\n')
  md = md.trim()

  return md
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '')
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, '')
}

// ---------------------------------------------------------------------------
// Fetch all pages in a space (paginated)
// ---------------------------------------------------------------------------

async function fetchAllSpacePages(baseUrl, spaceKey, token) {
  const pages = []
  let start = 0
  const limit = 50
  while (true) {
    const qs = new URLSearchParams({
      spaceKey,
      type: 'page',
      status: 'current',
      limit: String(limit),
      start: String(start),
      // Metadata only — bodies fetched on-demand to keep sync fast and reliable
      expand: 'space,version',
    })
    const data = await confluenceGet(baseUrl, `/content?${qs}`, token)
    const results = Array.isArray(data.results) ? data.results : []
    pages.push(...results)
    if (results.length < limit || !data._links?.next) break
    start += limit
  }
  return pages
}

// ---------------------------------------------------------------------------
// Express route registration
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// notes.json helpers — read/write team notes directly (avoids snapshot round-trip)
// ---------------------------------------------------------------------------

function notesPath(dataDir, teamId) {
  return path.join(dataDir, 'teams', teamId, 'notes.json')
}

function readNotes(dataDir, teamId) {
  try {
    const raw = fs.readFileSync(notesPath(dataDir, teamId), 'utf8')
    return JSON.parse(raw) ?? {}
  } catch {
    return {}
  }
}

function writeNotes(dataDir, teamId, notes) {
  const dir = path.join(dataDir, 'teams', teamId)
  fs.mkdirSync(dir, { recursive: true })
  const fp = notesPath(dataDir, teamId)
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(notes), 'utf8')
  fs.renameSync(tmp, fp)
}

function bumpRev(dataDir) {
  const fp = path.join(dataDir, 'tracker-state.json')
  let existing = {}
  try { existing = JSON.parse(fs.readFileSync(fp, 'utf8')) } catch {}
  const rev = Date.now()
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify({ ...existing, rev }), 'utf8')
  fs.renameSync(tmp, fp)
  return rev
}

export function registerConfluenceRoutes(app, dataDir, broadcastRevFn) {
  // Save PAT
  app.post('/api/confluence/token', (req, res) => {
    const token = req.body?.token
    const baseUrl = req.body?.baseUrl ?? 'https://wiki.corp.adobe.com'
    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ error: 'token is required' })
    }
    writeToken(dataDir, token.trim(), baseUrl.trim())
    res.json({ ok: true })
  })

  // Token status
  app.get('/api/confluence/token-status', (req, res) => {
    const t = readToken(dataDir)
    res.json({ configured: Boolean(t) })
  })

  // Sync all pages from configured space.
  // Reads confluenceSpaceUrl from notes.json (no snapshot needed).
  // Saves full page bodies to notes.json; returns only lightweight metadata refs.
  app.post('/api/confluence/sync', async (req, res) => {
    const { teamId } = req.body ?? {}
    if (!teamId || typeof teamId !== 'string') {
      return res.status(400).json({ ok: false, error: 'teamId is required' })
    }

    const tok = readToken(dataDir)
    if (!tok) {
      return res.status(400).json({ ok: false, error: 'No Confluence token configured. Add a PAT in Settings → Confluence Integration.' })
    }

    const notes = readNotes(dataDir, teamId)

    let spaceUrl = notes.confluenceSpaceUrl
    // Fallback: if not in notes.json (e.g. set before notes.json arch), read from main snapshot
    if (!spaceUrl || typeof spaceUrl !== 'string') {
      try {
        const store = readTrackerStore(dataDir)
        if (store.snapshot) {
          const snap = JSON.parse(store.snapshot)
          const fromSnap = snap?.teamsData?.[teamId]?.confluenceSpaceUrl
          if (typeof fromSnap === 'string' && fromSnap.trim()) {
            spaceUrl = fromSnap.trim()
            notes.confluenceSpaceUrl = spaceUrl // persist to notes.json below
          }
        }
      } catch { /* non-fatal */ }
    }
    if (!spaceUrl || typeof spaceUrl !== 'string') {
      return res.status(400).json({ ok: false, error: 'No Confluence space URL configured for this team. Set it in Settings → Confluence integration.' })
    }

    const spaceKeyMatch = spaceUrl.match(/\/spaces\/([^/?#]+)/i)
    if (!spaceKeyMatch) {
      return res.status(400).json({ ok: false, error: 'Could not extract space key from URL. Expected format: .../spaces/{SPACEKEY}/...' })
    }
    const spaceKey = spaceKeyMatch[1]

    // Preserve existing bodies on per-page error
    const existingRefs = {}
    for (const ref of Array.isArray(notes.confluencePages) ? notes.confluencePages : []) {
      if (ref && typeof ref.pageId === 'string') existingRefs[ref.pageId] = ref
    }

    let rawPages
    try {
      rawPages = await fetchAllSpacePages(tok.baseUrl, spaceKey, tok.token)
    } catch (e) {
      return res.status(502).json({ ok: false, error: `Failed to fetch pages from Confluence: ${e instanceof Error ? e.message : String(e)}` })
    }

    const now = new Date().toISOString()
    const newRefs = []      // includes body — stored in notes.json
    const metaRefs = []     // no body — returned to client

    for (const p of rawPages) {
      const pageId = String(p.id ?? '')
      if (!pageId) continue
      const title = typeof p.title === 'string' ? p.title : 'Untitled'
      const pageSpaceKey = p.space?.key ?? spaceKey
      const selfHref = p._links?.webui ?? ''
      const url = selfHref
        ? (selfHref.startsWith('http') ? selfHref : `${tok.baseUrl}${selfHref}`)
        : `${tok.baseUrl}/pages/viewpage.action?pageId=${pageId}`

        // Bodies are fetched on-demand when a page is opened; preserve any cached body
      const cachedBody = existingRefs[pageId]?.body

      const fullRef = {
        pageId, title, url, spaceKey: pageSpaceKey, lastSyncedAt: now,
        ...(cachedBody ? { body: cachedBody } : {}),
      }
      const metaRef = {
        pageId, title, url, spaceKey: pageSpaceKey, lastSyncedAt: now,
      }
      newRefs.push(fullRef)
      metaRefs.push(metaRef)
    }

    // Persist full refs (with bodies) to notes.json on the server
    writeNotes(dataDir, teamId, { ...notes, confluencePages: newRefs })

    // Bump rev and notify connected clients
    try {
      const rev = bumpRev(dataDir)
      if (typeof broadcastRevFn === 'function') broadcastRevFn(rev)
    } catch { /* non-fatal */ }

    // Return only metadata (no bodies) so the HTTP response stays small
    res.json({ ok: true, pages: metaRefs, pageCount: metaRefs.length })
  })

  // Fetch a single page body. Returns cached body from notes.json if available;
  // otherwise fetches live from Confluence API, converts to Markdown, and caches it.
  app.get('/api/confluence/body', async (req, res) => {
    const teamId = req.query.teamId
    const pageId = req.query.pageId
    if (!teamId || !pageId) {
      return res.status(400).json({ ok: false, error: 'teamId and pageId are required' })
    }
    const notes = readNotes(dataDir, String(teamId))
    const pages = Array.isArray(notes.confluencePages) ? notes.confluencePages : []
    const found = pages.find((p) => p && p.pageId === String(pageId))
    if (!found) {
      return res.status(404).json({ ok: false, error: 'Page not found. Sync the space to fetch page content.' })
    }

    // Serve cached body immediately
    if (found.body) {
      return res.json({ ok: true, body: found.body, syncError: found.syncError ?? null })
    }

    // On-demand fetch from Confluence API
    const tok = readToken(dataDir)
    if (!tok) {
      return res.json({ ok: true, body: '', syncError: 'No Confluence token configured' })
    }
    try {
      const data = await confluenceGet(tok.baseUrl, `/content/${String(pageId)}?expand=body.storage`, tok.token)
      const htmlBody = data.body?.storage?.value ?? ''
      let markdown = ''
      if (htmlBody) {
        try {
          markdown = storageToMarkdown(htmlBody)
        } catch (e) {
          return res.json({ ok: true, body: '', syncError: `Conversion failed: ${e instanceof Error ? e.message : String(e)}` })
        }
      }
      // Cache the body so future opens are instant
      if (markdown) {
        found.body = markdown
        delete found.syncError
        try { writeNotes(dataDir, String(teamId), notes) } catch { /* non-fatal */ }
      }
      return res.json({ ok: true, body: markdown, syncError: null })
    } catch (e) {
      return res.json({ ok: true, body: '', syncError: `Failed to fetch from Confluence: ${e instanceof Error ? e.message : String(e)}` })
    }
  })
}
