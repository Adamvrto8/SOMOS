import { Search, X } from 'lucide-react'
import { useRef } from 'react'

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
  autoFocus?: boolean
}

export function SearchField({ value, onChange, label, placeholder, autoFocus }: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        inputRef.current?.blur() // closes the keyboard so results are visible
      }}
      className="relative"
    >
      <Search
        size={20}
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={label}
        enterKeyHint="search"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="h-12 w-full rounded-2xl border border-line bg-surface pr-12 pl-12 text-base transition-colors duration-150 placeholder:text-ink-muted focus:border-brick focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
          aria-label="Vymazať"
          className="absolute top-1/2 right-0.5 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:text-ink"
        >
          <X size={18} strokeWidth={1.75} aria-hidden />
        </button>
      )}
    </form>
  )
}
