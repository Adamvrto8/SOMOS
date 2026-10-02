import { useRef, useState, type KeyboardEvent } from 'react'
import type { Grade } from '../../../lib/lesson'
import { RetryHint } from './RetryHint'
import type { Status } from './status'

// Characters a Slovak keyboard doesn't have at hand.
const EXTRA_KEYS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡']

const BORDER: Record<Status, string> = {
  correct: 'border-leaf',
  warn: 'border-amber',
  wrong: 'border-error',
}

interface TypedAnswerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  label: string
  placeholder: string
  status?: Status // set once graded; the field is then read-only
  multiline?: boolean
  lang?: 'es' | 'sk' // language typed; Slovak needs no Spanish extra keys
  hint?: Grade | null // a wrong try that may still be fixed
}

export function TypedAnswer({ value, onChange, onSubmit, label, placeholder, status, multiline, lang = 'es', hint }: TypedAnswerProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const locked = status !== undefined
  // The text a hint is about. Once the learner changes it, the hint belongs to the previous try and fades.
  const [checked, setChecked] = useState({ hint, value })
  if (checked.hint !== hint) setChecked({ hint, value })
  const stale = checked.hint === hint && checked.value !== value

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter checks the answer (keyboard "done" key); no line breaks in answers.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      onSubmit()
    }
  }

  const insert = (char: string) => {
    const el = ref.current
    if (!el || locked) return
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    onChange(value.slice(0, start) + char + value.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + char.length, start + char.length)
    })
  }

  return (
    <div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '))}
        onKeyDown={onKeyDown}
        readOnly={locked}
        rows={multiline ? 3 : 1}
        autoFocus
        lang={lang}
        aria-label={label}
        placeholder={placeholder}
        enterKeyHint="done"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        className={[
          'block w-full resize-none rounded-2xl border-2 bg-surface px-4 py-3 font-serif text-xl leading-snug transition-colors duration-150',
          'placeholder:font-sans placeholder:text-base placeholder:text-ink-muted focus:outline-none',
          status ? BORDER[status] : 'border-line focus:border-brick',
        ].join(' ')}
      />
      {hint && !locked && <RetryHint grade={hint} stale={stale} />}
      {!locked && lang === 'es' && (
        // One row at any width: the room above the phone keyboard is short.
        <div className="mt-2 grid grid-cols-9 gap-1" aria-label="Špeciálne znaky">
          {EXTRA_KEYS.map((char) => (
            <button
              key={char}
              type="button"
              tabIndex={-1}
              // Keep focus (and the phone keyboard) in the text field.
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => insert(char)}
              aria-label={`Vložiť ${char}`}
              className="flex h-11 items-center justify-center rounded-lg border border-line bg-surface font-serif text-lg transition-colors duration-150 hover:bg-surface-2 active:bg-surface-2"
            >
              {char}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
