import { useTrackerStore } from '../store/useTrackerStore'

/**
 * Shown when granular PATCH returns 409: some fields conflict with concurrent edits.
 */
export function WorkItemConflictBanner() {
  const conflict = useTrackerStore((s) => s.workItemSyncConflict)
  const resolve = useTrackerStore((s) => s.resolveWorkItemSyncConflict)
  const clear = useTrackerStore((s) => s.clearWorkItemSyncConflict)

  if (!conflict) return null

  const fields =
    conflict.conflicts.length > 0
      ? conflict.conflicts.join(', ')
      : 'unknown fields'

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 z-[200] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg dark:border-amber-700 dark:bg-amber-950/90 dark:text-amber-100"
    >
      <p className="font-semibold">Sync conflict on work item</p>
      <p className="mt-1 text-xs opacity-90">
        Someone else changed overlapping fields ({fields}). Choose how to resolve,
        or dismiss and edit again.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {conflict.mergedPartial ? (
          <button
            type="button"
            className="rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-900 dark:bg-amber-600 dark:hover:bg-amber-500"
            onClick={() => resolve('merged')}
          >
            Keep merged (non-conflicting edits)
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-lg border border-amber-800/40 bg-white px-3 py-1.5 text-xs font-bold text-amber-950 hover:bg-amber-100 dark:border-amber-400/50 dark:bg-amber-900 dark:text-amber-50 dark:hover:bg-amber-800"
          onClick={() => resolve('server')}
        >
          Use server version
        </button>
        <button
          type="button"
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-amber-900/80 underline dark:text-amber-200/90"
          onClick={() => clear()}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
