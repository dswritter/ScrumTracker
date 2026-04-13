import type { WorkStatus } from '../types'

const styles: Record<WorkStatus, string> = {
  done:
    'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800',
  in_progress:
    'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-800',
  to_test:
    'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800',
  to_track:
    'bg-violet-50 text-violet-900 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-800',
  blocked:
    'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800',
  todo:
    'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600',
}

const labels: Record<WorkStatus, string> = {
  done: 'Done',
  in_progress: 'In progress',
  to_test: 'To test',
  to_track: 'To track',
  blocked: 'Blocked',
  todo: 'Todo',
}

export function StatusBadge({ status }: { status: WorkStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status]}`}
    >
      {labels[status]}
    </span>
  )
}
