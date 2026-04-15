import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ClipboardEvent, DragEvent, InputHTMLAttributes } from 'react'
import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import MDEditor, {
  type ExecuteState,
  type ICommand,
  type TextAreaTextApi,
} from '@uiw/react-md-editor'
import '@uiw/react-md-editor/markdown-editor.css'
import { KnowledgeFindPanel } from '../components/KnowledgeFindPanel'
import { KnowledgeMarkdown } from '../components/KnowledgeMarkdown'
import { KnowledgeSearchMatchesPanel } from '../components/KnowledgeSearchMatchesPanel'
import {
  KB_PAGE_WIDTH_CLASS,
  KnowledgePageDialNav,
} from '../components/KnowledgePageDialNav'
import { KnowledgeTableModal } from '../components/KnowledgeTableModal'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import {
  listAllSearchMatches,
  rankKnowledgePagesByQuery,
  sanitizeTableCellsInMarkdown,
  toggleNthTaskListItem,
} from '../lib/knowledgeMarkdown'
import { useTrackerStore } from '../store/useTrackerStore'
import type { TeamKnowledgePage } from '../types'

const EMPTY_KB_PAGES: TeamKnowledgePage[] = []
const DEFAULT_NEW_TITLE = 'New page'
const MAX_INLINE_IMAGE_BYTES = 2_000_000

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

function buildMdPreviewOptions(
  setDraftBody: React.Dispatch<React.SetStateAction<string>>,
) {
  let taskIdx = 0
  return {
    components: {
      input(props: InputHTMLAttributes<HTMLInputElement>) {
        if (props.type !== 'checkbox') {
          return <input {...props} />
        }
        const idx = taskIdx++
        return (
          <input
            type="checkbox"
            className={props.className}
            checked={!!props.checked}
            onChange={() => {
              setDraftBody((b) => toggleNthTaskListItem(b, idx) ?? b)
            }}
          />
        )
      },
    },
  }
}

async function fileToImageMarkdownSnippet(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null
  if (file.size > MAX_INLINE_IMAGE_BYTES) {
    window.alert(
      `Image is too large (${Math.round(file.size / 1024)} KB). Max ${Math.round(MAX_INLINE_IMAGE_BYTES / 1024)} KB for inline upload.`,
    )
    return null
  }
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const data = String(r.result ?? '')
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[[\]]/g, '') || 'Image'
      resolve(`![${base}](${data})`)
    }
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(file)
  })
}

export function KnowledgeBase() {
  const mdColorMode = useMdEditorColorMode()
  const { pageId } = useParams<{ pageId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const findRaw = searchParams.get('find')?.trim() ?? ''
  const highlightQ = searchParams.get('q')?.trim() ?? ''
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
  const [tableModalOpen, setTableModalOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageAlt, setImageAlt] = useState('')
  const imageApiRef = useRef<TextAreaTextApi | null>(null)
  const tableApiRef = useRef<TextAreaTextApi | null>(null)
  const editorSurfaceRef = useRef<HTMLDivElement | null>(null)

  const idx = useMemo(
    () => (pageId ? pages.findIndex((p) => p.id === pageId) : -1),
    [pageId, pages],
  )
  const page = idx >= 0 ? pages[idx]! : null

  const findSuggestions = useMemo(() => {
    if (!findRaw) return []
    return rankKnowledgePagesByQuery(findRaw, pages, 6)
  }, [findRaw, pages])

  const searchMatches = useMemo(
    () => (highlightQ ? listAllSearchMatches(highlightQ, pages) : []),
    [highlightQ, pages],
  )

  const navigatePreservingKbParams = useCallback(
    (path: string) => {
      const s = searchParams.toString()
      navigate(s ? `${path}?${s}` : path)
    },
    [navigate, searchParams],
  )

  const clearSearchQuery = useCallback(() => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.delete('q')
        return n
      },
      { replace: true },
    )
  }, [setSearchParams])

  const goRelative = useCallback(
    (delta: -1 | 1) => {
      const n = idx + delta
      if (n < 0 || n >= pages.length) return
      const p = pages[n]!
      navigatePreservingKbParams(`/kb/${p.id}`)
    },
    [idx, pages, navigatePreservingKbParams],
  )

  const pageHref = useCallback(
    (id: string) => {
      const s = searchParams.toString()
      return s ? `/kb/${id}?${s}` : `/kb/${id}`
    },
    [searchParams],
  )

  useEffect(() => {
    if (editing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return
      if (t instanceof HTMLElement && t.closest('[contenteditable="true"]')) return
      e.preventDefault()
      goRelative(e.key === 'ArrowLeft' ? -1 : 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, goRelative])

  const dismissFind = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('find')
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const insertMarkdownAtCursor = useCallback(
    (md: string, api: TextAreaTextApi | null) => {
      if (api) {
        api.replaceSelection(md)
      } else {
        setDraftBody((b) => `${b}${b && !b.endsWith('\n') ? '\n' : ''}${md}\n`)
      }
    },
    [],
  )

  const applyPastedOrDroppedImage = useCallback(
    async (file: File, api: TextAreaTextApi | null) => {
      try {
        const snippet = await fileToImageMarkdownSnippet(file)
        if (snippet) insertMarkdownAtCursor(`${snippet}\n`, api)
      } catch {
        window.alert('Could not read image.')
      }
    },
    [insertMarkdownAtCursor],
  )

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

  const tableCommandFilter = useCallback((command: ICommand, isExtra: boolean) => {
    if (isExtra || command.keyCommand !== 'table') return command
    return {
      ...command,
      execute: (_state: ExecuteState, api: TextAreaTextApi) => {
        tableApiRef.current = api
        setTableModalOpen(true)
      },
    }
  }, [])

  const commandsFilter = useCallback(
    (command: ICommand, isExtra: boolean) =>
      imageCommandFilter(tableCommandFilter(command, isExtra) as ICommand, isExtra),
    [imageCommandFilter, tableCommandFilter],
  )

  const closeImageModal = useCallback(() => {
    setImageModalOpen(false)
    imageApiRef.current = null
  }, [])

  const confirmInsertImage = useCallback(() => {
    const url = imageUrl.trim()
    const isData = /^data:image\//i.test(url)
    if (!isData && !/^https:\/\//i.test(url)) {
      window.alert('Use an https:// image URL or upload a file.')
      return
    }
    const alt = (imageAlt.trim() || 'Image').replace(/[[\]]/g, '')
    const md = `![${alt}](${url})`
    const api = imageApiRef.current
    insertMarkdownAtCursor(`${md}\n`, api)
    closeImageModal()
  }, [imageUrl, imageAlt, closeImageModal, insertMarkdownAtCursor])

  const onImageFileChosen = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      e.target.value = ''
      if (!f) return
      await applyPastedOrDroppedImage(f, imageApiRef.current)
      closeImageModal()
    },
    [applyPastedOrDroppedImage, closeImageModal],
  )

  const startEdit = useCallback(() => {
    if (!page) return
    setDraftTitle(page.title)
    setDraftBody(page.body)
    setEditing(true)
  }, [page])

  const isPristineUnusedNewPage = useCallback(() => {
    if (!page) return false
    const t = draftTitle.trim()
    const b = draftBody.trim()
    return (
      b === '' &&
      (t === '' || t.toLowerCase() === DEFAULT_NEW_TITLE.toLowerCase())
    )
  }, [page, draftTitle, draftBody])

  const cancelEdit = useCallback(() => {
    if (teamId && page && isPristineUnusedNewPage()) {
      const dest = pages[idx + 1] ?? pages[idx - 1]
      deleteKnowledgePage(teamId, page.id)
      if (dest) navigatePreservingKbParams(`/kb/${dest.id}`)
      else navigate('/kb')
      setEditing(false)
      return
    }
    setEditing(false)
  }, [
    teamId,
    page,
    pages,
    idx,
    deleteKnowledgePage,
    navigate,
    navigatePreservingKbParams,
    isPristineUnusedNewPage,
  ])

  const saveEdit = useCallback(() => {
    if (!teamId || !page) return
    updateKnowledgePage(teamId, page.id, {
      title: draftTitle,
      body: draftBody,
    })
    setEditing(false)
  }, [teamId, page, draftTitle, draftBody, updateKnowledgePage])

  const onAddPage = useCallback(() => {
    if (!teamId || !user) return
    const id = addKnowledgePage(teamId, {
      title: DEFAULT_NEW_TITLE,
      body: '',
      authorDisplayName: user.displayName,
    })
    navigate(`/kb/${id}`)
    setDraftTitle(DEFAULT_NEW_TITLE)
    setDraftBody('')
    setEditing(true)
  }, [teamId, user, addKnowledgePage, navigate])

  const onDeletePage = useCallback(() => {
    if (!teamId || !page) return
    if (
      !window.confirm(
        `Delete the page “${page.title}”? This cannot be undone.`,
      )
    ) {
      return
    }
    const dest = pages[idx + 1] ?? pages[idx - 1]
    deleteKnowledgePage(teamId, page.id)
    if (dest) navigatePreservingKbParams(`/kb/${dest.id}`)
    else navigate('/kb')
    setEditing(false)
  }, [teamId, page, pages, idx, deleteKnowledgePage, navigate, navigatePreservingKbParams])

  const onReadTaskChange = useCallback(
    (nextBody: string) => {
      if (!teamId || !page) return
      updateKnowledgePage(teamId, page.id, { body: nextBody })
    },
    [teamId, page, updateKnowledgePage],
  )

  const previewOptions = useMemo(
    () => buildMdPreviewOptions(setDraftBody),
    [],
  )

  const onEditorPaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const file = it.getAsFile()
          if (file) {
            e.preventDefault()
            const ta = e.currentTarget
            const start = ta.selectionStart
            const end = ta.selectionEnd
            void (async () => {
              const snippet = await fileToImageMarkdownSnippet(file)
              if (!snippet) return
              setDraftBody(
                (b) => `${b.slice(0, start)}${snippet}\n${b.slice(end)}`,
              )
              const pos = start + snippet.length + 1
              requestAnimationFrame(() => {
                ta.setSelectionRange(pos, pos)
              })
            })()
          }
          return
        }
      }
    },
    [],
  )

  const onEditorDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onEditorDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const file = Array.from(e.dataTransfer.files).find((f) =>
        f.type.startsWith('image/'),
      )
      if (file) void applyPastedOrDroppedImage(file, null)
    },
    [applyPastedOrDroppedImage],
  )

  useEffect(() => {
    if (!editing) return
    const root = editorSurfaceRef.current
    if (!root) return
    const focusSource = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('.w-md-editor-preview')) {
        const ta = root.querySelector('textarea')
        ta?.focus()
      }
    }
    root.addEventListener('mousedown', focusSource)
    return () => root.removeEventListener('mousedown', focusSource)
  }, [editing])

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

  const qsParts = new URLSearchParams()
  if (findRaw) qsParts.set('find', findRaw)
  if (highlightQ) qsParts.set('q', highlightQ)
  const qs = qsParts.toString() ? `?${qsParts.toString()}` : ''

  if (!pageId) {
    return <Navigate to={`/kb/${pages[0]!.id}${qs}`} replace />
  }

  if (!page) {
    return <Navigate to={`/kb/${pages[0]!.id}${qs}`} replace />
  }

  const headerActions = (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={onAddPage}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        title="Add page"
        aria-label="Add knowledge page"
      >
        <i className="fa-solid fa-plus" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onDeletePage}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-700 shadow-sm hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:bg-slate-800 dark:hover:bg-rose-950/40"
        title="Delete this page"
        aria-label="Delete knowledge page"
      >
        <i className="fa-solid fa-trash-can" aria-hidden />
      </button>
      {!editing ? (
        <button
          type="button"
          onClick={startEdit}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#00B050] text-white shadow-sm hover:bg-[#009948]"
          title="Edit page"
          aria-label="Edit page"
        >
          <i className="fa-solid fa-pen" aria-hidden />
        </button>
      ) : null}
    </div>
  )

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
              Insert image
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Paste or drop images in the editor, or use a URL / file below (stored inline in the page; large images slow down sync).
            </p>
            <label className="mt-3 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Image URL (https)
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
            <label className="mt-3 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Upload file
              <input
                type="file"
                accept="image/*"
                className="mt-1 block w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-2 file:py-1.5 file:text-xs file:font-semibold dark:text-slate-300 dark:file:bg-slate-800"
                onChange={onImageFileChosen}
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
                Insert URL
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <KnowledgeTableModal
        open={tableModalOpen}
        onClose={() => {
          setTableModalOpen(false)
          tableApiRef.current = null
        }}
        onInsert={(md) => {
          const api = tableApiRef.current
          insertMarkdownAtCursor(md, api)
          tableApiRef.current = null
          setTableModalOpen(false)
        }}
      />

      {findRaw ? (
        <KnowledgeFindPanel
          query={findRaw}
          suggestions={findSuggestions}
          onContribute={onAddPage}
          onDismiss={dismissFind}
        />
      ) : null}

      {!editing && highlightQ ? (
        <KnowledgeSearchMatchesPanel
          query={highlightQ}
          currentId={page.id}
          matches={searchMatches}
          onDismiss={clearSearchQuery}
        />
      ) : null}

      <article className="rounded-xl border border-emerald-200/70 bg-[#E8F5E9]/95 shadow-sm dark:border-emerald-900/55 dark:bg-emerald-950/40">
        {editing ? (
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-start gap-3">
              <label className="block min-w-0 flex-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                Title
                <input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="mt-1 w-full max-w-xl rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
              {headerActions}
            </div>
            <div
              ref={editorSurfaceRef}
              data-color-mode={mdColorMode}
              className="kb-md-editor min-h-0"
              onDragOver={onEditorDragOver}
              onDrop={onEditorDrop}
            >
              <MDEditor
                value={draftBody}
                onChange={(v) =>
                  setDraftBody(sanitizeTableCellsInMarkdown(v ?? ''))
                }
                preview="preview"
                height={520}
                visibleDragbar
                autoFocus
                textareaProps={{
                  spellCheck: true,
                  'aria-label': 'Markdown content',
                  onPaste: onEditorPaste,
                }}
                commandsFilter={commandsFilter}
                previewOptions={previewOptions}
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
            </div>
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-start gap-3 border-b border-emerald-200/50 px-5 py-4 dark:border-emerald-900/40">
              <div className="min-w-0 flex-1 pr-2">
                <h2 className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">
                  {page.title}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Updated {new Date(page.updatedAt).toLocaleString()} ·{' '}
                  {page.authorDisplayName}
                </p>
              </div>
              {headerActions}
            </header>
            <div className="px-5 py-4">
              {page.body.trim() ? (
                <KnowledgeMarkdown
                  source={page.body}
                  highlightQuery={highlightQ || undefined}
                  interactiveTasks
                  onTasksSourceChange={onReadTaskChange}
                />
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
        <KnowledgePageDialNav
          pages={pages}
          currentId={page.id}
          onHorizontalStep={goRelative}
          pageHref={pageHref}
        />
      ) : null}
    </div>
  )
}
