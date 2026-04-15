import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { personProfilePath } from '../lib/personRoutes'
import type { TeamKnowledgePage, WorkComment } from '../types'

function formatFooterDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function PersonLink({ name }: { name: string }) {
  const n = name.trim()
  if (!n) return <>—</>
  return (
    <Link
      to={personProfilePath(n)}
      className="font-medium text-indigo-700 underline decoration-indigo-700/40 underline-offset-2 hover:text-indigo-900 dark:text-sky-300 dark:decoration-sky-300/40 dark:hover:text-sky-200"
    >
      {n}
    </Link>
  )
}

export function KnowledgePageAttribution({
  page,
  comments,
}: {
  page: TeamKnowledgePage
  comments: WorkComment[]
}) {
  const [contributorsOpen, setContributorsOpen] = useState(false)

  const owner = page.authorDisplayName.trim()
  const lastEditor = (
    page.lastEditedByDisplayName ?? page.authorDisplayName
  ).trim()

  const uniqueContributors = useMemo(() => {
    const fromComments = comments.map((c) => c.authorName.trim()).filter(Boolean)
    const set = new Set<string>([owner, lastEditor, ...fromComments])
    return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b))
  }, [owner, lastEditor, comments])

  const showContributorToggle = uniqueContributors.length > 1

  return (
    <div className="mt-3 text-right text-[10px] leading-snug text-slate-500 dark:text-slate-500">
      <p>
        Owner <PersonLink name={owner} />
        {' · '}
        Created {formatFooterDate(page.createdAt)}
        {' · '}
        Last edited {formatFooterDate(page.updatedAt)} by{' '}
        <PersonLink name={lastEditor} />
      </p>
      {showContributorToggle ? (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setContributorsOpen((o) => !o)}
            className="inline-flex items-center gap-0.5 rounded text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            aria-expanded={contributorsOpen}
            aria-controls="kb-page-contributors"
          >
            <i
              className={`fa-solid fa-chevron-down text-[9px] transition-transform ${contributorsOpen ? 'rotate-180' : ''}`}
              aria-hidden
            />
            <span>Contributors ({uniqueContributors.length})</span>
          </button>
          {contributorsOpen ? (
            <ul
              id="kb-page-contributors"
              className="mt-1 flex flex-col items-end gap-0.5 text-[10px]"
            >
              {uniqueContributors.map((name) => (
                <li key={name}>
                  <PersonLink name={name} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
