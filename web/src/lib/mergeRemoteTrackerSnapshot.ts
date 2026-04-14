import type {
  TeamChatMessage,
  TrackerTeam,
  TrackerTeamData,
  WorkComment,
  WorkItem,
} from '../types'

function mergeWorkComments(
  remote: WorkComment[],
  local: WorkComment[],
): WorkComment[] {
  const byId = new Map<string, WorkComment>()
  for (const c of remote) byId.set(c.id, c)
  for (const c of local) {
    if (!byId.has(c.id)) byId.set(c.id, c)
  }
  return [...byId.values()].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )
}

function mergeWorkItems(remoteList: WorkItem[], localList: WorkItem[]): WorkItem[] {
  const remoteById = new Map(remoteList.map((w) => [w.id, w] as const))
  const localById = new Map(localList.map((w) => [w.id, w] as const))
  const merged = new Map<string, WorkItem>()

  for (const [id, rw] of remoteById) {
    const lw = localById.get(id)
    merged.set(
      id,
      lw
        ? { ...rw, comments: mergeWorkComments(rw.comments, lw.comments) }
        : rw,
    )
  }
  for (const [id, lw] of localById) {
    if (!merged.has(id)) merged.set(id, lw)
  }

  const localOnlyIds = localList
    .map((w) => w.id)
    .filter((id) => !remoteById.has(id))
  return [
    ...remoteList.map((w) => merged.get(w.id)!),
    ...localOnlyIds.map((id) => merged.get(id)!),
  ]
}

function mergeTeamChatThreads(
  remote: Record<string, TeamChatMessage[]> | undefined,
  local: Record<string, TeamChatMessage[]> | undefined,
): Record<string, TeamChatMessage[]> | undefined {
  if (!remote && !local) return undefined
  const r = remote ?? {}
  const l = local ?? {}
  const keys = new Set([...Object.keys(r), ...Object.keys(l)])
  const out: Record<string, TeamChatMessage[]> = {}
  for (const key of keys) {
    const rm = r[key] ?? []
    const lm = l[key] ?? []
    const byId = new Map<string, TeamChatMessage>()
    for (const m of rm) byId.set(m.id, m)
    for (const m of lm) {
      if (!byId.has(m.id)) byId.set(m.id, m)
    }
    const list = [...byId.values()].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )
    if (list.length) out[key] = list
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * Apply a remote team slice on top of local: sprint/Jira/settings come from remote;
 * work-item comments and team chat messages are union-merged so offline-only entries
 * survive GET /api/tracker.
 */
export function mergeTeamDataWithRemote(
  local: TrackerTeamData,
  remote: TrackerTeamData,
): TrackerTeamData {
  return {
    ...remote,
    workItems: mergeWorkItems(remote.workItems, local.workItems),
    teamChatThreads: mergeTeamChatThreads(
      remote.teamChatThreads,
      local.teamChatThreads,
    ),
  }
}

export function mergeRemoteSnapshotTeamsAndData(args: {
  localTeams: TrackerTeam[]
  localTeamsData: Record<string, TrackerTeamData>
  remoteTeams: TrackerTeam[]
  remoteTeamsData: Record<string, TrackerTeamData>
}): { teams: TrackerTeam[]; teamsData: Record<string, TrackerTeamData> } {
  const { localTeams, localTeamsData, remoteTeams, remoteTeamsData } = args
  const remoteIds = new Set(remoteTeams.map((t) => t.id))
  const extraLocal = localTeams.filter((t) => !remoteIds.has(t.id))
  const teams = [...remoteTeams, ...extraLocal]

  const teamsData: Record<string, TrackerTeamData> = {}
  for (const t of teams) {
    const tid = t.id
    const remoteSlice = remoteTeamsData[tid]
    const localSlice = localTeamsData[tid]
    if (remoteSlice && localSlice) {
      teamsData[tid] = mergeTeamDataWithRemote(localSlice, remoteSlice)
    } else if (remoteSlice) {
      teamsData[tid] = remoteSlice
    } else if (localSlice) {
      teamsData[tid] = localSlice
    }
  }
  return { teams, teamsData }
}
