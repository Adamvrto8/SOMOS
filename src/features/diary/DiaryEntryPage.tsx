import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { useT } from '../../i18n'
import { useCustomWords } from '../../lib/archive'
import type { DiaryEntry } from '../../lib/db'
import { DIARY_MAX, isDiaryDate, saveDiaryEntry, useDiaryEntry } from '../../lib/diary'
import { useLanguage } from '../../lib/language'
import { DiaryCheck } from './DiaryCheck'
import { diaryDate } from './diaryDate'

const SAVE_AFTER = 800 // ms after the last keystroke
const CHECK_AFTER = 600

const FIELD =
  'field-sizing-content w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base leading-relaxed transition-colors duration-150 placeholder:text-ink-muted focus:border-brick focus:outline-none'

/** /diary/:date — one day of the diary. */
export function DiaryEntryPage() {
  const { date = '' } = useParams()
  const valid = isDiaryDate(date)
  const entry = useDiaryEntry(valid ? date : '')
  if (!valid) return <Navigate to="/diary" replace />
  // Loading from IndexedDB; the live query also hands back the previous day's row for a moment after a date change.
  if (entry === undefined || (entry && entry.date !== date)) return null
  return <EntryForm key={date} date={date} entry={entry} />
}

function EntryForm({ date, entry }: { date: string; entry: DiaryEntry | null }) {
  const dictionary = useT()
  const t = dictionary.diary
  const language = useLanguage()
  const customWords = useCustomWords()
  const customEs = useMemo(() => customWords?.map((w) => w.es) ?? [], [customWords])
  const [learned, setLearned] = useState(entry?.learned ?? '')
  const [es, setEs] = useState(entry?.es ?? '')
  const [checked, setChecked] = useState(entry?.es ?? '')
  const [saved, setSaved] = useState(false)

  // The latest text and whether it still has to be stored: read by the timer and on leaving the page.
  const latest = useRef({ learned, es })
  const dirty = useRef(false)
  const timer = useRef<number>(undefined)
  const savedTimer = useRef<number>(undefined)

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    if (!dirty.current) return
    dirty.current = false
    void saveDiaryEntry(date, latest.current).then((result) => {
      if (result === 'unchanged') return
      setSaved(true)
      window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => setSaved(false), 2000)
    })
  }, [date])

  // Leaving the page (back, tab bar, closing the app) saves what was typed last.
  useEffect(() => {
    // A phone sends an app to the background (and may kill it there) with only a visibilitychange.
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHidden)
      flush()
      window.clearTimeout(savedTimer.current)
    }
  }, [flush])

  useEffect(() => {
    const id = window.setTimeout(() => setChecked(es), CHECK_AFTER)
    return () => window.clearTimeout(id)
  }, [es])

  const change = (field: 'learned' | 'es', value: string) => {
    if (field === 'learned') setLearned(value)
    else setEs(value)
    latest.current = { ...latest.current, [field]: value }
    dirty.current = true
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, SAVE_AFTER)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <BackButton fallback="/diary" />
        <span aria-live="polite" className="text-sm text-ink-muted">
          {saved ? t.saved : ''}
        </span>
      </div>
      <h1 className="font-serif text-3xl font-semibold tracking-tight first-letter:uppercase">{diaryDate(date, dictionary.dateLocale)}</h1>

      <label className="block space-y-2">
        <span className="block font-medium">{t.learned}</span>
        <textarea
          value={learned}
          onChange={(e) => change('learned', e.target.value)}
          lang={language}
          rows={3}
          maxLength={DIARY_MAX}
          placeholder={t.learnedHint}
          className={`${FIELD} min-h-24`}
        />
      </label>

      <label className="block space-y-2">
        <span className="block font-medium">{t.es}</span>
        <textarea
          value={es}
          onChange={(e) => change('es', e.target.value)}
          lang="es"
          rows={6}
          maxLength={DIARY_MAX}
          spellCheck={false}
          autoCapitalize="sentences"
          placeholder={t.esHint}
          className={`${FIELD} min-h-36 font-serif text-lg`}
        />
      </label>

      <DiaryCheck text={checked} customEs={customEs} />
    </div>
  )
}
