import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { useT } from '../../i18n'
import type { DiaryEntry } from '../../lib/db'
import { DIARY_MAX, isDiaryDate, saveDiaryEntry, useDiaryEntry } from '../../lib/diary'
import { useLanguage } from '../../lib/language'
import { diaryDate } from './diaryDate'

const SAVE_AFTER = 800 // ms after the last keystroke

const FIELD =
  'w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base leading-relaxed transition-colors duration-150 placeholder:text-ink-muted focus:border-brick focus:outline-none'

/** /diary/:date — one day of the diary: one free text. */
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
  const [text, setText] = useState(entry?.text ?? '')
  const [saved, setSaved] = useState(false)

  // The latest text and whether it still has to be stored: read by the timer and on leaving the page.
  const latest = useRef(text)
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

  // The day changed elsewhere (SOMO's "Uložiť do Denníka" over this page, another device): take the stored text unless
  // something typed here is still waiting to be saved, so the next save cannot drop what was added.
  const stored = entry?.text ?? ''
  useEffect(() => {
    if (dirty.current || stored === latest.current) return
    latest.current = stored
    setText(stored)
  }, [stored])

  const change = (value: string) => {
    setText(value)
    latest.current = value
    dirty.current = true
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, SAVE_AFTER)
  }

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <BackButton fallback="/diary" />
        <span aria-live="polite" className="text-sm text-ink-muted">
          {saved ? t.saved : ''}
        </span>
      </div>
      <h1 className="font-serif text-3xl font-semibold tracking-tight first-letter:uppercase">{diaryDate(date, dictionary.dateLocale)}</h1>
      <label className="flex flex-1 flex-col">
        <span className="sr-only">{t.label}</span>
        <textarea
          value={text}
          onChange={(e) => change(e.target.value)}
          lang={language}
          maxLength={DIARY_MAX}
          placeholder={`${t.label} ${t.hint}`}
          className={`${FIELD} min-h-64 flex-1`}
        />
      </label>
    </div>
  )
}
