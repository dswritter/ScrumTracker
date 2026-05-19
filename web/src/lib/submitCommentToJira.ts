import { postJiraIssueComment, putJiraIssueCommentUpdate } from './jiraApi'
import { isAdmin } from './permissions'
import type { TrackerUserAccount } from '../types'

/** Post plain comment text to Jira (same PAT rules as sync). */
export async function submitCommentToJiraIssue(opts: {
  teamId: string
  issueKey: string
  bodyPlain: string
  user: TrackerUserAccount
}): Promise<
  { ok: true; jiraCommentId: string } | { ok: false; message: string }
> {
  const syncMode = isAdmin(opts.user) ? ('admin' as const) : ('individual' as const)
  const trackerUsername = isAdmin(opts.user) ? undefined : opts.user.username
  const issueKey = opts.issueKey.trim().toUpperCase()
  const res = await postJiraIssueComment({
    teamId: opts.teamId,
    issueKey,
    body: opts.bodyPlain,
    syncMode,
    ...(trackerUsername ? { trackerUsername } : {}),
  })
  if (!res.ok) {
    const message = await res.text()
    return { ok: false, message }
  }
  const data = (await res.json()) as { ok?: boolean; jiraCommentId?: string }
  if (data.ok === true && data.jiraCommentId) {
    return { ok: true, jiraCommentId: String(data.jiraCommentId) }
  }
  return { ok: false, message: 'Jira did not return a comment id.' }
}

/** After a local comment is saved, optionally post the same text to one Jira issue and retag for sync dedupe. */
export async function postTrackerCommentToJiraIfRequested(input: {
  newCommentId: string
  bodyPlain: string
  alsoToJira: boolean
  issueKey: string | undefined
  teamId: string
  itemId: string
  user: TrackerUserAccount
  retagCommentWithJiraId: (
    teamId: string,
    itemId: string,
    localCommentId: string,
    jiraCommentId: string,
    jiraIssueKey?: string,
  ) => void
}): Promise<void> {
  if (!input.alsoToJira) return
  const key = input.issueKey?.trim()
  if (!key) return
  try {
    const r = await submitCommentToJiraIssue({
      teamId: input.teamId,
      issueKey: key,
      bodyPlain: input.bodyPlain,
      user: input.user,
    })
    if (!r.ok) {
      if (typeof window !== 'undefined') {
        window.alert(
          `Comment saved in the tracker but could not be posted to Jira (${key}): ${r.message.slice(0, 500)}`,
        )
      }
      return
    }
    input.retagCommentWithJiraId(
      input.teamId,
      input.itemId,
      input.newCommentId,
      r.jiraCommentId,
      key,
    )
  } catch (e) {
    if (typeof window !== 'undefined') {
      window.alert(
        `Comment saved in the tracker but Jira request failed (${key}): ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }
}

/** Push an existing tracker-only comment to Jira and retag. */
export async function pushExistingTrackerCommentToJira(input: {
  teamId: string
  itemId: string
  localCommentId: string
  bodyPlain: string
  issueKey: string
  user: TrackerUserAccount
  retagCommentWithJiraId: (
    teamId: string,
    itemId: string,
    localCommentId: string,
    jiraCommentId: string,
    jiraIssueKey?: string,
  ) => void
}): Promise<void> {
  const key = input.issueKey.trim().toUpperCase()
  try {
    const r = await submitCommentToJiraIssue({
      teamId: input.teamId,
      issueKey: key,
      bodyPlain: input.bodyPlain,
      user: input.user,
    })
    if (!r.ok) {
      if (typeof window !== 'undefined') {
        window.alert(
          `Could not post to Jira (${key}): ${r.message.slice(0, 500)}`,
        )
      }
      return
    }
    input.retagCommentWithJiraId(
      input.teamId,
      input.itemId,
      input.localCommentId,
      r.jiraCommentId,
      key,
    )
  } catch (e) {
    if (typeof window !== 'undefined') {
      window.alert(
        `Jira request failed (${key}): ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }
}

/** Update Jira comment body when the tracker row is a jira-cmt-* mirror. */
export async function updateJiraWorkItemCommentBody(opts: {
  teamId: string
  issueKey: string
  jiraCommentNumericId: string
  bodyPlain: string
  user: TrackerUserAccount
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const syncMode = isAdmin(opts.user) ? ('admin' as const) : ('individual' as const)
  const trackerUsername = isAdmin(opts.user) ? undefined : opts.user.username
  const res = await putJiraIssueCommentUpdate({
    teamId: opts.teamId,
    issueKey: opts.issueKey.trim().toUpperCase(),
    jiraCommentId: opts.jiraCommentNumericId,
    body: opts.bodyPlain,
    syncMode,
    ...(trackerUsername ? { trackerUsername } : {}),
  })
  if (!res.ok) {
    return { ok: false, message: await res.text() }
  }
  const data = (await res.json()) as { ok?: boolean }
  if (data.ok === true) return { ok: true }
  return { ok: false, message: 'Unexpected Jira response.' }
}
