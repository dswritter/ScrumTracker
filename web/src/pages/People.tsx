import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PersonProgressBar } from '../components/PersonProgressBar'
import { StatusBadge } from '../components/StatusBadge'
import { WorkItemTitleLink } from '../components/WorkItemTitleLink'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import {
  formerTeammatesWithItems,
  itemsForAssignee,
  personCompletionPercent,
} from '../lib/stats'
import { resolveSlackDmUrl } from '../lib/slackDm'

export function People() {
  const ctx = useTeamContextNullable()

  const roster = useMemo(() => {
    if (!ctx?.teamMembers.length) return []
    return [...ctx.teamMembers].sort((a, b) => a.localeCompare(b))
  }, [ctx])

  const former = useMemo(
    () =>
      ctx
        ? formerTeammatesWithItems(ctx.teamMembers, ctx.workItems)
        : [],
    [ctx],
  )

  if (!ctx) return null

  const { workItems } = ctx

  return (
    <div className="space-y-8">
      <section>
        <div className="grid gap-4 lg:grid-cols-2">
          {roster.map((name) => {
            const mine = itemsForAssignee(name, workItems)
            const pct = personCompletionPercent(name, workItems)
            return (
              <div
                key={name}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <PersonProgressBar
                  name={name}
                  percent={pct}
                  itemCount={mine.length}
                  to={`/people/${encodeURIComponent(name)}`}
                  slackUrl={resolveSlackDmUrl(
                    name,
                    ctx.slackDmUrlByDisplayName,
                  )}
                />
                <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
                  {mine.map((w) => (
                    <li
                      key={w.id}
                      className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 first:border-t-0 first:pt-0"
                    >
                      <WorkItemTitleLink
                        item={w}
                        showCommentHover
                        className="min-w-0 flex-1 font-medium text-indigo-700 hover:text-indigo-900"
                      />
                      <StatusBadge status={w.status} />
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
        {roster.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            No one on the roster. Add login accounts in Settings.
          </p>
        ) : null}
      </section>

      {former.length > 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">
            Former teammates (on work items only)
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Not on the active roster; not used for new sprint assignment. Their
            past tasks remain unchanged.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {former.map((name) => (
              <li key={name}>
                <Link
                  to={`/people/${encodeURIComponent(name)}`}
                  className="inline-block rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-800 shadow-sm hover:border-indigo-200 hover:text-indigo-800"
                >
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
