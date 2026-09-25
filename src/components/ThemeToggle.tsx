import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { setThemePref, useThemePref, type ThemePref } from '../lib/theme'

const OPTIONS: Record<ThemePref, { label: string; icon: LucideIcon; next: ThemePref }> = {
  system: { label: 'podľa systému', icon: Monitor, next: 'light' },
  light: { label: 'svetlá', icon: Sun, next: 'dark' },
  dark: { label: 'tmavá', icon: Moon, next: 'system' },
}

export function ThemeToggle() {
  const pref = useThemePref()
  const { label, icon: Icon, next } = OPTIONS[pref]

  return (
    <button
      type="button"
      onClick={() => setThemePref(next)}
      aria-label={`Téma: ${label}. Prepnúť na: ${OPTIONS[next].label}`}
      title={`Téma: ${label}`}
      className="flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden />
    </button>
  )
}
