import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  Sprint,
  TeamChatMessage,
  TrackerSnapshot,
  TrackerTeam,
  TrackerTeamData,
  TrackerUserAccount,
  WorkComment,
  WorkItem,
  WorkStatus,
} from '../types'
import { TRACKER_SCHEMA_VERSION } from '../types'
import {
  SEED_TEAM_ID,
  SEED_TEAM_META,
  SEED_TEAM_PAYLOAD,
  SEED_USERS,
} from '../data/seed'
import {
  defaultEndForStart,
  getCurrentSprint,
  suggestedNextSprintStart,
  daysInclusiveUntilEnd,
} from '../lib/sdates'
import { rollIncompleteItemsToNextSprint } from '../lib/sprintRoll'
import {
  DEMO_SEED_ADMIN_PASSWORD,
  generateMasterPassword8,
  isStrongEnoughPassword,
  seedPasswordFromKey,
} from '../lib/passwords'
import { generateId } from '../lib/ids'
import { normalizeLoginUsername } from '../lib/username'
import { mergeBundledSlackDefaults } from '../data/defaultSlackDmUrls'
import { parseSlackDmUrlInput } from '../lib/slackDm'

/** Must match `persist.name` (localStorage key for cross-tab sync). */
export const TRACKER_PERSIST_KEY = 'scrum-tracker-v2'

function newId(prefix: string): string {
  return `${prefix}-${generateId().slice(0, 8)}`
}

function normalizeWorkItem(raw: unknown): WorkItem {
  const o = raw as Record<string, unknown>
  const existing = Array.isArray(o.comments)
    ? (o.comments as WorkComment[])
    : []
  const notes = typeof o.notes === 'string' ? o.notes : ''
  const comments =
    existing.length > 0
      ? existing
      : notes.trim()
        ? [
            {
              id: newId('c'),
              authorName: 'System',
              body: notes.trim(),
              createdAt: new Date().toISOString(),
            },
          ]
        : []
  return {
    id: String(o.id ?? newId('wi')),
    section: String(o.section ?? ''),
    component: String(o.component ?? ''),
    title: String(o.title ?? ''),
    eta: String(o.eta ?? ''),
    assignees: Array.isArray(o.assignees)
      ? (o.assignees as string[]).map(String)
      : [],
    status: (o.status as WorkStatus) ?? 'todo',
    sprintIds: Array.isArray(o.sprintIds)
      ? (o.sprintIds as string[]).map(String)
      : [],
    jiraKeys: Array.isArray(o.jiraKeys)
      ? (o.jiraKeys as string[]).map(String)
      : [],
    comments,
  }
}

const WEAK_PASSWORDS = new Set(['admin', 'demo'])

/** Replace legacy demo passwords and enforce minimum length. */
function finalizePasswordPolicy(u: TrackerUserAccount): TrackerUserAccount {
  const pw = (u.password || '').trim()
  if (u.role === 'admin') {
    if (pw === 'ChakrA12!') {
      return { ...u, password: DEMO_SEED_ADMIN_PASSWORD, mustChangePassword: false }
    }
    if (pw.length >= 8 && !WEAK_PASSWORDS.has(pw.toLowerCase())) return u
    return { ...u, password: DEMO_SEED_ADMIN_PASSWORD, mustChangePassword: false }
  }
  if (pw.length >= 8 && !WEAK_PASSWORDS.has(pw.toLowerCase())) return u
  return {
    ...u,
    password: seedPasswordFromKey(`${u.username}:member`),
    mustChangePassword: true,
  }
}

function normalizeUser(
  raw: unknown,
  defaultTeamId: string,
): TrackerUserAccount {
  const o = raw as Record<string, unknown>
  const username = normalizeLoginUsername(String(o.username ?? ''))
  const role = o.role === 'admin' ? 'admin' : 'member'
  const display =
    String(o.displayName ?? username).trim() || username || 'User'
  const teamId = String(o.teamId ?? defaultTeamId)
  const hasPwd = typeof o.password === 'string' && o.password.length > 0
  const slackRaw =
    typeof o.slackChatUrl === 'string' ? o.slackChatUrl.trim() : ''
  const base: TrackerUserAccount = {
    id: String(o.id ?? newId('user')),
    teamId,
    username,
    displayName: display,
    role,
    password: hasPwd
      ? String(o.password)
      : role === 'admin'
        ? DEMO_SEED_ADMIN_PASSWORD
        : seedPasswordFromKey(`${username}:member`),
    mustChangePassword: Boolean(o.mustChangePassword),
    ...(slackRaw ? { slackChatUrl: slackRaw } : {}),
  }
  return finalizePasswordPolicy(base)
}

/**
 * Zustand persist only runs `migrate` when the stored version differs. Older saves
 * may have no `version` or the same version with stale passwords—so we always
 * re-run `normalizeUser` when merging storage into the live store.
 */
function mergePersistedTrackerState(
  persistedState: unknown,
  currentState: TrackerState,
): TrackerState {
  if (!persistedState || typeof persistedState !== 'object') {
    return currentState
  }
  const p = persistedState as Partial<
    Pick<TrackerState, 'teams' | 'teamsData' | 'users'>
  >
  const teams = p.teams ?? currentState.teams
  const teamsData = p.teamsData ?? currentState.teamsData
  const defaultTid = teams[0]?.id ?? SEED_TEAM_ID
  const rawUsers =
    Array.isArray(p.users) && p.users.length > 0
      ? p.users
      : currentState.users
  let users = rawUsers.map((u) => normalizeUser(u, defaultTid))
  users = ensureSeedColorGraphicsAdmin(users, teams)
  return {
    ...currentState,
    teams,
    teamsData,
    users,
  }
}

/** Old persisted data sometimes dropped the seeded admin; restore so login works. */
function ensureSeedColorGraphicsAdmin(
  users: TrackerUserAccount[],
  teams: TrackerTeam[],
): TrackerUserAccount[] {
  const seedTeamPresent = teams.some((t) => t.id === SEED_TEAM_ID)
  if (!seedTeamPresent) return users
  if (users.some((u) => u.username === 'chakraba')) return users
  const seedAdmin = SEED_USERS.find(
    (u) => u.username === 'chakraba' && u.role === 'admin',
  )
  if (!seedAdmin) return users
  return [normalizeUser(seedAdmin, SEED_TEAM_ID), ...users]
}

function normalizeTeamData(raw: unknown): TrackerTeamData {
  const o = raw as Record<string, unknown>
  return {
    sprints: Array.isArray(o.sprints) ? (o.sprints as Sprint[]) : [],
    workItems: Array.isArray(o.workItems)
      ? o.workItems.map((w) => normalizeWorkItem(w))
      : [],
    teamMembers: Array.isArray(o.teamMembers)
      ? (o.teamMembers as string[]).map(String)
      : [],
    jiraBaseUrl:
      typeof o.jiraBaseUrl === 'string'
        ? o.jiraBaseUrl
        : 'https://jira.corp.adobe.com/browse/',
    jiraSyncJql:
      typeof o.jiraSyncJql === 'string' ? o.jiraSyncJql : undefined,
    jiraSprintFieldId:
      typeof o.jiraSprintFieldId === 'string' ? o.jiraSprintFieldId : undefined,
    slackDmUrlByDisplayName:
      o.slackDmUrlByDisplayName !== null &&
      typeof o.slackDmUrlByDisplayName === 'object' &&
      !Array.isArray(o.slackDmUrlByDisplayName)
        ? Object.fromEntries(
            Object.entries(o.slackDmUrlByDisplayName as Record<string, unknown>)
              .filter(
                ([k, v]) =>
                  typeof k === 'string' &&
                  k.trim() &&
                  typeof v === 'string' &&
                  v.trim(),
              )
              .map(([k, v]) => [k.trim(), (v as string).trim()]),
          )
        : undefined,
    weeklyWikiPageUrl:
      typeof o.weeklyWikiPageUrl === 'string' && o.weeklyWikiPageUrl.trim()
        ? o.weeklyWikiPageUrl.trim()
        : undefined,
    teamChatThreads:
      o.teamChatThreads !== null &&
      typeof o.teamChatThreads === 'object' &&
      !Array.isArray(o.teamChatThreads)
        ? normalizeTeamChatThreads(o.teamChatThreads as Record<string, unknown>)
        : undefined,
  }
}

function normalizeTeamChatThreads(
  raw: Record<string, unknown>,
): Record<string, TeamChatMessage[]> {
  const out: Record<string, TeamChatMessage[]> = {}
  for (const [key, val] of Object.entries(raw)) {
    if (typeof key !== 'string' || !key.includes('|||')) continue
    if (!Array.isArray(val)) continue
    const list: TeamChatMessage[] = []
    for (const item of val) {
      if (!item || typeof item !== 'object') continue
      const m = item as Record<string, unknown>
      const body = typeof m.body === 'string' ? m.body : ''
      if (!body.trim()) continue
      list.push({
        id: typeof m.id === 'string' ? m.id : newId('chat'),
        authorName:
          typeof m.authorName === 'string' && m.authorName.trim()
            ? m.authorName.trim()
            : 'Unknown',
        body,
        createdAt:
          typeof m.createdAt === 'string' && m.createdAt
            ? m.createdAt
            : new Date().toISOString(),
      })
    }
    if (list.length) out[key] = list
  }
  return out
}

function isSnapshotV3(x: unknown): x is TrackerSnapshot {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    o.version === TRACKER_SCHEMA_VERSION &&
    Array.isArray(o.teams) &&
    o.teamsData !== null &&
    typeof o.teamsData === 'object' &&
    Array.isArray(o.users)
  )
}

function isSnapshotV2Flat(x: unknown): boolean {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    o.version === 2 &&
    Array.isArray(o.sprints) &&
    Array.isArray(o.workItems) &&
    o.teamsData === undefined
  )
}

function isSnapshotV1(x: unknown): boolean {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    o.version === 1 &&
    Array.isArray(o.sprints) &&
    Array.isArray(o.workItems) &&
    Array.isArray(o.teamMembers) &&
    typeof o.jiraBaseUrl === 'string'
  )
}

function getSlice(state: TrackerState, teamId: string): TrackerTeamData {
  return state.teamsData[teamId] ?? {
    sprints: [],
    workItems: [],
    teamMembers: [],
    jiraBaseUrl: 'https://jira.corp.adobe.com/browse/',
  }
}

function patchSlice(
  state: TrackerState,
  teamId: string,
  patch: Partial<TrackerTeamData>,
): Record<string, TrackerTeamData> {
  const prev = getSlice(state, teamId)
  return {
    ...state.teamsData,
    [teamId]: { ...prev, ...patch },
  }
}

export interface TrackerState {
  teams: TrackerTeam[]
  teamsData: Record<string, TrackerTeamData>
  users: TrackerUserAccount[]

  addWorkItem: (teamId: string, partial?: Partial<WorkItem>) => void
  updateWorkItem: (
    teamId: string,
    id: string,
    patch: Partial<WorkItem>,
  ) => void
  deleteWorkItem: (teamId: string, id: string) => void

  addComment: (
    teamId: string,
    itemId: string,
    authorName: string,
    body: string,
  ) => void

  deleteComment: (teamId: string, itemId: string, commentId: string) => void

  ensureAutoSprints: (teamId: string) => void
  rollIncompleteWorkItems: (teamId: string) => void

  setJiraBaseUrl: (teamId: string, url: string) => void
  setJiraSyncJql: (teamId: string, jql: string) => void
  setJiraSprintFieldId: (teamId: string, fieldId: string) => void
  setSlackDmUrl: (teamId: string, displayName: string, url: string) => void
  removeSlackDmUrl: (teamId: string, displayName: string) => void
  applyBundledSlackDmUrls: (teamId: string) => void
  setUserSlackChatUrl: (
    teamId: string,
    userId: string,
    url: string,
  ) => { ok: true } | { ok: false; error: string }
  setWeeklyWikiPageUrl: (teamId: string, url: string) => void
  setTeamName: (teamId: string, name: string) => void

  addTeamMemberAccount: (
    teamId: string,
    input: {
      username: string
      displayName: string
      role: TrackerUserAccount['role']
      slackChatUrl?: string
    },
  ) => { ok: true; generatedPassword: string } | { ok: false; error: string }

  removeUser: (teamId: string, id: string) => void
  setUserRole: (
    teamId: string,
    id: string,
    role: TrackerUserAccount['role'],
  ) => void

  adminSetUserPassword: (
    teamId: string,
    userId: string,
    newPassword: string,
    mustChangePassword: boolean,
  ) => { ok: true } | { ok: false; error: string }

  completeFirstLoginPasswordChange: (
    userId: string,
    masterPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) => { ok: true } | { ok: false; error: string }

  /** Voluntary change: must match current login password. */
  changeOwnPassword: (
    userId: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) => { ok: true } | { ok: false; error: string }

  /** Forgot password / admin reset: verify stored password (master) then set new. */
  resetPasswordWithMaster: (
    userId: string,
    masterPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) => { ok: true } | { ok: false; error: string }

  registerTeamWithAdmin: (input: {
    teamName: string
    adminDisplayName: string
    adminUsername: string
    adminPassword: string
  }) => { ok: true } | { ok: false; error: string }

  importSnapshotJson: (json: string) => { ok: true } | { ok: false; error: string }
  exportSnapshotJson: () => string
  resetToSeed: () => void

  appendTeamChatMessage: (
    teamId: string,
    authorDisplayName: string,
    peerDisplayName: string,
    body: string,
  ) => void
}

const defaultWorkItem = (): WorkItem => ({
  id: newId('wi'),
  section: '',
  component: '',
  title: '',
  eta: '',
  assignees: [],
  status: 'todo',
  sprintIds: [],
  jiraKeys: [],
  comments: [],
})

const initialTeams: TrackerTeam[] = [SEED_TEAM_META]
const initialTeamsData: Record<string, TrackerTeamData> = {
  [SEED_TEAM_ID]: { ...SEED_TEAM_PAYLOAD },
}
const initialUsers: TrackerUserAccount[] = [...SEED_USERS]

export const useTrackerStore = create<TrackerState>()(
  persist(
    (set, get) => ({
      teams: initialTeams,
      teamsData: initialTeamsData,
      users: initialUsers,

      addWorkItem: (teamId, partial) =>
        set((s) => {
          const d = getSlice(s, teamId)
          return {
            teamsData: patchSlice(s, teamId, {
              workItems: [{ ...defaultWorkItem(), ...partial }, ...d.workItems],
            }),
          }
        }),

      updateWorkItem: (teamId, id, patch) =>
        set((s) => {
          const d = getSlice(s, teamId)
          return {
            teamsData: patchSlice(s, teamId, {
              workItems: d.workItems.map((w) =>
                w.id === id ? { ...w, ...patch } : w,
              ),
            }),
          }
        }),

      deleteWorkItem: (teamId, id) =>
        set((s) => {
          const d = getSlice(s, teamId)
          return {
            teamsData: patchSlice(s, teamId, {
              workItems: d.workItems.filter((w) => w.id !== id),
            }),
          }
        }),

      addComment: (teamId, itemId, authorName, body) => {
        const t = body.trim()
        if (!t) return
        const entry: WorkComment = {
          id: newId('comment'),
          authorName: authorName.trim() || 'Unknown',
          body: t,
          createdAt: new Date().toISOString(),
        }
        set((s) => {
          const d = getSlice(s, teamId)
          return {
            teamsData: patchSlice(s, teamId, {
              workItems: d.workItems.map((w) =>
                w.id === itemId
                  ? { ...w, comments: [...w.comments, entry] }
                  : w,
              ),
            }),
          }
        })
      },

      appendTeamChatMessage: (teamId, authorDisplayName, peerDisplayName, body) => {
        const t = body.trim()
        if (!t) return
        const a = authorDisplayName.trim()
        const p = peerDisplayName.trim()
        if (!p || a === p) return
        const [x, y] = [a, p].sort((m, n) => m.localeCompare(n))
        const key = `${x}|||${y}`
        const msg: TeamChatMessage = {
          id: newId('chat'),
          authorName: a,
          body: t,
          createdAt: new Date().toISOString(),
        }
        set((s) => {
          const d = getSlice(s, teamId)
          const threads = { ...(d.teamChatThreads ?? {}) }
          const prev = threads[key] ?? []
          threads[key] = [...prev, msg]
          return {
            teamsData: patchSlice(s, teamId, { teamChatThreads: threads }),
          }
        })
      },

      deleteComment: (teamId, itemId, commentId) =>
        set((s) => {
          const d = getSlice(s, teamId)
          return {
            teamsData: patchSlice(s, teamId, {
              workItems: d.workItems.map((w) =>
                w.id === itemId
                  ? {
                      ...w,
                      comments: w.comments.filter((c) => c.id !== commentId),
                    }
                  : w,
              ),
            }),
          }
        }),

      ensureAutoSprints: (teamId) =>
        set((state) => {
          const d = getSlice(state, teamId)
          const sprints = [...d.sprints]
          if (sprints.length === 0) return state
          const sorted = [...sprints].sort(
            (a, b) =>
              a.start.localeCompare(b.start) || a.id.localeCompare(b.id),
          )
          const current = getCurrentSprint(sorted)
          if (!current) return state
          const daysLeft = daysInclusiveUntilEnd(current.end)
          if (daysLeft > 10) return state
          const nextStart = suggestedNextSprintStart(current)
          const hasNext = sorted.some((sp) => sp.start >= nextStart)
          if (hasNext) return state
          const sprint: Sprint = {
            id: newId('sprint'),
            name: `Sprint ${sprints.length}`,
            start: nextStart,
            end: defaultEndForStart(nextStart),
          }
          return {
            teamsData: patchSlice(state, teamId, {
              sprints: [...sprints, sprint],
            }),
          }
        }),

      rollIncompleteWorkItems: (teamId) =>
        set((state) => {
          const d = getSlice(state, teamId)
          const next = rollIncompleteItemsToNextSprint(d.sprints, d.workItems)
          return {
            teamsData: patchSlice(state, teamId, { workItems: next }),
          }
        }),

      setJiraBaseUrl: (teamId, url) =>
        set((s) => ({
          teamsData: patchSlice(s, teamId, { jiraBaseUrl: url }),
        })),

      setJiraSyncJql: (teamId, jql) =>
        set((s) => ({
          teamsData: patchSlice(s, teamId, { jiraSyncJql: jql.trim() }),
        })),

      setJiraSprintFieldId: (teamId, fieldId) =>
        set((s) => ({
          teamsData: patchSlice(s, teamId, {
            jiraSprintFieldId: fieldId.trim() || undefined,
          }),
        })),

      setSlackDmUrl: (teamId, displayName, url) =>
        set((s) => {
          const d = getSlice(s, teamId)
          const key = displayName.trim()
          const t = url.trim()
          if (!key) return s
          const next = { ...(d.slackDmUrlByDisplayName ?? {}) }
          if (!t) {
            delete next[key]
          } else {
            next[key] = t
          }
          return {
            teamsData: patchSlice(s, teamId, {
              slackDmUrlByDisplayName:
                Object.keys(next).length > 0 ? next : undefined,
            }),
          }
        }),

      removeSlackDmUrl: (teamId, displayName) =>
        set((s) => {
          const d = getSlice(s, teamId)
          const key = displayName.trim()
          const prev = d.slackDmUrlByDisplayName ?? {}
          if (!key || !prev[key]) return s
          const next = { ...prev }
          delete next[key]
          return {
            teamsData: patchSlice(s, teamId, {
              slackDmUrlByDisplayName:
                Object.keys(next).length > 0 ? next : undefined,
            }),
          }
        }),

      applyBundledSlackDmUrls: (teamId) =>
        set((s) => {
          const d = getSlice(s, teamId)
          const merged = mergeBundledSlackDefaults(d.slackDmUrlByDisplayName)
          const users = s.users.map((u) => {
            if (u.teamId !== teamId) return u
            if (u.slackChatUrl?.trim()) return u
            const url = merged[u.displayName.trim()]
            if (!url?.trim()) return u
            return { ...u, slackChatUrl: url.trim() }
          })
          return {
            users,
            teamsData: patchSlice(s, teamId, {
              slackDmUrlByDisplayName: merged,
            }),
          }
        }),

      setUserSlackChatUrl: (teamId, userId, url) => {
        const t = url.trim()
        if (!t) {
          set((s) => ({
            users: s.users.map((u) =>
              u.id === userId && u.teamId === teamId
                ? { ...u, slackChatUrl: undefined }
                : u,
            ),
          }))
          return { ok: true }
        }
        const okUrl = parseSlackDmUrlInput(t)
        if (!okUrl) {
          return {
            ok: false,
            error: 'Invalid Slack URL (https://…/archives/D… on allowed host).',
          }
        }
        set((s) => ({
          users: s.users.map((u) =>
            u.id === userId && u.teamId === teamId
              ? { ...u, slackChatUrl: okUrl }
              : u,
          ),
        }))
        return { ok: true }
      },

      setWeeklyWikiPageUrl: (teamId, url) =>
        set((s) => ({
          teamsData: patchSlice(s, teamId, {
            weeklyWikiPageUrl: url.trim() || undefined,
          }),
        })),

      setTeamName: (teamId, name) =>
        set((s) => ({
          teams: s.teams.map((t) =>
            t.id === teamId ? { ...t, name: name.trim() || t.name } : t,
          ),
        })),

      addTeamMemberAccount: (teamId, input) => {
        const username = normalizeLoginUsername(input.username)
        const displayName = input.displayName.trim()
        if (!username || !displayName) {
          return { ok: false, error: 'Username and display name are required.' }
        }
        let slackChatUrl: string | undefined
        if (input.slackChatUrl?.trim()) {
          const p = parseSlackDmUrlInput(input.slackChatUrl)
          if (!p) {
            return { ok: false, error: 'Invalid Slack URL.' }
          }
          slackChatUrl = p
        }
        const s = get()
        if (s.users.some((x) => x.username === username)) {
          return { ok: false, error: 'Username already exists.' }
        }
        const generatedPassword = generateMasterPassword8()
        const acc: TrackerUserAccount = {
          id: newId('user'),
          teamId,
          username,
          displayName,
          role: input.role,
          password: generatedPassword,
          mustChangePassword: true,
          ...(slackChatUrl ? { slackChatUrl } : {}),
        }
        const d = getSlice(s, teamId)
        const teamMembers = d.teamMembers.includes(displayName)
          ? d.teamMembers
          : [...d.teamMembers, displayName].sort((a, b) => a.localeCompare(b))
        set({
          users: [...s.users, acc],
          teamsData: patchSlice(s, teamId, { teamMembers }),
        })
        return { ok: true, generatedPassword }
      },

      removeUser: (teamId, id) =>
        set((s) => {
          const target = s.users.find((u) => u.id === id)
          if (!target || target.teamId !== teamId) return s
          const admins = s.users.filter(
            (u) => u.teamId === teamId && u.role === 'admin',
          )
          if (target.role === 'admin' && admins.length <= 1) return s
          const d = getSlice(s, teamId)
          return {
            users: s.users.filter((u) => u.id !== id),
            teamsData: patchSlice(s, teamId, {
              teamMembers: d.teamMembers.filter((m) => m !== target.displayName),
            }),
          }
        }),

      setUserRole: (teamId, id, role) =>
        set((s) => {
          const admins = s.users.filter(
            (u) => u.teamId === teamId && u.role === 'admin',
          )
          const target = s.users.find(
            (u) => u.id === id && u.teamId === teamId,
          )
          if (!target) return s
          if (target.role === 'admin' && role === 'member' && admins.length <= 1)
            return s
          return {
            users: s.users.map((u) =>
              u.id === id && u.teamId === teamId ? { ...u, role } : u,
            ),
          }
        }),

      adminSetUserPassword: (teamId, userId, newPassword, mustChangePassword) => {
        if (!isStrongEnoughPassword(newPassword)) {
          return {
            ok: false,
            error: 'Password must be at least 8 characters.',
          }
        }
        const s = get()
        const u = s.users.find((x) => x.id === userId && x.teamId === teamId)
        if (!u) return { ok: false, error: 'User not found.' }
        set({
          users: s.users.map((x) =>
            x.id === userId
              ? { ...x, password: newPassword, mustChangePassword }
              : x,
          ),
        })
        return { ok: true }
      },

      completeFirstLoginPasswordChange: (
        userId,
        masterPassword,
        newPassword,
        confirmPassword,
      ) => {
        if (newPassword !== confirmPassword) {
          return { ok: false, error: 'New password and confirmation do not match.' }
        }
        if (!isStrongEnoughPassword(newPassword)) {
          return {
            ok: false,
            error: 'New password must be at least 8 characters.',
          }
        }
        const s = get()
        const u = s.users.find((x) => x.id === userId)
        if (!u || !u.mustChangePassword) {
          return { ok: false, error: 'Password change not required.' }
        }
        if (u.password !== masterPassword) {
          return { ok: false, error: 'Master password is incorrect.' }
        }
        set({
          users: s.users.map((x) =>
            x.id === userId
              ? { ...x, password: newPassword, mustChangePassword: false }
              : x,
          ),
        })
        return { ok: true }
      },

      changeOwnPassword: (
        userId,
        currentPassword,
        newPassword,
        confirmPassword,
      ) => {
        if (newPassword !== confirmPassword) {
          return { ok: false, error: 'New password and confirmation do not match.' }
        }
        if (!isStrongEnoughPassword(newPassword)) {
          return {
            ok: false,
            error: 'New password must be at least 8 characters.',
          }
        }
        const s = get()
        const u = s.users.find((x) => x.id === userId)
        if (!u) return { ok: false, error: 'User not found.' }
        if (u.password !== currentPassword) {
          return { ok: false, error: 'Current password is incorrect.' }
        }
        set({
          users: s.users.map((x) =>
            x.id === userId
              ? { ...x, password: newPassword, mustChangePassword: false }
              : x,
          ),
        })
        return { ok: true }
      },

      resetPasswordWithMaster: (
        userId,
        masterPassword,
        newPassword,
        confirmPassword,
      ) => {
        if (newPassword !== confirmPassword) {
          return { ok: false, error: 'New password and confirmation do not match.' }
        }
        if (!isStrongEnoughPassword(newPassword)) {
          return {
            ok: false,
            error: 'New password must be at least 8 characters.',
          }
        }
        const s = get()
        const u = s.users.find((x) => x.id === userId)
        if (!u) return { ok: false, error: 'User not found.' }
        if (u.password !== masterPassword) {
          return { ok: false, error: 'Master password is incorrect.' }
        }
        set({
          users: s.users.map((x) =>
            x.id === userId
              ? { ...x, password: newPassword, mustChangePassword: false }
              : x,
          ),
        })
        return { ok: true }
      },

      registerTeamWithAdmin: (input) => {
        const teamName = input.teamName.trim()
        const adminDisplayName = input.adminDisplayName.trim()
        const un = normalizeLoginUsername(input.adminUsername)
        if (!teamName || !adminDisplayName || !un) {
          return { ok: false, error: 'All fields are required.' }
        }
        if (!isStrongEnoughPassword(input.adminPassword)) {
          return {
            ok: false,
            error: 'Password must be at least 8 characters.',
          }
        }
        const s = get()
        if (s.users.some((x) => x.username === un)) {
          return { ok: false, error: 'Username already exists.' }
        }
        const teamId = newId('team')
        const admin: TrackerUserAccount = {
          id: newId('user'),
          teamId,
          username: un,
          displayName: adminDisplayName,
          role: 'admin',
          password: input.adminPassword,
          mustChangePassword: false,
        }
        const team: TrackerTeam = { id: teamId, name: teamName }
        const empty: TrackerTeamData = {
          sprints: [],
          workItems: [],
          teamMembers: [adminDisplayName],
          jiraBaseUrl: 'https://jira.corp.adobe.com/browse/',
        }
        set({
          teams: [...s.teams, team],
          teamsData: { ...s.teamsData, [teamId]: empty },
          users: [...s.users, admin],
        })
        return { ok: true }
      },

      importSnapshotJson: (json) => {
        try {
          const data = JSON.parse(json) as unknown
          if (isSnapshotV3(data)) {
            const teamsData: Record<string, TrackerTeamData> = {}
            for (const [k, v] of Object.entries(data.teamsData)) {
              teamsData[k] = normalizeTeamData(v)
            }
            const defaultTid = data.teams[0]?.id ?? SEED_TEAM_ID
            set({
              teams: data.teams as TrackerTeam[],
              teamsData,
              users: data.users.map((u) => normalizeUser(u, defaultTid)),
            })
            return { ok: true as const }
          }
          if (isSnapshotV2Flat(data)) {
            const o = data as {
              sprints: Sprint[]
              workItems: unknown[]
              teamMembers: string[]
              jiraBaseUrl: string
              users: unknown[]
            }
            const tid = `team-import-${newId('m')}`
            set({
              teams: [{ id: tid, name: 'Imported team' }],
              teamsData: {
                [tid]: {
                  sprints: o.sprints,
                  workItems: o.workItems.map((w) => normalizeWorkItem(w)),
                  teamMembers: o.teamMembers,
                  jiraBaseUrl: o.jiraBaseUrl,
                },
              },
              users: Array.isArray(o.users)
                ? o.users.map((u) => normalizeUser(u, tid))
                : [],
            })
            return { ok: true as const }
          }
          if (isSnapshotV1(data)) {
            const o = data as {
              sprints: Sprint[]
              workItems: unknown[]
              teamMembers: string[]
              jiraBaseUrl: string
            }
            const tid = `team-import-${newId('m')}`
            set({
              teams: [{ id: tid, name: 'Imported team' }],
              teamsData: {
                [tid]: {
                  sprints: o.sprints,
                  workItems: o.workItems.map((w) => normalizeWorkItem(w)),
                  teamMembers: o.teamMembers,
                  jiraBaseUrl: o.jiraBaseUrl,
                },
              },
              users: [],
            })
            return { ok: true as const }
          }
          return {
            ok: false as const,
            error:
              'Invalid file: expected schema v3 (or legacy v2 / v1) export.',
          }
        } catch {
          return { ok: false as const, error: 'Could not parse JSON.' }
        }
      },

      exportSnapshotJson: () => {
        const s = get()
        const snap: TrackerSnapshot = {
          version: TRACKER_SCHEMA_VERSION,
          teams: s.teams,
          teamsData: s.teamsData,
          users: s.users,
        }
        return JSON.stringify(snap, null, 2)
      },

      resetToSeed: () =>
        set({
          teams: initialTeams,
          teamsData: {
            [SEED_TEAM_ID]: { ...SEED_TEAM_PAYLOAD },
          },
          users: [...SEED_USERS],
        }),
    }),
    {
      name: TRACKER_PERSIST_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        teams: s.teams,
        teamsData: s.teamsData,
        users: s.users,
      }),
      merge: mergePersistedTrackerState,
      migrate: (persisted) => {
        const p = persisted as Record<string, unknown> | undefined
        if (!p) return persisted

        if (p.teamsData && typeof p.teamsData === 'object' && p.teams) {
          const teamsData: Record<string, TrackerTeamData> = {}
          for (const [k, v] of Object.entries(
            p.teamsData as Record<string, unknown>,
          )) {
            teamsData[k] = normalizeTeamData(v)
          }
          const teams = (p.teams as TrackerTeam[]) ?? []
          const defaultTid = teams[0]?.id ?? SEED_TEAM_ID
          const usersRaw = p.users
          const users = Array.isArray(usersRaw)
            ? usersRaw.map((u) => normalizeUser(u, defaultTid))
            : [...SEED_USERS]
          return { ...p, teams, teamsData, users }
        }

        const workItems = Array.isArray(p.workItems)
          ? p.workItems.map((w) => normalizeWorkItem(w))
          : []
        const tid = SEED_TEAM_ID
        const teams: TrackerTeam[] = [
          { id: tid, name: 'Color & Graphics' },
        ]
        const teamsData: Record<string, TrackerTeamData> = {
          [tid]: {
            sprints: Array.isArray(p.sprints) ? (p.sprints as Sprint[]) : [],
            workItems,
            teamMembers: Array.isArray(p.teamMembers)
              ? (p.teamMembers as string[])
              : [],
            jiraBaseUrl:
              typeof p.jiraBaseUrl === 'string'
                ? p.jiraBaseUrl
                : 'https://jira.corp.adobe.com/browse/',
            teamChatThreads: {},
          },
        }
        let users: TrackerUserAccount[] = SEED_USERS
        if (Array.isArray(p.users) && p.users.length) {
          users = (p.users as unknown[]).map((u) => normalizeUser(u, tid))
        }
        return {
          teams,
          teamsData,
          users,
        }
      },
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === TRACKER_PERSIST_KEY) {
      void useTrackerStore.persist.rehydrate()
    }
  })
}

export const STATUS_OPTIONS: { value: WorkStatus; label: string }[] = [
  { value: 'done', label: 'Done' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'to_test', label: 'To test' },
  { value: 'to_track', label: 'To track' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'todo', label: 'Todo' },
]
