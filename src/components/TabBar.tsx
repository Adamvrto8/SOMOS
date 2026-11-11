import { CircleUser, House, PencilLine, Route, Search, type LucideIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { useT } from '../i18n'
import { continueLesson } from '../features/home/continueLesson'
import { useLessonProgression } from '../lib/lessonProgress'
import { useReviewOverview } from '../lib/srs'

interface Tab {
  to: string
  key: 'home' | 'search' | 'path' | 'practice' | 'profile' // its name in the dictionary
  icon: LucideIcon
  // Paths (besides `to`) that belong to this tab, e.g. word detail under Hľadať.
  sections?: string[]
}

// Cesta sits in the middle as the raised button: the one place a learner always finds the path.
const TABS: Tab[] = [
  { to: '/', key: 'home', icon: House, sections: ['/stats', '/diary'] },
  { to: '/search', key: 'search', icon: Search, sections: ['/word', '/topic'] },
  { to: '/path', key: 'path', icon: Route },
  { to: '/practice', key: 'practice', icon: PencilLine, sections: ['/duel'] },
  // Môj slovník (/archive) is the learner's own: it opens from Profil.
  { to: '/profile', key: 'profile', icon: CircleUser, sections: ['/privacy', '/archive'] },
]

const isUnder = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

function isActive(tab: Tab, pathname: string) {
  // "/" is the base of every path: Domov is itself and its own sections only.
  const bases = tab.to === '/' ? (tab.sections ?? []) : [tab.to, ...(tab.sections ?? [])]
  return pathname === tab.to || bases.some((base) => isUnder(pathname, base))
}

/** The number (or, without one, a dot) on a tab's icon; screen readers hear it after the tab's name instead. */
function Badge({ count }: { count?: number }) {
  if (count === undefined) {
    return <span aria-hidden className="absolute -top-0.5 -right-1 size-2.5 rounded-full border-2 border-surface bg-brick" />
  }
  return (
    <span
      aria-hidden
      className="absolute -top-1.5 -right-3 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-surface bg-brick px-1 text-[0.625rem] leading-none font-semibold text-on-accent tabular-nums"
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function TabBar() {
  const { pathname } = useLocation()
  const text = useT().nav
  const due = useReviewOverview()?.dueToday ?? 0
  // Cvičiť shows a calm dot for a lesson left half-way, not the count of mistakes (a long list only stresses).
  const unfinished = continueLesson(useLessonProgression()).unfinished === true

  return (
    // Hidden while the phone keyboard is open: it would otherwise ride on top of it and take the room for typing.
    <nav aria-label={text.main} className="fixed inset-x-0 bottom-0 z-20 keyboard:hidden">
      <div className="mx-auto max-w-[480px] border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:border-x">
        <ul className="grid grid-cols-5">
          {TABS.map((tab) => {
            const active = isActive(tab, pathname)
            const Icon = tab.icon
            const badge =
              tab.key === 'home' && due > 0
                ? { count: due, label: text.dueBadge(due) }
                : tab.key === 'practice' && unfinished
                  ? { count: undefined, label: text.unfinishedBadge }
                  : null
            return (
              <li key={tab.to}>
                <Link
                  to={tab.to}
                  aria-current={active ? 'page' : undefined}
                  // The number is heard after the tab's name: "Domov, 3 kartičky na dnes".
                  aria-label={badge ? `${text[tab.key]}, ${badge.label}` : undefined}
                  className={[
                    'flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] transition-colors duration-150',
                    'focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-brick',
                    active ? 'font-semibold text-brick' : 'text-ink-muted hover:text-ink',
                  ].join(' ')}
                >
                  {tab.key === 'path' ? (
                    // Raised above the bar, always filled: it stands out on every screen, active or not.
                    <span className="-mt-7 flex size-14 items-center justify-center rounded-full border-4 border-bg bg-brick text-on-accent shadow-[0_6px_20px_-6px_var(--brick)]">
                      <Icon size={24} strokeWidth={1.75} aria-hidden />
                    </span>
                  ) : (
                    <span className="relative flex">
                      <Icon size={24} strokeWidth={1.75} aria-hidden />
                      {badge && <Badge count={badge.count} />}
                    </span>
                  )}
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
