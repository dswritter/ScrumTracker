import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { itemDetailPath } from '../lib/workItemRoutes'
import {
  bundleWeeklyProgressByPerson,
  type WeeklyProgressCard,
  type WeeklyProgressPersonBundle,
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
    h += t.bullets.length * 26
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
function authorLineVisible(authorRaw: string, personName: string): boolean {
  const chunks = authorRaw
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean)
  if (chunks.length > 1) return true
  return chunks[0] !== personName.trim()
}

export function WeeklyProgressPanel({
  cards,
  peopleOptions,
  weekChoices,
  weekKey,
  onWeekKeyChange,
}: {
  cards: WeeklyProgressCard[]
  peopleOptions: string[]
  weekChoices: { key: string; label: string }[]
  weekKey: string
  onWeekKeyChange: (key: string) => void
}) {
  const [person, setPerson] = useState('')
  const [project, setProject] = useState('')
  const [query, setQuery] = useState('')

  const projectOptions = useMemo(() => {
    const s = new Set<string>()
    for (const c of cards) s.add(c.section)
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [cards])

  const filteredCards = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cards.filter((c) => {
      if (person && c.personName !== person) return false
      if (project && c.section !== project) return false
      if (!q) return true
      const blob = [
        c.personName,
        c.authorRaw,
        c.itemTitle,
        ...c.bullets,
        ...c.jiraLinks.map((j) => j.key),
      ]
        .join('\n')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [cards, person, project, query])

  const bundles = useMemo(
    () => bundleWeeklyProgressByPerson(filteredCards),
    [filteredCards],
  )

  const columnCount = useWeeklyCardColumnCount()
  const bundleColumns = useMemo(
    () => splitBundlesIntoShortestColumns(bundles, columnCount),
    [bundles, columnCount],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-900/50 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Person
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-normal text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
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
            value={project}
            onChange={(e) => setProject(e.target.value)}
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
            type="search"
            placeholder="Filter by text, Jira key…"
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-normal text-slate-900 shadow-sm placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {bundles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-10 text-center text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
          No updates match these filters for this week.
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
          {bundleColumns.map((col, colIdx) => (
            <ul
              key={`col-${colIdx}`}
              className="m-0 flex min-w-0 flex-1 list-none flex-col gap-3 p-0"
            >
              {col.map(({ item: b, index: idx }) => (
                <li
                  key={b.id}
                  className={`flex flex-col rounded-2xl border p-4 shadow-sm ${shellClass(idx)}`}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-200/70 pb-2 dark:border-slate-600/60">
                    <p className="min-w-0 truncate text-sm font-bold text-slate-900 dark:text-slate-50">
                      {b.personName}
                    </p>
                    {b.tasks.length === 1 ? (
                      <time
                        className="shrink-0 text-[10px] tabular-nums text-slate-600 dark:text-slate-300"
                        dateTime={b.tasks[0]!.dateKey}
                      >
                        {b.tasks[0]!.dateLabel}
                      </time>
                    ) : (
                      <span className="shrink-0 text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                        {b.tasks.length} tasks
                      </span>
                    )}
                  </div>
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
                        <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">
                          Task:{' '}
                          <Link
                            to={itemDetailPath(c.itemId)}
                            className="font-semibold text-indigo-700 hover:underline dark:text-slate-100 dark:hover:text-white"
                          >
                            {c.itemTitle}
                          </Link>
                        </p>
                        <ul className="mt-2 space-y-1">
                          {c.bullets.map((line, i) =>
                            line === '—' ? (
                              <li
                                key={`${c.id}-b-${i}`}
                                className="my-0.5 list-none border-t border-slate-200/70 pt-1 dark:border-slate-600/50"
                                aria-hidden
                              />
                            ) : (
                              <li
                                key={`${c.id}-b-${i}`}
                                className="flex gap-2 text-sm leading-snug text-slate-800 dark:text-slate-100"
                              >
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00B050] dark:bg-emerald-400" />
                                <span className="min-w-0 whitespace-pre-wrap break-words">
                                  {line}
                                </span>
                              </li>
                            ),
                          )}
                        </ul>
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
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}
    </div>
  )
}
