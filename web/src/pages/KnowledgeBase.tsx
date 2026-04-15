import { useCallback, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { KnowledgeMarkdown } from '../components/KnowledgeMarkdown'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import { useTrackerStore } from '../store/useTrackerStore'
import type { TeamKnowledgePage } from '../types'

/** ~85% of viewport width; matches article + bottom prev/next rail */
const KB_PAGE_WIDTH_CLASS = 'mx-auto w-[min(100%,85vw)]'

const EMPTY_KB_PAGES: TeamKnowledgePage[] = []

function previewSnippet(body: string, max = 120): string {
  const t = body.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t || '—'
  return `${t.slice(0, max - 1)}…`
}

function PagePreviewLink({
  page,
  label,
}: {
  page: TeamKnowledgePage
  label: string
}) {
  return (
    <Link
      to={`/kb/${page.id}`}
      className="flex min-w-0 flex-1 flex-col rounded-lg border border-slate-200 bg-slate-50/90 p-2.5 text-left shadow-sm transition-colors hover:border-[#00B050]/50 hover:bg-white dark:border-slate-600 dark:bg-slate-800/60 dark:hover:bg-slate-800 sm:max-w-[14rem]"
    >
      <span className="text-[10px] font-bold uppercase tracking-wide text-[#007a3d] dark:text-emerald-300">
        {label}
      </span>
      <span className="mt-0.5 truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
        {page.title}
      </span>
      <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
        {previewSnippet(page.body, 100)}
      </span>
    </Link>
  )
}

function MarkdownHelpPanel() {
  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50/80 text-xs dark:border-slate-600 dark:bg-slate-800/50">
      <summary className="cursor-pointer select-none px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
        Markdown tips &amp; images
      </summary>
      <div className="space-y-2 border-t border-slate-200 px-3 py-3 text-slate-600 dark:border-slate-600 dark:text-slate-300">
        <p>
          Content is{' '}
          <strong className="text-slate-800 dark:text-slate-100">Markdown</strong>
          . Plain text still works. Use{' '}
          <code className="rounded bg-white px-1 dark:bg-slate-900">https://</code>{' '}
          links and images only (
          <code className="rounded bg-white px-1 dark:bg-slate-900">
            ![alt](https://…)
          </code>
          ); large pasted images are not stored in the team snapshot.
        </p>
        <ul className="list-inside list-disc space-y-1">
          <li>
            Headings: <code className="rounded bg-white px-1 dark:bg-slate-900">## Title</code>
          </li>
          <li>
            Bold / italic: <code className="rounded bg-white px-1 dark:bg-slate-900">**bold**</code>,{' '}
            <code className="rounded bg-white px-1 dark:bg-slate-900">*italic*</code>
          </li>
          <li>Lists: lines starting with <code className="rounded bg-white px-1 dark:bg-slate-900">-</code> or <code className="rounded bg-white px-1 dark:bg-slate-900">1.</code></li>
          <li>
            Code: <code className="rounded bg-white px-1 dark:bg-slate-900">`inline`</code> or fenced blocks with{' '}
            <code className="rounded bg-white px-1 dark:bg-slate-900">```js</code>
          </li>
          <li>Tables: GitHub-style pipes (see GFM table syntax)</li>
        </ul>
      </div>
    </details>
  )
}

export function KnowledgeBase() {
  const { pageId } = useParams<{ pageId: string }>()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const ctx = useTeamContextNullable()
  const teamId = ctx?.teamId
  const pages = ctx?.teamKnowledgePages ?? EMPTY_KB_PAGES

  const addKnowledgePage = useTrackerStore((s) => s.addKnowledgePage)
  const updateKnowledgePage = useTrackerStore((s) => s.updateKnowledgePage)
  const deleteKnowledgePage = useTrackerStore((s) => s.deleteKnowledgePage)

  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')

  const idx = useMemo(
    () => (pageId ? pages.findIndex((p) => p.id === pageId) : -1),
    [pageId, pages],
  )
  const page = idx >= 0 ? pages[idx]! : null
  const prevPage = idx > 0 ? pages[idx - 1]! : null
  const nextPage = idx >= 0 && idx < pages.length - 1 ? pages[idx + 1]! : null

  const startEdit = useCallback(() => {
    if (!page) return
    setDraftTitle(page.title)
    setDraftBody(page.body)
    setEditing(true)
  }, [page])

  const cancelEdit = useCallback(() => {
    setEditing(false)
  }, [])

  const saveEdit = useCallback(() => {
    if (!teamId || !page) return
    updateKnowledgePage(teamId, page.id, {
      title: draftTitle,
      body: draftBody,
    })
    setEditing(false)
  }, [teamId, page, draftTitle, draftBody, updateKnowledgePage])

  const onAddPage = () => {
    if (!teamId || !user) return
    const id = addKnowledgePage(teamId, {
      title: 'New page',
      body: '',
      authorDisplayName: user.displayName,
    })
    navigate(`/kb/${id}`)
    setDraftTitle('New page')
    setDraftBody('')
    setEditing(true)
  }

  const onDeletePage = () => {
    if (!teamId || !page || !confirm('Delete this knowledge page?')) return
    const next = pages.filter((p) => p.id !== page.id)
    deleteKnowledgePage(teamId, page.id)
    if (next[0]) navigate(`/kb/${next[0].id}`)
    else navigate('/kb')
    setEditing(false)
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md p-8 text-center text-sm text-slate-600 dark:text-slate-400">
        Sign in to view team knowledge.
      </div>
    )
  }
  if (!ctx) {
    return (
      <div className="mx-auto max-w-md p-8 text-center text-sm text-slate-600 dark:text-slate-400">
        Loading team…
      </div>
    )
  }

  if (pages.length === 0) {
    return (
      <div className={`${KB_PAGE_WIDTH_CLASS} space-y-6`}>
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-14 text-center dark:border-slate-600 dark:bg-slate-900/40">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#00B050]/15 text-[#0d5c2e] dark:bg-emerald-950/50 dark:text-emerald-200"
            aria-hidden
          >
            <i className="fa-solid fa-book text-2xl" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">
            Team knowledge
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            No pages yet. Add runbooks, Git/Jira notes, URLs, and setup guides—
            everyone on the team can edit. Pages use Markdown for formatting.
          </p>
          <button
            type="button"
            className="mt-6 rounded-lg bg-[#00B050] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#009948]"
            onClick={onAddPage}
          >
            Add first page
          </button>
        </div>
      </div>
    )
  }

  if (!pageId) {
    return <Navigate to={`/kb/${pages[0]!.id}`} replace />
  }

  if (!page) {
    return <Navigate to={`/kb/${pages[0]!.id}`} replace />
  }

  return (
    <div className={`${KB_PAGE_WIDTH_CLASS} pb-24`}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Team knowledge
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAddPage}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Add page
          </button>
          {!editing ? (
            <button
              type="button"
              onClick={startEdit}
              className="rounded-lg bg-[#00B050] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#009948]"
            >
              Edit
            </button>
          ) : null}
        </div>
      </div>

      <article className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
        {editing ? (
          <div className="space-y-4 p-5">
            <MarkdownHelpPanel />
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Title
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              <label className="block min-h-0 text-xs font-semibold text-slate-600 dark:text-slate-400 lg:col-span-1">
                Markdown
                <textarea
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  rows={20}
                  spellCheck={false}
                  className="mt-1 max-h-[70vh] min-h-[16rem] w-full resize-y rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm leading-relaxed dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  aria-label="Markdown content"
                />
              </label>
              <div className="min-h-0 lg:col-span-1">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Preview
                </p>
                <div className="mt-1 max-h-[70vh] min-h-[16rem] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-600 dark:bg-slate-950/50">
                  <KnowledgeMarkdown source={draftBody} />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveEdit}
                className="rounded-lg bg-[#00B050] px-3 py-1.5 text-xs font-bold text-white"
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDeletePage}
                className="ml-auto rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
              >
                Delete page
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {page.title}
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Updated {new Date(page.updatedAt).toLocaleString()} ·{' '}
                {page.authorDisplayName}
              </p>
            </header>
            <div className="px-5 py-4">
              {page.body.trim() ? (
                <KnowledgeMarkdown source={page.body} />
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  Empty page — click Edit.
                </p>
              )}
            </div>
          </>
        )}
      </article>

      {(prevPage || nextPage) && !editing ? (
        <nav
          className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95"
          aria-label="Adjacent pages"
        >
          <div className={`flex ${KB_PAGE_WIDTH_CLASS} gap-3`}>
            {prevPage ? (
              <PagePreviewLink page={prevPage} label="Previous" />
            ) : (
              <span className="flex-1" />
            )}
            {nextPage ? (
              <PagePreviewLink page={nextPage} label="Next" />
            ) : (
              <span className="flex-1" />
            )}
          </div>
        </nav>
      ) : null}
    </div>
  )
}
