import { Outlet, ScrollRestoration } from 'react-router'
import { TabBar } from './TabBar'
import { ThemeToggle } from './ThemeToggle'

export function AppLayout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col sm:border-x sm:border-line">
      <header className="sticky top-0 z-10 box-content flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
        <span className="font-serif text-2xl font-semibold tracking-tight">
          somos<span className="text-amber">.</span>
        </span>
        <ThemeToggle />
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
