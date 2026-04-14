import { useMemo } from 'react'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import { resolveSlackDmUrl } from '../lib/slackDm'
import { sprintsSortedNewestFirst } from '../lib/sdates'
import { WorkItemTitleLink } from '../components/WorkItemTitleLink'
import { matrixCellItems } from '../lib/stats'

export function Matrix() {
  const ctx = useTeamContextNullable()

  const sortedSprints = useMemo(() => {
    if (!ctx?.sprints.length) return []
    return sprintsSortedNewestFirst(ctx.sprints)
  }, [ctx])

  const people = useMemo(() => {
    if (!ctx?.teamMembers.length) return []
    return [...ctx.teamMembers].sort((a, b) => a.localeCompare(b))
  }, [ctx])

  if (!ctx) return null

  const { workItems } = ctx

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
        <table className="min-w-max border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800">
              <th className="sticky left-0 z-[1] bg-slate-50 px-3 py-2 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                Person
              </th>
              {sortedSprints.map((sp) => (
                <th
                  key={sp.id}
                  className="min-w-[140px] px-2 py-2 font-bold text-slate-800 dark:text-slate-100"
                >
                  <span className="block whitespace-nowrap">
                    {sp.emoji} {sp.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((person) => {
              const slackUrl = resolveSlackDmUrl(
                person,
                ctx.slackDmUrlByDisplayName,
                ctx.teamUsers,
              )
              return (
                <tr
                  key={person}
                  className="border-b border-slate-100 hover:bg-slate-50/80 dark:border-slate-700 dark:hover:bg-slate-800/60"
                >
                  <td className="sticky left-0 z-[1] bg-white px-3 py-2 font-semibold text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                    <span className="inline-flex items-center gap-2">
                      {person}
                      {slackUrl ? (
                        <a
                          href={slackUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-[#4A154B] hover:bg-purple-50 dark:text-[#ecb22e] dark:hover:bg-white/10"
                          title="Slack"
                          aria-label={`Slack: ${person}`}
                        >
                          <i className="fa-brands fa-slack text-sm" aria-hidden />
                        </a>
                      ) : null}
                    </span>
                  </td>
                  {sortedSprints.map((sp) => {
                    const cellItems = matrixCellItems(person, sp.id, workItems)
                    return (
                      <td
                        key={sp.id}
                        className="align-top px-2 py-2 text-slate-700 dark:text-slate-200"
                      >
                        {cellItems.length === 0 ? (
                          <span className="text-slate-400 dark:text-slate-500">
                            —
                          </span>
                        ) : (
                          <ul className="list-inside list-disc space-y-1 marker:text-[#00B050] dark:marker:text-emerald-400">
                            {cellItems.map((w) => (
                              <li
                                key={w.id}
                                className="max-w-[200px] truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
                              >
                                <WorkItemTitleLink
                                  item={w}
                                  showCommentHover
                                  maxPreviewComments={3}
                                  sprintCommentWindow={{
                                    start: sp.start,
                                    end: sp.end,
                                  }}
                                  className="font-semibold text-indigo-800 hover:text-indigo-950 hover:underline dark:text-sky-100 dark:hover:text-white"
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
