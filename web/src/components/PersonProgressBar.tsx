import { Link } from 'react-router-dom'

export function PersonProgressBar({
  name,
  percent,
  itemCount,
  to,
  slackUrl,
}: {
  name: string
  percent: number
  itemCount: number
  /** Link target for profile (e.g. personal progress page). */
  to?: string
  /** Slack DM / archive URL; opens in new tab. */
  slackUrl?: string
}) {
  const p = Math.min(100, Math.max(0, percent))
  const bar = (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#00B050] to-emerald-600 transition-[width] duration-300"
        style={{ width: `${p}%` }}
      />
    </div>
  )

  const shell =
    'rounded-lg border border-slate-200 bg-white p-3 transition-shadow ' +
    (to
      ? 'hover:border-[#00B050]/40 hover:shadow-sm focus-within:ring-2 focus-within:ring-[#00B050]/25'
      : '')

  const nameEl = to ? (
    <Link
      to={to}
      className="min-w-0 truncate font-semibold text-slate-900 hover:text-[#007a3d] hover:underline"
    >
      {name}
    </Link>
  ) : (
    <span className="min-w-0 truncate font-semibold text-slate-900">{name}</span>
  )

  return (
    <div className={shell}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {nameEl}
          {slackUrl ? (
            <a
              href={slackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#4A154B] hover:bg-purple-50"
              title="Open Slack conversation"
              aria-label={`Open Slack for ${name}`}
            >
              <i className="fa-brands fa-slack text-base" aria-hidden />
            </a>
          ) : null}
        </div>
        <span className="shrink-0 text-xs tabular-nums text-slate-500">
          {itemCount} item{itemCount === 1 ? '' : 's'} · {p}%
        </span>
      </div>
      {to ? (
        <Link to={to} className="mt-2 block" aria-hidden tabIndex={-1}>
          {bar}
        </Link>
      ) : (
        bar
      )}
    </div>
  )
}
