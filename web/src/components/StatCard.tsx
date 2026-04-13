import { Link } from 'react-router-dom'

export function StatCard({
  title,
  value,
  hint,
  to,
}: {
  title: string
  value: string | number
  hint?: string
  /** When set, entire card is a link (keyboard + click). */
  to?: string
}) {
  const className =
    'rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm transition-shadow dark:border-slate-700 dark:bg-slate-900/90 ' +
    (to
      ? 'cursor-pointer hover:border-indigo-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:hover:border-indigo-500/50'
      : '')

  const inner = (
    <>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={`block ${className}`}>
        {inner}
      </Link>
    )
  }

  return <div className={className}>{inner}</div>
}
