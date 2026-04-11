import cors from 'cors'
import express from 'express'
import fs from 'fs'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { WebSocketServer, WebSocket as WsWebSocket } from 'ws'
import { registerJiraRoutes } from './jira.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const DATA_FILE = path.join(DATA_DIR, 'tracker-state.json')

const PORT = Number(process.env.PORT || 3847)
const HOST = process.env.HOST || '0.0.0.0'

function readStore() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8')
    const o = JSON.parse(raw)
    const rev = typeof o.rev === 'number' ? o.rev : 0
    const snapshot = typeof o.snapshot === 'string' ? o.snapshot : null
    return { rev, snapshot }
  } catch {
    return { rev: 0, snapshot: null }
  }
}

function writeStore(rev, snapshot) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ rev, snapshot }, null, 0),
    'utf8',
  )
}

/** @type {import('ws').WebSocketServer | null} */
let trackerWss = null

function broadcastTrackerRev(rev) {
  if (!trackerWss) return
  const msg = JSON.stringify({ type: 'tracker_rev', rev })
  for (const client of trackerWss.clients) {
    if (client.readyState === WsWebSocket.OPEN) client.send(msg)
  }
}

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '25mb' }))

app.get('/api/tracker', (req, res) => {
  const { rev, snapshot } = readStore()
  const etag = `"${rev}"`
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end()
    return
  }
  res.setHeader('ETag', etag)
  res.setHeader('Cache-Control', 'private, no-cache')
  res.json({ rev, snapshot })
})

app.put('/api/tracker', (req, res) => {
  const snapshot = req.body?.snapshot
  if (typeof snapshot !== 'string') {
    res.status(400).json({ error: 'Body must be JSON { snapshot: string }' })
    return
  }
  const rev = Date.now()
  writeStore(rev, snapshot)
  broadcastTrackerRev(rev)
  res.json({ ok: true, rev })
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

registerJiraRoutes(app, { dataDir: DATA_DIR })

const server = http.createServer(app)
trackerWss = new WebSocketServer({ server, path: '/ws/tracker' })

server.listen(PORT, HOST, () => {
  console.log(
    `Scrum tracker sync listening on http://${HOST === '0.0.0.0' ? '<this-pc-ip>' : HOST}:${PORT}`,
  )
  console.log(`  GET  /api/tracker  — fetch shared snapshot + revision (ETag / If-None-Match)`)
  console.log(`  PUT  /api/tracker  — push full snapshot (JSON string body.snapshot)`)
  console.log(`  WS   /ws/tracker — push { type: 'tracker_rev', rev } when snapshot changes`)
  console.log(`  JIRA: POST /api/jira/token, GET /api/jira/token-status, POST /api/jira/sync`)
})
