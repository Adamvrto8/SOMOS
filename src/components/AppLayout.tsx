import { Search } from 'lucide-react'
import { Link, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { TabBar } from './TabBar'
import { ThemeToggle } from './ThemeToggle'

export function AppLayout() {
  const { pathname } = useLocation()
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col sm:border-x sm:border-line">
      <header className="sticky top-0 z-10 box-content flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
        <span className="font-serif text-2xl font-semibold tracking-tight">
          somos<span className="text-amber">.</span>
        </span>
        <div className="flex items-center gap-1">
          {/* Quick search on Home (the Hľadať tab has its own field). */}
          {pathname === '/' && (
            <Link
              to="/search"
              state={{ focus: true }}
              aria-label="Hľadať slovo"
              className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink transition-colors duration-150 hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
            >
              <Search size={20} strokeWidth={1.75} aria-hidden />
            </Link>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Bottom padding keeps content clear of the fixed tab bar (h-16 + safe area). */}
      <main className="flex-1 px-4 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      <TabBar />
      {/* New pages start at the top; "back" returns to the previous scroll position. */}
      <ScrollRestoration />
    </div>
  )
}
