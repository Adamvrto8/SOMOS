import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { TurnDirection } from '../lib/pageTurn'

interface PagerProps {
  label: string // what is being paged through, for screen readers
  previous: string
  next: string
  index: number
  total: number
  onTurn: (dir: TurnDirection) => void
}

/** ‹ n / N › */
export function Pager({ label, previous, next, index, total, onTurn }: PagerProps) {
  return (
    <nav aria-label={label} className="-mr-2 flex items-center">
      <PagerButton label={previous} disabled={index <= 0} onClick={() => onTurn('prev')}>
        <ChevronLeft size={20} strokeWidth={1.75} aria-hidden />
      </PagerButton>
      <span className="min-w-12 text-center text-sm text-ink-muted tabular-nums">
        {index + 1} / {total}
      </span>
      <PagerButton label={next} disabled={index >= total - 1} onClick={() => onTurn('next')}>
        <ChevronRight size={20} strokeWidth={1.75} aria-hidden />
      </PagerButton>
    </nav>
  )
}

interface PagerButtonProps {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}

function PagerButton({ label, disabled, onClick, children }: PagerButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick disabled:opacity-30"
    >
      {children}
    </button>
  )
}
