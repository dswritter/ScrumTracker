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

export function OrgSettings() {
  const user = useCurrentUser()
  const teams = useTrackerStore((s) => s.teams)
  const users = useTrackerStore((s) => s.users)
  const setParentManager = useTrackerStore((s) => s.setParentManager)
  const setUserRole = useTrackerStore((s) => s.setUserRole)

  const [teamSearch, setTeamSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')

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

  // Teams available to add: not yet under this manager AND not under any other manager
  // (or already under this manager — prevents duplicates).
  const availableTeams = teams.filter(
    (t) =>
      !t.parentManagerId &&
      t.id !== '' &&
      t.name.toLowerCase().includes(teamSearch.toLowerCase()),
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

  function linkTeam(teamId: string) {
    setParentManager('team', teamId, user!.id)
  }

  function unlinkTeam(teamId: string) {
    setParentManager('team', teamId, null)
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
        <AddTeamRow
          available={availableTeams}
          search={teamSearch}
          onSearch={setTeamSearch}
          onAdd={linkTeam}
        />
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
        <AddUserRow
          available={availableUsers.filter(
            (u) => u.role === 'admin' || u.role === 'member',
          )}
          search={userSearch}
          onSearch={setUserSearch}
          onAdd={(uid) => linkUser(uid, 'member')}
          label="Add direct IC"
          emptyLabel="No unlinked users found"
        />
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

function AddTeamRow({
  available,
  search,
  onSearch,
  onAdd,
}: {
  available: TrackerTeam[]
  search: string
  onSearch: (v: string) => void
  onAdd: (id: string) => void
}) {
  return (
    <div className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3">
      <p className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">
        Add a team
      </p>
      <input
        type="text"
        placeholder="Search teams…"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        className="mb-2 w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
      />
      {available.length === 0 ? (
        <p className="text-xs text-zinc-400">
          {search ? 'No teams match' : 'All teams are already linked to a manager'}
        </p>
      ) : (
        <ul className="space-y-1 max-h-48 overflow-y-auto">
          {available.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-zinc-100"
            >
              <span className="text-sm text-zinc-700">{t.name}</span>
              <button
                onClick={() => onAdd(t.id)}
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
