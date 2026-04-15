import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  MetabuildAssigneeBars,
  MetabuildSectionBars,
  MetabuildStatusPie,
} from '../components/MetabuildCharts'
import { WeeklyProgressPanel } from '../components/WeeklyProgressPanel'
import { WorkItemTitleLink } from '../components/WorkItemTitleLink'
import { StatusBadge } from '../components/StatusBadge'
import { useCurrentUser } from '../hooks/useCurrentUser'
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
  sprintSelectOptionLabel,
  scopeShortLabel,
  scopeToParams,
  yearOptionsFromSprints,
} from '../lib/dashboardScope'
import {
  loadPersistedWeekKey,
  loadPersistedWeeklyFilters,
  loadPersistedWeeklyOpen,
  savePersistedWeekKey,
  savePersistedWeeklyFilters,
  savePersistedWeeklyOpen,
} from '../lib/dashboardUiPersistence'
import {
  allAssignees,
  assigneeChartUniqueLabels,
  countByStatus,
  personCompletionPercent,
} from '../lib/stats'
import { resolveSlackDmUrl } from '../lib/slackDm'
import {
  getCurrentSprint,
  sprintDayProgress,
  sprintsSortedNewestFirst,
} from '../lib/sdates'
import {
  buildWeeklyProgressCards,
  formatWeekRangeLabel,
  mondayDateKey,
  parseMondayKey,
  weekMondayOffsets,
} from '../lib/weeklyProgress'
import { useTrackerStore } from '../store/useTrackerStore'
import type { WorkItem } from '../types'

function displayInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  const a = parts[0][0] ?? ''
  const b = parts[parts.length - 1][0] ?? ''
  return `${a}${b}`.toUpperCase()
}

function latestCommentPreview(w: WorkItem): string {
  if (!w.comments.length) return '—'
  const sorted = [...w.comments].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  const t = sorted[0].body.replace(/\s+/g, ' ').trim()
  return t.length > 120 ? `${t.slice(0, 119)}…` : t
}

function DashboardPageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-24 rounded-xl bg-slate-200/80 dark:bg-slate-700/60 xl:hidden" />
      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[min(20rem,calc(100vw-3rem))_1fr] xl:items-start xl:gap-5">
        <div className="order-1 space-y-3 xl:order-2 xl:min-w-0">
          <div className="h-64 rounded-xl bg-slate-200/80 dark:bg-slate-700/60" />
        </div>
        <aside className="order-2 hidden space-y-3 xl:order-1 xl:block xl:w-full">
          <div className="h-40 rounded-xl bg-slate-200/80 dark:bg-slate-700/60" />
          <div className="h-48 rounded-xl bg-slate-200/80 dark:bg-slate-700/60" />
        </aside>
      </div>
    </div>
  )
}

export function Dashboard() {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const ctx = useTeamContextNullable()
  const storeHydrated = useSyncExternalStore(
    (onStoreChange) =>
      useTrackerStore.persist.onFinishHydration(onStoreChange),
    () => useTrackerStore.persist.hasHydrated(),
    () => true,
  )

  const scopeSelectRef = useRef<HTMLSelectElement>(null)
  const weeklySearchInputRef = useRef<HTMLInputElement>(null)
  const memberWpersonInitialized = useRef(false)
  const weeklyFiltersFromLs = useRef(false)

  const sortedSprints = useMemo(() => {
    if (!ctx?.sprints?.length) return []
    return sprintsSortedNewestFirst(ctx.sprints)
  }, [ctx])

  const defaultSprintId = useMemo(() => {
    if (sortedSprints.length === 0) return null
    return getCurrentSprint(sortedSprints)?.id ?? sortedSprints[0].id
  }, [sortedSprints])

  const [searchParams, setSearchParams] = useSearchParams()
  const weeklyOpen = searchParams.get('weekly') === '1'
  const [weeklyWeekKey, setWeeklyWeekKey] = useState(() => {
    const persisted = loadPersistedWeekKey()
    if (persisted) return persisted
    return mondayDateKey(weekMondayOffsets(12)[0])
  })

  const wPerson = searchParams.get('wperson') ?? ''
  const [wProject, setWProject] = useState('')
  const [wQuery, setWQuery] = useState('')

  const weekChoices = useMemo(
    () =>
      weekMondayOffsets(12).map((d) => ({
        key: mondayDateKey(d),
        label: formatWeekRangeLabel(d),
      })),
    [],
  )

  const scope = useMemo(
    () =>
      parseDashboardScope(searchParams, sortedSprints, defaultSprintId),
    [searchParams, sortedSprints, defaultSprintId],
  )

  useEffect(() => {
    if (sortedSprints.length === 0) return
    const sp = new URLSearchParams(searchParams)
    const hasScope = sp.has('scope')
    const current = getCurrentSprint(sortedSprints)?.id ?? sortedSprints[0].id

    if (!hasScope) {
      const sid = sp.get('sprint')
      const id =
        sid && sortedSprints.some((s) => s.id === sid) ? sid : current
      sp.set('scope', 'sprint')
      sp.set('sprint', id)
      if (!sp.has('weekly')) {
        const p = loadPersistedWeeklyOpen()
        sp.set('weekly', p === false ? '0' : '1')
      }
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
      const sp = new URLSearchParams(searchParams)
      sp.set('scope', 'sprint')
      sp.set('sprint', sortedSprints[next]!.id)
      setSearchParams(sp)
    },
    [sortedSprints, sprintIndex, setSearchParams, searchParams],
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

  const teamPieSlices = useMemo(
    () =>
      [
        {
          name: 'Done',
          value: done,
          variant: 'solid' as const,
          filter: 'done' as const,
        },
        {
          name: 'In progress',
          value: inProgressCount,
          variant: 'striped' as const,
          filter: 'inProgress' as const,
        },
        {
          name: 'Todo / blocked',
          value: blockedTodoCount,
          variant: 'muted' as const,
          filter: 'blockedTodo' as const,
        },
      ].filter((r) => r.value > 0),
    [done, inProgressCount, blockedTodoCount],
  )

  const onPieSliceNavigate = useCallback(
    (filter: 'done' | 'inProgress' | 'blockedTodo') => {
      if (filter === 'done') {
        navigate(buildItemsHref(scope, { status: 'done' }))
      } else if (filter === 'inProgress') {
        navigate(buildItemsHref(scope, { group: 'inProgress' }))
      } else {
        navigate(buildItemsHref(scope, { group: 'blockedTodo' }))
      }
    },
    [navigate, scope],
  )

  const sectionBarRows = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>()
    for (const w of filteredItems) {
      const key = w.section.trim() || 'General'
      const cur = m.get(key) ?? { total: 0, done: 0 }
      cur.total++
      if (w.status === 'done') cur.done++
      m.set(key, cur)
    }
    return [...m.entries()]
      .map(([name, { total, done: doneC }]) => ({
        name: name.length > 16 ? `${name.slice(0, 15)}…` : name,
        pct: total ? Math.round((doneC / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [filteredItems])

  const sprintProgress = selectedSprint
    ? sprintDayProgress(selectedSprint)
    : null
  const frac = sprintProgress?.fraction ?? 0

  const rosterForAssigneeChart = useMemo(
    () =>
      allAssignees(ctx?.teamMembers ?? [], ctx?.workItems ?? []).sort((a, b) =>
        a.localeCompare(b),
      ),
    [ctx],
  )

  const assigneeLabelByName = useMemo(
    () => assigneeChartUniqueLabels(rosterForAssigneeChart),
    [rosterForAssigneeChart],
  )

  const teammateNames = useMemo(() => {
    if (!user || isAdmin(user)) return []
    return [...(ctx?.teamMembers ?? [])]
      .filter((n) => n.trim() && n.trim() !== user.displayName.trim())
      .sort((a, b) => a.localeCompare(b))
  }, [ctx, user])

  const assigneeBarRows = useMemo(
    () =>
      rosterForAssigneeChart.map((name) => ({
        label: assigneeLabelByName.get(name) ?? name,
        fullName: name,
        pct: personCompletionPercent(name, filteredItems),
      })),
    [rosterForAssigneeChart, assigneeLabelByName, filteredItems],
  )

  const tableItems = useMemo(
    () => [...filteredItems].sort((a, b) => a.title.localeCompare(b.title)),
    [filteredItems],
  )

  function primaryAssigneeLabel(w: WorkItem): string {
    const names = [...w.assignees].map((a) => a.trim()).filter(Boolean)
    if (names.length === 0) return 'Unassigned'
    names.sort((a, b) => a.localeCompare(b))
    return names[0]!
  }

  const tableAssigneeGroups = useMemo(() => {
    const m = new Map<string, WorkItem[]>()
    for (const w of tableItems) {
      const key = primaryAssigneeLabel(w)
      const cur = m.get(key) ?? []
      cur.push(w)
      m.set(key, cur)
    }
    const names = [...m.keys()].sort((a, b) => a.localeCompare(b))
    return names.map((name) => ({
      name,
      items: (m.get(name) ?? []).sort((a, b) =>
        a.title.localeCompare(b.title),
      ),
    }))
  }, [tableItems])

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
    const sp = new URLSearchParams(searchParams)
    for (const key of ['scope', 'sprint', 'year', 'month']) {
      sp.delete(key)
    }
    for (const [k, v] of Object.entries(scopeToParams(next))) {
      sp.set(k, v)
    }
    if (weeklyOpen) sp.set('weekly', '1')
    setSearchParams(sp)
  }

  /** Weekly attribution must use the full roster; excluding “admin” names drops all cards when assignees have admin logins. */
  const weeklyPersonRoster = useMemo(
    () =>
      [...new Set((ctx?.teamMembers ?? []).map((m) => m.trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [ctx?.teamMembers],
  )

  const weeklyCards = useMemo(() => {
    if (!weeklyOpen || !ctx) return []
    const mon = parseMondayKey(weeklyWeekKey)
    /** Team sprint scope (not per-user filtered) so weekly shows all teammate comments in the sprint. */
    return buildWeeklyProgressCards(
      scopedItems,
      weeklyPersonRoster,
      mon,
      ctx.jiraBaseUrl,
    )
  }, [
    weeklyOpen,
    weeklyWeekKey,
    scopedItems,
    weeklyPersonRoster,
    ctx,
  ])

  useEffect(() => {
    savePersistedWeekKey(weeklyWeekKey)
  }, [weeklyWeekKey])

  useEffect(() => {
    if (!storeHydrated || weeklyFiltersFromLs.current) return
    weeklyFiltersFromLs.current = true
    const f = loadPersistedWeeklyFilters()
    setWProject(f.project)
    setWQuery(f.query)
  }, [storeHydrated])

  useEffect(() => {
    if (!user || isAdmin(user) || memberWpersonInitialized.current) return
    if (searchParams.has('wperson')) {
      memberWpersonInitialized.current = true
      return
    }
    memberWpersonInitialized.current = true
    const sp = new URLSearchParams(searchParams)
    sp.set('wperson', user.displayName)
    setSearchParams(sp, { replace: true })
    savePersistedWeeklyFilters({
      person: user.displayName,
      project: wProject,
      query: wQuery,
    })
  }, [user, searchParams, setSearchParams, wProject, wQuery])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) {
        return
      }
      e.preventDefault()
      if (weeklyOpen) {
        weeklySearchInputRef.current?.focus()
      } else {
        scopeSelectRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [weeklyOpen])

  const onWeeklyPersonChange = useCallback(
    (v: string) => {
      const sp = new URLSearchParams(searchParams)
      if (v) sp.set('wperson', v)
      else sp.delete('wperson')
      setSearchParams(sp)
      savePersistedWeeklyFilters({
        person: v,
        project: wProject,
        query: wQuery,
      })
    },
    [searchParams, setSearchParams, wProject, wQuery],
  )

  const onWeeklyProjectChange = useCallback(
    (v: string) => {
      setWProject(v)
      savePersistedWeeklyFilters({
        person: wPerson,
        project: v,
        query: wQuery,
      })
    },
    [wPerson, wQuery],
  )

  const onWeeklySearchChange = useCallback(
    (v: string) => {
      setWQuery(v)
      savePersistedWeeklyFilters({
        person: wPerson,
        project: wProject,
        query: v,
      })
    },
    [wPerson, wProject],
  )

  const toggleWeekly = () => {
    const sp = new URLSearchParams(searchParams)
    if (weeklyOpen) {
      sp.delete('weekly')
      savePersistedWeeklyOpen(false)
    } else {
      sp.set('weekly', '1')
      savePersistedWeeklyOpen(true)
    }
    setSearchParams(sp)
  }

  if (!user) return null
  if (!storeHydrated) return <DashboardPageSkeleton />
  if (!ctx) return null

  const titleLinkCls =
    'font-semibold text-indigo-800 hover:text-indigo-950 hover:underline dark:text-slate-100 dark:hover:text-white'

  const sprintCommentWindow =
    selectedSprint && scope.type === 'sprint'
      ? { start: selectedSprint.start, end: selectedSprint.end }
      : null

  function renderScopeCard(layout: 'sidebar' | 'toolbar') {
    const sidebar = layout === 'sidebar'
    const selectCls = sidebar
      ? 'min-w-0 flex-1 rounded border border-slate-200/80 bg-white/95 py-1 pl-2 pr-6 text-xs font-semibold text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-900/95 dark:text-slate-100'
      : 'min-w-0 max-w-[7.5rem] shrink-0 flex-1 rounded border border-slate-200/80 bg-white/95 py-1 pl-2 pr-6 text-xs font-semibold text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-900/95 dark:text-slate-100 sm:max-w-[11rem]'

    const onSprintArrowKeyDownCapture = (e: React.KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if ((e.target as HTMLElement).closest('select')) return
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'ArrowLeft') goSprint(1)
      else goSprint(-1)
    }

    const olderBtn = (
      <button
        type="button"
        aria-label="Older sprint"
        disabled={
          scope.type !== 'sprint' ||
          sprintIndex < 0 ||
          sprintIndex >= sortedSprints.length - 1
        }
        className="rounded border border-slate-200/80 bg-white/90 px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={() => goSprint(1)}
      >
        ←
      </button>
    )
    const scopeSelect = (
      <select
        ref={scopeSelectRef}
        aria-label="Dashboard scope"
        className={selectCls}
        value={scopeSelectValue(scope)}
        onChange={(e) => onScopeSelectChange(e.target.value)}
      >
        <optgroup
          label="Sprints"
          className="dark:text-slate-200 [&>option]:dark:text-slate-100"
        >
          {sortedSprints.map((s) => (
            <option key={s.id} value={`sprint:${s.id}`}>
              {sprintSelectOptionLabel(s)}
            </option>
          ))}
        </optgroup>
        <option value="all">All sprints to date</option>
        <optgroup
          label="By month"
          className="dark:text-slate-200 [&>option]:dark:text-slate-100"
        >
          {monthOpts.map((m) => (
            <option
              key={`${m.year}-${m.month}`}
              value={`month:${m.year}:${m.month}`}
            >
              {m.label}
            </option>
          ))}
        </optgroup>
        <optgroup
          label="By year"
          className="dark:text-slate-200 [&>option]:dark:text-slate-100"
        >
          {yearOpts.map((y) => (
            <option key={y} value={`year:${y}`}>
              {y}
            </option>
          ))}
        </optgroup>
      </select>
    )
    const weeklyBtn = (
      <button
        type="button"
        className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${
          sidebar ? 'w-full py-1.5' : 'shrink-0'
        } ${
          weeklyOpen
            ? 'border-[#00B050] bg-[#00B050] text-white dark:border-emerald-500 dark:bg-emerald-600'
            : 'border-slate-200/80 bg-white/90 text-[#0d5c2e] hover:bg-white dark:border-slate-600 dark:bg-slate-800/90 dark:text-emerald-200 dark:hover:bg-slate-800'
        }`}
        title="Card view of teammate comments this week (Jira + tracker)"
        onClick={toggleWeekly}
      >
        {weeklyOpen ? 'Exit weekly' : 'Weekly'}
      </button>
    )
    const newerBtn = (
      <button
        type="button"
        aria-label="Newer sprint"
        disabled={scope.type !== 'sprint' || sprintIndex <= 0}
        className="rounded border border-slate-200/80 bg-white/90 px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={() => goSprint(-1)}
      >
        →
      </button>
    )
    const progressLine =
      selectedSprint && sprintProgress ? (
        <span
          role="status"
          aria-label={`Sprint calendar progress ${Math.round(frac * 100)} percent, day ${sprintProgress.current} of ${sprintProgress.total}`}
        >
          <span className="font-bold text-[#007a3d] dark:text-emerald-300">
            {Math.round(frac * 100)}%
          </span>
          <span>
            {' '}
            · day {sprintProgress.current}/{sprintProgress.total}
          </span>
        </span>
      ) : (
        <span className="block max-w-[11rem] truncate font-semibold text-slate-600 dark:text-slate-300">
          {scopeShortLabel(scope, sortedSprints)}
        </span>
      )

    const progressBlockToolbar = (
      <div className="ml-auto flex shrink-0 flex-col items-end gap-0.5 text-right text-[10px] tabular-nums text-slate-700 dark:text-slate-200">
        {progressLine}
      </div>
    )

    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
        <div className="relative overflow-hidden border-b border-[#00B050]/25 bg-[#00B050]/10">
          {selectedSprint && sprintProgress ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-[#00B050]/45 to-[#00B050]/20 transition-[width] duration-300 ease-out dark:from-[#00B050]/35 dark:to-[#00B050]/15"
              style={{ width: `${Math.round(frac * 100)}%` }}
            />
          ) : null}
          {sidebar ? (
            <div className="relative z-10 flex flex-col gap-2 px-2.5 py-2">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#007a3d] dark:text-emerald-300">
                  Scope
                </span>
                <div className="min-w-0 text-right text-[10px] leading-tight tabular-nums text-slate-700 dark:text-slate-200">
                  {progressLine}
                </div>
              </div>
              <div
                className="flex w-full min-w-0 items-stretch gap-1 rounded-md outline-none ring-[#00B050]/40 focus-visible:ring-2"
                role="group"
                aria-label="Sprint navigation"
                tabIndex={0}
                onKeyDownCapture={onSprintArrowKeyDownCapture}
              >
                {olderBtn}
                {scopeSelect}
                {newerBtn}
              </div>
              {weeklyBtn}
            </div>
          ) : (
            <div className="relative z-10 flex flex-wrap items-center gap-2 gap-y-2 px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#007a3d] dark:text-emerald-300">
                Scope
              </span>
              <div
                className="flex min-w-0 flex-wrap items-center gap-1 rounded-md outline-none ring-[#00B050]/40 focus-visible:ring-2"
                role="group"
                aria-label="Sprint navigation"
                tabIndex={0}
                onKeyDownCapture={onSprintArrowKeyDownCapture}
              >
                {olderBtn}
                {scopeSelect}
                {newerBtn}
              </div>
              {weeklyBtn}
              {progressBlockToolbar}
            </div>
          )}
        </div>
      </div>
    )
  }

  const chartAside = (
    <aside className="order-2 w-full max-w-full space-y-3 xl:order-1 xl:flex xl:max-w-[20rem] xl:flex-col xl:gap-3 xl:space-y-0 xl:self-start xl:pr-1">
      {sortedSprints.length > 0 ? (
        <div className="hidden shrink-0 xl:block">{renderScopeCard('sidebar')}</div>
      ) : null}
      <div className="space-y-3 xl:sticky xl:top-24 xl:z-0 xl:max-h-[calc(100vh-6rem)] xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain">
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
          <h3 className="mb-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#007a3d] dark:text-emerald-300">
            Team progress
          </h3>
          <MetabuildStatusPie
            data={teamPieSlices}
            compact
            totalItems={total}
            onSliceClick={onPieSliceNavigate}
            onTotalClick={() => navigate(buildItemsHref(scope))}
          />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
          <h3 className="mb-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#007a3d] dark:text-emerald-300">
            Section (done %)
          </h3>
          <MetabuildSectionBars rows={sectionBarRows} compact />
        </div>
        {isAdmin(user) ? (
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
            <h3 className="mb-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#007a3d] dark:text-emerald-300">
              Done % by person
            </h3>
            <MetabuildAssigneeBars rows={assigneeBarRows} compact />
          </div>
        ) : null}
        {!isAdmin(user) && teammateNames.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
            <h3 className="mb-2 text-center text-[10px] font-bold uppercase tracking-wide text-[#007a3d] dark:text-emerald-300">
              Teammates
            </h3>
            <ul className="flex flex-col items-stretch gap-3">
              {teammateNames.map((name) => {
                const href = personDetailHref(name, scope)
                const slackUrl = resolveSlackDmUrl(
                  name,
                  ctx.slackDmUrlByDisplayName,
                  ctx.teamUsers,
                )
                return (
                  <li key={name} className="flex items-center gap-2">
                    <Link
                      to={href}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00B050] to-emerald-700 text-xs font-bold text-white shadow-md ring-2 ring-white hover:ring-[#00B050]/40"
                      title={name}
                    >
                      {displayInitials(name)}
                    </Link>
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <Link
                        to={href}
                        className="truncate text-xs font-medium text-slate-800 hover:text-[#007a3d] hover:underline dark:text-slate-100 dark:hover:text-white"
                      >
                        {name}
                      </Link>
                      {slackUrl ? (
                        <a
                          href={slackUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#4A154B] hover:bg-purple-50 dark:text-[#ecb22e] dark:hover:bg-white/10"
                          title={`Slack: ${name}`}
                          aria-label={`Open Slack for ${name}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <i className="fa-brands fa-slack text-sm" aria-hidden />
                        </a>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </aside>
  )

  const emptySprintsCallout = (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center dark:border-slate-600 dark:bg-slate-900/40">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#00B050]/15 text-[#0d5c2e] dark:bg-emerald-950/50 dark:text-emerald-200"
        aria-hidden
      >
        <i className="fa-solid fa-clipboard-list text-2xl" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          No sprints yet
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Add a sprint from Settings (JSON import) or open Work items after
          syncing from Jira.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {isAdmin(user) ? (
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 rounded-lg bg-[#00B050] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#009948]"
          >
            <i className="fa-solid fa-file-import text-xs" aria-hidden />
            Import data
          </Link>
        ) : null}
        <Link
          to="/items"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          <i className="fa-solid fa-table-list text-xs" aria-hidden />
          Open work items
        </Link>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 xl:space-y-0">
      {sortedSprints.length > 0 ? (
        <div className="xl:hidden">{renderScopeCard('toolbar')}</div>
      ) : null}

      <div className="relative flex flex-col gap-4 xl:grid xl:grid-cols-[min(20rem,calc(100vw-3rem))_1fr] xl:items-start xl:gap-5">
        <div className="order-1 min-w-0 space-y-2 xl:order-2 xl:min-w-0 xl:self-start">
          {sortedSprints.length === 0 ? emptySprintsCallout : null}

      {sortedSprints.length > 0 && weeklyOpen ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
          <WeeklyProgressPanel
            cards={weeklyCards}
            peopleOptions={weeklyPersonRoster}
            weekChoices={weekChoices}
            weekKey={weeklyWeekKey}
            onWeekKeyChange={setWeeklyWeekKey}
            personFilter={wPerson}
            onPersonFilterChange={onWeeklyPersonChange}
            projectFilter={wProject}
            onProjectFilterChange={onWeeklyProjectChange}
            searchQuery={wQuery}
            onSearchQueryChange={onWeeklySearchChange}
            weeklySearchInputRef={weeklySearchInputRef}
            showReportHeader
            reportTeamName={ctx.teamName}
            reportScopeLabel={scopeShortLabel(scope, sortedSprints)}
          />
        </div>
      ) : null}
      {sortedSprints.length > 0 && !weeklyOpen ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
          <div className="border-b border-[#00B050]/30 bg-[#00B050] px-3 py-2">
            <h3 className="text-sm font-bold text-white">Work items</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-[#00B050]/12 dark:border-slate-700 dark:bg-[#00B050]/18">
                  <th className="px-3 py-2 font-bold text-[#0d5c2e] dark:text-emerald-300">
                    Title
                  </th>
                  <th className="px-3 py-2 font-bold text-[#0d5c2e] dark:text-emerald-300">
                    Section
                  </th>
                  {isAdmin(user) ? (
                    <th className="px-3 py-2 font-bold text-[#0d5c2e] dark:text-emerald-300">
                      Assignees
                    </th>
                  ) : null}
                  <th className="px-3 py-2 font-bold text-[#0d5c2e] dark:text-emerald-300">
                    Status
                  </th>
                  <th className="px-3 py-2 font-bold text-[#0d5c2e] dark:text-emerald-300">
                    Jira
                  </th>
                  <th className="min-w-[12rem] px-3 py-2 font-bold text-[#0d5c2e] dark:text-emerald-300">
                    Latest comment
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {tableItems.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin(user) ? 6 : 5} className="px-4 py-10">
                      <div className="flex flex-col items-center justify-center gap-3 text-center">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                          aria-hidden
                        >
                          <i className="fa-solid fa-inbox text-xl" />
                        </div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          No work items in this scope
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {isAdmin(user) ? (
                            <Link
                              to="/settings"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#00B050] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#009948]"
                            >
                              <i className="fa-solid fa-file-import" aria-hidden />
                              Import sprint
                            </Link>
                          ) : null}
                          <Link
                            to="/items"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          >
                            Open work items
                          </Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  tableAssigneeGroups.flatMap((g) => {
                    const jiraBase = ctx.jiraBaseUrl.trim().replace(/\/$/, '')
                    const headerRow = (
                      <tr
                        key={`grp-${g.name}`}
                        className="bg-[#00B050]/10 dark:bg-[#00B050]/15"
                      >
                        <td
                          colSpan={isAdmin(user) ? 6 : 5}
                          className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#0d5c2e] dark:text-emerald-300"
                        >
                          {g.name}
                        </td>
                      </tr>
                    )
                    const itemRows = g.items.map((w) => (
                      <tr
                        key={w.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                      >
                        <td className="max-w-[14rem] px-3 py-2 align-top">
                          <WorkItemTitleLink
                            item={w}
                            showCommentHover
                            maxPreviewComments={3}
                            sprintCommentWindow={sprintCommentWindow}
                            className={titleLinkCls}
                          />
                        </td>
                        <td className="px-3 py-2 align-top font-medium text-slate-800 dark:text-slate-200">
                          {w.section || '—'}
                        </td>
                        {isAdmin(user) ? (
                          <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-200">
                            {w.assignees.length ? w.assignees.join(', ') : '—'}
                          </td>
                        ) : null}
                        <td className="px-3 py-2 align-top text-slate-800 dark:text-slate-100">
                          <StatusBadge status={w.status} />
                        </td>
                        <td className="px-3 py-2 align-top">
                          {w.jiraKeys.length && jiraBase ? (
                            <div className="flex flex-wrap gap-1">
                              {w.jiraKeys.map((k) => (
                                <a
                                  key={k}
                                  href={`${jiraBase}/${k}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 hover:underline dark:text-sky-100 dark:hover:text-white"
                                >
                                  {k}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">
                              —
                            </span>
                          )}
                        </td>
                        <td className="max-w-[20rem] px-3 py-2 align-top text-sm font-medium text-slate-700 dark:text-slate-300">
                          {latestCommentPreview(w)}
                        </td>
                      </tr>
                    ))
                    return [headerRow, ...itemRows]
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
        </div>

        {sortedSprints.length > 0 ? chartAside : null}
      </div>
    </div>
  )
}
