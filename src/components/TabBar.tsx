import { Bookmark, House, PencilLine, Search, type LucideIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { useT } from '../i18n'

interface Tab {
  to: string
  key: 'home' | 'search' | 'practice' | 'archive' // its name in the dictionary
  icon: LucideIcon
  // Paths (besides `to`) that belong to this tab, e.g. word detail under Hľadať.
  sections?: string[]
}

const TABS: Tab[] = [
  { to: '/', key: 'home', icon: House, sections: ['/stats'] },
  { to: '/search', key: 'search', icon: Search, sections: ['/word', '/topic'] },
  { to: '/practice', key: 'practice', icon: PencilLine },
  { to: '/archive', key: 'archive', icon: Bookmark },
]

const isUnder = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

function isActive(tab: Tab, pathname: string) {
  // "/" is the base of every path: Domov is itself and its own sections only.
  const bases = tab.to === '/' ? (tab.sections ?? []) : [tab.to, ...(tab.sections ?? [])]
  return pathname === tab.to || bases.some((base) => isUnder(pathname, base))
}

export function TabBar() {
  const { pathname } = useLocation()
  const text = useT().nav

  return (
    // Hidden while the phone keyboard is open: it would otherwise ride on top of it and take the room for typing.
    <nav aria-label={text.main} className="fixed inset-x-0 bottom-0 z-20 keyboard:hidden">
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
                  {text[tab.key]}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
