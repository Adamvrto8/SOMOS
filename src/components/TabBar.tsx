import { Bookmark, House, PencilLine, Search, type LucideIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router'

interface Tab {
  to: string
  label: string
  icon: LucideIcon
  // Paths (besides `to`) that belong to this tab, e.g. word detail under Hľadať.
  sections?: string[]
}

const TABS: Tab[] = [
  { to: '/', label: 'Domov', icon: House },
  { to: '/search', label: 'Hľadať', icon: Search, sections: ['/word', '/topic'] },
  { to: '/practice', label: 'Cvičiť', icon: PencilLine },
  { to: '/archive', label: 'Archív', icon: Bookmark },
]

const isUnder = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

function isActive(tab: Tab, pathname: string) {
  if (tab.to === '/') return pathname === '/'
  return [tab.to, ...(tab.sections ?? [])].some((base) => isUnder(pathname, base))
}

export function TabBar() {
  const { pathname } = useLocation()

  return (
    <nav aria-label="Hlavná navigácia" className="fixed inset-x-0 bottom-0 z-20">
      <div className="mx-auto max-w-[480px] border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:border-x">
        <ul className="grid grid-cols-4">
          {TABS.map((tab) => {
            const active = isActive(tab, pathname)
            const Icon = tab.icon
            return (
              <li key={tab.to}>
                <Link
                  to={tab.to}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'flex h-16 flex-col items-center justify-center gap-1 text-xs transition-colors duration-150',
                    'focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-brick',
                    active ? 'font-semibold text-brick' : 'text-ink-muted hover:text-ink',
                  ].join(' ')}
                >
                  <Icon size={24} strokeWidth={1.75} aria-hidden />
                  {tab.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
