import type { ReactNode } from 'react'

interface BadgeProps {
  tone?: 'default' | 'amber'
  children: ReactNode
}

export function Badge({ tone = 'default', children }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tone === 'amber' ? 'bg-amber/25 text-ink' : 'border border-line text-ink-muted',
      ].join(' ')}
    >
      {children}
    </span>
  )
}
