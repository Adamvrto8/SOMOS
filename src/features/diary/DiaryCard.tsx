import { Check, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { useT } from '../../i18n'
import { todayKey, useDiaryEntry } from '../../lib/diary'
import { entryLine } from './diaryDate'

/**
 * Domov: today's diary entry, compact — a hint and "Napísať", or ✓ and the first line of what was written.
 * The card itself opens the day (stretched link); "Napísať" and "Všetky zápisy" sit above it.
 */
export function DiaryCard() {
  const t = useT().diary
  const today = todayKey()
  const entry = useDiaryEntry(today)
  if (entry === undefined) return null // loading from IndexedDB
  const href = `/diary/${today}`

  return (
    <section
      aria-labelledby="diary-heading"
      className="relative rounded-card border border-line bg-surface px-5 py-4 transition-colors duration-150 hover:border-ink-muted"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="diary-heading" className="flex items-center gap-1.5 text-xs font-semibold tracking-widest text-brick uppercase dark:text-amber">
          {t.todayEntry}
          {entry && <Check size={14} strokeWidth={2.5} className="text-leaf" aria-label="✓" />}
        </h2>
        {/* Negative margin: a 44px tap target without a taller card. */}
        <Link
          to="/diary"
          className="relative z-10 -my-3 -mr-2 inline-flex min-h-11 items-center px-2 text-sm font-medium text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-brick"
        >
          {t.all}
        </Link>
      </div>
      <div className="mt-1 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={href}
            tabIndex={entry ? undefined : -1}
            className={`block leading-snug ${entry ? 'truncate font-serif text-lg font-semibold' : 'line-clamp-2 text-ink-muted'} after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-brick`}
          >
            {entry ? entryLine(entry) : t.cardHint}
          </Link>
        </div>
        {entry ? (
          <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
        ) : (
          <Link
            to={href}
            className="relative z-10 inline-flex min-h-11 shrink-0 items-center rounded-full bg-brick px-4 text-sm font-semibold text-on-accent transition-colors duration-150 hover:bg-brick/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
          >
            {t.write}
          </Link>
        )}
      </div>
    </section>
  )
}
