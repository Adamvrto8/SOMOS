import type { ReactNode } from 'react'
import { Azulejos } from '../../components/Azulejos'

interface EmptyStateProps {
  title: string
  text: string
  action?: ReactNode
}

export function EmptyState({ title, text, action }: EmptyStateProps) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="relative h-24 border-b border-line bg-surface-2">
        <Azulejos className="opacity-25 dark:opacity-20" />
      </div>
      <div className="px-6 pt-5 pb-6 text-center">
        <p className="font-serif text-xl font-semibold">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{text}</p>
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </div>
    </div>
  )
}
