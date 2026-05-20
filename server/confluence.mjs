/**
 * Confluence wiki sync for ScrumTracker.
 * Mirrors the jira.mjs pattern: server reads PAT, fetches Confluence REST API,
 * converts Confluence Storage Format (HTML) to Markdown, and stores page bodies
 * directly in the snapshot (no server-side file cache).
 *
 * Token file: data/confluence-tokens.json  →  { token, baseUrl }
 */
import fs from 'fs'
import path from 'path'

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
    return {
      token: o.token,
      baseUrl: typeof o.baseUrl === 'string' ? o.baseUrl.replace(/\/$/, '') : 'https://wiki.corp.adobe.com',
    }
  } catch {
    return null
  }
}

function writeToken(dataDir, token, baseUrl) {
  fs.mkdirSync(dataDir, { recursive: true })
  const tmp = tokenPath(dataDir) + `.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify({ token, baseUrl }, null, 2), 'utf8')
  fs.renameSync(tmp, tokenPath(dataDir))
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
      expand: 'body.storage,space,version',
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

export function registerConfluenceRoutes(app, dataDir) {
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

  // Sync all pages from configured space
  app.post('/api/confluence/sync', async (req, res) => {
    const { teamId, snapshot: snapshotStr } = req.body ?? {}
    if (!teamId || typeof teamId !== 'string') {
      return res.status(400).json({ ok: false, error: 'teamId is required' })
    }
    if (!snapshotStr || typeof snapshotStr !== 'string') {
      return res.status(400).json({ ok: false, error: 'snapshot is required' })
    }

    const tok = readToken(dataDir)
    if (!tok) {
      return res.status(400).json({ ok: false, error: 'No Confluence token configured. Add a PAT in Settings → Confluence Integration.' })
    }

    let snap
    try {
      snap = JSON.parse(snapshotStr)
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid snapshot JSON' })
    }

    const teamData = snap?.teamsData?.[teamId]
    if (!teamData) {
      return res.status(400).json({ ok: false, error: `No team data found for teamId: ${teamId}` })
    }

    const spaceUrl = teamData.confluenceSpaceUrl
    if (!spaceUrl || typeof spaceUrl !== 'string') {
      return res.status(400).json({ ok: false, error: 'No Confluence space URL configured for this team.' })
    }

    // Extract spaceKey from URL: /spaces/{spaceKey}/...
    const spaceKeyMatch = spaceUrl.match(/\/spaces\/([^/?#]+)/i)
    if (!spaceKeyMatch) {
      return res.status(400).json({ ok: false, error: 'Could not extract space key from URL. Expected format: https://wiki.corp.adobe.com/spaces/{SPACEKEY}/...' })
    }
    const spaceKey = spaceKeyMatch[1]

    // Build a map of existing refs so we can preserve old bodies on error
    const existingRefs = {}
    const prev = Array.isArray(teamData.confluencePages) ? teamData.confluencePages : []
    for (const ref of prev) {
      if (ref && typeof ref.pageId === 'string') existingRefs[ref.pageId] = ref
    }

    let rawPages
    try {
      rawPages = await fetchAllSpacePages(tok.baseUrl, spaceKey, tok.token)
    } catch (e) {
      return res.status(502).json({ ok: false, error: `Failed to fetch pages from Confluence: ${e instanceof Error ? e.message : String(e)}` })
    }

    const now = new Date().toISOString()
    const newRefs = []

    for (const p of rawPages) {
      const pageId = String(p.id ?? '')
      if (!pageId) continue
      const title = typeof p.title === 'string' ? p.title : 'Untitled'
      const pageSpaceKey = p.space?.key ?? spaceKey
      const selfHref = p._links?.webui ?? ''
      const url = selfHref
        ? (selfHref.startsWith('http') ? selfHref : `${tok.baseUrl}${selfHref}`)
        : `${tok.baseUrl}/pages/viewpage.action?pageId=${pageId}`

      const htmlBody = p.body?.storage?.value ?? ''
      if (!htmlBody && !existingRefs[pageId]?.body) {
        // Skip empty pages with no prior body
        newRefs.push({
          pageId,
          title,
          url,
          spaceKey: pageSpaceKey,
          lastSyncedAt: now,
        })
        continue
      }

      let markdown = ''
      let syncError
      try {
        markdown = htmlBody ? storageToMarkdown(htmlBody) : (existingRefs[pageId]?.body ?? '')
      } catch (e) {
        syncError = `Conversion failed: ${e instanceof Error ? e.message : String(e)}`
        markdown = existingRefs[pageId]?.body ?? ''
      }

      const ref = {
        pageId,
        title,
        url,
        spaceKey: pageSpaceKey,
        lastSyncedAt: now,
        ...(markdown ? { body: markdown } : {}),
        ...(syncError ? { syncError } : {}),
      }
      newRefs.push(ref)
    }

    // Write updated refs back into snapshot
    snap.teamsData[teamId] = {
      ...teamData,
      confluencePages: newRefs,
    }

    res.json({ ok: true, snapshot: JSON.stringify(snap), pageCount: newRefs.length })
  })
}
