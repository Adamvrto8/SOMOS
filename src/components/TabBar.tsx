import { Bookmark, House, PencilLine, Search, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'

interface Tab {
  to: string
  label: string
  icon: LucideIcon
}

const TABS: Tab[] = [
  { to: '/', label: 'Domov', icon: House },
  { to: '/search', label: 'Hľadať', icon: Search },
  { to: '/practice', label: 'Cvičiť', icon: PencilLine },
  { to: '/archive', label: 'Archív', icon: Bookmark },
]

export function TabBar() {
  return (
    <nav aria-label="Hlavná navigácia" className="fixed inset-x-0 bottom-0 z-20">
      <div className="mx-auto max-w-[480px] border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:border-x">
        <ul className="grid grid-cols-4">
          {TABS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  [
                    'flex h-16 flex-col items-center justify-center gap-1 text-xs transition-colors duration-150',
                    'focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-brick',
                    isActive ? 'font-semibold text-brick' : 'text-ink-muted hover:text-ink',
                  ].join(' ')
                }
              >
                <Icon size={24} strokeWidth={1.75} aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
