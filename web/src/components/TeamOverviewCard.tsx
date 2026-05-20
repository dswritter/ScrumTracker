import { useMemo } from 'react'
import { useTrackerStore } from '../store/useTrackerStore'
import { MetabuildStatusPie, type TeamPieSlice } from './MetabuildCharts'
import { countByStatus } from '../lib/stats'
import { getCurrentSprint, sprintsSortedNewestFirst } from '../lib/sdates'
import { filterWorkItemsByScope } from '../lib/dashboardScope'

interface TeamOverviewCardProps {
  teamId: string
  /** Manager display name shown as a badge (director view). */
  managerName?: string
  onEnter: (teamId: string) => void
}

export function TeamOverviewCard({
  teamId,
  managerName,
  onEnter,
}: TeamOverviewCardProps) {
  const teamMeta = useTrackerStore((s) => s.teams.find((t) => t.id === teamId))
  const teamData = useTrackerStore((s) => s.teamsData[teamId])

  const { sprintName, pieSlices, done, total } = useMemo(() => {
    if (!teamData) return { sprintName: null, pieSlices: [] as TeamPieSlice[], done: 0, total: 0 }
    const sorted = sprintsSortedNewestFirst(teamData.sprints)
    const current = getCurrentSprint(sorted)
    const activeSprint = current ?? sorted[0] ?? null
    const scope = activeSprint
      ? ({ type: 'sprint', sprintId: activeSprint.id } as const)
      : ({ type: 'all' } as const)
    const items = filterWorkItemsByScope(teamData.workItems, teamData.sprints, scope)
    const c = countByStatus(items)
    const slices: TeamPieSlice[] = [
      { name: 'Done', value: c.done, variant: 'solid', filter: 'done' },
      {
        name: 'In progress',
        value: c.in_progress + c.to_test + c.to_track,
        variant: 'striped',
        filter: 'inProgress',
      },
      {
        name: 'Ready for prod',
        value: c.ready_for_prod,
        variant: 'accent',
        filter: 'readyForProd',
      },
      {
        name: 'Todo / blocked',
        value: c.blocked + c.todo,
        variant: 'muted',
        filter: 'blockedTodo',
      },
    ]
    return {
      sprintName: activeSprint?.name ?? null,
      pieSlices: slices,
      done: c.done,
      total: items.length,
    }
  }, [teamData])

  const teamName = teamMeta?.name ?? teamId

  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-zinc-900 leading-tight">{teamName}</h3>
          {managerName && (
            <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600 font-medium">
              {managerName}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-zinc-400">
          {sprintName ?? 'No active sprint'}
        </p>
      </div>

      {/* Chart */}
      <div className="flex justify-center px-4">
        {pieSlices.length > 0 ? (
          <MetabuildStatusPie data={pieSlices} compact totalItems={total} />
        ) : (
          <div className="h-[168px] flex items-center justify-center text-zinc-300 text-sm">
            No data
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 pt-1 flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          {done} / {total} done
        </span>
        <button
          onClick={() => onEnter(teamId)}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          Enter Team
        </button>
      </div>
    </div>
  )
}
