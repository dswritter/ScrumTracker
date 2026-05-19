import { useEffect, useMemo, useState } from 'react'
import {
  pushExistingTrackerCommentToJira,
  updateJiraWorkItemCommentBody,
} from '../lib/submitCommentToJira'
import {
  jiraNumericIdFromCommentId,
  resolveIssueKeyForJiraComment,
} from '../lib/resolveJiraCommentIssueKey'
import type { TrackerUserAccount, WorkComment, WorkItem } from '../types'

export function PushExistingCommentToJiraDialog({
  open,
  onClose,
  comment,
  item,
  teamId,
  user,
  retagCommentWithJiraId,
}: {
  open: boolean
  onClose: () => void
  comment: WorkComment | null
  item: WorkItem
  teamId: string
  user: TrackerUserAccount
  retagCommentWithJiraId: (
    teamId: string,
    itemId: string,
    localCommentId: string,
    jiraCommentId: string,
    jiraIssueKey?: string,
  ) => void
}) {
  const keys = useMemo(
    () => item.jiraKeys.map((k) => String(k).trim()).filter(Boolean),
    [item.jiraKeys],
  )
  const [selectedIssueKey, setSelectedIssueKey] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !comment) return
    const fromComment =
      typeof comment.jiraIssueKey === 'string' && comment.jiraIssueKey.trim()
        ? comment.jiraIssueKey.trim()
        : ''
    setSelectedIssueKey(fromComment || keys[0] || '')
  }, [open, comment?.id, keys.join('|')])

  if (!open || !comment) return null

  const issueKey = resolveIssueKeyForJiraComment(
    comment,
    item,
    selectedIssueKey,
  )

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Post comment to Jira"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Post comment to Jira
        </h4>
        <p className="mt-2 line-clamp-4 rounded border border-slate-100 bg-slate-50 p-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          {comment.body}
        </p>
        {keys.length === 0 ? (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
            This work item has no linked Jira issues. Add a Jira key on the item
            first.
          </p>
        ) : keys.length > 1 &&
          !(
            typeof comment.jiraIssueKey === 'string' &&
            comment.jiraIssueKey.trim()
          ) ? (
          <fieldset className="mt-3 space-y-2 text-sm">
            <legend className="font-semibold text-slate-800 dark:text-slate-100">
              Which issue?
            </legend>
            {keys.map((k) => (
              <label
                key={k}
                className="flex cursor-pointer items-center gap-2 text-slate-700 dark:text-slate-200"
              >
                <input
                  type="radio"
                  name="push-comment-jira-issue"
                  value={k}
                  checked={selectedIssueKey === k}
                  onChange={() => setSelectedIssueKey(k)}
                />
                <span className="font-mono text-xs">{k}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
            Will post to{' '}
            <span className="font-mono font-semibold">
              {issueKey ?? keys[0]}
            </span>
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={busy || keys.length === 0 || !issueKey}
            onClick={async () => {
              if (!issueKey) return
              setBusy(true)
              try {
                await pushExistingTrackerCommentToJira({
                  teamId,
                  itemId: item.id,
                  localCommentId: comment.id,
                  bodyPlain: comment.body,
                  issueKey,
                  user,
                  retagCommentWithJiraId,
                })
                onClose()
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Posting…' : 'Post to Jira'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function EditWorkCommentDialog({
  open,
  onClose,
  comment,
  item,
  teamId,
  user,
  editComment,
}: {
  open: boolean
  onClose: () => void
  comment: WorkComment | null
  item: WorkItem
  teamId: string
  user: TrackerUserAccount
  editComment: (
    teamId: string,
    itemId: string,
    commentId: string,
    newBody: string,
  ) => void
}) {
  const keys = useMemo(
    () => item.jiraKeys.map((k) => String(k).trim()).filter(Boolean),
    [item.jiraKeys],
  )
  const [body, setBody] = useState('')
  const [syncToJira, setSyncToJira] = useState(false)
  const [pickedKey, setPickedKey] = useState('')
  const [busy, setBusy] = useState(false)

  const isJiraMirror = Boolean(comment?.id.startsWith('jira-cmt-'))

  useEffect(() => {
    if (!open || !comment) return
    setBody(comment.body)
    setSyncToJira(false)
    const fromComment =
      typeof comment.jiraIssueKey === 'string' && comment.jiraIssueKey.trim()
        ? comment.jiraIssueKey.trim()
        : ''
    setPickedKey(fromComment || keys[0] || '')
  }, [open, comment?.id, comment?.body, keys.join('|')])

  if (!open || !comment) return null

  const needsKeyPick =
    isJiraMirror &&
    syncToJira &&
    keys.length > 1 &&
    !(
      typeof comment.jiraIssueKey === 'string' && comment.jiraIssueKey.trim()
    )

  const issueKeyForSync = resolveIssueKeyForJiraComment(
    comment,
    item,
    pickedKey,
  )

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Edit comment"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Edit comment
        </h4>
        <textarea
          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {isJiraMirror ? (
          <div className="mt-3 space-y-2 rounded-lg border border-slate-100 bg-slate-50/90 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/60">
            <label className="flex cursor-pointer items-start gap-2 text-slate-800 dark:text-slate-100">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={syncToJira}
                onChange={(e) => setSyncToJira(e.target.checked)}
              />
              <span>
                <span className="font-semibold">Sync edit to Jira</span>
                <span className="mt-0.5 block text-slate-500 dark:text-slate-400">
                  If unchecked, only the tracker is updated; Jira keeps the
                  previous text until the next sync.
                </span>
              </span>
            </label>
            {needsKeyPick ? (
              <fieldset className="space-y-1.5 border-t border-slate-200 pt-2 dark:border-slate-600">
                <legend className="font-semibold text-slate-800 dark:text-slate-100">
                  Which linked issue hosts this comment?
                </legend>
                {keys.map((k) => (
                  <label
                    key={k}
                    className="flex cursor-pointer items-center gap-2 text-slate-700 dark:text-slate-200"
                  >
                    <input
                      type="radio"
                      name="edit-comment-jira-issue"
                      value={k}
                      checked={pickedKey === k}
                      onChange={() => setPickedKey(k)}
                    />
                    <span className="font-mono text-[11px]">{k}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            This comment exists only in the tracker. Edits stay local unless you
            post the comment to Jira from the comment row.
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={busy || !body.trim()}
            onClick={async () => {
              const t = body.trim()
              if (!t) return
              setBusy(true)
              try {
                editComment(teamId, item.id, comment.id, t)
                if (isJiraMirror && syncToJira) {
                  const jid = jiraNumericIdFromCommentId(comment.id)
                  const ik = issueKeyForSync
                  if (!jid || !ik) {
                    window.alert(
                      !ik
                        ? 'Choose which Jira issue to update.'
                        : 'Could not determine Jira comment id.',
                    )
                    return
                  }
                  const r = await updateJiraWorkItemCommentBody({
                    teamId,
                    issueKey: ik,
                    jiraCommentNumericId: jid,
                    bodyPlain: t,
                    user,
                  })
                  if (!r.ok) {
                    window.alert(
                      `Tracker was updated but Jira sync failed: ${r.message.slice(0, 400)}`,
                    )
                  }
                }
                onClose()
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
