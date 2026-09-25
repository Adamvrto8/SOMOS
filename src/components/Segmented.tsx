import type { KeyboardEvent, ReactNode } from 'react'

interface Option<T extends string> {
  id: T
  label: ReactNode
}

interface SegmentedProps<T extends string> {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  // "tabs" switches a panel (give it `panelId`), "radio" picks a setting.
  mode: 'tabs' | 'radio'
  idPrefix: string
  panelId?: string
}

/** Pill-shaped segmented control; arrow keys move the selection (WAI-ARIA tabs/radio). */
export function Segmented<T extends string>({ options, value, onChange, label, mode, idPrefix, panelId }: SegmentedProps<T>) {
  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const index = options.findIndex((o) => o.id === value)
    const next = options[(index + step + options.length) % options.length].id
    onChange(next)
    document.getElementById(`${idPrefix}-${next}`)?.focus()
  }

  return (
    <div role={mode === 'tabs' ? 'tablist' : 'radiogroup'} aria-label={label} className="flex rounded-full bg-surface-2 p-1">
      {options.map((option) => {
        const selected = option.id === value
        return (
          <button
            key={option.id}
            id={`${idPrefix}-${option.id}`}
            type="button"
            role={mode === 'tabs' ? 'tab' : 'radio'}
            aria-selected={mode === 'tabs' ? selected : undefined}
            aria-checked={mode === 'radio' ? selected : undefined}
            aria-controls={mode === 'tabs' ? panelId : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={onKeyDown}
            className={[
              // flex-auto: a longer label ("Podľa systému") takes more room instead of wrapping.
              'h-10 flex-auto rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick',
              selected ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
