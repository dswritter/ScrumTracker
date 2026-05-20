import { type KeyboardEvent, type SyntheticEvent, useState } from 'react'

export function filterMentions(names: string[], q: string): string[] {
  const t = q.trim().toLowerCase()
  const list = t ? names.filter((n) => n.toLowerCase().includes(t)) : [...names]
  return list.sort((a, b) => a.localeCompare(b)).slice(0, 8)
}

type TextInput = HTMLInputElement | HTMLTextAreaElement

/**
 * Reusable @mention popup logic for any controlled text input or textarea.
 * Caller supplies the current value, a value setter, the list of mentionable
 * names, and a ref to the DOM element (for cursor manipulation).
 */
export function useMentionPopup(
  value: string,
  setValue: (v: string) => void,
  mentionNames: string[],
  getEl: () => TextInput | null | undefined,
) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [query, setQuery] = useState('')

  const matches = filterMentions(mentionNames, query)

  function updateFromCursor(val: string, cursor: number) {
    const before = val.slice(0, cursor)
    const at = before.lastIndexOf('@')
    if (at < 0) { setOpen(false); setMentionStart(null); return }
    const afterAt = before.slice(at + 1)
    if (/[\s\n]/.test(afterAt)) { setOpen(false); setMentionStart(null); return }
    setMentionStart(at)
    setQuery(afterAt)
    setOpen(true)
    setHighlight(0)
  }

  function insertMention(name: string) {
    if (mentionStart == null) return
    const el = getEl()
    const cursor = el?.selectionStart ?? value.length
    const before = value.slice(0, mentionStart)
    const after = value.slice(cursor)
    const insert = `@${name} `
    setValue(before + insert + after)
    setOpen(false)
    setMentionStart(null)
    requestAnimationFrame(() => {
      const pos = before.length + insert.length
      el?.focus()
      el?.setSelectionRange(pos, pos)
    })
  }

  function onKeyDown(e: KeyboardEvent<TextInput>) {
    if (!open || matches.length === 0) return
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

  function onAfterInput(e: SyntheticEvent<TextInput>) {
    const el = e.currentTarget
    updateFromCursor(el.value, el.selectionStart ?? el.value.length)
  }

  return { open, setOpen, highlight, matches, insertMention, onKeyDown, onAfterInput }
}
