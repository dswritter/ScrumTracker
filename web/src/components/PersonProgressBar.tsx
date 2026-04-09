import { Link } from 'react-router-dom'

export function PersonProgressBar({
  name,
  percent,
  itemCount,
  to,
}: {
  name: string
  percent: number
  itemCount: number
  /** Link target for the whole card (e.g. personal progress page). */
  to?: string
}) {
  const p = Math.min(100, Math.max(0, percent))
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-slate-900">{name}</span>
        <span className="text-xs tabular-nums text-slate-500">
          {itemCount} item{itemCount === 1 ? '' : 's'} · {p}%
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 transition-[width] duration-300"
          style={{ width: `${p}%` }}
        />
      </div>
    </>
  )

  const shell =
    'rounded-lg border border-slate-200 bg-white p-3 transition-shadow ' +
    (to
      ? 'cursor-pointer hover:border-indigo-200 hover:shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/30'
      : '')

  if (to) {
    return (
      <Link to={to} className={`block ${shell}`}>
        {body}
      </Link>
    )
  }

  return <div className={shell}>{body}</div>
}
