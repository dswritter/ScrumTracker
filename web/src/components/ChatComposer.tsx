import { type KeyboardEvent, useRef, useState } from 'react'

type Props = {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  placeholder: string
  mentionNames: string[]
  disabled?: boolean
}

function filterMentions(names: string[], q: string): string[] {
  const t = q.trim().toLowerCase()
  const list = t
    ? names.filter((n) => n.toLowerCase().includes(t))
    : [...names]
  return list.sort((a, b) => a.localeCompare(b)).slice(0, 8)
}

/**
 * Single-line composer with @mention substring autocomplete.
 */
export function ChatComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  mentionNames,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [query, setQuery] = useState('')

  const updateMentionFromInput = (val: string, cursor: number) => {
    const before = val.slice(0, cursor)
    const at = before.lastIndexOf('@')
    if (at < 0) {
      setOpen(false)
      setMentionStart(null)
      return
    }
    const afterAt = before.slice(at + 1)
    if (/[\s\n]/.test(afterAt)) {
      setOpen(false)
      setMentionStart(null)
      return
    }
    setMentionStart(at)
    setQuery(afterAt)
    setOpen(true)
    setHighlight(0)
  }

  const matches = filterMentions(mentionNames, query)

  const insertMention = (name: string) => {
    if (mentionStart == null) return
    const el = inputRef.current
    const cursor = el?.selectionStart ?? value.length
    const before = value.slice(0, mentionStart)
    const after = value.slice(cursor)
    const insert = `@${name} `
    const next = before + insert + after
    onChange(next)
    setOpen(false)
    setMentionStart(null)
    requestAnimationFrame(() => {
      const pos = before.length + insert.length
      el?.focus()
      el?.setSelectionRange(pos, pos)
    })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || matches.length === 0) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onSubmit()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(matches.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const pick = matches[highlight] ?? matches[0]
      if (pick) insertMention(pick)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value)
          const c = e.target.selectionStart ?? e.target.value.length
          updateMentionFromInput(e.target.value, c)
        }}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => {
          const el = e.currentTarget
          updateMentionFromInput(el.value, el.selectionStart ?? el.value.length)
        }}
        onClick={(e) => {
          const el = e.currentTarget
          updateMentionFromInput(el.value, el.selectionStart ?? el.value.length)
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#00B050] focus:outline-none focus:ring-1 focus:ring-[#00B050]"
      />
      {open && matches.length > 0 ? (
        <ul
          className="absolute bottom-full left-0 z-20 mb-1 max-h-48 w-full min-w-[12rem] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {matches.map((name, i) => (
            <li key={name} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                className={`flex w-full px-3 py-2 text-left text-sm ${
                  i === highlight
                    ? 'bg-[#00B050]/15 text-[#0d5c2e]'
                    : 'text-slate-800 hover:bg-slate-50'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertMention(name)}
              >
                @{name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

