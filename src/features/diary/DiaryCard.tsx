import { Check } from 'lucide-react'
import { Link } from 'react-router'
import { useT } from '../../i18n'
import { promptOfDay, todayKey, useDiaryEntry } from '../../lib/diary'
import { useLanguage } from '../../lib/language'
import { entryLine } from './diaryDate'

/** Domov: today's diary entry — the day's prompt and "Napísať", or ✓ and the first line of what was written. */
export function DiaryCard() {
  const t = useT().diary
  const language = useLanguage()
  const today = todayKey()
  const entry = useDiaryEntry(today)
  if (entry === undefined) return null // loading from IndexedDB
  const prompt = promptOfDay(today)
  const href = `/diary/${today}`

  return (
    <section aria-labelledby="diary-heading" className="relative rounded-card border border-line bg-surface p-5 transition-colors duration-150 hover:border-ink-muted">
      <h2 id="diary-heading" className="flex items-center gap-1.5 text-xs font-semibold tracking-widest text-brick uppercase dark:text-amber">
        {t.todayEntry}
        {entry && <Check size={14} strokeWidth={2.5} className="text-leaf" aria-label="✓" />}
      </h2>
      {entry ? (
        // Stretched link: the card opens the day; "Všetky zápisy" sits above it.
        <Link
          to={href}
          lang="es"
          className="mt-2 block truncate font-serif text-xl after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-brick"
        >
          {entryLine(entry)}
        </Link>
      ) : (
        <>
          <p lang="es" className="mt-2 font-serif text-2xl leading-snug font-semibold">
            {prompt.es}
          </p>
          <p className="text-ink-muted">{language === 'en' ? prompt.en : prompt.sk}</p>
        </>
      )}
      <div className="relative mt-4 flex items-center gap-3">
        {!entry && (
          <Link
            to={href}
            className="inline-flex min-h-11 items-center rounded-full bg-brick px-5 font-semibold text-on-accent transition-colors duration-150 hover:bg-brick/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
          >
            {t.write}
          </Link>
        )}
        <Link to="/diary" className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-brick">
          {t.all}
        </Link>
      </div>
    </section>
  )
}
