import type { ReactNode } from 'react'
import { BackButton } from '../../components/BackButton'

interface SettingsSubpageProps {
  title: string
  children: ReactNode
}

/** One setting on its own page: back to Nastavenia, its name, then the choice and its hint. */
export function SettingsSubpage({ title, children }: SettingsSubpageProps) {
  return (
    <div className="space-y-6">
      <div>
        <BackButton fallback="/archive/settings" />
        <h1 className="mt-2 font-serif text-3xl leading-tight font-semibold tracking-tight">{title}</h1>
      </div>
      {children}
    </div>
  )
}

/** The one short explanation under a choice (in the same block as the choice). */
export function SettingsHint({ children }: { children: ReactNode }) {
  return <p className="mt-2 px-1 text-sm leading-relaxed text-ink-muted">{children}</p>
}

/** A titled part of a page with more than one choice: Vzhľad → Téma, Štýl. */
export function SettingsPart({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-2 px-1 text-xs font-semibold tracking-widest text-ink-muted uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}
