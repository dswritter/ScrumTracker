import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listAllSearchMatches } from '../lib/knowledgeMarkdown'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTrackerStore } from '../store/useTrackerStore'
import type { TeamKnowledgePage } from '../types'

/** Stable fallback so the zustand selector does not return a new [] every render (infinite updates / #185). */
const EMPTY_KNOWLEDGE_PAGES: TeamKnowledgePage[] = []

type Props = {
  /** When true, sits inside the fused header pill (no outer border on the field). */
  fused?: boolean
  /** When fused, expand/collapse is controlled by the parent (Layout) so the pill width can follow. */
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
}

export function KnowledgeHeaderSearch({
  fused = false,
  expanded: expandedProp,
  onExpandedChange,
}: Props) {
  const user = useCurrentUser()
  const teamId = user?.teamId
  const pages = useTrackerStore((s) =>
    teamId
      ? (s.teamsData[teamId]?.teamKnowledgePages ?? EMPTY_KNOWLEDGE_PAGES)
      : EMPTY_KNOWLEDGE_PAGES,
  )
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [internalExpanded, setInternalExpanded] = useState(!fused)

  const expanded = fused ? Boolean(expandedProp) : internalExpanded
  const setExpanded = (v: boolean) => {
    if (fused) onExpandedChange?.(v)
    else setInternalExpanded(v)
  }

  useEffect(() => {
    if (expanded && fused) {
      requestAnimationFrame(() => {
        document.getElementById('kb-knowledge-search-input')?.focus()
      })
    }
  }, [expanded, fused])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const raw = q.trim()
    if (!raw) {
      navigate('/kb')
      if (fused) setExpanded(false)
      return
    }
    const matches = listAllSearchMatches(raw, pages)
    if (matches.length > 0) {
      const best = matches[0]!.page
      navigate(`/kb/${best.id}?q=${encodeURIComponent(raw)}`)
      if (fused) setExpanded(false)
      return
    }
    const first = pages[0]
    if (first) {
      navigate(`/kb/${first.id}?find=${encodeURIComponent(raw.toLowerCase())}`)
    } else {
      navigate('/kb')
    }
    if (fused) setExpanded(false)
  }

  if (fused && !expanded) {
    return (
      <button
        type="button"
        className="flex h-full w-full min-w-0 items-center justify-center px-3 py-2 text-slate-500 transition-colors hover:text-[#007a3d] dark:text-slate-400 dark:hover:text-emerald-300"
        aria-label="Open knowledge search"
        onClick={() => setExpanded(true)}
      >
        <i className="fa-solid fa-magnifying-glass text-sm" aria-hidden />
      </button>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      title="Tip: press . anywhere (outside a field) to open search"
      className={
        fused
          ? 'relative flex h-full min-w-0 w-full flex-1'
          : 'relative w-full min-w-0'
      }
    >
      <i
        className={`fa-solid fa-magnifying-glass pointer-events-none absolute top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500 ${
          fused ? 'left-3' : 'left-2.5'
        }`}
        aria-hidden
      />
      <input
        id="kb-knowledge-search-input"
        type="search"
        placeholder="Search knowledge…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className={
          fused
            ? 'w-full min-w-0 border-0 bg-transparent py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-none placeholder:text-slate-400 focus:border-0 focus:outline-none focus:ring-0 dark:bg-transparent dark:text-slate-100 dark:placeholder:text-slate-500'
            : 'w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#00B050] focus:outline-none focus:ring-1 focus:ring-[#00B050]/40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500'
        }
        aria-label="Search team knowledge"
      />
    </form>
  )
}
