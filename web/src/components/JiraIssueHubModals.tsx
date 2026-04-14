import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDismissOnEscape } from '../hooks/useDismissOnEscape'
import { getCurrentSprint, sprintsSortedNewestFirst } from '../lib/sdates'
import {
  fetchJiraIssueTypesForProject,
  fetchJiraLookupIssue,
  fetchJiraProjectsForTeam,
  postJiraCreateIssue,
} from '../lib/jiraApi'
import { canAddWorkItem, canEditWorkItem } from '../lib/permissions'
import type { Sprint, TrackerUserAccount, WorkItem } from '../types'

const field =
  'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'

export function mergeJiraKeysList(existing: string[], add: string): string[] {
  const u = add.trim().toUpperCase()
  if (!u) return existing
  if (existing.some((k) => k.toUpperCase() === u)) return [...existing]
  return [...existing, u]
}

export type JiraHubSyncContext = {
  teamId: string
  syncMode: 'admin' | 'individual'
  trackerUsername?: string
}

export function JiraCreateIssueModal({
  open,
  onClose,
  syncCtx,
  user,
  workItems,
  sprints,
  onApplyNewItem,
  onApplyLink,
  contextItemId = null,
}: {
  open: boolean
  onClose: () => void
  syncCtx: JiraHubSyncContext
  user: TrackerUserAccount
  workItems: WorkItem[]
  sprints: Sprint[]
  onApplyNewItem: (partial: Partial<WorkItem>) => void
  onApplyLink: (itemId: string, jiraKey: string) => void
  /** When set, defaults to linking the new issue to this work item. */
  contextItemId?: string | null
}) {
  const close = useCallback(() => onClose(), [onClose])
  useDismissOnEscape(open, close)

  const sortedSprints = useMemo(() => sprintsSortedNewestFirst(sprints), [sprints])
  const defaultSprintIds = useMemo(() => {
    const cur = getCurrentSprint(sortedSprints)
    return cur ? [cur.id] : []
  }, [sortedSprints])

  const editableItems = useMemo(
    () =>
      [...workItems]
        .filter((w) => canEditWorkItem(user, w))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [workItems, user],
  )

  const canNew = canAddWorkItem(user)

  const [target, setTarget] = useState<'new' | 'existing'>('new')
  const [existingId, setExistingId] = useState('')
  const [projects, setProjects] = useState<{ key: string; name: string }[]>([])
  const [issueTypes, setIssueTypes] = useState<{ id: string; name: string }[]>([])
  const [projectKey, setProjectKey] = useState('')
  const [issueTypeName, setIssueTypeName] = useState('')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingTypes, setLoadingTypes] = useState(false)
  const [metaErr, setMetaErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setMetaErr(null)
    setFormErr(null)
    setSummary('')
    setDescription('')
    setTarget(canNew ? 'new' : 'existing')
    setProjectKey('')
    setIssueTypeName('')
    setIssueTypes([])
    let cancelled = false
    ;(async () => {
      setLoadingProjects(true)
      const r = await fetchJiraProjectsForTeam(syncCtx)
      setLoadingProjects(false)
      if (cancelled) return
      if (!r.ok) {
        setMetaErr(r.message)
        setProjects([])
        return
      }
      setProjects(r.projects)
      if (r.projects[0]) setProjectKey(r.projects[0].key)
    })()
    return () => {
      cancelled = true
    }
  }, [open, syncCtx.teamId, syncCtx.syncMode, syncCtx.trackerUsername, canNew])

  useEffect(() => {
    if (!open) return
    if (
      contextItemId &&
      editableItems.some((w) => w.id === contextItemId)
    ) {
      setTarget('existing')
      setExistingId(contextItemId)
    } else {
      setTarget(canNew ? 'new' : 'existing')
      setExistingId(editableItems[0]?.id ?? '')
    }
  }, [open, contextItemId, editableItems, canNew])

  useEffect(() => {
    if (!open || !projectKey) {
      setIssueTypes([])
      setIssueTypeName('')
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadingTypes(true)
      setMetaErr(null)
      const r = await fetchJiraIssueTypesForProject({
        teamId: syncCtx.teamId,
        projectKey,
        syncMode: syncCtx.syncMode,
        trackerUsername: syncCtx.trackerUsername,
      })
      setLoadingTypes(false)
      if (cancelled) return
      if (!r.ok) {
        setMetaErr(r.message)
        setIssueTypes([])
        setIssueTypeName('')
        return
      }
      setIssueTypes(r.issueTypes)
      if (r.issueTypes[0]) setIssueTypeName(r.issueTypes[0].name)
      else setIssueTypeName('')
    })()
    return () => {
      cancelled = true
    }
  }, [open, projectKey, syncCtx.teamId, syncCtx.syncMode, syncCtx.trackerUsername])

  useEffect(() => {
    if (!canNew && target === 'new') setTarget('existing')
  }, [canNew, target])

  const submit = async () => {
    const sum = summary.trim()
    if (!sum) {
      setFormErr('Summary is required.')
      return
    }
    if (!projectKey || !issueTypeName) {
      setFormErr('Choose a project and issue type.')
      return
    }
    if (target === 'existing' && !existingId) {
      setFormErr('Choose a work item to link.')
      return
    }
    setFormErr(null)
    setBusy(true)
    try {
      const res = await postJiraCreateIssue({
        teamId: syncCtx.teamId,
        projectKey,
        issueType: issueTypeName,
        summary: sum,
        description: description.trim() || undefined,
        syncMode: syncCtx.syncMode,
        trackerUsername: syncCtx.trackerUsername,
      })
      if (!res.ok) {
        setFormErr(await res.text())
        return
      }
      const data = (await res.json()) as { key?: string }
      const key = typeof data.key === 'string' ? data.key : ''
      if (!key) {
        setFormErr('No issue key in response.')
        return
      }
      if (target === 'new') {
        onApplyNewItem({
          title: sum,
          jiraKeys: [key],
          sprintIds: [...defaultSprintIds],
          status: 'todo',
          assignees:
            user.role === 'admin'
              ? []
              : user.displayName.trim()
                ? [user.displayName.trim()]
                : [],
        })
      } else {
        onApplyLink(existingId, key)
      }
      close()
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create Jira issue"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className="max-h-[min(90vh,680px)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Create Jira issue
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            New issues use your Jira permissions (same PAT as sync). Choose whether
            the tracker adds a new row or links the key to an existing item.
          </p>
        </div>

        <div className="space-y-3 px-4 py-3 text-sm">
          {metaErr ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/80 dark:text-rose-100">
              {metaErr}
            </p>
          ) : null}
          {formErr ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-100">
              {formErr}
            </p>
          ) : null}

          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Tracker target
            </span>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
              <input
                type="radio"
                name="ji-target"
                checked={target === 'new'}
                disabled={!canNew}
                onChange={() => setTarget('new')}
              />
              New work item (summary becomes the title; Jira key attached)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
              <input
                type="radio"
                name="ji-target"
                checked={target === 'existing'}
                onChange={() => setTarget('existing')}
              />
              Existing work item (append Jira key)
            </label>
            {target === 'existing' ? (
              <select
                className={field}
                value={existingId}
                onChange={(e) => setExistingId(e.target.value)}
              >
                {editableItems.length === 0 ? (
                  <option value="">No editable items</option>
                ) : null}
                {editableItems.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title.slice(0, 80)}
                    {w.title.length > 80 ? '…' : ''}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Project
            </label>
            <select
              className={field}
              value={projectKey}
              disabled={loadingProjects || projects.length === 0}
              onChange={(e) => setProjectKey(e.target.value)}
            >
              {loadingProjects ? (
                <option value="">Loading…</option>
              ) : projects.length === 0 ? (
                <option value="">No projects</option>
              ) : null}
              {projects.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.key} — {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Issue type
            </label>
            <select
              className={field}
              value={issueTypeName}
              disabled={loadingTypes || issueTypes.length === 0}
              onChange={(e) => setIssueTypeName(e.target.value)}
            >
              {loadingTypes ? (
                <option value="">Loading…</option>
              ) : issueTypes.length === 0 ? (
                <option value="">No types</option>
              ) : null}
              {issueTypes.map((t) => (
                <option key={t.id || t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Summary <span className="text-rose-600">*</span>
            </label>
            <input
              className={field}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Jira summary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Description
            </label>
            <textarea
              className={`${field} min-h-[5rem]`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={close}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || loadingProjects || !projectKey || !issueTypeName}
              className="rounded-lg bg-[#0052CC] px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0747a6] disabled:opacity-50"
              onClick={() => void submit()}
            >
              {busy ? 'Creating…' : 'Create in Jira'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function LinkJiraIssueModal({
  open,
  onClose,
  syncCtx,
  user,
  workItems,
  onApplyLink,
  contextItemId = null,
}: {
  open: boolean
  onClose: () => void
  syncCtx: JiraHubSyncContext
  user: TrackerUserAccount
  workItems: WorkItem[]
  onApplyLink: (itemId: string, jiraKey: string) => void
  /** When set, pre-selects this work item in the list. */
  contextItemId?: string | null
}) {
  const close = useCallback(() => onClose(), [onClose])
  useDismissOnEscape(open, close)

  const editableItems = useMemo(
    () =>
      [...workItems]
        .filter((w) => canEditWorkItem(user, w))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [workItems, user],
  )

  const [itemId, setItemId] = useState('')
  const [keyDraft, setKeyDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setErr(null)
    setKeyDraft('')
    if (
      contextItemId &&
      editableItems.some((w) => w.id === contextItemId)
    ) {
      setItemId(contextItemId)
    } else {
      setItemId(editableItems[0]?.id ?? '')
    }
  }, [open, contextItemId, editableItems])

  const submit = async () => {
    const raw = keyDraft.trim().toUpperCase()
    if (!itemId || !raw) {
      setErr('Choose a work item and enter a Jira key.')
      return
    }
    setErr(null)
    setBusy(true)
    try {
      const r = await fetchJiraLookupIssue({
        teamId: syncCtx.teamId,
        key: raw,
        syncMode: syncCtx.syncMode,
        trackerUsername: syncCtx.trackerUsername,
      })
      if (r.status === 'failed') {
        setErr(r.message)
        return
      }
      if (r.status === 'notfound') {
        setErr(r.error)
        return
      }
      onApplyLink(itemId, r.key)
      close()
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Link Jira issue"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Link existing Jira issue
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            The key is checked against Jira before it is saved on the work item.
          </p>
        </div>
        <div className="space-y-3 px-4 py-3 text-sm">
          {err ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-100">
              {err}
            </p>
          ) : null}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Work item
            </label>
            <select
              className={field}
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
            >
              {editableItems.length === 0 ? (
                <option value="">No editable items</option>
              ) : null}
              {editableItems.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title.slice(0, 80)}
                  {w.title.length > 80 ? '…' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Jira key
            </label>
            <input
              className={field}
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="e.g. PROJ-123"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={close}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !itemId}
              className="rounded-lg bg-[#0052CC] px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0747a6] disabled:opacity-50"
              onClick={() => void submit()}
            >
              {busy ? 'Checking…' : 'Verify & link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
