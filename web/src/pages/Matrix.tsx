import { useMemo } from 'react'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import { resolveSlackDmUrl } from '../lib/slackDm'
import { matrixCellTitles } from '../lib/stats'

export function Matrix() {
  const ctx = useTeamContextNullable()

  const sortedSprints = useMemo(() => {
    if (!ctx?.sprints.length) return []
    return [...ctx.sprints].sort((a, b) => a.start.localeCompare(b.start))
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
                  <span className="block text-[10px] font-normal text-slate-600 dark:text-slate-400">
                    {sp.start} → {sp.end}
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
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-[#4A154B] hover:bg-purple-50 dark:text-[#e9d5ff] dark:hover:bg-slate-800"
                          title="Slack"
                          aria-label={`Slack: ${person}`}
                        >
                          <i className="fa-brands fa-slack text-sm" aria-hidden />
                        </a>
                      ) : null}
                    </span>
                  </td>
                  {sortedSprints.map((sp) => {
                    const titles = matrixCellTitles(person, sp.id, workItems)
                    return (
                      <td
                        key={sp.id}
                        className="align-top px-2 py-2 text-slate-700 dark:text-slate-200"
                      >
                        {titles.length === 0 ? (
                          <span className="text-slate-400 dark:text-slate-500">
                            —
                          </span>
                        ) : (
                          <ul className="list-inside list-disc space-y-1 marker:text-[#00B050] dark:marker:text-emerald-400">
                            {titles.map((t, i) => (
                              <li
                                key={i}
                                className="max-w-[200px] truncate text-slate-800 dark:text-slate-200"
                                title={t}
                              >
                                {t}
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
