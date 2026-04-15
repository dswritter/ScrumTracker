import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTrackerStore } from '../store/useTrackerStore'

export function KnowledgeHeaderSearch() {
  const user = useCurrentUser()
  const teamId = user?.teamId
  const pages = useTrackerStore((s) =>
    teamId ? (s.teamsData[teamId]?.teamKnowledgePages ?? []) : [],
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
    if (hit) navigate(`/kb/${hit.id}`)
    else navigate('/kb')
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full min-w-0">
      <i
        className="fa-solid fa-magnifying-glass pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500"
        aria-hidden
      />
      <input
        type="search"
        placeholder="Search knowledge…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#00B050] focus:outline-none focus:ring-1 focus:ring-[#00B050]/40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
        aria-label="Search team knowledge"
      />
    </form>
  )
}
