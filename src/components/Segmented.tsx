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
  // Too many options for the width: scroll sideways instead of squeezing.
  scroll?: boolean
}

/** Pill-shaped segmented control; arrow keys move the selection (WAI-ARIA tabs/radio). */
export function Segmented<T extends string>({ options, value, onChange, label, mode, idPrefix, panelId, scroll }: SegmentedProps<T>) {
  const select = (id: T, focus: boolean) => {
    onChange(id)
    const button = document.getElementById(`${idPrefix}-${id}`)
    if (focus) button?.focus()
    if (scroll) button?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const index = options.findIndex((o) => o.id === value)
    select(options[(index + step + options.length) % options.length].id, true)
  }

  return (
    <div
      role={mode === 'tabs' ? 'tablist' : 'radiogroup'}
      aria-label={label}
      className={`flex rounded-full bg-surface-2 p-1 ${scroll ? 'no-scrollbar overflow-x-auto' : ''}`}
    >
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
            onClick={() => select(option.id, false)}
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
