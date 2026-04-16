/**
 * On-disk split layout (per docs/splitJSON_concurrentUpdateConflict_ResolutionPlan.md).
 * API stays: GET/PUT use one composed snapshot string; only persistence is sharded.
 *
 * data/tracker-state.json → { rev, storage: "split-v1" } (no inline snapshot)
 * data/tracker-root.json      → { version, teams, users }
 * data/teams/<teamId>/work_items.json
 * data/teams/<teamId>/sprints.json
 * data/teams/<teamId>/notes.json → rest of TrackerTeamData (members, Jira, chat, KB, …)
 */
import fs from 'fs'
import path from 'path'

export const SPLIT_STORAGE_V1 = 'split-v1'

const TRACKER_STATE = 'tracker-state.json'
const TRACKER_ROOT = 'tracker-root.json'
const TEAMS_DIR = 'teams'

function atomicWriteJson(filePath, value, pretty = false) {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  const payload = JSON.stringify(value, null, pretty ? 2 : 0)
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, payload, 'utf8')
  fs.renameSync(tmp, filePath)
}

function readJsonFile(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function teamNotesSlice(teamData) {
  if (!teamData || typeof teamData !== 'object') return {}
  const {
    sprints: _s,
    workItems: _w,
    ...rest
  } = teamData
  return rest
}

/**
 * @param {string} dataDir
 * @returns {string | null}
 */
export function composeSnapshotFromSplit(dataDir) {
  const rootPath = path.join(dataDir, TRACKER_ROOT)
  const root = readJsonFile(rootPath, null)
  if (!root || typeof root !== 'object') return null

  const version = root.version
  const teams = Array.isArray(root.teams) ? root.teams : []
  const users = Array.isArray(root.users) ? root.users : []

  /** @type {Record<string, unknown>} */
  const teamsData = {}
  for (const team of teams) {
    const tid = team && typeof team.id === 'string' ? team.id : null
    if (!tid) continue
    const base = path.join(dataDir, TEAMS_DIR, tid)
    const workItems = readJsonFile(path.join(base, 'work_items.json'), [])
    const sprints = readJsonFile(path.join(base, 'sprints.json'), [])
    const notes = readJsonFile(path.join(base, 'notes.json'), {})
    teamsData[tid] = {
      sprints: Array.isArray(sprints) ? sprints : [],
      workItems: Array.isArray(workItems) ? workItems : [],
      ...(notes && typeof notes === 'object' ? notes : {}),
    }
  }

  return JSON.stringify({
    version,
    teams,
    teamsData,
    users,
  })
}

/**
 * @param {string} dataDir
 * @param {number} rev
 * @param {string} snapshotStr
 */
export function persistSplitSnapshot(dataDir, rev, snapshotStr) {
  let snap
  try {
    snap = JSON.parse(snapshotStr)
  } catch {
    throw new Error('Invalid snapshot JSON')
  }
  if (!snap || typeof snap !== 'object') throw new Error('Snapshot must be an object')

  const version = snap.version
  const teams = Array.isArray(snap.teams) ? snap.teams : []
  const users = Array.isArray(snap.users) ? snap.users : []
  const teamsData =
    snap.teamsData && typeof snap.teamsData === 'object' ? snap.teamsData : {}

  atomicWriteJson(path.join(dataDir, TRACKER_ROOT), { version, teams, users })

  const teamIds = new Set()
  for (const team of teams) {
    const tid = team && typeof team.id === 'string' ? team.id : null
    if (!tid) continue
    teamIds.add(tid)
    const td = teamsData[tid]
    const base = path.join(dataDir, TEAMS_DIR, tid)
    const sprints = td && Array.isArray(td.sprints) ? td.sprints : []
    const workItems = td && Array.isArray(td.workItems) ? td.workItems : []
    const notes = teamNotesSlice(td)
    atomicWriteJson(path.join(base, 'work_items.json'), workItems)
    atomicWriteJson(path.join(base, 'sprints.json'), sprints)
    atomicWriteJson(path.join(base, 'notes.json'), notes)
  }

  const teamsRoot = path.join(dataDir, TEAMS_DIR)
  if (fs.existsSync(teamsRoot)) {
    for (const name of fs.readdirSync(teamsRoot)) {
      const full = path.join(teamsRoot, name)
      if (!teamIds.has(name) && fs.statSync(full).isDirectory()) {
        fs.rmSync(full, { recursive: true, force: true })
      }
    }
  }

  atomicWriteJson(path.join(dataDir, TRACKER_STATE), {
    rev,
    storage: SPLIT_STORAGE_V1,
  })
}

/**
 * @param {string} dataDir
 * @returns {{ rev: number, snapshot: string | null }}
 */
export function readTrackerStore(dataDir) {
  const statePath = path.join(dataDir, TRACKER_STATE)
  const o = readJsonFile(statePath, {})
  const rev = typeof o.rev === 'number' ? o.rev : 0

  if (o.storage === SPLIT_STORAGE_V1) {
    const composed = composeSnapshotFromSplit(dataDir)
    return { rev, snapshot: composed }
  }

  const snapshot = typeof o.snapshot === 'string' ? o.snapshot : null
  return { rev, snapshot }
}

/**
 * @param {string} dataDir
 * @param {number} rev
 * @param {string} snapshotStr
 */
export function writeTrackerStore(dataDir, rev, snapshotStr) {
  persistSplitSnapshot(dataDir, rev, snapshotStr)
}
