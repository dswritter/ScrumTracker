import { useState } from 'react'
import { Link } from 'react-router-dom'
import { personProfilePath } from '../lib/personRoutes'
import { useTrackerStore } from '../store/useTrackerStore'
import type { WorkComment } from '../types'

function formatTinyDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function KnowledgePageComments({
  teamId,
  pageId,
  comments,
  currentDisplayName,
}: {
  teamId: string
  pageId: string
  comments: WorkComment[]
  currentDisplayName: string
}) {
  const addKnowledgePageComment = useTrackerStore(
    (s) => s.addKnowledgePageComment,
  )
  const [draft, setDraft] = useState('')

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const t = draft.trim()
    if (!t) return
    addKnowledgePageComment(teamId, pageId, currentDisplayName, t)
    setDraft('')
  }

  return (
    <section aria-labelledby="kb-page-comments-heading">
      <h3
        id="kb-page-comments-heading"
        className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"
      >
        Questions & comments
      </h3>
      {comments.length > 0 ? (
        <ul className="mt-2 space-y-2.5">
          {comments.map((c) => (
            <li
              key={c.id}
              className="text-sm text-slate-800 dark:text-slate-200"
            >
              <p className="whitespace-pre-wrap break-words">{c.body}</p>
                           <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-500">
                {c.authorName.trim() ? (
                  <Link
                    to={personProfilePath(c.authorName)}
                    className="font-medium text-indigo-700 underline decoration-indigo-700/40 underline-offset-2 hover:text-indigo-900 dark:text-sky-300 dark:decoration-sky-300/40 dark:hover:text-sky-200"
                  >
                    {c.authorName.trim()}
                  </Link>
                ) : (
                  <span>Unknown</span>
                )}
                {' · '}
                {formatTinyDate(c.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Ask a question or leave a note for the team.
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-3">
        <label htmlFor="kb-page-comment-draft" className="sr-only">
          Add a comment
        </label>
        <div className="flex items-end overflow-hidden rounded-lg border border-slate-200 bg-white/80 dark:border-slate-600 dark:bg-slate-900/50">
          <textarea
            id="kb-page-comment-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={1}
            placeholder="Ask about this page…"
            className="min-h-[2.5rem] min-w-0 flex-1 resize-y border-0 bg-transparent px-3 py-2 text-sm leading-snug text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <div className="flex shrink-0 border-l border-slate-200 dark:border-slate-600">
            <button
              type="submit"
              className="flex min-h-[2.5rem] min-w-[4.25rem] items-center justify-center self-end bg-[#00B050] px-3 py-2 text-xs font-bold text-white hover:bg-[#009948] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#00B050] dark:hover:bg-[#009948]"
              disabled={!draft.trim()}
            >
              Post
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
