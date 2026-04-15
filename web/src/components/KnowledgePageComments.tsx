import { useState } from 'react'
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
                {c.authorName} · {formatTinyDate(c.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Ask a question or leave a note for the team.
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2">
        <label htmlFor="kb-page-comment-draft" className="sr-only">
          Add a comment
        </label>
        <textarea
          id="kb-page-comment-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Ask about this page…"
          className="w-full resize-y rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-[#00B050] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#009948] disabled:opacity-40"
            disabled={!draft.trim()}
          >
            Post
          </button>
        </div>
      </form>
    </section>
  )
}
