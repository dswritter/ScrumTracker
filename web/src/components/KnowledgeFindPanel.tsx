import { Link } from 'react-router-dom'
import type { TeamKnowledgePage } from '../types'

type Props = {
  query: string
  suggestions: { page: TeamKnowledgePage; score: number }[]
  onContribute: () => void
  onDismiss: () => void
}

function LostExplorerIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <ellipse cx="100" cy="148" rx="72" ry="8" fill="currentColor" opacity="0.12" />
      <path
        d="M52 118c8-28 22-48 40-58 6-18 22-30 40-30 20 0 36 14 40 34 10 8 18 22 22 40"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.35"
      />
      <circle cx="72" cy="52" r="5" fill="currentColor" opacity="0.45" />
      <circle cx="128" cy="44" r="4" fill="currentColor" opacity="0.35" />
      <circle
        cx="100"
        cy="58"
        r="20"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.45"
      />
      <path
        d="M100 78v28M78 124l22-18 22 18M92 96l-12-10M108 96l12-10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.45"
      />
      <circle cx="94" cy="54" r="2.5" fill="currentColor" opacity="0.55" />
      <circle cx="106" cy="54" r="2.5" fill="currentColor" opacity="0.55" />
      <path
        d="M100 28l4-8 6 6M118 34l8-2-2 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
      />
      <rect
        x="118"
        y="86"
        width="28"
        height="20"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.35"
      />
      <path d="M124 92h16M124 98h10" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
    </svg>
  )
}

export function KnowledgeFindPanel({
  query,
  suggestions,
  onContribute,
  onDismiss,
}: Props) {
  const hasSuggestions = suggestions.length > 0

  return (
    <section
      className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30"
      aria-label="Knowledge search results"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-amber-950 dark:text-amber-100">
          No exact match for “{query}”.
          {hasSuggestions
            ? ' Here are the closest pages:'
            : ' Nothing close turned up in your team knowledge.'}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold text-amber-900/80 hover:bg-amber-200/50 dark:text-amber-200 dark:hover:bg-amber-900/40"
          aria-label="Dismiss search notice"
        >
          ×
        </button>
      </div>
      {hasSuggestions ? (
        <ul className="mt-2 space-y-1">
          {suggestions.map(({ page }) => (
            <li key={page.id}>
              <Link
                to={`/kb/${page.id}`}
                className="font-medium text-[#007a3d] underline-offset-2 hover:underline dark:text-emerald-300"
              >
                {page.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 flex flex-col items-center text-center text-amber-950/80 dark:text-amber-100/85">
          <LostExplorerIllustration className="mb-3 h-28 w-36 text-amber-800 dark:text-amber-200" />
          <p className="max-w-sm text-xs leading-relaxed">
            Like an explorer off the map—try different words, or start a new page for the team.
          </p>
          <button
            type="button"
            onClick={onContribute}
            className="mt-4 rounded-lg bg-[#00B050] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#009948]"
          >
            Contribute a page
          </button>
        </div>
      )}
    </section>
  )
}
