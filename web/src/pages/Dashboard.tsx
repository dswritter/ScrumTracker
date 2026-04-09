import { useCallback, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PersonProgressBar } from '../components/PersonProgressBar'
import { StatCard } from '../components/StatCard'
import { StatusBadge } from '../components/StatusBadge'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import { isAdmin } from '../lib/permissions'
import {
  buildItemsHref,
  filterWorkItemsByScope,
  monthOptionsFromSprints,
  parseDashboardScope,
  parseScopeSelectValue,
  personDetailHref,
  scopeSelectValue,
  scopeShortLabel,
  scopeToParams,
  yearOptionsFromSprints,
} from '../lib/dashboardScope'
import {
  countByStatus,
  itemsForAssignee,
  personCompletionPercent,
} from '../lib/stats'
import { getCurrentSprint, sprintDayProgress } from '../lib/sdates'
export function Dashboard() {
  const ctx = useTeamContextNullable()
  const user = ctx?.user

  const sortedSprints = useMemo(() => {
    if (!ctx?.sprints?.length) return []
    return [...ctx.sprints].sort(
      (a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id),
    )
  }, [ctx])

  const defaultSprintId = useMemo(() => {
    if (sortedSprints.length === 0) return null
    return (
      getCurrentSprint(sortedSprints)?.id ?? sortedSprints[sortedSprints.length - 1].id
    )
  }, [sortedSprints])

  const [searchParams, setSearchParams] = useSearchParams()

  const scope = useMemo(
    () =>
      parseDashboardScope(searchParams, sortedSprints, defaultSprintId),
    [searchParams, sortedSprints, defaultSprintId],
  )

  useEffect(() => {
    if (sortedSprints.length === 0) return
    const sp = new URLSearchParams(searchParams)
    const hasScope = sp.has('scope')
    const current =
      getCurrentSprint(sortedSprints)?.id ?? sortedSprints[sortedSprints.length - 1].id

    if (!hasScope) {
      const sid = sp.get('sprint')
      const id =
        sid && sortedSprints.some((s) => s.id === sid) ? sid : current
      sp.set('scope', 'sprint')
      sp.set('sprint', id)
      setSearchParams(sp, { replace: true })
      return
    }

    if (sp.get('scope') === 'sprint') {
      const sid = sp.get('sprint')
      const id =
        sid && sortedSprints.some((s) => s.id === sid) ? sid : current
      if (sp.get('sprint') !== id) {
        sp.set('sprint', id)
        setSearchParams(sp, { replace: true })
      }
    }
  }, [sortedSprints, searchParams, setSearchParams])

  const selectedSprint =
    scope.type === 'sprint'
      ? sortedSprints.find((s) => s.id === scope.sprintId) ?? null
      : null

  const sprintIndex = selectedSprint
    ? sortedSprints.findIndex((s) => s.id === selectedSprint.id)
    : -1

  const goSprint = useCallback(
    (delta: number) => {
      if (sortedSprints.length === 0 || sprintIndex < 0) return
      const next = Math.min(
        sortedSprints.length - 1,
        Math.max(0, sprintIndex + delta),
      )
      setSearchParams({
        scope: 'sprint',
        sprint: sortedSprints[next].id,
      })
    },
    [sortedSprints, sprintIndex, setSearchParams],
  )

  const scopedItems = useMemo(
    () =>
      filterWorkItemsByScope(
        ctx?.workItems ?? [],
        sortedSprints,
        scope,
      ),
    [ctx, sortedSprints, scope],
  )

  const filteredItems = useMemo(() => {
    if (!user || isAdmin(user)) return scopedItems
    return scopedItems.filter((w) =>
      w.assignees.some((a) => a.trim() === user.displayName.trim()),
    )
  }, [scopedItems, user])

  const counts = countByStatus(filteredItems)
  const done = counts.done
  const total = filteredItems.length
  const inProgressCount =
    counts.in_progress + counts.to_test + counts.to_track
  const blockedTodoCount = counts.blocked + counts.todo

  const sprintProgress = selectedSprint
    ? sprintDayProgress(selectedSprint)
    : null
  const frac = sprintProgress?.fraction ?? 0

  const roster = useMemo(() => {
    const base = [...(ctx?.teamMembers ?? [])].sort((a, b) =>
      a.localeCompare(b),
    )
    if (!user || isAdmin(user)) return base
    return base.filter((n) => n === user.displayName)
  }, [ctx, user])

  const monthOpts = useMemo(
    () => monthOptionsFromSprints(sortedSprints),
    [sortedSprints],
  )
  const yearOpts = useMemo(
    () => yearOptionsFromSprints(sortedSprints),
    [sortedSprints],
  )

  const onScopeSelectChange = (raw: string) => {
    const next = parseScopeSelectValue(
      raw,
      sortedSprints,
      defaultSprintId,
    )
    setSearchParams(scopeToParams(next))
  }

  if (!user || !ctx) return null

  return (
    <div className="space-y-5">
      {!isAdmin(user) ? (
        <p className="text-sm text-slate-600">
          Showing your assignments for the selected scope above.
        </p>
      ) : null}

      {sortedSprints.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 gap-y-2 border-b border-slate-100 px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Scope
            </span>
            <button
              type="button"
              aria-label="Previous sprint"
              disabled={scope.type !== 'sprint' || sprintIndex <= 0}
              className="rounded border border-slate-200/80 bg-white/90 px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => goSprint(-1)}
            >
              ←
            </button>
            <select
              aria-label="Dashboard scope"
              className="min-w-0 max-w-[min(100%,280px)] flex-1 rounded border border-slate-200/80 bg-white/95 py-1 pl-2 pr-7 text-xs font-semibold text-slate-900 shadow-sm sm:max-w-md"
              value={scopeSelectValue(scope)}
              onChange={(e) => onScopeSelectChange(e.target.value)}
            >
              <optgroup label="Sprints">
                {sortedSprints.map((s) => (
                  <option key={s.id} value={`sprint:${s.id}`}>
                    {s.emoji ?? ''} {s.name} · {s.start} → {s.end}
                  </option>
                ))}
              </optgroup>
              <option value="all">All sprints to date</option>
              <optgroup label="By month">
                {monthOpts.map((m) => (
                  <option
                    key={`${m.year}-${m.month}`}
                    value={`month:${m.year}:${m.month}`}
                  >
                    {m.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="By year">
                {yearOpts.map((y) => (
                  <option key={y} value={`year:${y}`}>
                    {y}
                  </option>
                ))}
              </optgroup>
            </select>
            <button
              type="button"
              aria-label="Next sprint"
              disabled={
                scope.type !== 'sprint' ||
                sprintIndex < 0 ||
                sprintIndex >= sortedSprints.length - 1
              }
              className="rounded border border-slate-200/80 bg-white/90 px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => goSprint(1)}
            >
              →
            </button>
            <div className="ml-auto flex shrink-0 flex-col items-end gap-0.5 text-right">
              <span className="text-[10px] font-semibold text-slate-700">
                {scopeShortLabel(scope, sortedSprints)}
              </span>
              {selectedSprint && sprintProgress ? (
                <span className="text-[10px] tabular-nums text-slate-500">
                  <span className="font-bold text-teal-700">
                    {Math.round(frac * 100)}%
                  </span>
                  <span>
                    {' '}
                    · day {sprintProgress.current}/{sprintProgress.total}
                  </span>
                </span>
              ) : null}
            </div>
          </div>
          {selectedSprint && sprintProgress ? (
            <div className="px-3 pb-2 pt-1">
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuenow={Math.round(frac * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Sprint calendar time elapsed"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-600 transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.round(frac * 100)}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          Sprints will appear here once seeded or imported.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Work items"
          value={total}
          to={buildItemsHref(scope)}
        />
        <StatCard
          title="Done"
          value={done}
          hint={
            total ? `${Math.round((done / total) * 100)}% of scoped items` : undefined
          }
          to={buildItemsHref(scope, { status: 'done' })}
        />
        <StatCard
          title="In progress"
          value={inProgressCount}
          to={buildItemsHref(scope, { group: 'inProgress' })}
        />
        <StatCard
          title="Blocked / todo"
          value={blockedTodoCount}
          to={buildItemsHref(scope, { group: 'blockedTodo' })}
        />
      </div>

      <div>
        <div className="grid gap-3 sm:grid-cols-2">
          {roster.map((name) => {
            const personHref = personDetailHref(name, scope)
            const mine = itemsForAssignee(name, filteredItems)
            const pct = personCompletionPercent(name, filteredItems)
            return (
              <div
                key={name}
                className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <PersonProgressBar
                  name={name}
                  percent={pct}
                  itemCount={mine.length}
                  to={personHref}
                />
                <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
                  {mine.map((w) => (
                    <li
                      key={w.id}
                      className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 first:border-t-0 first:pt-0"
                    >
                      <Link
                        to={buildItemsHref(scope)}
                        className="min-w-0 flex-1 font-medium text-indigo-700 hover:text-indigo-900"
                      >
                        {w.title || '(untitled)'}
                      </Link>
                      <StatusBadge status={w.status} />
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
