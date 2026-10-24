import { Check, type LucideIcon } from 'lucide-react'
import type { KeyboardEvent } from 'react'

export interface Option<T extends string | number> {
  id: T
  label: string
  detail?: string
  icon?: LucideIcon
}

interface OptionListProps<T extends string | number> {
  options: Option<T>[]
  value: T | undefined
  onChange: (value: T) => void
  label: string
}

/** A question's answers as large rows, one of them picked (WAI-ARIA radio group, arrow keys move). */
export function OptionList<T extends string | number>({ options, value, onChange, label }: OptionListProps<T>) {
  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = options[(index + step + options.length) % options.length]
    onChange(next.id)
    ;(e.currentTarget.parentElement?.children[options.indexOf(next)] as HTMLElement | undefined)?.focus()
  }

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-3">
      {options.map((option, index) => {
        const selected = option.id === value
        const Icon = option.icon
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            // The picked row is the one Tab reaches; before any pick, the first.
            tabIndex={selected || (value === undefined && index === 0) ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={[
              'flex min-h-16 w-full items-center gap-4 rounded-card border-2 px-4 py-3 text-left transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick',
              selected ? 'border-brick bg-brick/10' : 'border-line bg-surface hover:border-ink-muted',
            ].join(' ')}
          >
            {Icon && (
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-brick text-on-accent' : 'bg-surface-2 text-brick'}`}>
                <Icon size={20} strokeWidth={1.75} aria-hidden />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{option.label}</span>
              {option.detail && <span className="mt-0.5 block text-sm text-ink-muted">{option.detail}</span>}
            </span>
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-brick bg-brick text-on-accent' : 'border-line'}`}
              aria-hidden
            >
              {selected && <Check size={14} strokeWidth={3} />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
