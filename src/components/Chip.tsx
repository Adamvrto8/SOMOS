import type { ReactNode } from 'react'

interface ChipProps {
  selected: boolean
  onClick: () => void
  children: ReactNode
}

export function Chip({ selected, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        'h-11 shrink-0 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick',
        selected ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink-muted hover:text-ink',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
