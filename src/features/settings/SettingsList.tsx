import { ChevronRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

interface SettingsGroupProps {
  id: string
  title?: string
  children: ReactNode
}

/** A titled card of rows, as in the settings of a phone. */
export function SettingsGroup({ id, title, children }: SettingsGroupProps) {
  return (
    <section aria-labelledby={title ? id : undefined}>
      {title && (
        <h2 id={id} className="mb-2 px-1 text-xs font-semibold tracking-widest text-ink-muted uppercase">
          {title}
        </h2>
      )}
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">{children}</ul>
    </section>
  )
}

interface SettingsRowProps {
  to: string
  icon: LucideIcon
  title: string
  detail?: ReactNode // a second line under the title
  value?: string // what is set now, at the right edge
}

/** One row of a group: icon, name, what is set now, and › to its own page. */
export function SettingsRow({ to, icon: Icon, title, detail, value }: SettingsRowProps) {
  return (
    <li>
      <Link
        to={to}
        className="flex min-h-13 items-center gap-3 px-4 py-2 transition-colors duration-150 hover:bg-surface-2/60 focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-brick active:bg-surface-2"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-brick">
          <Icon size={18} strokeWidth={1.75} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate leading-snug">{title}</span>
          {detail && <span className="block truncate text-sm text-ink-muted">{detail}</span>}
        </span>
        {value && <span className="max-w-[45%] shrink-0 truncate text-sm text-ink-muted">{value}</span>}
        <ChevronRight size={18} strokeWidth={1.75} className="-mr-1 shrink-0 text-ink-muted" aria-hidden />
      </Link>
    </li>
  )
}
