import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  MetabuildAssigneeBars,
  MetabuildSectionBars,
  MetabuildStatusPie,
} from '../components/MetabuildCharts'
import { PersonProgressBar } from '../components/PersonProgressBar'
import { WorkItemTitleLink } from '../components/WorkItemTitleLink'
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
import { copyTextToClipboard } from '../lib/clipboard'
import {
  allAssignees,
  assigneeChartUniqueLabels,
  countByStatus,
  itemsForAssignee,
  personCompletionPercent,
} from '../lib/stats'
import { DEFAULT_WEEKLY_WIKI_PAGE_URL } from '../data/defaultSlackDmUrls'
import { resolveSlackDmUrl } from '../lib/slackDm'
import { getCurrentSprint, sprintDayProgress } from '../lib/sdates'
import type { WorkItem } from '../types'
import {
  buildMyWeeklyWikiColumnUpdate,
  buildWeeklyWikiTable,
  getLocalWeekRangeContaining,
} from '../lib/weeklyWikiExport'

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
export function Dashboard() {
  const ctx = useTeamContextNullable()
  const user = ctx?.user
  const [wikiToast, setWikiToast] = useState<string | null>(null)
  const [wikiTopWeekCell, setWikiTopWeekCell] = useState('')

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

  const pieData = useMemo(
    () =>
      [
        { name: 'Done', value: done, fill: '#00B050' },
        { name: 'In progress', value: inProgressCount, fill: '#3DCC7A' },
        { name: 'Todo / blocked', value: blockedTodoCount, fill: '#B8E6CC' },
      ].filter((r) => r.value > 0),
    [done, inProgressCount, blockedTodoCount],
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

  const roster = useMemo(() => {
    const base = [...(ctx?.teamMembers ?? [])].sort((a, b) =>
      a.localeCompare(b),
    )
    if (!user || isAdmin(user)) return base
    return base.filter((n) => n === user.displayName)
  }, [ctx, user])

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

  const wikiPageUrl =
    ctx.weeklyWikiPageUrl?.trim() || DEFAULT_WEEKLY_WIKI_PAGE_URL

  const titleLinkCls =
    'font-medium text-indigo-700 hover:text-indigo-900 hover:underline'

  const chartAside = (
    <aside className="order-2 w-full max-w-full space-y-3 xl:sticky xl:top-4 xl:order-1 xl:max-h-[min(calc(100vh-5rem),56rem)] xl:max-w-[20rem] xl:justify-self-start xl:overflow-y-auto xl:overscroll-contain xl:pr-1">
      <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <h3 className="mb-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#007a3d]">
          Team progress
        </h3>
        <MetabuildStatusPie data={pieData} compact />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <h3 className="mb-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#007a3d]">
          Section (done %)
        </h3>
        <MetabuildSectionBars rows={sectionBarRows} compact />
      </div>
      {isAdmin(user) ? (
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
          <h3 className="mb-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#007a3d]">
            Done % by person
          </h3>
          <MetabuildAssigneeBars rows={assigneeBarRows} compact />
        </div>
      ) : null}
      {!isAdmin(user) && teammateNames.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <h3 className="mb-2 text-center text-[10px] font-bold uppercase tracking-wide text-[#007a3d]">
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
                      className="truncate text-xs font-medium text-slate-800 hover:text-[#007a3d] hover:underline"
                    >
                      {name}
                    </Link>
                    {slackUrl ? (
                      <a
                        href={slackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#4A154B] hover:bg-purple-50"
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
    </aside>
  )

  return (
    <div className="space-y-6">
      {!isAdmin(user) ? (
        <p className="text-sm text-slate-600">
          Showing your assignments for the selected scope above.
        </p>
      ) : null}

      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(16.5rem,20rem)_minmax(0,1fr)] xl:items-start xl:gap-5">
        <div className="order-1 min-w-0 space-y-6 xl:order-2">
          <div className="rounded-xl border border-[#00B050]/30 bg-white px-3 py-2.5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <span className="text-xs font-semibold text-[#007a3d] shrink-0">
                Weekly wiki
              </span>
              <label className="flex min-w-0 flex-1 flex-col gap-0.5 sm:max-w-md">
                <span className="text-[10px] font-medium text-slate-500">
                  Top row &quot;Week&quot; cell (optional — paste from wiki for append vs new row)
                </span>
                <input
                  type="text"
                  value={wikiTopWeekCell}
                  onChange={(e) => setWikiTopWeekCell(e.target.value)}
                  placeholder='e.g. 06 Apr 2026 to 10 Apr 2026'
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-800 placeholder:text-slate-400"
                />
              </label>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-lg bg-[#00B050] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#009948]"
                onClick={async () => {
                  const update = buildMyWeeklyWikiColumnUpdate({
                    displayName: user.displayName,
                    workItems: ctx.workItems,
                    wikiTopWeekCell: wikiTopWeekCell.trim() || undefined,
                  })
                  const text = `${update.instructions}\n\n---\n\n${update.cellContent}`
                  const ok = await copyTextToClipboard(text)
                  if (ok) {
                    setWikiToast(
                      update.mode === 'append_to_top_row'
                        ? 'Copied your column update (append to current week row).'
                        : `Copied your column update (new week row: ${update.weekRangeLabel}).`,
                    )
                    window.setTimeout(() => setWikiToast(null), 4000)
                  } else {
                    setWikiToast(
                      'Could not copy (clipboard blocked — use HTTPS or select text manually).',
                    )
                  }
                }}
              >
                Copy my wiki column
              </button>
              {isAdmin(user) ? (
                <>
                  <button
                    type="button"
                    className="rounded-lg border border-[#00B050]/40 bg-[#00B050]/10 px-3 py-1.5 text-xs font-semibold text-[#0d5c2e] hover:bg-[#00B050]/15"
                    onClick={async () => {
                      const week = getLocalWeekRangeContaining()
                      const rosterSorted = [...ctx.teamMembers].sort((a, b) =>
                        a.localeCompare(b),
                      )
                      const text = buildWeeklyWikiTable({
                        week,
                        roster: rosterSorted,
                        workItems: ctx.workItems,
                      })
                      const ok = await copyTextToClipboard(text)
                      if (ok) {
                        setWikiToast(`Copied full table for ${week.label}`)
                        window.setTimeout(() => setWikiToast(null), 3500)
                      } else {
                        setWikiToast(
                          'Could not copy (clipboard blocked — use HTTPS or select text manually).',
                        )
                      }
                    }}
                  >
                    Copy full wiki table
                  </button>
                  <a
                    href={wikiPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                  >
                    Open wiki page
                  </a>
                </>
              ) : (
                <a
                  href={wikiPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  Open wiki page
                </a>
              )}
              {wikiToast ? (
                <span className="text-xs font-medium text-emerald-800">
                  {wikiToast}
                </span>
              ) : null}
            </div>
          </div>

          {sortedSprints.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-2 gap-y-2 border-b border-[#00B050]/25 bg-[#00B050]/10 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#007a3d]">
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
                      <span className="font-bold text-[#007a3d]">
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
                      className="h-full rounded-full bg-gradient-to-r from-[#00B050] to-[#009948] transition-[width] duration-300 ease-out"
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-[#00B050]/30 bg-[#00B050] px-3 py-2">
          <h3 className="text-sm font-bold text-white">
            Work items · {scopeShortLabel(scope, sortedSprints)}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-[#00B050]/12">
                <th className="px-3 py-2 font-bold text-[#0d5c2e]">Title</th>
                <th className="px-3 py-2 font-bold text-[#0d5c2e]">Section</th>
                {isAdmin(user) ? (
                  <th className="px-3 py-2 font-bold text-[#0d5c2e]">
                    Assignees
                  </th>
                ) : null}
                <th className="px-3 py-2 font-bold text-[#0d5c2e]">Status</th>
                <th className="px-3 py-2 font-bold text-[#0d5c2e]">Jira</th>
                <th className="min-w-[12rem] px-3 py-2 font-bold text-[#0d5c2e]">
                  Latest comment
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin(user) ? 6 : 5}
                    className="px-3 py-6 text-center text-slate-500"
                  >
                    No items in this scope.
                  </td>
                </tr>
              ) : (
                tableItems.map((w) => {
                  const jiraBase = ctx.jiraBaseUrl.trim().replace(/\/$/, '')
                  return (
                    <tr key={w.id} className="hover:bg-slate-50/80">
                      <td className="max-w-[14rem] px-3 py-2 align-top">
                        <WorkItemTitleLink
                          item={w}
                          showCommentHover={false}
                          className={titleLinkCls}
                        />
                      </td>
                      <td className="px-3 py-2 align-top text-slate-700">
                        {w.section || '—'}
                      </td>
                      {isAdmin(user) ? (
                        <td className="px-3 py-2 align-top text-slate-700">
                          {w.assignees.length ? w.assignees.join(', ') : '—'}
                        </td>
                      ) : null}
                      <td className="px-3 py-2 align-top text-slate-800">
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
                                className="font-mono text-[11px] text-indigo-700 hover:text-indigo-900 hover:underline"
                              >
                                {k}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="max-w-[20rem] px-3 py-2 align-top text-slate-600">
                        {latestCommentPreview(w)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin(user) ? (
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
                    slackUrl={resolveSlackDmUrl(
                      name,
                      ctx.slackDmUrlByDisplayName,
                      ctx.teamUsers,
                    )}
                  />
                  <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
                    {mine.map((w) => (
                      <li
                        key={w.id}
                        className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 first:border-t-0 first:pt-0"
                      >
                        <WorkItemTitleLink
                          item={w}
                          showCommentHover={isAdmin(user)}
                          className={`min-w-0 flex-1 ${titleLinkCls}`}
                        />
                        <StatusBadge status={w.status} />
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
        </div>

        {chartAside}
      </div>
    </div>
  )
}
