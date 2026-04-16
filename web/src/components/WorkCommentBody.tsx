import type { WorkComment } from '../types'

const JIRA_RESOLVED_PREFIX = 'jira-sys-resolved-'

export function isJiraResolvedStampComment(id: string): boolean {
  return id.startsWith(JIRA_RESOLVED_PREFIX)
}

export function jiraIssueKeyFromResolvedStampId(id: string): string | null {
  if (!isJiraResolvedStampComment(id)) return null
  const key = id.slice(JIRA_RESOLVED_PREFIX.length)
  return key || null
}

/**
 * Renders work-item comment body. Jira “resolved” system stamps use a compact line
 * with a clickable issue key; other comments show `body` as-is.
 */
export function WorkCommentBody({
  comment,
  jiraBaseUrl,
  className = '',
}: {
  comment: WorkComment
  jiraBaseUrl: string
  className?: string
}) {
  const key = jiraIssueKeyFromResolvedStampId(comment.id)
  if (!key) {
    return <span className={className}>{comment.body}</span>
  }
  const base = jiraBaseUrl.trim().replace(/\/$/, '')
  const href = base ? `${base}/${key}` : null
  return (
    <span className={className}>
      Jira closed ·{' '}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono font-semibold text-indigo-700 hover:underline dark:text-sky-300"
        >
          {key}
        </a>
      ) : (
        <span className="font-mono font-semibold">{key}</span>
      )}
    </span>
  )
}
