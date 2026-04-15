import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import MDEditor, {
  type ExecuteState,
  type ICommand,
  type TextAreaTextApi,
} from '@uiw/react-md-editor'
import '@uiw/react-md-editor/markdown-editor.css'
import { KnowledgeMarkdown } from '../components/KnowledgeMarkdown'
import {
  KB_PAGE_WIDTH_CLASS,
  KnowledgePageDialNav,
} from '../components/KnowledgePageDialNav'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import { useTrackerStore } from '../store/useTrackerStore'
import type { TeamKnowledgePage } from '../types'

const EMPTY_KB_PAGES: TeamKnowledgePage[] = []

function useMdEditorColorMode(): 'light' | 'dark' {
  const [mode, setMode] = useState<'light' | 'dark'>(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setMode(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mode
}

function MarkdownHelpHint() {
  return (
    <p className="text-xs text-slate-600 dark:text-slate-400">
      Content is saved as Markdown. Use the toolbar to format; images must use{' '}
      <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">https://</code>{' '}
      URLs (no uploads).{' '}
      <details className="ml-1 inline align-baseline">
        <summary className="cursor-pointer font-semibold text-[#007a3d] dark:text-emerald-300">
          More tips
        </summary>
        <span className="mt-1 block max-w-prose rounded border border-slate-200 bg-slate-50/90 p-2 text-[11px] leading-snug dark:border-slate-600 dark:bg-slate-800/50">
          Keyboard: lists and headings from the toolbar; paste plain text freely.
          For images, use the image button or the “Insert image URL” control to
          add <code className="rounded bg-white px-0.5 dark:bg-slate-900">![alt](url)</code>.
        </span>
      </details>
    </p>
  )
}

export function KnowledgeBase() {
  const mdColorMode = useMdEditorColorMode()
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
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageAlt, setImageAlt] = useState('')
  const imageApiRef = useRef<TextAreaTextApi | null>(null)

  const idx = useMemo(
    () => (pageId ? pages.findIndex((p) => p.id === pageId) : -1),
    [pageId, pages],
  )
  const page = idx >= 0 ? pages[idx]! : null

  const imageCommandFilter = useCallback((command: ICommand, isExtra: boolean) => {
    if (isExtra || command.keyCommand !== 'image') return command
    return {
      ...command,
      execute: (_state: ExecuteState, api: TextAreaTextApi) => {
        imageApiRef.current = api
        setImageUrl('')
        setImageAlt('')
        setImageModalOpen(true)
      },
    }
  }, [])

  const closeImageModal = useCallback(() => {
    setImageModalOpen(false)
    imageApiRef.current = null
  }, [])

  const confirmInsertImage = useCallback(() => {
    const url = imageUrl.trim()
    if (!/^https:\/\//i.test(url)) {
      window.alert('Image URL must start with https://')
      return
    }
    const alt = (imageAlt.trim() || 'Image').replace(/[[\]]/g, '')
    const api = imageApiRef.current
    if (api) {
      api.replaceSelection(`![${alt}](${url})`)
    } else {
      setDraftBody((b) => `${b}${b && !b.endsWith('\n') ? '\n' : ''}![${alt}](${url})\n`)
    }
    closeImageModal()
  }, [imageUrl, imageAlt, closeImageModal])

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
      {imageModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={closeImageModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="kb-image-dialog-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="kb-image-dialog-title"
              className="text-sm font-bold text-slate-900 dark:text-slate-100"
            >
              Insert image from URL
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Use an <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">https://</code>{' '}
              link only.
            </p>
            <label className="mt-3 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Image URL
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="https://…"
                autoComplete="off"
              />
            </label>
            <label className="mt-2 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Alt text
              <input
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="Description"
              />
            </label>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeImageModal}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmInsertImage}
                className="rounded-lg bg-[#00B050] px-3 py-1.5 text-xs font-bold text-white"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
            <MarkdownHelpHint />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
                onClick={() => {
                  imageApiRef.current = null
                  setImageUrl('')
                  setImageAlt('')
                  setImageModalOpen(true)
                }}
              >
                Insert image URL…
              </button>
            </div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Title
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <div data-color-mode={mdColorMode} className="min-h-0">
              <MDEditor
                value={draftBody}
                onChange={(v) => setDraftBody(v ?? '')}
                preview="live"
                height={420}
                visibleDragbar
                textareaProps={{
                  spellCheck: true,
                  'aria-label': 'Markdown content',
                }}
                commandsFilter={imageCommandFilter}
              />
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

      {!editing && pages.length > 1 ? (
        <KnowledgePageDialNav pages={pages} currentId={page.id} />
      ) : null}
    </div>
  )
}
