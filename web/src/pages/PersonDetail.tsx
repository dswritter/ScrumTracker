import { useMemo } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { PersonProgressBar } from '../components/PersonProgressBar'
import { StatusBadge } from '../components/StatusBadge'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import { canViewPersonProfile, isAdmin } from '../lib/permissions'
import {
  filterWorkItemsByScope,
  parseDashboardScope,
  scopeShortLabel,
  scopeToParams,
} from '../lib/dashboardScope'
import {
  itemsForAssignee,
  personCompletionPercent,
} from '../lib/stats'

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
        <Link to="/people" className="text-indigo-700 underline">
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={isAdmin(viewer) ? '/people' : '/me'}
          className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
        >
          {isAdmin(viewer) ? '← People' : '← My page'}
        </Link>
        {dashboardQs ? (
          <Link
            to={`/?${dashboardQs}`}
            className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
          >
            Dashboard (this scope)
          </Link>
        ) : null}
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          {name}
        </h2>
        {!onRoster ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <span className="font-semibold">Former teammate</span> — not on the
            active roster. Historical work items are unchanged.
          </p>
        ) : null}
        {scope.type !== 'all' ? (
          <p className="mt-2 text-sm text-slate-600">
            Scoped to{' '}
            <span className="font-semibold text-slate-800">
              {scopeShortLabel(scope, ctx.sprints)}
            </span>
            .
            <Link
              to={`/people/${encodeURIComponent(name)}`}
              className="ml-2 font-medium text-indigo-700 underline"
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

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <ul className="divide-y divide-slate-100">
          {scopedItems.map((w) => (
            <li
              key={w.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
            >
              <span className="min-w-0 flex-1 font-medium text-slate-900">
                {w.title || '(untitled)'}
              </span>
              <StatusBadge status={w.status} />
              <Link
                to="/items"
                className="text-xs font-semibold text-indigo-700 hover:underline"
              >
                Edit in table
              </Link>
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
