import { CalendarDays, Pencil, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { useT } from '../../i18n'
import { todayKey, useDiaryNotes } from '../../lib/diary'
import { dayLabel, noteHeading } from './diaryDate'
import type { FromList } from './DiaryNotePage'

const FROM_LIST: FromList = { fromList: true }

const CARD =
  'flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 transition-colors duration-150 hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick active:bg-surface-2'

/** /diary — every note as its day and its title, newest first; a tap opens it to edit. And "Nová poznámka". */
export function DiaryPage() {
  const dictionary = useT()
  const t = dictionary.diary
  const notes = useDiaryNotes()
  if (!notes) return null
  const today = todayKey()

  return (
    <div>
      <BackButton fallback="/" />
      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">{t.title}</h1>
        <Link
          to="/diary/new"
          state={FROM_LIST}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brick px-4 text-sm font-semibold text-on-accent transition duration-150 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick active:scale-[0.98]"
        >
          <Plus size={18} strokeWidth={2} aria-hidden />
          {t.newNote}
        </Link>
      </div>
      {notes.length > 0 && (
        <ul className="mt-6 space-y-2">
          {notes.map((note) => (
            <li key={note.id}>
              <Link to={`/diary/${note.id}`} state={FROM_LIST} className={CARD}>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <CalendarDays size={14} strokeWidth={1.75} aria-hidden />
                    <span className="first-letter:uppercase">{dayLabel(note.date, today, t, dictionary.dateLocale)}</span>
                  </span>
                  <span className="mt-1 line-clamp-2 font-serif text-lg leading-snug font-semibold">{noteHeading(note) || t.untitled}</span>
                </span>
                <Pencil size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {notes.length === 0 && (
        <div className="mt-6 text-sm text-ink-muted">
          <p className="font-medium text-ink">{t.empty}</p>
          <p className="mt-1">{t.emptyHint}</p>
        </div>
      )}
    </div>
  )
}
