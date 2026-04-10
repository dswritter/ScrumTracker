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
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-max border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="sticky left-0 z-[1] bg-slate-50 px-3 py-2 font-bold text-slate-600">
                Person
              </th>
              {sortedSprints.map((sp) => (
                <th
                  key={sp.id}
                  className="min-w-[140px] px-2 py-2 font-bold text-slate-800"
                >
                  <span className="block whitespace-nowrap">
                    {sp.emoji} {sp.name}
                  </span>
                  <span className="block text-[10px] font-normal text-slate-500">
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
                  className="border-b border-slate-100 hover:bg-slate-50/80"
                >
                  <td className="sticky left-0 z-[1] bg-white px-3 py-2 font-semibold text-slate-800">
                    <span className="inline-flex items-center gap-2">
                      {person}
                      {slackUrl ? (
                        <a
                          href={slackUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-[#4A154B] hover:bg-purple-50"
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
                        className="align-top px-2 py-2 text-slate-600"
                      >
                        {titles.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <ul className="list-inside list-disc space-y-1">
                            {titles.map((t, i) => (
                              <li
                                key={i}
                                className="max-w-[200px] truncate"
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
