import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTrackerStore } from '../store/useTrackerStore'
import { useAuthStore } from '../store/useAuthStore'
import {
  isUpperManagement,
  isDirector,
  getFullOrgScope,
  getManagedTeams,
  getManagedManagers,
} from '../lib/permissions'
import { TeamOverviewCard } from '../components/TeamOverviewCard'

type TabKey = 'flat' | 'byManager'

export function OverviewDashboard() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const setViewingTeamId = useAuthStore((s) => s.setViewingTeamId)
  const teams = useTrackerStore((s) => s.teams)
  const users = useTrackerStore((s) => s.users)
  const [tab, setTab] = useState<TabKey>('flat')

  if (!user) return <Navigate to="/login" replace />
  if (!isUpperManagement(user)) return <Navigate to="/" replace />

  const scopedTeamIds = getFullOrgScope(user.id, users, teams)

  function handleEnterTeam(teamId: string) {
    setViewingTeamId(teamId)
    navigate('/')
  }

  // For director view: build groups of teams by their direct manager.
  const directorGrouped = (() => {
    if (!isDirector(user)) return null
    const subManagers = getManagedManagers(user.id, users)
    const directTeamIds = getManagedTeams(user.id, teams).map((t) => t.id)

    // Build manager groups with all their scoped team ids.
    const groups = subManagers.map((mgr) => {
      const mgrTeamIds = getFullOrgScope(mgr.id, users, teams).filter((tid) =>
        scopedTeamIds.includes(tid),
      )
      return { manager: mgr, teamIds: mgrTeamIds }
    })

    // Teams not under any sub-manager (directly under director).
    const assignedIds = new Set(groups.flatMap((g) => g.teamIds))
    const unassignedIds = scopedTeamIds.filter((tid) => !assignedIds.has(tid) && !directTeamIds.includes(tid))
    const directIds = directTeamIds.filter((tid) => scopedTeamIds.includes(tid))

    return { groups, directIds: [...directIds, ...unassignedIds] }
  })()

  const canToggleTabs = isDirector(user)

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Overview</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {scopedTeamIds.length} team{scopedTeamIds.length !== 1 ? 's' : ''} in your scope
        </p>
      </div>

      {/* Tab toggle (director only) */}
      {canToggleTabs && (
        <div className="mb-6 flex gap-1 rounded-lg border border-zinc-200 bg-white p-1 w-fit">
          {([['flat', 'All Teams'], ['byManager', 'By Manager']] as [TabKey, string][]).map(
            ([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={[
                  'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                  tab === key
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-500 hover:text-zinc-900',
                ].join(' ')}
              >
                {label}
              </button>
            ),
          )}
        </div>
      )}

      {/* Flat grid (managers + director in flat tab) */}
      {(tab === 'flat' || !canToggleTabs) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {scopedTeamIds.length === 0 ? (
            <EmptyState />
          ) : (
            scopedTeamIds.map((tid) => {
              // For directors: show which manager this team belongs to.
              const mgr = isDirector(user)
                ? users.find(
                    (u) =>
                      isUpperManagement(u) &&
                      getFullOrgScope(u.id, users, teams).includes(tid) &&
                      u.id !== user.id,
                  )
                : undefined
              return (
                <TeamOverviewCard
                  key={tid}
                  teamId={tid}
                  managerName={mgr?.displayName}
                  onEnter={handleEnterTeam}
                />
              )
            })
          )}
        </div>
      )}

      {/* Grouped by manager (director only) */}
      {tab === 'byManager' && directorGrouped && (
        <div className="space-y-8">
          {/* Direct reports (no sub-manager) */}
          {directorGrouped.directIds.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Direct
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {directorGrouped.directIds.map((tid) => (
                  <TeamOverviewCard
                    key={tid}
                    teamId={tid}
                    onEnter={handleEnterTeam}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Manager groups */}
          {directorGrouped.groups.map(({ manager, teamIds }) =>
            teamIds.length === 0 ? null : (
              <section key={manager.id}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                    {manager.displayName[0]?.toUpperCase()}
                  </span>
                  {manager.displayName}
                  <span className="text-zinc-400 font-normal">
                    · {teamIds.length} team{teamIds.length !== 1 ? 's' : ''}
                  </span>
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {teamIds.map((tid) => (
                    <TeamOverviewCard
                      key={tid}
                      teamId={tid}
                      onEnter={handleEnterTeam}
                    />
                  ))}
                </div>
              </section>
            ),
          )}

          {directorGrouped.groups.every((g) => g.teamIds.length === 0) &&
            directorGrouped.directIds.length === 0 && <EmptyState />}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center gap-2 py-16 text-zinc-400">
      <p className="text-lg font-medium">No teams in your scope yet.</p>
      <p className="text-sm">
        Go to{' '}
        <a href="/org" className="underline hover:text-zinc-600">
          Org Settings
        </a>{' '}
        to link teams.
      </p>
    </div>
  )
}
