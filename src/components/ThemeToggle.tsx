import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { useT } from '../i18n'
import { setThemePref, useThemePref, type ThemePref } from '../lib/theme'

const OPTIONS: Record<ThemePref, { icon: LucideIcon; next: ThemePref }> = {
  system: { icon: Monitor, next: 'light' },
  light: { icon: Sun, next: 'dark' },
  dark: { icon: Moon, next: 'system' },
}

export function ThemeToggle() {
  const pref = useThemePref()
  const text = useT().common
  const { icon: Icon, next } = OPTIONS[pref]

  return (
    <button
      type="button"
      onClick={() => setThemePref(next)}
      aria-label={text.themeSwitch(text.themeNames[pref], text.themeNames[next])}
      title={text.themeTitle(text.themeNames[pref])}
      className="flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden />
    </button>
  )
}
