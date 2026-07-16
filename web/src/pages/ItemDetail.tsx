import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { CommentJiraPostOptions } from '../components/CommentJiraPostOptions'
import { JiraPerItemIssueActions } from '../components/JiraPerItemIssueActions'
import {
  EditWorkCommentDialog,
  PushExistingCommentToJiraDialog,
} from '../components/WorkCommentActionDialogs'
import { WorkCommentRow } from '../components/WorkCommentRow'
import { StatusBadge } from '../components/StatusBadge'
import { WorkItemTitleLink } from '../components/WorkItemTitleLink'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import { commentAuthorLabel } from '../lib/commentAuthor'
import {
  canAddComment,
  canDeleteComment,
  canEditWorkItem,
  canViewWorkItemDetail,
  isAdmin,
} from '../lib/permissions'
import { isPrivateWorkItem } from '../lib/workItemPrivacy'
import { otherItemsSharingAssignees } from '../lib/stats'
import { dedupeWorkCommentsForDisplay } from '../lib/dedupeWorkComments'
import { postTrackerCommentToJiraIfRequested } from '../lib/submitCommentToJira'
import { isTrackerSyncEnabled } from '../lib/syncConfigured'
import { workStatusLabel } from '../lib/weeklyProgress'
import { useTrackerStore } from '../store/useTrackerStore'
import type { Sprint, WorkComment, WorkStatus } from '../types'

const WORK_STATUSES: WorkStatus[] = [
  'todo',
  'in_progress',
  'to_test',
  'to_track',
  'ready_for_prod',
  'blocked',
  'done',
]

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
  const retagCommentWithJiraId = useTrackerStore((s) => s.retagCommentWithJiraId)
  const deleteComment = useTrackerStore((s) => s.deleteComment)
  const editComment = useTrackerStore((s) => s.editComment)
  const updateWorkItem = useTrackerStore((s) => s.updateWorkItem)
  const rawParam = useParams<{ itemId: string }>().itemId ?? ''
  const itemId = useMemo(() => {
    try {
      return decodeURIComponent(rawParam)
    } catch {
      return rawParam
    }
  }, [rawParam])

  const [draft, setDraft] = useState('')
  const [alsoToJira, setAlsoToJira] = useState(false)
  const [selectedIssueKey, setSelectedIssueKey] = useState('')
  const [pushJiraComment, setPushJiraComment] = useState<WorkComment | null>(null)
  const [editingComment, setEditingComment] = useState<WorkComment | null>(null)

  const item = useMemo(
    () => ctx?.workItems?.find((w) => w.id === itemId) ?? null,
    [ctx, itemId],
  )

  const jiraKeysTrim = useMemo(
    () =>
      (item?.jiraKeys ?? [])
        .map((k) => String(k).trim())
        .filter(Boolean),
    [item],
  )

  useEffect(() => {
    setAlsoToJira(false)
    setSelectedIssueKey(jiraKeysTrim[0] ?? '')
  }, [item?.id, jiraKeysTrim])

  const syncJira = isTrackerSyncEnabled()

  const sortedComments = useMemo(() => {
    if (!item) return []
    const deduped = dedupeWorkCommentsForDisplay(item.comments)
    return [...deduped].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )
  }, [item])

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
  const canRemoveComment = !readOnly && canDeleteComment(user, item)
  const canPromotePrivate =
    isPrivateWorkItem(item) && user.id === item.privateOwnerUserId
  const canStripJiraKey =
    isAdmin(user) ||
    (isPrivateWorkItem(item) && user.id === item.privateOwnerUserId)
  const teamId = ctx.teamId
  const { sprints, jiraBaseUrl } = ctx

  const submitComment = () => {
    const t = draft.trim()
    if (!t || !user) return
    const newId = addComment(teamId, item.id, commentAuthorLabel(user), t)
    setDraft('')
    if (!newId) return
    const issueKey =
      jiraKeysTrim.length === 1 ? jiraKeysTrim[0] : selectedIssueKey.trim()
    void postTrackerCommentToJiraIfRequested({
      newCommentId: newId,
      bodyPlain: t,
      alsoToJira: syncJira && jiraKeysTrim.length > 0 && alsoToJira,
      issueKey,
      teamId,
      itemId: item.id,
      user,
      retagCommentWithJiraId,
    })
  }

  return (
    <div className="space-y-8 pb-16">
      {readOnly ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200">
          <span className="font-semibold">View only</span> — you can read this
          item but not edit it or add comments.
        </p>
      ) : null}

      {isPrivateWorkItem(item) ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <span className="font-semibold">Private</span> — only you can see this
          work item. It is not visible to admins or teammates until you publish it.
          {canPromotePrivate ? (
            <span className="mt-2 block">
              <button
                type="button"
                className="font-semibold text-indigo-800 underline hover:text-indigo-950 dark:text-indigo-300 dark:hover:text-indigo-200"
                onClick={() => {
                  if (
                    confirm(
                      'Make this visible to everyone on the team? You cannot make it private again.',
                    )
                  ) {
                    updateWorkItem(teamId, item.id, {
                      isPrivate: false,
                      privateOwnerUserId: undefined,
                    })
                  }
                }}
              >
                Make visible to team
              </button>
            </span>
          ) : null}
        </div>
      ) : null}

      <div>
        <div className="flex flex-wrap items-center gap-2">
          {isPrivateWorkItem(item) ? (
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase text-amber-950 dark:bg-amber-950/60 dark:text-amber-100">
              Private
            </span>
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {item.title || '(untitled)'}
          </h1>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 gap-y-2">
          {!readOnly && canEditWorkItem(user, item) && item.jiraKeys.length === 0 ? (
            <label className="inline-flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Status
              </span>
              <select
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                value={item.status}
                onChange={(e) =>
                  updateWorkItem(teamId, item.id, {
                    status: e.target.value as WorkStatus,
                  })
                }
              >
                {WORK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {workStatusLabel(s)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <StatusBadge status={item.status} />
          )}
          {item.jiraKeys.length > 0 ? (
            <span
              className="text-[10px] text-slate-400 dark:text-slate-500"
              title="Status follows the linked Jira issue and updates on sync (e.g. auto-closes when Jira is closed)."
            >
              (status from Jira)
            </span>
          ) : null}
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

      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          {isAdmin(user) ? (
            <div className="flex min-w-0 max-w-[min(100%,15rem)] items-baseline gap-2">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Assignees
              </span>
              <span
                className="min-w-0 truncate text-xs font-medium text-slate-900 dark:text-slate-100"
                title={
                  item.assignees.length ? item.assignees.join(', ') : undefined
                }
              >
                {item.assignees.length ? item.assignees.join(', ') : '—'}
              </span>
            </div>
          ) : null}
          <div className="flex min-w-0 flex-1 items-baseline gap-2 sm:min-w-[10rem]">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Sprints
            </span>
            <span className="min-w-0 text-xs font-medium text-slate-900 dark:text-slate-100">
              {item.sprintIds.length
                ? item.sprintIds.map((id) => sprintLabel(sprints, id)).join(', ')
                : '—'}
            </span>
          </div>
          <div className="flex min-w-0 flex-[2] flex-wrap items-center gap-x-2 gap-y-1">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Jira
            </span>
            {item.jiraNeedsSprintLabel ? (
              <span
                className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
                title="Not on a Jira sprint that matches the active tracker sprint. Ask an admin to set the sprint in Jira, then re-sync."
              >
                Needs sprint
              </span>
            ) : null}
            {item.jiraKeys.length === 0 ? (
              <span className="text-xs text-slate-500">—</span>
            ) : (
              <span className="flex flex-wrap items-center gap-1.5">
                {item.jiraKeys.map((k) => (
                  <span
                    key={k}
                    className="group relative inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-900 ring-1 ring-indigo-100 dark:bg-slate-800 dark:text-sky-100 dark:ring-slate-600"
                  >
                    {jiraBaseUrl.trim() ? (
                      <a
                        href={jiraHref(jiraBaseUrl, k)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {k}
                      </a>
                    ) : (
                      k
                    )}
                    {canStripJiraKey ? (
                      <button
                        type="button"
                        title="Remove Jira link"
                        className="absolute -right-1 -top-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-rose-600"
                        onClick={() =>
                          updateWorkItem(teamId, item.id, {
                            jiraKeys: item.jiraKeys.filter((x) => x !== k),
                          })
                        }
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                ))}
              </span>
            )}
            {!readOnly && canEditWorkItem(user, item) ? (
              <JiraPerItemIssueActions
                item={item}
                user={user}
                teamId={teamId}
                workItems={ctx.workItems}
                sprints={sprints}
              />
            ) : null}
          </div>
        </div>
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
              <WorkCommentRow
                key={c.id}
                comment={c}
                item={item}
                user={user}
                jiraBaseUrl={jiraBaseUrl}
                onPushJira={
                  canComment ? (cc) => setPushJiraComment(cc) : undefined
                }
                onEdit={
                  canComment ? (cc) => setEditingComment(cc) : undefined
                }
                onDelete={
                  canRemoveComment
                    ? (cid) => deleteComment(teamId, item.id, cid)
                    : undefined
                }
              />
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
              placeholder="Write an update… (Shift+Enter to post)"
              onChange={(e) => {
                const v = e.target.value
                setDraft(v)
                if (!v.trim()) setAlsoToJira(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.shiftKey) {
                  e.preventDefault()
                  submitComment()
                }
              }}
            />
            {syncJira && jiraKeysTrim.length > 0 && draft.trim().length > 0 ? (
              <CommentJiraPostOptions
                jiraKeys={jiraKeysTrim}
                alsoToJira={alsoToJira}
                onAlsoToJiraChange={setAlsoToJira}
                selectedIssueKey={selectedIssueKey}
                onSelectedIssueKeyChange={setSelectedIssueKey}
              />
            ) : null}
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
                onClick={submitComment}
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
                  jiraBaseUrl={jiraBaseUrl}
                  showCommentHover={isAdmin(user)}
                  className="min-w-0 flex-1 font-medium text-indigo-700 hover:text-indigo-900 dark:text-slate-100 dark:hover:text-white"
                />
                <StatusBadge status={w.status} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <PushExistingCommentToJiraDialog
        open={pushJiraComment !== null}
        onClose={() => setPushJiraComment(null)}
        comment={pushJiraComment}
        item={item}
        teamId={teamId}
        user={user}
        retagCommentWithJiraId={retagCommentWithJiraId}
      />
      <EditWorkCommentDialog
        open={editingComment !== null}
        onClose={() => setEditingComment(null)}
        comment={editingComment}
        item={item}
        teamId={teamId}
        user={user}
        editComment={editComment}
      />
    </div>
  )
}
