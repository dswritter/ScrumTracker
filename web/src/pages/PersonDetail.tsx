import { useMemo } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { PersonProgressBar } from '../components/PersonProgressBar'
import { StatusBadge } from '../components/StatusBadge'
import { WorkItemTitleLink } from '../components/WorkItemTitleLink'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import { canViewPersonProfile, isAdmin } from '../lib/permissions'
import {
  buildItemsHref,
  filterWorkItemsByScope,
  parseDashboardScope,
  scopeShortLabel,
  scopeToParams,
} from '../lib/dashboardScope'
import {
  itemsForAssignee,
  personCompletionPercent,
} from '../lib/stats'
import { resolveSlackDmUrl } from '../lib/slackDm'

export function PersonDetail() {
  const viewer = useCurrentUser()
  const ctx = useTeamContextNullable()
  const { personName = '' } = useParams<{ personName: string }>()
  const [searchParams] = useSearchParams()

  const name = useMemo(() => {
    try {
      return decodeURIComponent(personName)
    } catch {
      return personName
    }
  }, [personName])

  const scope = useMemo(
    () => parseDashboardScope(searchParams, ctx?.sprints ?? [], null),
    [searchParams, ctx],
  )

  const scopedItems = useMemo(() => {
    const mine = itemsForAssignee(name, ctx?.workItems ?? [])
    return filterWorkItemsByScope(
      mine,
      ctx?.sprints ?? [],
      scope,
    )
  }, [name, ctx, scope])

  const pct = personCompletionPercent(name, scopedItems)

  const dashboardQs = new URLSearchParams(scopeToParams(scope)).toString()

  if (!name.trim()) {
    return (
      <p className="text-slate-600">
        Missing person.{' '}
        <Link
          to="/people"
          className="text-indigo-700 underline dark:text-slate-100 dark:hover:text-white"
        >
          Back
        </Link>
      </p>
    )
  }

  if (!viewer || !ctx) return null

  const onRoster = ctx.teamMembers.includes(name)
  if (!canViewPersonProfile(viewer, name, ctx.teamMembers, ctx.workItems)) {
    return <Navigate to="/me" replace />
  }

  const viewingSelf = viewer.displayName.trim() === name.trim()

  const slackUrl =
    resolveSlackDmUrl(
      name,
      ctx.slackDmUrlByDisplayName,
      ctx.teamUsers,
    ) ??
    (viewingSelf
      ? ctx.teamUsers?.find((u) => u.id === viewer.id)?.slackChatUrl?.trim()
      : undefined)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={
            isAdmin(viewer)
              ? '/people'
              : viewingSelf
                ? '/me'
                : '/'
          }
          className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 dark:text-slate-100 dark:hover:text-white"
        >
          {isAdmin(viewer)
            ? '← People'
            : viewingSelf
              ? '← My page'
              : '← Dashboard'}
        </Link>
        {dashboardQs ? (
          <Link
            to={`/?${dashboardQs}`}
            className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 dark:text-slate-100 dark:hover:text-white"
          >
            Dashboard (this scope)
          </Link>
        ) : null}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {name}
          </h2>
          {slackUrl ? (
            <a
              href={slackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-[#4A154B] hover:bg-purple-100 dark:border-purple-500/40 dark:bg-purple-950/50 dark:text-[#ecb22e] dark:hover:bg-purple-900/60"
            >
              <i className="fa-brands fa-slack" aria-hidden />
              Slack
            </a>
          ) : null}
        </div>
        {!onRoster ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <span className="font-semibold">Former teammate</span> — not on the
            active roster. Historical work items are unchanged.
          </p>
        ) : null}
        {scope.type !== 'all' ? (
          <p className="mt-2 text-sm text-slate-600">
            Scoped to{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {scopeShortLabel(scope, ctx.sprints)}
            </span>
            .
            <Link
              to={`/people/${encodeURIComponent(name)}`}
              className="ml-2 font-medium text-indigo-700 underline dark:text-slate-100 dark:hover:text-white"
            >
              Show all time
            </Link>
          </p>
        ) : null}
      </div>

      <PersonProgressBar
        name={
          scope.type !== 'all'
            ? `${name} · ${scopeShortLabel(scope, ctx.sprints)}`
            : name
        }
        percent={pct}
        itemCount={scopedItems.length}
      />

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
        <ul className="divide-y divide-slate-100">
          {scopedItems.map((w) => (
            <li
              key={w.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
            >
              <WorkItemTitleLink
                item={w}
                jiraBaseUrl={ctx.jiraBaseUrl}
                showCommentHover={viewingSelf && isAdmin(viewer)}
                className="min-w-0 flex-1 font-medium text-indigo-700 hover:text-indigo-900 dark:text-slate-100 dark:hover:text-white"
              />
              <StatusBadge status={w.status} />
              {viewingSelf ? (
                <Link
                  to={buildItemsHref(scope)}
                  className="text-xs font-semibold text-indigo-700 hover:underline dark:text-slate-100 dark:hover:text-white"
                >
                  Edit in table
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
        {scopedItems.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-600">
            No items for this view.
          </p>
        ) : null}
      </div>
    </div>
  )
}
