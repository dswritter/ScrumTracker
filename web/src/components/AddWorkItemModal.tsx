import { useCallback, useMemo, useState } from 'react'
import { useDismissOnEscape } from '../hooks/useDismissOnEscape'
import { getCurrentSprint, sprintsSortedNewestFirst } from '../lib/sdates'
import { STATUS_OPTIONS } from '../store/useTrackerStore'
import type { Sprint, TrackerUserAccount, WorkItem, WorkStatus } from '../types'

const KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/i

function parseJiraKeys(raw: string): string[] {
  const out: string[] = []
  for (const p of raw.split(/[,;\s]+/)) {
    const k = p.trim().toUpperCase()
    if (KEY_RE.test(k) && !out.includes(k)) out.push(k)
  }
  return out
}

export function AddWorkItemModal({
  onClose,
  user,
  teamMembers,
  sprints,
  onCreate,
}: {
  onClose: () => void
  user: TrackerUserAccount
  teamMembers: string[]
  sprints: Sprint[]
  onCreate: (partial: Partial<WorkItem>) => void
}) {
  const close = useCallback(() => onClose(), [onClose])
  useDismissOnEscape(true, close)

  const sortedSprints = useMemo(() => sprintsSortedNewestFirst(sprints), [sprints])

  const defaultSprintIds = useMemo(() => {
    const cur = getCurrentSprint(sortedSprints)
    return cur ? [cur.id] : []
  }, [sortedSprints])

  const [section, setSection] = useState('')
  const [component, setComponent] = useState('')
  const [title, setTitle] = useState('')
  const [eta, setEta] = useState('')
  const [status, setStatus] = useState<WorkStatus>('todo')
  const [sprintIds, setSprintIds] = useState<string[]>(() => [...defaultSprintIds])
  const [assignees, setAssignees] = useState<string[]>(() =>
    user.role === 'admin'
      ? []
      : user.displayName.trim()
        ? [user.displayName.trim()]
        : [],
  )
  const [jiraDraft, setJiraDraft] = useState('')

  const isAdmin = user.role === 'admin'

  const toggleSprint = (id: string) => {
    setSprintIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const toggleAssignee = (name: string) => {
    setAssignees((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
    )
  }

  const submit = () => {
    const t = title.trim()
    if (!t) return
    const jiraKeys = parseJiraKeys(jiraDraft)
    onCreate({
      section: section.trim(),
      component: component.trim(),
      title: t,
      eta: eta.trim(),
      status,
      sprintIds: [...sprintIds],
      assignees: isAdmin ? [...assignees] : [user.displayName.trim()].filter(Boolean),
      jiraKeys,
    })
    onClose()
  }

  const field =
    'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add work item"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className="max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">New work item</h3>
          <p className="text-xs text-slate-500">
            Fill in details, pick sprints, then create. The row appears in the
            table ordered by sprint dates.
          </p>
        </div>

        <div className="space-y-3 px-4 py-3 text-sm">
          <div>
            <label className="text-xs font-semibold text-slate-600" htmlFor="nw-title">
              Title <span className="text-rose-600">*</span>
            </label>
            <input
              id="nw-title"
              className={field}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short description"
              autoFocus
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-600" htmlFor="nw-sec">
                Section
              </label>
              <input
                id="nw-sec"
                className={field}
                value={section}
                onChange={(e) => setSection(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600" htmlFor="nw-comp">
                Component
              </label>
              <input
                id="nw-comp"
                className={field}
                value={component}
                onChange={(e) => setComponent(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600" htmlFor="nw-eta">
              ETA
            </label>
            <input
              id="nw-eta"
              className={field}
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              placeholder="e.g. April release"
            />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-600">Status</span>
            <select
              className={field}
              value={status}
              onChange={(e) => setStatus(e.target.value as WorkStatus)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-600">Sprints</span>
            <div className="mt-1 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {sortedSprints.length === 0 ? (
                <p className="text-xs text-slate-500">No sprints defined yet.</p>
              ) : (
                sortedSprints.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={sprintIds.includes(s.id)}
                      onChange={() => toggleSprint(s.id)}
                    />
                    <span>
                      <span className="font-medium text-slate-900">
                        {s.emoji ?? ''} {s.name}
                      </span>
                      <span className="block text-slate-500">
                        {s.start} → {s.end}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          {isAdmin ? (
            <div>
              <span className="text-xs font-semibold text-slate-600">Assignees</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {teamMembers.map((m) => (
                  <label
                    key={m}
                    className="flex cursor-pointer items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={assignees.includes(m)}
                      onChange={() => toggleAssignee(m)}
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600">
              Assignee: <strong>{user.displayName}</strong>
            </p>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-600" htmlFor="nw-jira">
              JIRA IDs (optional)
            </label>
            <input
              id="nw-jira"
              className={field}
              value={jiraDraft}
              onChange={(e) => setJiraDraft(e.target.value)}
              placeholder="CTAGM-123, AI-456"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={close}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={!title.trim()}
            onClick={submit}
          >
            Create work item
          </button>
        </div>
      </div>
    </div>
  )
}
