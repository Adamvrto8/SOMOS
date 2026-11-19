import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { useT } from '../../i18n'
import type { DiaryNote } from '../../lib/db'
import { todayKey, useDiaryNotes } from '../../lib/diary'
import { dayLabel, noteHeading, notePreview } from './diaryDate'
import type { FromList } from './DiaryNotePage'

const FROM_LIST: FromList = { fromList: true }

const CARD =
  'block rounded-card border border-line bg-surface px-4 py-3 transition-colors duration-150 hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick active:bg-surface-2'

/** /diary — every note under its day, newest first, and "Nová poznámka". */
export function DiaryPage() {
  const dictionary = useT()
  const t = dictionary.diary
  const notes = useDiaryNotes()
  if (!notes) return null
  const today = todayKey()
  const days: { date: string; notes: DiaryNote[] }[] = []
  for (const note of notes) {
    const last = days.at(-1)
    if (last?.date === note.date) last.notes.push(note)
    else days.push({ date: note.date, notes: [note] })
  }

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
      {days.map((day) => {
        const label = dayLabel(day.date, today, t, dictionary.dateLocale)
        return (
          <section key={day.date} aria-label={label} className="mt-6">
            <h2 className="text-xs font-semibold tracking-widest text-ink-muted uppercase first-letter:uppercase">{label}</h2>
            <ul className="mt-2 space-y-2">
              {day.notes.map((note) => {
                const preview = notePreview(note)
                return (
                  <li key={note.id}>
                    <Link to={`/diary/${note.id}`} state={FROM_LIST} className={CARD}>
                      <span className="line-clamp-2 block font-serif text-lg leading-snug font-semibold">{noteHeading(note) || t.untitled}</span>
                      {preview && <span className="mt-0.5 line-clamp-2 block text-sm text-ink-muted">{preview}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      {notes.length === 0 && (
        <div className="mt-6 text-sm text-ink-muted">
          <p className="font-medium text-ink">{t.empty}</p>
          <p className="mt-1">{t.emptyHint}</p>
        </div>
      )}
    </div>
  )
}
