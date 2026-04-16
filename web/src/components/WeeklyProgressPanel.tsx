import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { RefObject } from 'react'
import { Link } from 'react-router-dom'
import { itemDetailPath } from '../lib/workItemRoutes'
import {
  downloadWeeklyProgressDocx,
  downloadWeeklyProgressPdf,
} from '../lib/weeklyReportExport'
import {
  buildBulletTree,
  bundleWeeklyProgressByPerson,
  isCommentSeparator,
  workStatusLabel,
  type WeeklyProgressCard,
  type WeeklyProgressPersonBundle,
  type BulletTreeNode,
} from '../lib/weeklyProgress'

const CARD_SHELLS = [
  'border-violet-200/90 bg-violet-50/60 dark:border-violet-800/50 dark:bg-violet-950/25',
  'border-sky-200/90 bg-sky-50/60 dark:border-sky-800/50 dark:bg-sky-950/25',
  'border-emerald-200/90 bg-emerald-50/55 dark:border-emerald-800/50 dark:bg-emerald-950/25',
  'border-rose-200/90 bg-rose-50/55 dark:border-rose-900/40 dark:bg-rose-950/25',
  'border-amber-200/90 bg-amber-50/55 dark:border-amber-900/40 dark:bg-amber-950/25',
]

function shellClass(i: number): string {
  return CARD_SHELLS[i % CARD_SHELLS.length] ?? CARD_SHELLS[0]
}

/** Match Tailwind `sm` / `xl` so card columns follow the old grid breakpoints. */
function weeklyColumnCountFromViewport(): number {
  if (typeof window === 'undefined') return 1
  if (window.matchMedia('(min-width: 1280px)').matches) return 3
  if (window.matchMedia('(min-width: 640px)').matches) return 2
  return 1
}

function useWeeklyCardColumnCount(): number {
  const [n, setN] = useState(weeklyColumnCountFromViewport)
  useEffect(() => {
    const apply = () => setN(weeklyColumnCountFromViewport())
    apply()
    const m2 = window.matchMedia('(min-width: 640px)')
    const m3 = window.matchMedia('(min-width: 1280px)')
    m2.addEventListener('change', apply)
    m3.addEventListener('change', apply)
    return () => {
      m2.removeEventListener('change', apply)
      m3.removeEventListener('change', apply)
    }
  }, [])
  return n
}

/** Rough pixel-ish score so the next card goes into the shortest column (denser layout). */
function estimateBundleHeight(b: WeeklyProgressPersonBundle): number {
  let h = 72
  for (const t of b.tasks) {
    h += 44
    h += t.bulletLines.length * 26
    h += Math.min(120, Math.ceil(t.itemTitle.length / 48) * 18)
    h += t.jiraLinks.length * 22
  }
  return Math.max(h, 100)
}

/**
 * Greedy “shortest column” packing: each new person card goes under the column with
 * the smallest running estimated height so short columns fill before a tall stack grows.
 * Preserves original indices for stable card shell colors.
 */
function splitBundlesIntoShortestColumns(
  items: WeeklyProgressPersonBundle[],
  columnCount: number,
): { item: WeeklyProgressPersonBundle; index: number }[][] {
  if (columnCount <= 1) {
    return [items.map((item, i) => ({ item, index: i }))]
  }
  const cols: { item: WeeklyProgressPersonBundle; index: number }[][] =
    Array.from({ length: columnCount }, () => [])
  const heights = new Array(columnCount).fill(0)
  items.forEach((item, i) => {
    let bestCol = 0
    let bestH = heights[0]!
    for (let c = 1; c < columnCount; c++) {
      const hc = heights[c]!
      if (hc < bestH) {
        bestH = hc
        bestCol = c
      }
    }
    cols[bestCol]!.push({ item, index: i })
    heights[bestCol] += estimateBundleHeight(item)
  })
  return cols
}

/** Show “Comment by …” when authors are not only the attributed person. */
function CommentBulletTreeView({
  nodes,
  nestLevel = 0,
}: {
  nodes: BulletTreeNode[]
  /**0 = top-level (filled disc); odd = hollow circle; even>0 = disc again (Jira-style alternation). */
  nestLevel?: number
}) {
  if (nodes.length === 0) return null
  const useCircle = nestLevel % 2 === 1
  const ulCls =
    nestLevel === 0
      ? 'm-0 list-disc list-outside space-y-1.5 pl-5 text-sm leading-relaxed text-slate-800 marker:text-slate-700 dark:text-slate-100 dark:marker:text-slate-300'
      : useCircle
        ? 'mb-0 mt-1.5 list-[circle] list-outside space-y-1 pl-5 text-[13px] leading-relaxed text-slate-800 marker:text-slate-600 dark:text-slate-100 dark:marker:text-slate-400'
        : 'mb-0 mt-1.5 list-disc list-outside space-y-1 pl-5 text-[13px] leading-relaxed text-slate-800 marker:text-slate-600 dark:text-slate-100 dark:marker:text-slate-400'
  return (
    <ul className={ulCls}>
      {nodes.map((n, i) => (
        <li key={i} className="pl-0.5">
          <span className="whitespace-pre-wrap break-words">{n.text}</span>
          {n.children.length > 0 ? (
            <CommentBulletTreeView nodes={n.children} nestLevel={nestLevel + 1} />
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/** Splits separators; renders each segment as a nested Jira-like bullet list (disc → circle → disc…). */
function WeeklyCommentBody({ lines }: { lines: WeeklyProgressCard['bulletLines'] }) {
  const segments: Array<Array<{ depth: number; text: string }>> = []
  let cur: Array<{ depth: number; text: string }> = []
  for (const L of lines) {
    if (isCommentSeparator(L)) {
      if (cur.length) segments.push(cur)
      cur = []
    } else {
      cur.push(L)
    }
  }
  if (cur.length) segments.push(cur)

  return (
    <div className="space-y-2">
      {segments.map((seg, si) => {
        const tree = buildBulletTree(seg)
        return (
          <Fragment key={si}>
            {si > 0 ? (
              <hr className="my-2 border-slate-200/80 dark:border-slate-600/60" />
            ) : null}
            <CommentBulletTreeView nodes={tree} />
          </Fragment>
        )
      })}
    </div>
  )
}

function authorLineVisible(authorRaw: string, personName: string): boolean {
  const chunks = authorRaw
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean)
  if (chunks.length > 1) return true
  return chunks[0] !== personName.trim()
}

function WeeklyReportExportMenu({
  disabled,
  onExportDocx,
  onExportPdf,
}: {
  disabled: boolean
  onExportDocx: () => Promise<void>
  onExportPdf: () => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        disabled={disabled}
        className="inline-flex h-7 w-7 items-center justify-center rounded text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        title="Download weekly report as Word or PDF"
        aria-label="Export weekly report"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <i className="fa-solid fa-file-export text-xs" aria-hidden />
      </button>
      {open && !disabled ? (
        <div
          className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[11rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={() => {
              setOpen(false)
              void onExportDocx()
            }}
          >
            Word (.docx)
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={() => {
              setOpen(false)
              onExportPdf()
            }}
          >
            PDF (.pdf)
          </button>
        </div>
      ) : null}
    </div>
  )
}

const COLLAPSE_WHEN_TASKS_GTE = 4

function filterWeeklyCards(
  source: WeeklyProgressCard[],
  person: string,
  project: string,
  query: string,
): WeeklyProgressCard[] {
  const q = query.trim().toLowerCase()
  return source.filter((c) => {
    if (person && c.personName !== person) return false
    if (project && c.section !== project) return false
    if (!q) return true
    const blob = [
      c.personName,
      c.authorRaw,
      c.itemTitle,
      workStatusLabel(c.itemStatus),
      c.jiraStatusName ?? '',
      c.jiraResolvedStampKey ?? '',
      ...c.bulletLines.map((bl) =>
        isCommentSeparator(bl) ? '' : bl.text,
      ),
      ...c.jiraLinks.map((j) => j.key),
    ]
      .join('\n')
      .toLowerCase()
    return blob.includes(q)
  })
}

export function WeeklyProgressPanel({
  cards,
  peopleOptions,
  weekChoices,
  weekKey,
  onWeekKeyChange,
  personFilter,
  onPersonFilterChange,
  projectFilter,
  onProjectFilterChange,
  searchQuery,
  onSearchQueryChange,
  weeklySearchInputRef,
  showReportHeader = false,
  reportTeamName,
  reportScopeLabel,
  jiraBaseUrl = '',
}: {
  cards: WeeklyProgressCard[]
  peopleOptions: string[]
  weekChoices: { key: string; label: string }[]
  weekKey: string
  onWeekKeyChange: (key: string) => void
  personFilter: string
  onPersonFilterChange: (v: string) => void
  projectFilter: string
  onProjectFilterChange: (v: string) => void
  searchQuery: string
  onSearchQueryChange: (v: string) => void
  weeklySearchInputRef?: RefObject<HTMLInputElement | null>
  showReportHeader?: boolean
  reportTeamName?: string
  reportScopeLabel?: string
  /** For compact Jira resolved-stamp links in cards */
  jiraBaseUrl?: string
}) {
  const [personExpand, setPersonExpand] = useState<Record<string, boolean>>({})

  const projectOptions = useMemo(() => {
    const s = new Set<string>()
    for (const c of cards) s.add(c.section)
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [cards])

  const filteredCards = useMemo(
    () =>
      filterWeeklyCards(cards, personFilter, projectFilter, searchQuery),
    [cards, personFilter, projectFilter, searchQuery],
  )

  const bundles = useMemo(
    () => bundleWeeklyProgressByPerson(filteredCards),
    [filteredCards],
  )

  const columnCount = useWeeklyCardColumnCount()
  const bundleColumns = useMemo(
    () => splitBundlesIntoShortestColumns(bundles, columnCount),
    [bundles, columnCount],
  )

  const weekLabel = useMemo(
    () => weekChoices.find((w) => w.key === weekKey)?.label ?? weekKey,
    [weekChoices, weekKey],
  )

  const handleExportDocx = useCallback(async () => {
    await downloadWeeklyProgressDocx(
      bundles,
      {
        weekLabel,
        teamName: reportTeamName,
        scopeLabel: reportScopeLabel,
      },
      window.location.origin,
      weekKey,
    )
  }, [bundles, weekLabel, reportTeamName, reportScopeLabel, weekKey])

  const handleExportPdf = useCallback(() => {
    downloadWeeklyProgressPdf(
      bundles,
      {
        weekLabel,
        teamName: reportTeamName,
        scopeLabel: reportScopeLabel,
      },
      window.location.origin,
      weekKey,
    )
  }, [bundles, weekLabel, reportTeamName, reportScopeLabel, weekKey])

  return (
    <>
      {showReportHeader ? (
        <div className="flex items-center justify-between gap-2 border-b border-[#00B050]/30 bg-[#00B050] px-3 py-2 dark:bg-[#00B050]/90">
          <h3 className="min-w-0 text-sm font-bold text-white">
            Weekly progress
          </h3>
          <WeeklyReportExportMenu
            disabled={bundles.length === 0}
            onExportDocx={handleExportDocx}
            onExportPdf={handleExportPdf}
          />
        </div>
      ) : null}
      <div className={`space-y-4 ${showReportHeader ? 'p-4' : ''}`}>
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-900/50 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Person
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-normal text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            value={personFilter}
            onChange={(e) => onPersonFilterChange(e.target.value)}
          >
            <option value="">All teammates</option>
            {peopleOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Week
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-normal text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            value={weekKey}
            onChange={(e) => onWeekKeyChange(e.target.value)}
          >
            {weekChoices.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Project / section
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-normal text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            value={projectFilter}
            onChange={(e) => onProjectFilterChange(e.target.value)}
          >
            <option value="">All</option>
            {projectOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[12rem] flex-[2] flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Search
          <input
            ref={weeklySearchInputRef}
            type="search"
            placeholder="Filter by text, Jira key…"
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-normal text-slate-900 shadow-sm placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
          />
        </label>
      </div>

      {bundles.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-10 text-center dark:border-slate-600 dark:bg-slate-900/40">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200/90 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            aria-hidden
          >
            <i className="fa-regular fa-comment-dots text-xl" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            No updates match these filters for this week.
          </p>
          <Link
            to="/items"
            className="inline-flex items-center gap-2 rounded-lg bg-[#00B050] px-4 py-2 text-xs font-bold text-white hover:bg-[#009948]"
          >
            <i className="fa-solid fa-table-list" aria-hidden />
            Open work items
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
          {bundleColumns.map((col, colIdx) => (
            <ul
              key={`col-${colIdx}`}
              className="m-0 flex min-w-0 flex-1 list-none flex-col gap-3 p-0"
            >
              {col.map(({ item: b, index: idx }) => {
                /** Long lists still get a collapse control, but default to expanded. */
                const expanded = personExpand[b.id] !== false
                const toggleExpand = () => {
                  setPersonExpand((m) => ({
                    ...m,
                    [b.id]: !expanded,
                  }))
                }
                const showToggle = b.tasks.length >= COLLAPSE_WHEN_TASKS_GTE
                return (
                <li
                  key={b.id}
                  className={`flex flex-col rounded-2xl border p-4 shadow-sm ${shellClass(idx)}`}
                >
                  <div
                    className={`flex items-start justify-between gap-2 border-b border-slate-200/70 pb-2 dark:border-slate-600/60 ${showToggle ? 'cursor-pointer select-none' : ''}`}
                    role={showToggle ? 'button' : undefined}
                    tabIndex={showToggle ? 0 : undefined}
                    aria-expanded={showToggle ? expanded : undefined}
                    onClick={showToggle ? toggleExpand : undefined}
                    onKeyDown={
                      showToggle
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              toggleExpand()
                            }
                          }
                        : undefined }
                  >
                    <p className="min-w-0 truncate text-sm font-bold text-slate-900 dark:text-slate-50">
                      {b.personName}
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {b.tasks.length === 1 ? (
                        <time
                          className="text-[10px] tabular-nums text-slate-600 dark:text-slate-300"
                          dateTime={b.tasks[0]!.dateKey}
                        >
                          {b.tasks[0]!.dateLabel}
                        </time>
                      ) : (
                        <span className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                          {b.tasks.length} tasks
                        </span>
                      )}
                      {showToggle ? (
                        <i
                          className={`fa-solid ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px] text-slate-500 dark:text-slate-400`}
                          aria-hidden
                        />
                      ) : null}
                    </div>
                  </div>
                  {expanded ? (
                  <div className="mt-3 space-y-4">
                    {b.tasks.map((c, taskIdx) => (
                      <div
                        key={c.id}
                        className={
                          taskIdx > 0
                            ? 'border-t border-slate-200/60 pt-4 dark:border-slate-600/50'
                            : ''
                        }
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {b.tasks.length > 1 ? (
                              <time
                                className="mb-1 block text-[10px] tabular-nums text-slate-600 dark:text-slate-300"
                                dateTime={c.dateKey}
                              >
                                {c.dateLabel}
                              </time>
                            ) : null}
                            {authorLineVisible(c.authorRaw, c.personName) ? (
                              <p className="mb-1 truncate text-[10px] text-slate-600 dark:text-slate-300">
                                Comment by {c.authorRaw}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200/80 dark:bg-slate-800/90 dark:text-slate-100 dark:ring-slate-600">
                            {c.section}
                          </span>
                          {c.source === 'mixed' ? (
                            <>
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-900 dark:bg-slate-700 dark:text-slate-100">
                                Jira
                              </span>
                              <span className="rounded-full bg-[#00B050]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0d5c2e] dark:bg-emerald-950/60 dark:text-emerald-200">
                                Tracker
                              </span>
                            </>
                          ) : (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                c.source === 'jira'
                                  ? 'bg-blue-100 text-blue-900 dark:bg-slate-700 dark:text-slate-100'
                                  : 'bg-[#00B050]/15 text-[#0d5c2e] dark:bg-emerald-950/60 dark:text-emerald-200'
                              }`}
                            >
                              {c.source === 'jira' ? 'Jira' : 'Tracker'}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-[10px] text-slate-600 dark:text-slate-400">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            Status:
                          </span>{' '}
                          Tracker{' '}
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {workStatusLabel(c.itemStatus)}
                          </span>
                          {c.jiraStatusName ? (
                            <>
                              {' '}
                              · Jira{' '}
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                {c.jiraStatusName}
                              </span>
                            </>
                          ) : null}
                        </p>
                        <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">
                          Task:{' '}
                          <Link
                            to={itemDetailPath(c.itemId)}
                            className="font-semibold text-indigo-700 hover:underline dark:text-slate-100 dark:hover:text-white"
                          >
                            {c.itemTitle}
                          </Link>
                        </p>
                        <div className="mt-2 space-y-2">
                          {c.jiraResolvedStampKey ? (
                            <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-100">
                              Jira closed ·{' '}
                              {jiraBaseUrl.trim() ? (
                                <a
                                  href={`${jiraBaseUrl.trim().replace(/\/$/, '')}/${c.jiraResolvedStampKey}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono font-semibold text-indigo-800 hover:underline dark:text-sky-300"
                                >
                                  {c.jiraResolvedStampKey}
                                </a>
                              ) : (
                                <span className="font-mono font-semibold">
                                  {c.jiraResolvedStampKey}
                                </span>
                              )}
                            </p>
                          ) : null}
                          <WeeklyCommentBody lines={c.bulletLines} />
                        </div>
                        {c.jiraLinks.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-1 border-t border-slate-200/70 pt-2 dark:border-slate-600/60">
                            {c.jiraLinks.map((j) =>
                              j.href !== '#' ? (
                                <a
                                  key={j.key}
                                  href={j.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-md bg-white/90 px-2 py-0.5 font-mono text-[10px] font-semibold text-indigo-800 ring-1 ring-slate-200/80 hover:underline dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600"
                                >
                                  {j.key}
                                </a>
                              ) : (
                                <span
                                  key={j.key}
                                  className="rounded-md bg-white/90 px-2 py-0.5 font-mono text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                  {j.key}
                                </span>
                              ),
                            )}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  ) : (
                    <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
                      {b.tasks.length} tasks hidden — click header to show
                    </p>
                  )}
                </li>
              )})}
            </ul>
          ))}
        </div>
      )}
      </div>
    </>
  )
}
