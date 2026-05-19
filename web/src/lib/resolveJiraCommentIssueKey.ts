import type { WorkComment, WorkItem } from '../types'

/** Issue key to use for Jira REST on this comment (stored on row, single linked key, or explicit pick). */
export function resolveIssueKeyForJiraComment(
  comment: WorkComment,
  item: WorkItem,
  pickedKey?: string,
): string | null {
  if (typeof comment.jiraIssueKey === 'string' && comment.jiraIssueKey.trim()) {
    return comment.jiraIssueKey.trim().toUpperCase()
  }
  const keys = item.jiraKeys.map((k) => String(k).trim()).filter(Boolean)
  if (keys.length === 1) return keys[0].toUpperCase()
  if (pickedKey?.trim()) return pickedKey.trim().toUpperCase()
  return null
}

export function jiraNumericIdFromCommentId(commentId: string): string | null {
  if (!commentId.startsWith('jira-cmt-')) return null
  const n = commentId.slice('jira-cmt-'.length).trim()
  return n || null
}
