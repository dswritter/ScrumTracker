/**
 * Optional controls when a work item has linked Jira keys and sync is enabled.
 * Default: tracker only (do not post to Jira until the user opts in).
 */
export function CommentJiraPostOptions({
  jiraKeys,
  alsoToJira,
  onAlsoToJiraChange,
  selectedIssueKey,
  onSelectedIssueKeyChange,
}: {
  jiraKeys: string[]
  alsoToJira: boolean
  onAlsoToJiraChange: (v: boolean) => void
  selectedIssueKey: string
  onSelectedIssueKeyChange: (key: string) => void
}) {
  const keys = jiraKeys.map((k) => String(k).trim()).filter(Boolean)
  if (keys.length === 0) return null

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2.5 text-xs dark:border-slate-600 dark:bg-slate-800/60">
      <label className="flex cursor-pointer items-start gap-2 text-slate-800 dark:text-slate-100">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={alsoToJira}
          onChange={(e) => onAlsoToJiraChange(e.target.checked)}
        />
        <span>
          <span className="font-semibold">Also post to Jira</span>
          <span className="block text-slate-500 dark:text-slate-400">
            If unchecked, the comment is saved only in the tracker.
          </span>
        </span>
      </label>
      {alsoToJira && keys.length > 1 ? (
        <fieldset className="space-y-1.5 border-t border-slate-200 pt-2 dark:border-slate-600">
          <legend className="font-semibold text-slate-800 dark:text-slate-100">
            Which linked issue?
          </legend>
          {keys.map((k) => (
            <label
              key={k}
              className="flex cursor-pointer items-center gap-2 text-slate-700 dark:text-slate-200"
            >
              <input
                type="radio"
                name="jira-issue-for-comment"
                value={k}
                checked={selectedIssueKey === k}
                onChange={() => onSelectedIssueKeyChange(k)}
              />
              <span className="font-mono text-[11px]">{k}</span>
            </label>
          ))}
        </fieldset>
      ) : alsoToJira && keys.length === 1 ? (
        <p className="border-t border-slate-200 pt-2 text-slate-600 dark:border-slate-600 dark:text-slate-300">
          Will post to <span className="font-mono font-semibold">{keys[0]}</span>
        </p>
      ) : null}
    </div>
  )
}
