import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { itemDetailPath } from '../lib/workItemRoutes'
import type { WeeklyProgressCard } from '../lib/weeklyProgress'

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

export function WeeklyProgressPanel({
  cards,
  peopleOptions,
  weekChoices,
  weekKey,
  onWeekKeyChange,
  scopeLabel,
}: {
  cards: WeeklyProgressCard[]
  peopleOptions: string[]
  weekChoices: { key: string; label: string }[]
  weekKey: string
  onWeekKeyChange: (key: string) => void
  scopeLabel: string
}) {
  const [person, setPerson] = useState('')
  const [project, setProject] = useState('')
  const [query, setQuery] = useState('')

  const projectOptions = useMemo(() => {
    const s = new Set<string>()
    for (const c of cards) s.add(c.section)
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [cards])

  const filtered = useMemo(() => {
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

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600 dark:text-slate-300">
        One card per comment in the selected week. Includes{' '}
        <strong className="text-slate-800 dark:text-slate-100">
          ScrumTracker comments
        </strong>{' '}
        and{' '}
        <strong className="text-slate-800 dark:text-slate-100">
          Jira issue comments
        </strong>{' '}
        merged on sync, scoped to <span className="font-semibold">{scopeLabel}</span>.
        Run <strong>Jira sync</strong> for the newest remote comments. Admins are excluded
        from the people list; Jira activity on member-assigned items is attributed to the
        assignee when the commenter is not on the roster.
      </p>

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

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-10 text-center text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
          No updates match these filters for this week.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c, idx) => (
            <li
              key={c.id}
              className={`flex flex-col rounded-2xl border p-4 shadow-sm ${shellClass(idx)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">
                    {c.personName}
                  </p>
                  {c.authorRaw !== c.personName ? (
                    <p className="truncate text-[10px] text-slate-600 dark:text-slate-300">
                      Comment by {c.authorRaw}
                    </p>
                  ) : null}
                </div>
                <time
                  className="shrink-0 text-[10px] tabular-nums text-slate-600 dark:text-slate-300"
                  dateTime={c.dateKey}
                >
                  {c.dateLabel}
                </time>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200/80 dark:bg-slate-800/90 dark:text-slate-100 dark:ring-slate-600">
                  {c.section}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    c.source === 'jira'
                      ? 'bg-blue-100 text-blue-900 dark:bg-slate-700 dark:text-slate-100'
                      : 'bg-[#00B050]/15 text-[#0d5c2e] dark:bg-emerald-950/60 dark:text-emerald-200'
                  }`}
                >
                  {c.source === 'jira' ? 'Jira' : 'Tracker'}
                </span>
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
              <ul className="mt-2 space-y-1.5 border-t border-slate-200/70 pt-2 dark:border-slate-600/60">
                {c.bullets.map((line, i) => (
                  <li
                    key={`${c.id}-b-${i}`}
                    className="flex gap-2 text-sm leading-snug text-slate-800 dark:text-slate-100"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00B050] dark:bg-emerald-400" />
                    <span className="min-w-0 whitespace-pre-wrap break-words">
                      {line}
                    </span>
                  </li>
                ))}
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
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
