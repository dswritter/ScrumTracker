import { type ReactNode, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTrackerStore } from '../store/useTrackerStore'
import {
  isUpperManagement,
  isDirector,
  getManagedTeams,
  getManagedManagers,
  getFullOrgScope,
} from '../lib/permissions'
import type { TrackerTeam, TrackerUserAccount } from '../types'
import { copyTextToClipboard } from '../lib/copyToClipboard'

export function OrgSettings() {
  const user = useCurrentUser()
  const teams = useTrackerStore((s) => s.teams)
  const users = useTrackerStore((s) => s.users)
  const setParentManager = useTrackerStore((s) => s.setParentManager)
  const setUserRole = useTrackerStore((s) => s.setUserRole)
  const addTeamByJoinCode = useTrackerStore((s) => s.addTeamByJoinCode)
  const createDirectIcAccount = useTrackerStore((s) => s.createDirectIcAccount)

  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [joinCodeMsg, setJoinCodeMsg] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [newIcUsername, setNewIcUsername] = useState('')
  const [newIcDisplay, setNewIcDisplay] = useState('')
  const [newIcMsg, setNewIcMsg] = useState<string | null>(null)
  const [newIcCredentials, setNewIcCredentials] = useState<{ displayName: string; generatedPassword: string } | null>(null)

  if (!user) return <Navigate to="/login" replace />
  if (!isUpperManagement(user)) return <Navigate to="/me" replace />

  const myTeams = getManagedTeams(user.id, teams)
  const myManagers = getManagedManagers(user.id, users)
  const myIcs = users.filter(
    (u) =>
      u.parentManagerId === user.id &&
      u.role !== 'manager' &&
      u.role !== 'director',
  )

  // Users available to add as direct IC or sub-manager: not yet in my scope.
  const myScopeTeamIds = getFullOrgScope(user.id, users, teams)
  const scopedUserIds = new Set(
    users
      .filter((u) => u.teamId && myScopeTeamIds.includes(u.teamId))
      .map((u) => u.id),
  )
  const availableUsers = users.filter(
    (u) =>
      u.id !== user.id &&
      !u.parentManagerId &&
      !scopedUserIds.has(u.id) &&
      u.displayName.toLowerCase().includes(userSearch.toLowerCase()),
  )

  function handleAddTeamByCode() {
    const r = addTeamByJoinCode(joinCodeInput, user!.id)
    if (r.ok) {
      setJoinCodeMsg(`✓ Team "${r.teamName}" linked successfully.`)
      setJoinCodeInput('')
    } else {
      setJoinCodeMsg(r.error)
    }
  }

  function unlinkTeam(teamId: string) {
    setParentManager('team', teamId, null)
  }

  function handleCreateIc() {
    const r = createDirectIcAccount(user!.id, { displayName: newIcDisplay, username: newIcUsername })
    if (r.ok) {
      setNewIcCredentials({ displayName: newIcDisplay.trim(), generatedPassword: r.generatedPassword })
      setNewIcMsg(null)
      setNewIcUsername('')
      setNewIcDisplay('')
    } else {
      setNewIcMsg(r.error)
      setNewIcCredentials(null)
    }
  }

  function linkUser(userId: string, role: 'manager' | 'member') {
    setParentManager('user', userId, user!.id)
    if (role === 'manager') {
      const target = users.find((u) => u.id === userId)
      if (target) setUserRole(target.teamId, userId, 'manager')
    }
  }

  function unlinkUser(userId: string) {
    setParentManager('user', userId, null)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 py-2">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Org Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage your organizational hierarchy — link teams, sub-managers, and direct reports.
        </p>
      </div>

      {/* My Managed Teams */}
      <Section title="Managed Teams" count={myTeams.length}>
        {myTeams.length > 0 && (
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {myTeams.map((t) => (
              <TeamRow key={t.id} team={t} onRemove={() => unlinkTeam(t.id)} />
            ))}
          </ul>
        )}
        <div className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Add team by join code
          </p>
          <p className="mb-2 text-xs text-zinc-400">
            Ask the team admin to share their 6-character join code (found in team Settings).
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. AB3X7K"
              value={joinCodeInput}
              onChange={(e) => { setJoinCodeInput(e.target.value.toUpperCase()); setJoinCodeMsg(null) }}
              maxLength={6}
              className="w-32 rounded-md border border-zinc-200 px-3 py-1.5 font-mono text-sm uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              onClick={handleAddTeamByCode}
              disabled={joinCodeInput.trim().length < 4}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              Link Team
            </button>
          </div>
          {joinCodeMsg && (
            <p className={`mt-1 text-xs ${joinCodeMsg.startsWith('✓') ? 'text-emerald-600' : 'text-rose-500'}`}>
              {joinCodeMsg}
            </p>
          )}
        </div>
      </Section>

      {/* Sub-managers */}
      <Section title="Sub-managers" count={myManagers.length}>
        {myManagers.length > 0 && (
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {myManagers.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                badge="manager"
                onRemove={() => unlinkUser(u.id)}
              />
            ))}
          </ul>
        )}
        <AddUserRow
          available={availableUsers.filter((u) =>
            u.role === 'manager' || u.role === 'director',
          )}
          search={userSearch}
          onSearch={setUserSearch}
          onAdd={(uid) => linkUser(uid, 'manager')}
          label="Add sub-manager"
          emptyLabel="No unlinked managers found"
        />
      </Section>

      {/* Direct ICs */}
      <Section title="Direct ICs" count={myIcs.length}>
        {myIcs.length > 0 && (
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {myIcs.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                badge={u.role}
                onRemove={() => unlinkUser(u.id)}
              />
            ))}
          </ul>
        )}
        {/* Link existing unlinked user */}
        <AddUserRow
          available={availableUsers.filter(
            (u) => u.role === 'admin' || u.role === 'member',
          )}
          search={userSearch}
          onSearch={setUserSearch}
          onAdd={(uid) => linkUser(uid, 'member')}
          label="Link existing user"
          emptyLabel="No unlinked users found"
        />
        {/* Create brand-new IC account */}
        <div className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Create new IC account
          </p>
          {newIcCredentials ? (
            <div className="space-y-2">
              <p className="text-sm text-emerald-700">
                Account created for <strong>{newIcCredentials.displayName}</strong>.
                Share the temporary password below — they must change it on first login.
              </p>
              <div className="flex items-center gap-2">
                <span className="rounded border border-zinc-200 bg-white px-3 py-1.5 font-mono text-sm">
                  {newIcCredentials.generatedPassword}
                </span>
                <button
                  onClick={() => copyTextToClipboard(newIcCredentials.generatedPassword)}
                  className="text-xs text-indigo-600 hover:text-indigo-800"
                >
                  Copy
                </button>
              </div>
              <button
                onClick={() => setNewIcCredentials(null)}
                className="text-xs text-zinc-500 hover:text-zinc-700"
              >
                Create another
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="LDAP / username"
                  value={newIcUsername}
                  onChange={(e) => setNewIcUsername(e.target.value)}
                  className="flex-1 rounded-md border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <input
                  type="text"
                  placeholder="Full name"
                  value={newIcDisplay}
                  onChange={(e) => setNewIcDisplay(e.target.value)}
                  className="flex-1 rounded-md border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              {newIcMsg && <p className="text-xs text-rose-500">{newIcMsg}</p>}
              <button
                onClick={handleCreateIc}
                disabled={!newIcUsername.trim() || !newIcDisplay.trim()}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                Create Account
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* Director-only: full manager tree */}
      {isDirector(user) && (
        <Section title="Full Scope (All Managers)">
          <DirectorManagerTree userId={user.id} users={users} teams={teams} />
        </Section>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: ReactNode
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-zinc-800">
        {title}
        {count !== undefined && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
            {count}
          </span>
        )}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function TeamRow({
  team,
  onRemove,
}: {
  team: TrackerTeam
  onRemove: () => void
}) {
  return (
    <li className="flex items-center justify-between px-4 py-3">
      <span className="text-sm font-medium text-zinc-800">{team.name}</span>
      <button
        onClick={onRemove}
        className="text-xs text-rose-500 hover:text-rose-700"
      >
        Remove
      </button>
    </li>
  )
}

function UserRow({
  user,
  badge,
  onRemove,
}: {
  user: TrackerUserAccount
  badge: string
  onRemove: () => void
}) {
  return (
    <li className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-zinc-800">
          {user.displayName}
        </span>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">
          {badge}
        </span>
      </div>
      <button
        onClick={onRemove}
        className="text-xs text-rose-500 hover:text-rose-700"
      >
        Remove
      </button>
    </li>
  )
}


function AddUserRow({
  available,
  search,
  onSearch,
  onAdd,
  label,
  emptyLabel,
}: {
  available: TrackerUserAccount[]
  search: string
  onSearch: (v: string) => void
  onAdd: (id: string) => void
  label: string
  emptyLabel: string
}) {
  return (
    <div className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3">
      <p className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">
        {label}
      </p>
      <input
        type="text"
        placeholder="Search users…"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        className="mb-2 w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
      />
      {available.length === 0 ? (
        <p className="text-xs text-zinc-400">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1 max-h-48 overflow-y-auto">
          {available.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-zinc-100"
            >
              <span className="text-sm text-zinc-700">{u.displayName}</span>
              <button
                onClick={() => onAdd(u.id)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DirectorManagerTree({
  userId,
  users,
  teams,
  depth = 0,
}: {
  userId: string
  users: TrackerUserAccount[]
  teams: TrackerTeam[]
  depth?: number
}) {
  const subManagers = getManagedManagers(userId, users)
  const directTeams = getManagedTeams(userId, teams)

  if (subManagers.length === 0 && directTeams.length === 0) {
    return <p className="text-sm text-zinc-400 italic">No sub-managers linked yet.</p>
  }

  return (
    <ul className={depth === 0 ? 'space-y-2' : 'ml-4 mt-1 space-y-1 border-l border-zinc-200 pl-3'}>
      {directTeams.map((t) => (
        <li key={t.id} className="flex items-center gap-2 text-sm text-zinc-600">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
          {t.name}
          <span className="text-xs text-zinc-400">(direct team)</span>
        </li>
      ))}
      {subManagers.map((mgr) => (
        <li key={mgr.id}>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600">
              {mgr.displayName[0]?.toUpperCase()}
            </span>
            <span className="text-sm font-medium text-zinc-800">
              {mgr.displayName}
            </span>
            <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-600">
              {mgr.role}
            </span>
          </div>
          <DirectorManagerTree
            userId={mgr.id}
            users={users}
            teams={teams}
            depth={depth + 1}
          />
        </li>
      ))}
    </ul>
  )
}
