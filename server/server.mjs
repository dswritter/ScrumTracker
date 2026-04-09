import cors from 'cors'
import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '25mb' }))

app.get('/api/tracker', (_req, res) => {
  const { rev, snapshot } = readStore()
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
  res.json({ ok: true, rev })
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.listen(PORT, HOST, () => {
  console.log(
    `Scrum tracker sync listening on http://${HOST === '0.0.0.0' ? '<this-pc-ip>' : HOST}:${PORT}`,
  )
  console.log(`  GET  /api/tracker  — fetch shared snapshot + revision`)
  console.log(`  PUT  /api/tracker  — push full snapshot (JSON string body.snapshot)`)
})
