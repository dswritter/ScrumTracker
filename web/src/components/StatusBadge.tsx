import type { WorkStatus } from '../types'

const styles: Record<WorkStatus, string> = {
  done: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  in_progress: 'bg-sky-50 text-sky-800 ring-sky-200',
  to_test: 'bg-amber-50 text-amber-900 ring-amber-200',
  to_track: 'bg-violet-50 text-violet-900 ring-violet-200',
  blocked: 'bg-rose-50 text-rose-800 ring-rose-200',
  todo: 'bg-slate-100 text-slate-700 ring-slate-200',
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
