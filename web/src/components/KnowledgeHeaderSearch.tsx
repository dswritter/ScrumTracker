import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTrackerStore } from '../store/useTrackerStore'
import type { TeamKnowledgePage } from '../types'

/** Stable fallback so the zustand selector does not return a new [] every render (infinite updates / #185). */
const EMPTY_KNOWLEDGE_PAGES: TeamKnowledgePage[] = []

type Props = {
  /** When true, sits inside the fused header pill (no outer border on the field). */
  fused?: boolean
}

export function KnowledgeHeaderSearch({ fused = false }: Props) {
  const user = useCurrentUser()
  const teamId = user?.teamId
  const pages = useTrackerStore((s) =>
    teamId
      ? (s.teamsData[teamId]?.teamKnowledgePages ?? EMPTY_KNOWLEDGE_PAGES)
      : EMPTY_KNOWLEDGE_PAGES,
  )
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const needle = q.trim().toLowerCase()
    if (!needle) {
      navigate('/kb')
      return
    }
    const hit = pages.find((p) => {
      const blob = `${p.title}\n${p.body}`.toLowerCase()
      return blob.includes(needle)
    })
    if (hit) {
      navigate(`/kb/${hit.id}`)
      return
    }
    const first = pages[0]
    if (first) {
      navigate(`/kb/${first.id}?find=${encodeURIComponent(needle)}`)
    } else {
      navigate('/kb')
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      title="Tip: press . anywhere (outside a field) to focus this search"
      className={
        fused
          ? 'relative min-w-0 flex-1'
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
            ? 'w-full border-0 bg-transparent py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-none placeholder:text-slate-400 focus:border-0 focus:outline-none focus:ring-0 dark:bg-transparent dark:text-slate-100 dark:placeholder:text-slate-500'
            : 'w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#00B050] focus:outline-none focus:ring-1 focus:ring-[#00B050]/40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500'
        }
        aria-label="Search team knowledge"
      />
    </form>
  )
}
