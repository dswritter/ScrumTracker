import { Link } from 'react-router-dom'
import type { TeamKnowledgePage } from '../types'

type Props = {
  query: string
  currentId: string
  matches: { page: TeamKnowledgePage; score: number }[]
  onDismiss: () => void
}

export function KnowledgeSearchMatchesPanel({
  query,
  currentId,
  matches,
  onDismiss,
}: Props) {
  if (matches.length <= 1) return null

  const q = encodeURIComponent(query)

  return (
    <aside
      className="mb-3 max-h-52 overflow-y-auto rounded-xl border border-emerald-200/80 bg-[#E8F5E9]/90 px-3 py-2 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/40"
      aria-label="Search matches"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-[#0d5c2e] dark:text-emerald-200">
          {matches.length} pages match “{query}”
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded px-1.5 text-xs font-semibold text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-800/60"
          aria-label="Clear search highlights"
        >
          ×
        </button>
      </div>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
        {matches.map(({ page }, i) => (
          <li
            key={page.id}
            className={
              page.id === currentId
                ? 'font-semibold text-[#007a3d] dark:text-emerald-300'
                : 'text-slate-700 dark:text-slate-200'
            }
          >
            <Link
              to={`/kb/${page.id}?q=${q}`}
              className="hover:underline"
            >
              {page.title}
            </Link>
            {i === 0 ? (
              <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">
                (best match)
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </aside>
  )
}
