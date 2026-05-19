import { WorkCommentBody } from './WorkCommentBody'
import { formatIsoDateTime } from '../lib/formatIso'
import {
  canDeleteComment,
  canEditOwnWorkComment,
} from '../lib/permissions'
import { isTrackerSyncEnabled } from '../lib/syncConfigured'
import type { TrackerUserAccount, WorkComment, WorkItem } from '../types'

export function WorkCommentRow({
  comment,
  item,
  user,
  jiraBaseUrl,
  onPushJira,
  onEdit,
  onDelete,
}: {
  comment: WorkComment
  item: WorkItem
  user: TrackerUserAccount | null
  jiraBaseUrl: string
  onPushJira?: (c: WorkComment) => void
  onEdit?: (c: WorkComment) => void
  onDelete?: (cid: string) => void
}) {
  const sync = isTrackerSyncEnabled()
  const keys = item.jiraKeys.map((k) => String(k).trim()).filter(Boolean)
  const showPush =
    Boolean(sync && keys.length && onPushJira) &&
    !comment.id.startsWith('jira-cmt-')
  const canDel = canDeleteComment(user, item) && Boolean(onDelete)
  const canEd = Boolean(onEdit && canEditOwnWorkComment(user, item, comment))

  return (
    <li className="group relative text-sm pr-24">
      <div className="pointer-events-none absolute right-0 top-0 flex gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        {showPush ? (
          <button
            type="button"
            title="Post this comment to Jira"
            aria-label="Post this comment to Jira"
            className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-indigo-700 shadow-sm hover:bg-indigo-50 dark:border-slate-600 dark:bg-slate-800 dark:text-indigo-300 dark:hover:bg-slate-700"
            onClick={() => onPushJira?.(comment)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M10 2.5a.75.75 0 0 1 .75.75v7.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V3.25A.75.75 0 0 1 10 2.5Z"
                clipRule="evenodd"
              />
              <path d="M4.75 12.5a.75.75 0 0 0-1.5 0v2.75c0 .69.56 1.25 1.25 1.25h11a1.25 1.25 0 0 0 1.25-1.25v-2.75a.75.75 0 0 0-1.5 0v2a.25.25 0 0 1-.25.25h-11a.25.25 0 0 1-.25-.25v-2Z" />
            </svg>
          </button>
        ) : null}
        {canEd ? (
          <button
            type="button"
            title="Edit comment"
            aria-label="Edit comment"
            className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={() => onEdit?.(comment)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
              aria-hidden
            >
              <path d="M2.695 14.295a1.05 1.05 0 0 0 0 1.485l1.525 1.525a1.05 1.05 0 0 0 1.485 0l8.4-8.4-3.01-3.01-8.4 8.4ZM14.305 2.685l2.01 2.01c.41.41.41 1.075 0 1.485l-1.075 1.075-3.01-3.01 1.075-1.075c.41-.41 1.075-.41 1.485 0Z" />
            </svg>
          </button>
        ) : null}
        {canDel ? (
          <button
            type="button"
            className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-700"
            title="Remove comment"
            aria-label="Remove comment"
            onClick={() => {
              if (
                confirm('Remove this comment? This cannot be undone.') &&
                onDelete
              )
                onDelete(comment.id)
            }}
          >
            <span className="text-xl leading-none" aria-hidden>
              ×
            </span>
          </button>
        ) : null}
      </div>
      <p className="font-medium text-slate-900 dark:text-slate-100">
        <WorkCommentBody comment={comment} jiraBaseUrl={jiraBaseUrl} />
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {comment.authorName} · {formatIsoDateTime(comment.createdAt)}
        {comment.editedAt ? (
          <span className="ml-1 text-slate-400">
            · edited {formatIsoDateTime(comment.editedAt)}
          </span>
        ) : null}
      </p>
    </li>
  )
}
