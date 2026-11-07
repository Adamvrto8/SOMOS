import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { useT } from '../../i18n'
import { todayKey, useDiaryEntries } from '../../lib/diary'
import { diaryDate, entryLine } from './diaryDate'

const ROW =
  'flex min-h-16 items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 transition-colors duration-150 hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick'

/** /diary — today first, then every written day, newest first. */
export function DiaryPage() {
  const dictionary = useT()
  const t = dictionary.diary
  const entries = useDiaryEntries()
  if (!entries) return null
  const today = todayKey()
  const todays = entries.find((e) => e.date === today)
  const earlier = entries.filter((e) => e.date !== today)

  return (
    <div>
      <BackButton fallback="/" />
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">{t.title}</h1>
      <ul className="mt-6 space-y-2">
        <li>
          <Link to={`/diary/${today}`} className={ROW}>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{t.today}</span>
              <span lang={todays ? 'es' : undefined} className="block truncate text-sm text-ink-muted">
                {todays ? entryLine(todays) : t.nothingToday}
              </span>
            </span>
            <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
          </Link>
        </li>
        {earlier.map((entry) => (
          <li key={entry.date}>
            <Link to={`/diary/${entry.date}`} className={ROW}>
              <span className="min-w-0 flex-1">
                <span className="block font-medium first-letter:uppercase">{diaryDate(entry.date, dictionary.dateLocale)}</span>
                <span lang="es" className="block truncate text-sm text-ink-muted">
                  {entryLine(entry)}
                </span>
              </span>
              <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {entries.length === 0 && <p className="mt-4 text-sm text-ink-muted">{t.empty}</p>}
    </div>
  )
}
