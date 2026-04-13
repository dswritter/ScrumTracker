import { useCallback, useState } from 'react'
import { useDismissOnEscape } from '../hooks/useDismissOnEscape'
import type { WorkItem } from '../types'

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function CommentsCell({
  item,
  canAdd,
  currentName,
  onAdd,
  canDeleteComment = false,
  onDeleteComment,
}: {
  item: WorkItem
  canAdd: boolean
  currentName: string
  onAdd: (body: string) => void
  /** Admin: show hover ✕ to remove one comment */
  canDeleteComment?: boolean
  onDeleteComment?: (commentId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const comments = item.comments
  const close = useCallback(() => setOpen(false), [])
  useDismissOnEscape(open, close)

  const preview = comments.slice(-2).reverse()

  return (
    <div className="group relative w-44">
      <button
        type="button"
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-[11px] text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={() => setOpen(true)}
      >
        <span className="font-semibold text-slate-800">
          {comments.length} comment{comments.length === 1 ? '' : 's'}
        </span>
        {preview.length > 0 ? (
          <ul className="mt-1 line-clamp-2 list-disc pl-3 text-[10px] text-slate-500">
            {preview.map((c) => (
              <li key={c.id} className="truncate">
                {c.body}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-0.5 text-[10px] text-slate-400">
            Hover preview · click to add
          </p>
        )}
      </button>
      {comments.length > 0 ? (
        <div className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-72 max-w-[85vw] rounded-lg border border-slate-200 bg-white p-2 text-[10px] text-slate-700 shadow-lg group-hover:block dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
          <p className="mb-1 font-bold uppercase tracking-wide text-slate-500">
            Recent
          </p>
          <ul className="max-h-28 space-y-1.5 overflow-y-auto">
            {comments.slice(-5).map((c) => (
              <li
                key={c.id}
                className="list-inside list-disc marker:text-indigo-500 dark:marker:text-sky-300"
              >
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {c.body}
                </span>
                <span className="mt-0.5 block pl-3 text-slate-500">
                  {c.authorName} · {formatDate(c.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Comments"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close()
          }}
        >
          <div
            className="max-h-[min(85vh,560px)] w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Comments
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {canDeleteComment
                  ? 'Admins can remove individual comments. Add updates below.'
                  : 'Add updates below.'}
              </p>
            </div>
            <ul className="max-h-64 space-y-2 overflow-y-auto px-4 py-3 text-sm">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className="group relative list-inside list-disc pr-7 text-slate-800 marker:text-indigo-500 dark:text-slate-100 dark:marker:text-sky-300"
                >
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {c.body}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {c.authorName} · {formatDate(c.createdAt)}
                  </span>
                  {canDeleteComment && onDeleteComment ? (
                    <button
                      type="button"
                      className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center rounded text-slate-400 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-700 group-hover:opacity-100"
                      title="Remove comment"
                      aria-label="Remove comment"
                      onClick={() => {
                        if (
                          confirm(
                            'Remove this comment? This cannot be undone.',
                          )
                        )
                          onDeleteComment(c.id)
                      }}
                    >
                      <span className="text-lg leading-none" aria-hidden>
                        ×
                      </span>
                    </button>
                  ) : null}
                </li>
              ))}
              {comments.length === 0 ? (
                <li className="list-none text-slate-500">No comments yet.</li>
              ) : null}
            </ul>
            {canAdd ? (
              <div className="border-t border-slate-100 px-4 py-3">
                <label className="text-xs font-semibold text-slate-600">
                  New comment as {currentName}
                </label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  rows={3}
                  value={draft}
                  placeholder="Write an update…"
                  onChange={(e) => setDraft(e.target.value)}
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    onClick={close}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
                    onClick={() => {
                      const t = draft.trim()
                      if (!t) return
                      onAdd(t)
                      setDraft('')
                    }}
                  >
                    Add comment
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-slate-100 px-4 py-3 text-right">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  onClick={close}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
