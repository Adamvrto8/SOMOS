import type { ReactNode } from 'react'

interface SectionTitleProps {
  id: string
  children: ReactNode
}

export function SectionTitle({ id, children }: SectionTitleProps) {
  return (
    <h2 id={id} className="mb-3 text-xs font-semibold tracking-widest text-ink-muted uppercase">
      {children}
    </h2>
  )
}
