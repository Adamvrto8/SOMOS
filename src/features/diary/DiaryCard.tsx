import { Check, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { useT } from '../../i18n'
import { todayKey, useDiaryNotes } from '../../lib/diary'

/** Domov: the diary as one button to the list of notes — how many there are, ✓ when one was written today. */
export function DiaryCard() {
  const t = useT().diary
  const notes = useDiaryNotes()
  if (notes === undefined) return null // loading from IndexedDB
  const today = todayKey()
  const writtenToday = notes.some((n) => n.date === today)

  return (
    <section aria-labelledby="diary-heading">
      <Link
        to="/diary"
        className="flex min-h-16 items-center gap-3 rounded-card border border-line bg-surface px-5 py-4 transition-colors duration-150 hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick active:bg-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span id="diary-heading" className="flex items-center gap-1.5 text-xs font-semibold tracking-widest text-brick uppercase dark:text-amber">
            {t.title}
            {writtenToday && <Check size={14} strokeWidth={2.5} className="text-leaf" aria-label="✓" />}
          </span>
          <span className="mt-0.5 block text-ink-muted">{notes.length ? t.count(notes.length) : t.cardHint}</span>
        </span>
        <ChevronRight size={20} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
      </Link>
    </section>
  )
}
