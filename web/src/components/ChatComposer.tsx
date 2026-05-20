import { useRef } from 'react'
import { useMentionPopup } from '../hooks/useMentionPopup'

type Props = {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  placeholder: string
  mentionNames: string[]
  disabled?: boolean
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
  const mention = useMentionPopup(value, onChange, mentionNames, () => inputRef.current)

  return (
    <div className="relative min-w-0 flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value)
          mention.onAfterInput(e)
        }}
        onKeyDown={(e) => {
          mention.onKeyDown(e)
          if (!mention.open && e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSubmit()
          }
        }}
        onKeyUp={mention.onAfterInput}
        onClick={mention.onAfterInput}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#00B050] focus:outline-none focus:ring-1 focus:ring-[#00B050]"
      />
      {mention.open && mention.matches.length > 0 ? (
        <ul
          className="absolute bottom-full left-0 z-20 mb-1 max-h-48 w-full min-w-[12rem] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {mention.matches.map((name, i) => (
            <li key={name} role="option" aria-selected={i === mention.highlight}>
              <button
                type="button"
                className={`flex w-full px-3 py-2 text-left text-sm ${
                  i === mention.highlight
                    ? 'bg-[#00B050]/15 text-[#0d5c2e]'
                    : 'text-slate-800 hover:bg-slate-50'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => mention.insertMention(name)}
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
