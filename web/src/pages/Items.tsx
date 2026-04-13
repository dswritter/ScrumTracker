import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AddWorkItemModal } from '../components/AddWorkItemModal'
import { CommentsCell } from '../components/CommentsCell'
import { JiraCell } from '../components/JiraCell'
import { SprintPickerCell } from '../components/SprintPickerCell'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import { commentAuthorLabel } from '../lib/commentAuthor'
import {
  canAddWorkItem,
  canChangeAssignees,
  canDeleteWorkItem,
  canEditWorkItem,
  canAddComment,
  canDeleteComment,
  isAdmin,
} from '../lib/permissions'
import {
  parseDashboardScope,
  filterWorkItemsByScope,
  scopeShortLabel,
} from '../lib/dashboardScope'
import {
  filterWorkItemsView,
  formerAssigneesOnItem,
  sortWorkItemsByNewestSprintFirst,
} from '../lib/stats'
import { useTrackerStore, STATUS_OPTIONS } from '../store/useTrackerStore'
import type { Sprint, TrackerUserAccount, WorkItem, WorkStatus } from '../types'

function Row({
  item,
  user,
  teamId,
  sprints,
  teamMembers,
  jiraBaseUrl,
  showAssigneesColumn,
}: {
  item: WorkItem
  user: TrackerUserAccount
  teamId: string
  sprints: Sprint[]
  teamMembers: string[]
  jiraBaseUrl: string
  showAssigneesColumn: boolean
}) {
  const updateWorkItem = useTrackerStore((s) => s.updateWorkItem)
  const deleteWorkItem = useTrackerStore((s) => s.deleteWorkItem)
  const addComment = useTrackerStore((s) => s.addComment)
  const deleteComment = useTrackerStore((s) => s.deleteComment)

  const canEdit = canEditWorkItem(user, item)
  const canDel = canDeleteWorkItem(user)
  const assigneeAdmin = canChangeAssignees(user)
  const canComment = canAddComment(user, item)
  const canRemoveComment = canDeleteComment(user)

  const former = formerAssigneesOnItem(item, teamMembers)

  const inputCls =
    'rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm disabled:bg-slate-100 disabled:text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-400'

  return (
    <tr className="align-top border-b border-slate-100 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40">
      <td className="px-2 py-2">
        <input
          className={`w-28 ${inputCls}`}
          disabled={!canEdit}
          value={item.section}
          onChange={(e) =>
            updateWorkItem(teamId, item.id, { section: e.target.value })
          }
        />
      </td>
      <td className="px-2 py-2">
        <input
          className={`w-24 ${inputCls}`}
          disabled={!canEdit}
          value={item.component}
          onChange={(e) =>
            updateWorkItem(teamId, item.id, { component: e.target.value })
          }
        />
      </td>
      <td className="px-2 py-2">
        <input
          className={`min-w-0 w-full max-w-[min(100%,320px)] ${inputCls}`}
          disabled={!canEdit}
          value={item.title}
          onChange={(e) =>
            updateWorkItem(teamId, item.id, { title: e.target.value })
          }
        />
      </td>
      {showAssigneesColumn ? (
        <td className="px-2 py-2">
          <div className="flex max-w-[220px] flex-col gap-1">
            {assigneeAdmin ? (
              <div className="flex flex-wrap gap-1">
                {teamMembers.map((m) => (
                  <label
                    key={m}
                    className="flex cursor-pointer items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={item.assignees.includes(m)}
                      onChange={() => {
                        const has = item.assignees.includes(m)
                        updateWorkItem(teamId, item.id, {
                          assignees: has
                            ? item.assignees.filter((a) => a !== m)
                            : [...item.assignees, m],
                        })
                      }}
                    />
                    {m}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-700">
                {item.assignees.length
                  ? item.assignees.join(', ')
                  : '—'}
              </p>
            )}
            {former.length > 0 ? (
              <p className="text-[10px] leading-snug text-slate-500">
                <span className="font-medium text-slate-600">Former:</span>{' '}
                {former.join(', ')}
              </p>
            ) : null}
          </div>
        </td>
      ) : null}
      <td className="px-2 py-2">
        <select
          className={`${inputCls} pr-6`}
          disabled={!canEdit}
          value={item.status}
          onChange={(e) =>
            updateWorkItem(teamId, item.id, {
              status: e.target.value as WorkStatus,
            })
          }
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <SprintPickerCell
          item={item}
          sprints={sprints}
          canEdit={canEdit}
          onChangeSprintIds={(sprintIds) =>
            updateWorkItem(teamId, item.id, { sprintIds })
          }
        />
      </td>
      <td className="px-2 py-2">
        <input
          className={`w-24 ${inputCls}`}
          disabled={!canEdit}
          value={item.eta}
          onChange={(e) =>
            updateWorkItem(teamId, item.id, { eta: e.target.value })
          }
        />
      </td>
      <td className="px-2 py-2">
        <JiraCell
          item={item}
          jiraBaseUrl={jiraBaseUrl}
          canEdit={canEdit}
          onChangeKeys={(jiraKeys) =>
            updateWorkItem(teamId, item.id, { jiraKeys })
          }
        />
      </td>
      <td className="px-2 py-2">
        <CommentsCell
          item={item}
          canAdd={canComment}
          currentName={commentAuthorLabel(user)}
          onAdd={(body) =>
            addComment(teamId, item.id, commentAuthorLabel(user), body)
          }
          canDeleteComment={canRemoveComment}
          onDeleteComment={(cid) => deleteComment(teamId, item.id, cid)}
        />
      </td>
      <td className="px-2 py-2">
        {canDel ? (
          <button
            type="button"
            className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-800 hover:bg-rose-100"
            onClick={() => {
              if (confirm('Delete this work item?'))
                deleteWorkItem(teamId, item.id)
            }}
          >
            Delete
          </button>
        ) : (
          <span className="text-[10px] text-slate-400">—</span>
        )}
      </td>
    </tr>
  )
}

const STATUS_VALUES = new Set<string>([
  'done',
  'in_progress',
  'to_test',
  'to_track',
  'blocked',
  'todo',
])

export function Items() {
  const user = useCurrentUser()
  const ctx = useTeamContextNullable()
  const addWorkItem = useTrackerStore((s) => s.addWorkItem)
  const [searchParams] = useSearchParams()
  const [addOpen, setAddOpen] = useState(false)
  const [addModalKey, setAddModalKey] = useState(0)
  const [tableFilterSection, setTableFilterSection] = useState('')
  const [tableFilterComponent, setTableFilterComponent] = useState('')
  const [tableFilterStatus, setTableFilterStatus] = useState('')

  const statusParam = searchParams.get('status')
  const groupParam = searchParams.get('group')

  const statusFilter =
    statusParam && STATUS_VALUES.has(statusParam)
      ? (statusParam as WorkStatus)
      : null
  const groupFilter =
    groupParam === 'inProgress'
      ? ('inProgress' as const)
      : groupParam === 'blockedTodo'
        ? ('blockedTodo' as const)
        : null

  const scope = useMemo(
    () => parseDashboardScope(searchParams, ctx?.sprints ?? [], null),
    [searchParams, ctx],
  )

  const scopedList = useMemo(() => {
    const sprints = ctx?.sprints ?? []
    const workItems = ctx?.workItems ?? []
    let list = filterWorkItemsByScope(workItems, sprints, scope)
    list = filterWorkItemsView(list, {
      sprintId: null,
      status: statusFilter,
      group: groupFilter,
    })
    if (user && !isAdmin(user)) {
      list = list.filter((w) =>
        w.assignees.some((a) => a.trim() === user.displayName.trim()),
      )
    }
    return sortWorkItemsByNewestSprintFirst(list, sprints)
  }, [ctx, scope, statusFilter, groupFilter, user])

  const sectionOptions = useMemo(() => {
    const set = new Set<string>()
    for (const w of scopedList) {
      const s = w.section.trim() || '(empty)'
      set.add(s)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [scopedList])

  const componentOptions = useMemo(() => {
    const set = new Set<string>()
    for (const w of scopedList) {
      const c = w.component.trim() || '(empty)'
      set.add(c)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [scopedList])

  const visible = useMemo(() => {
    let list = scopedList
    if (tableFilterSection) {
      if (tableFilterSection === '(empty)') {
        list = list.filter((w) => !w.section.trim())
      } else {
        list = list.filter((w) => w.section.trim() === tableFilterSection)
      }
    }
    if (tableFilterComponent) {
      if (tableFilterComponent === '(empty)') {
        list = list.filter((w) => !w.component.trim())
      } else {
        list = list.filter(
          (w) => w.component.trim() === tableFilterComponent,
        )
      }
    }
    if (tableFilterStatus && STATUS_VALUES.has(tableFilterStatus)) {
      list = list.filter((w) => w.status === tableFilterStatus)
    }
    return list
  }, [scopedList, tableFilterSection, tableFilterComponent, tableFilterStatus])

  const hasScopeParams = Boolean(searchParams.get('scope'))
  const hasColumnFilters = Boolean(
    tableFilterSection || tableFilterComponent || tableFilterStatus,
  )
  const hasQuery =
    hasScopeParams ||
    Boolean(searchParams.get('sprint')) ||
    Boolean(statusFilter) ||
    Boolean(groupFilter) ||
    hasColumnFilters

  if (!user || !ctx) return null

  const { teamId, sprints, workItems, teamMembers, jiraBaseUrl } = ctx

  let filterSummary = scopeShortLabel(scope, sprints)
  if (statusFilter)
    filterSummary += ` · Status: ${statusFilter.replace('_', ' ')}`
  if (groupFilter === 'inProgress')
    filterSummary += ' · In progress (incl. to test / to track)'
  if (groupFilter === 'blockedTodo') filterSummary += ' · Blocked & todo'
  if (user && !isAdmin(user)) filterSummary += ' · Your assignments only'
  if (tableFilterSection)
    filterSummary += ` · Section: ${tableFilterSection}`
  if (tableFilterComponent)
    filterSummary += ` · Component: ${tableFilterComponent}`
  if (tableFilterStatus)
    filterSummary += ` · Table status: ${tableFilterStatus.replace('_', ' ')}`

  const showAssigneesColumn = isAdmin(user)
  const filterSelectCls =
    'mt-0.5 w-full min-w-0 rounded border border-slate-200 bg-white px-1 py-1 text-[10px] font-normal text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-end gap-3">
        <button
          type="button"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          disabled={!canAddWorkItem(user)}
          onClick={() => {
            setAddModalKey((k) => k + 1)
            setAddOpen(true)
          }}
        >
          Add work item
        </button>
      </div>

      {addOpen ? (
        <AddWorkItemModal
          key={addModalKey}
          onClose={() => setAddOpen(false)}
          user={user}
          teamMembers={teamMembers}
          sprints={sprints}
          onCreate={(partial) => {
            if (!canAddWorkItem(user)) return
            addWorkItem(teamId, partial)
          }}
        />
      ) : null}

      {hasQuery ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-100 bg-indigo-50/80 px-3 py-2 text-sm text-indigo-950 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100">
          <span>
            <span className="font-semibold">Filtered:</span> {filterSummary}
          </span>
          <span className="flex flex-wrap gap-3">
            <button
              type="button"
              className="font-medium text-indigo-800 underline hover:text-indigo-950 dark:text-slate-100 dark:hover:text-white"
              onClick={() => {
                setTableFilterSection('')
                setTableFilterComponent('')
                setTableFilterStatus('')
              }}
            >
              Clear column filters
            </button>
            <Link
              to="/items"
              className="font-medium text-indigo-800 underline hover:text-indigo-950 dark:text-slate-100 dark:hover:text-white"
            >
              Clear all
            </Link>
          </span>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
        <table className="w-full min-w-0 border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
              <th className="px-2 py-2">Section</th>
              <th className="px-2 py-2">Component</th>
              <th className="px-2 py-2">Title</th>
              {showAssigneesColumn ? (
                <th className="px-2 py-2">Assignees</th>
              ) : null}
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Sprints</th>
              <th className="px-2 py-2">ETA</th>
              <th className="px-2 py-2">JIRA</th>
              <th className="px-2 py-2">Comments</th>
              <th className="px-2 py-2" />
            </tr>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-[10px] font-semibold normal-case text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              <th className="px-2 pb-2 pt-0 align-top">
                <label className="block font-semibold text-slate-500">
                  Filter
                  <select
                    className={filterSelectCls}
                    value={tableFilterSection}
                    onChange={(e) => setTableFilterSection(e.target.value)}
                  >
                    <option value="">All sections</option>
                    {sectionOptions.map((s) => (
                      <option key={s} value={s === '(empty)' ? '(empty)' : s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </th>
              <th className="px-2 pb-2 pt-0 align-top">
                <label className="block font-semibold text-slate-500">
                  Filter
                  <select
                    className={filterSelectCls}
                    value={tableFilterComponent}
                    onChange={(e) => setTableFilterComponent(e.target.value)}
                  >
                    <option value="">All components</option>
                    {componentOptions.map((c) => (
                      <option key={c} value={c === '(empty)' ? '(empty)' : c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </th>
              <th className="px-2 pb-2 pt-0" aria-hidden />
              {showAssigneesColumn ? (
                <th className="px-2 pb-2 pt-0" aria-hidden />
              ) : null}
              <th className="px-2 pb-2 pt-0 align-top">
                <label className="block font-semibold text-slate-500">
                  Filter
                  <select
                    className={filterSelectCls}
                    value={tableFilterStatus}
                    onChange={(e) => setTableFilterStatus(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </th>
              <th className="px-2 pb-2 pt-0" colSpan={5} aria-hidden />
            </tr>
          </thead>
          <tbody>
            {visible.map((w) => (
              <Row
                key={w.id}
                item={w}
                user={user}
                teamId={teamId}
                sprints={sprints}
                teamMembers={teamMembers}
                jiraBaseUrl={jiraBaseUrl}
                showAssigneesColumn={showAssigneesColumn}
              />
            ))}
          </tbody>
        </table>
        {visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-600">
            {!hasQuery &&
            !hasColumnFilters &&
            workItems.length === 0 ? (
              <>No items yet. Click &quot;Add work item&quot;.</>
            ) : (
              <>
                No items match this filter.{' '}
                <Link
                  to="/items"
                  className="font-medium text-indigo-700 underline dark:text-slate-100 dark:hover:text-white"
                >
                  Show all
                </Link>
              </>
            )}
          </p>
        ) : null}
      </div>
    </div>
  )
}
