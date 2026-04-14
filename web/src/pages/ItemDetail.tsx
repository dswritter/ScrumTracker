import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { StatusBadge } from '../components/StatusBadge'
import { WorkItemTitleLink } from '../components/WorkItemTitleLink'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import { commentAuthorLabel } from '../lib/commentAuthor'
import { formatIsoDateTime } from '../lib/formatIso'
import {
  canAddComment,
  canDeleteComment,
  canEditWorkItem,
  canViewWorkItemDetail,
  isAdmin,
} from '../lib/permissions'
import { otherItemsSharingAssignees } from '../lib/stats'
import { useTrackerStore } from '../store/useTrackerStore'
import type { Sprint } from '../types'

function jiraHref(base: string, key: string): string {
  const b = base.trim().replace(/\/$/, '')
  if (!b) return '#'
  return `${b}/${key}`
}

function sprintLabel(sprints: Sprint[], id: string): string {
  const s = sprints.find((x) => x.id === id)
  return s ? `${s.emoji ?? ''} ${s.name}`.trim() : id
}

export function ItemDetail() {
  const user = useCurrentUser()
  const ctx = useTeamContextNullable()
  const addComment = useTrackerStore((s) => s.addComment)
  const deleteComment = useTrackerStore((s) => s.deleteComment)
  const rawParam = useParams<{ itemId: string }>().itemId ?? ''
  const itemId = useMemo(() => {
    try {
      return decodeURIComponent(rawParam)
    } catch {
      return rawParam
    }
  }, [rawParam])

  const [draft, setDraft] = useState('')

  const item = useMemo(
    () => ctx?.workItems.find((w) => w.id === itemId) ?? null,
    [ctx, itemId],
  )

  const sortedComments = useMemo(
    () =>
      item
        ? [...item.comments].sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt),
          )
        : [],
    [item],
  )

  const otherItems = useMemo(() => {
    if (!item || !ctx) return []
    return otherItemsSharingAssignees(item, ctx.workItems, ctx.sprints)
  }, [item, ctx])

  if (!user || !ctx) return null

  if (!item) {
    return (
      <div className="space-y-4">
        <p className="text-slate-600">
          No work item found for this link.{' '}
          <Link
            to="/items"
            className="font-semibold text-indigo-700 underline dark:text-slate-100 dark:hover:text-white"
          >
            Back to work items
          </Link>
        </p>
      </div>
    )
  }

  if (!canViewWorkItemDetail(user, item, ctx.workItems)) {
    return <Navigate to="/me" replace />
  }

  const readOnly = !canEditWorkItem(user, item)
  const canComment = !readOnly && canAddComment(user, item)
  const canRemoveComment = !readOnly && canDeleteComment(user)
  const teamId = ctx.teamId
  const { sprints, jiraBaseUrl } = ctx

  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/items"
          className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 dark:text-slate-100 dark:hover:text-white"
        >
          ← Work items
        </Link>
      </div>

      {readOnly ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200">
          <span className="font-semibold">View only</span> — you can read this
          item but not edit it or add comments.
        </p>
      ) : null}

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {item.title || '(untitled)'}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 gap-y-2">
          <StatusBadge status={item.status} />
          {item.section ? (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {item.section}
            </span>
          ) : null}
          {item.component ? (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {item.component}
            </span>
          ) : null}
          {item.eta ? (
            <span className="text-sm text-slate-600">
              ETA: <span className="font-medium text-slate-900">{item.eta}</span>
            </span>
          ) : null}
        </div>
      </div>

      <div
        className={`grid gap-4 ${isAdmin(user) ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}
      >
        {isAdmin(user) ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Assignees
            </h2>
            <p className="mt-2 text-sm text-slate-900 dark:text-slate-100">
              {item.assignees.length
                ? item.assignees.join(', ')
                : '—'}
            </p>
          </div>
        ) : null}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Sprints
          </h2>
          <p className="mt-2 text-sm text-slate-900 dark:text-slate-100">
            {item.sprintIds.length
              ? item.sprintIds.map((id) => sprintLabel(sprints, id)).join(', ')
              : '—'}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          JIRA
        </h2>
        {item.jiraNeedsSprintLabel ? (
          <p
            className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            title="Not on a Jira sprint that matches the active tracker sprint. Ask an admin to set the sprint in Jira, then re-sync."
          >
            Needs Jira sprint label — visible to admins for board cleanup.
          </p>
        ) : null}
        {item.jiraKeys.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">—</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {item.jiraKeys.map((k) => (
              <li key={k}>
                {jiraBaseUrl.trim() ? (
                  <a
                    href={jiraHref(jiraBaseUrl, k)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-md bg-indigo-50 px-2 py-1 text-sm font-semibold text-indigo-900 ring-1 ring-indigo-100 hover:underline dark:bg-slate-800 dark:text-sky-100 dark:ring-slate-600"
                  >
                    {k}
                  </a>
                ) : (
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {k}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Comments
        </h2>
        {sortedComments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No comments yet.</p>
        ) : (
          <ul className="mt-3 space-y-4 border-t border-slate-100 pt-4">
            {sortedComments.map((c) => (
              <li
                key={c.id}
                className="group relative text-sm pr-8"
              >
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {c.body}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {c.authorName} · {formatIsoDateTime(c.createdAt)}
                </p>
                {canRemoveComment ? (
                  <button
                    type="button"
                    className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded text-slate-400 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-700 group-hover:opacity-100"
                    title="Remove comment"
                    aria-label="Remove comment"
                    onClick={() => {
                      if (
                        confirm(
                          'Remove this comment? This cannot be undone.',
                        )
                      )
                        deleteComment(teamId, item.id, c.id)
                    }}
                  >
                    <span className="text-xl leading-none" aria-hidden>
                      ×
                    </span>
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canComment ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <label className="text-xs font-semibold text-slate-600">
              New comment as {commentAuthorLabel(user)}
            </label>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              rows={3}
              value={draft}
              placeholder="Write an update…"
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
                onClick={() => {
                  const t = draft.trim()
                  if (!t) return
                  addComment(teamId, item.id, commentAuthorLabel(user), t)
                  setDraft('')
                }}
              >
                Add comment
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {!readOnly && otherItems.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">
            Other items (shared assignees)
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Click a title to open that item. Hover shows comments when available
            (admins).
          </p>
          <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-600 dark:bg-slate-900/80">
            {otherItems.map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm"
              >
                <WorkItemTitleLink
                  item={w}
                  showCommentHover={isAdmin(user)}
                  className="min-w-0 flex-1 font-medium text-indigo-700 hover:text-indigo-900 dark:text-slate-100 dark:hover:text-white"
                />
                <StatusBadge status={w.status} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
