import { CalendarDays, Check, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import type { DiaryNote } from '../../lib/db'
import { deleteDiaryNote, DIARY_MAX, newDiaryNoteId, saveDiaryNote, TITLE_MAX, todayKey, useDiaryNote } from '../../lib/diary'
import { useLanguage } from '../../lib/language'
import { diaryDate } from './diaryDate'

const SAVE_AFTER = 800 // ms after the last keystroke

const FIELD =
  'w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base leading-relaxed transition-colors duration-150 placeholder:text-ink-muted focus:border-brick focus:outline-none'

/** The state a list link passes, so "Uložiť" goes back to that list instead of adding it again. */
export interface FromList {
  fromList?: boolean
}

/** /diary/new and /diary/:id — one note: an optional title and a text, saved while typing and by "Uložiť". */
export function DiaryNotePage({ fresh = false }: { fresh?: boolean }) {
  const { id: param = '' } = useParams()
  const [newId] = useState(newDiaryNoteId)
  const id = fresh ? newId : param
  const note = useDiaryNote(id)
  // Loading from IndexedDB; the live query also hands back the previous note for a moment after an id change.
  if (note === undefined || (note && note.id !== id)) return null
  return <Opened key={id} id={id} fresh={fresh} note={note} />
}

function Opened({ id, fresh, note }: { id: string; fresh: boolean; note: DiaryNote | null }) {
  // What the note was when it opened: a missing one is a wrong link, unless it is new. Later it may vanish
  // (cleared and saved, deleted elsewhere) without the page closing under the learner's fingers.
  const [initial] = useState(note)
  const [date] = useState(() => note?.date ?? todayKey())
  if (!fresh && !initial) return <Navigate to="/diary" replace />
  return <NoteForm id={id} date={date} initial={initial} stored={note} />
}

function NoteForm({ id, date, initial, stored }: { id: string; date: string; initial: DiaryNote | null; stored: DiaryNote | null }) {
  const dictionary = useT()
  const t = dictionary.diary
  const language = useLanguage()
  const navigate = useNavigate()
  const fromList = (useLocation().state as FromList | null)?.fromList === true
  const [title, setTitle] = useState(initial?.title ?? '')
  const [text, setText] = useState(initial?.text ?? '')
  // Typed but not stored yet: "✓ Uložené" shows once it is stored.
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const body = useRef<HTMLTextAreaElement>(null)

  // The latest title and text and whether they still have to be stored: read by the timer and on leaving the page.
  const latest = useRef({ title, text })
  const dirty = useRef(false)
  const removed = useRef(false)
  const timer = useRef<number>(undefined)

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    if (!dirty.current || removed.current) return
    dirty.current = false
    void saveDiaryNote({ id, date, ...latest.current }).then(() => {
      if (!dirty.current) setPending(false)
    })
  }, [id, date])

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

  // The note changed elsewhere (another device): take it unless something typed here still waits to be saved.
  useEffect(() => {
    if (!stored || dirty.current) return
    if (stored.title === latest.current.title && stored.text === latest.current.text) return
    latest.current = { title: stored.title, text: stored.text }
    setTitle(stored.title)
    setText(stored.text)
  }, [stored])

  const change = (next: { title?: string; text?: string }) => {
    latest.current = { ...latest.current, ...next }
    if (next.title !== undefined) setTitle(next.title)
    if (next.text !== undefined) setText(next.text)
    dirty.current = true
    setPending(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, SAVE_AFTER)
  }

  // Back to the list the note was opened from, or to the list in place of this page.
  const close = () => (fromList ? navigate(-1) : navigate('/diary', { replace: true }))

  // "Uložiť": store and close, as a notes app does; the note is then in the list under its day.
  const save = () => {
    flush()
    close()
  }

  const remove = async () => {
    removed.current = true
    window.clearTimeout(timer.current)
    await deleteDiaryNote(id)
    close()
  }

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <BackButton fallback="/diary" />
        <div className="flex items-center gap-3">
          <span aria-live="polite" className="flex items-center gap-1 text-sm text-ink-muted">
            {!pending && stored && (
              <>
                <Check size={16} strokeWidth={2} aria-hidden />
                {t.saved}
              </>
            )}
          </span>
          <Button onClick={save} className="h-11 px-5">
            {t.save}
          </Button>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-sm text-ink-muted">
        <CalendarDays size={16} strokeWidth={1.75} aria-hidden />
        <span className="first-letter:uppercase">{diaryDate(date, dictionary.dateLocale)}</span>
      </p>
      {/* A textarea that grows with its words: a title (a question saved from SOMO) can be long. One line, no breaks. */}
      <textarea
        value={title}
        onChange={(e) => change({ title: e.target.value.replace(/\s*\n\s*/g, ' ') })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            body.current?.focus()
          }
        }}
        rows={1}
        aria-label={t.titleLabel}
        placeholder={t.titleLabel}
        maxLength={TITLE_MAX}
        enterKeyHint="next"
        lang={language}
        className="w-full resize-none bg-transparent py-1 font-serif text-2xl leading-tight font-semibold tracking-tight [field-sizing:content] placeholder:text-ink-muted/70 focus:outline-none"
      />
      <label className="flex flex-1 flex-col">
        <span className="sr-only">{t.label}</span>
        <textarea
          ref={body}
          value={text}
          onChange={(e) => change({ text: e.target.value })}
          autoFocus={!initial}
          lang={language}
          maxLength={DIARY_MAX}
          placeholder={`${t.label} ${t.hint}`}
          className={`${FIELD} min-h-64 flex-1`}
        />
      </label>
      {stored &&
        (confirming ? (
          <div role="group" aria-label={t.removeConfirm} className="flex flex-wrap items-center gap-2">
            <span className="mr-auto text-sm font-medium">{t.removeConfirm}</span>
            <Button variant="secondary" onClick={() => setConfirming(false)} className="h-11 px-4">
              {t.removeNo}
            </Button>
            <Button variant="danger-solid" onClick={() => void remove()} className="h-11 px-4">
              {t.removeYes}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-ink-muted hover:text-error focus-visible:outline-2 focus-visible:outline-brick"
          >
            <Trash2 size={16} strokeWidth={1.75} aria-hidden />
            {t.remove}
          </button>
        ))}
    </div>
  )
}
