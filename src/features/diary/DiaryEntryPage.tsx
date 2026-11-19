import { Check, ChevronRight, Lightbulb } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { Button } from '../../components/Button'
import { tipById } from '../../data'
import { useT } from '../../i18n'
import type { DiaryEntry } from '../../lib/db'
import { tipsInText } from '../../lib/assistant/note'
import { DIARY_MAX, isDiaryDate, saveDiaryEntry, useDiaryEntry } from '../../lib/diary'
import { useLanguage } from '../../lib/language'
import { localizedTip } from '../../lib/localized'
import { diaryDate } from './diaryDate'

const SAVE_AFTER = 800 // ms after the last keystroke

const FIELD =
  'w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base leading-relaxed transition-colors duration-150 placeholder:text-ink-muted focus:border-brick focus:outline-none'

/** /diary/:date — one day of the diary: one free text, saved while typing and by "Uložiť". */
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
  // Typed but not stored yet: "Uložiť" is the main button then, "✓ Uložené" shows once it is stored.
  const [pending, setPending] = useState(false)
  const field = useRef<HTMLTextAreaElement>(null)

  // The latest text and whether it still has to be stored: read by the timer and on leaving the page.
  const latest = useRef(text)
  const dirty = useRef(false)
  const timer = useRef<number>(undefined)

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    if (!dirty.current) return
    dirty.current = false
    // "✓ Uložené" only once it is stored, and not when more was typed meanwhile.
    void saveDiaryEntry(date, latest.current).then(() => {
      if (!dirty.current) setPending(false)
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
    setPending(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, SAVE_AFTER)
  }

  // "Uložiť": store now and put the keyboard away, so finishing a note is one tap and never a worry.
  const save = () => {
    flush()
    field.current?.blur()
  }

  const tipIds = useMemo(() => tipsInText(text), [text])

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <BackButton fallback="/diary" />
        <div className="flex items-center gap-3">
          <span aria-live="polite" className="flex items-center gap-1 text-sm text-ink-muted">
            {!pending && text.trim() && (
              <>
                <Check size={16} strokeWidth={2} aria-hidden />
                {t.saved}
              </>
            )}
          </span>
          <Button variant={pending ? 'primary' : 'secondary'} onClick={save} className="h-11 px-4">
            {t.save}
          </Button>
        </div>
      </div>
      <h1 className="font-serif text-3xl font-semibold tracking-tight first-letter:uppercase">{diaryDate(date, dictionary.dateLocale)}</h1>
      {tipIds.length > 0 && (
        <nav aria-label={t.tips} className="flex flex-wrap gap-2">
          {tipIds.map((id) => {
            const tip = tipById.get(id)
            if (!tip) return null
            return (
              <Link
                key={id}
                to={`/practice/grammar/${id}`}
                className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface px-4 text-sm font-medium text-brick focus-visible:outline-2 focus-visible:outline-brick active:bg-surface-2"
              >
                <Lightbulb size={16} strokeWidth={1.75} aria-hidden />
                {localizedTip(tip).title}
                <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
              </Link>
            )
          })}
        </nav>
      )}
      <label className="flex flex-1 flex-col">
        <span className="sr-only">{t.label}</span>
        <textarea
          ref={field}
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
