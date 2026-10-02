import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Rating, type Grade } from 'ts-fsrs'
import { Button } from '../../components/Button'
import { SpeakButton } from '../../components/SpeakButton'
import { Tapestry } from '../../components/Tapestry'
import { checkAnswer, wrongAsWhole, type CheckResult } from '../../lib/checkAnswer'
import { lookupForm } from '../../lib/knownForms'
import type { Grade as LessonGrade } from '../../lib/lesson'
import { GRADES, isDueToday, previewIntervals, rateCard } from '../../lib/srs'
import { pluralSk } from '../../lib/text'
import { statusOf } from '../exercises/tasks/status'
import { TypedAnswer } from '../exercises/tasks/TypedAnswer'
import { loadDueEntries, typedRating, type ReviewEntry } from './reviewQueue'

const GRADE_STYLE: Record<number, string> = {
  1: 'border border-line bg-surface text-error',
  2: 'border border-line bg-surface text-ink',
  3: 'bg-brick text-on-accent',
  4: 'border border-line bg-surface text-leaf',
}

/** What TypedAnswer and its hint take: a lesson grade made from a check. */
const asGrade = (check: CheckResult): LessonGrade => ({ correct: check.verdict !== 'wrong', verdict: check.verdict, expected: check.expected, check })

/**
 * Full-screen flashcard session: one side (words alternate, see slovakFirst), then either
 * type the other side (it rates itself, see typedRating) or reveal it and rate (FSRS).
 */
export function ReviewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [queue, setQueue] = useState<ReviewEntry[] | null>(null) // null = loading
  const [revealed, setRevealed] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [busy, setBusy] = useState(false)
  // Typing the hidden side instead of revealing it.
  const [typed, setTyped] = useState('')
  const [tries, setTries] = useState(0)
  const [hint, setHint] = useState<LessonGrade | null>(null) // a wrong try, still to be fixed
  const [outcome, setOutcome] = useState<{ grade: Grade; check: CheckResult } | null>(null) // settled: the answer rated itself

  useEffect(() => {
    void loadDueEntries().then(setQueue)
  }, [])

  const entry = queue?.[0]
  const canType = Boolean(entry?.answers.length)
  const spoken = entry ? (entry.article ? `${entry.article} ${entry.es}` : entry.es) : ''
  const intervals = entry && revealed ? previewIntervals(entry.card, new Date()) : undefined

  const exit = () => {
    if (location.key === 'default') void navigate('/', { replace: true })
    else void navigate(-1)
  }

  const rate = async (grade: Grade) => {
    if (!entry || busy) return
    setBusy(true)
    const card = await rateCard(entry.itemType, entry.itemId, grade)
    // Cards still due today (short relearning steps) come back later in this session.
    setQueue((q) => (q ? [...q.slice(1), ...(isDueToday(card) ? [{ ...entry, card }] : [])] : q))
    setReviewed((n) => n + 1)
    setRevealed(false)
    setTyped('')
    setTries(0)
    setHint(null)
    setOutcome(null)
    setBusy(false)
  }

  const closeKeyboard = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }

  const reveal = () => {
    setRevealed(true)
    closeKeyboard()
  }

  const settle = (grade: Grade, check: CheckResult) => {
    setHint(null)
    setOutcome({ grade, check })
    reveal()
  }

  const check = () => {
    if (!entry || revealed || !typed.trim()) return
    const result = checkAnswer(typed, entry.answers, entry.slovakFirst ? { lookup: lookupForm } : {})
    setTries(tries + 1)
    // A wrong answer can be fixed and checked again, like in a lesson.
    if (result.verdict === 'wrong') setHint({ ...asGrade(result), diff: wrongAsWhole(typed) })
    else settle(typedRating(tries + 1, false), result)
  }

  const giveUp = () => {
    if (hint?.check) settle(typedRating(tries, true), hint.check)
  }

  // Keyboard: Space/Enter reveals, 1–4 rates.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!entry || e.target instanceof HTMLButtonElement || e.target instanceof HTMLTextAreaElement) return
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        reveal()
      } else if (revealed && !outcome && ['1', '2', '3', '4'].includes(e.key)) {
        void rate(Number(e.key) as Grade)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const remaining = queue?.length ?? 0
  const progress = reviewed + remaining ? (reviewed / (reviewed + remaining)) * 100 : 0

  return (
    <div className="mx-auto min-h-dvh max-w-[480px] sm:border-x sm:border-line">
      <header className="sticky top-0 z-10 box-content flex h-14 items-center gap-2 bg-bg px-2 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={exit}
          aria-label="Ukončiť opakovanie"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick"
        >
          <X size={22} strokeWidth={1.75} aria-hidden />
        </button>
        <div
          role="progressbar"
          aria-label="Priebeh opakovania"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2"
        >
          <div className="h-full rounded-full bg-brick transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="w-14 shrink-0 pr-2 text-right text-sm text-ink-muted" aria-label={`Zostáva ${remaining}`}>
          {queue ? remaining : ''}
        </span>
      </header>

      <main className="px-4 pt-4 pb-56">
        {queue === null ? null : entry ? (
          <>
            <article className="rounded-card border border-line bg-surface p-6 text-center">
              <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">
                {entry.slovakFirst ? 'Ako sa to povie po španielsky?' : 'Pamätáš si?'}
              </p>
              {entry.slovakFirst ? (
                // No 🔊 here: hearing the word would give the answer away.
                <div className="mt-4">
                  <h1 lang="sk" className="font-serif text-4xl leading-tight font-semibold tracking-tight hyphens-auto">
                    {entry.sk[0]}
                  </h1>
                  {entry.sk.length > 1 && <p className="mt-2 text-ink-muted">{entry.sk.slice(1).join(', ')}</p>}
                </div>
              ) : (
                <>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <h1
                      lang="es"
                      className={`font-serif leading-tight font-semibold tracking-tight hyphens-auto ${entry.itemType === 'sentence' ? 'text-3xl' : 'text-5xl'}`}
                    >
                      {entry.article && <span className="text-3xl font-normal text-ink-muted">{entry.article} </span>}
                      {entry.es}
                    </h1>
                  </div>
                  <div className="mt-3 flex justify-center">
                    <SpeakButton text={spoken} size="lg" />
                  </div>
                </>
              )}

              {revealed && (
                <div className="mt-6 border-t border-line pt-6 text-left">
                  {entry.slovakFirst ? (
                    <div className="flex items-center gap-1">
                      <p lang="es" className="min-w-0 flex-1 font-serif text-3xl leading-tight font-semibold hyphens-auto">
                        {entry.article && <span className="font-normal text-ink-muted">{entry.article} </span>}
                        {entry.es}
                      </p>
                      <SpeakButton text={spoken} size="lg" />
                    </div>
                  ) : (
                    <>
                      <p className="text-2xl font-medium">{entry.sk[0]}</p>
                      {entry.sk.length > 1 && <p className="text-ink-muted">{entry.sk.slice(1).join(', ')}</p>}
                    </>
                  )}
                  {entry.example && (
                    <div className="mt-4 flex items-start gap-1 rounded-2xl bg-surface-2 py-2 pr-1 pl-4">
                      <div className="min-w-0 flex-1 pt-1">
                        <p lang="es" className="font-serif text-lg leading-snug">
                          {entry.example.es}
                        </p>
                        <p className="text-sm text-ink-muted">{entry.example.sk}</p>
                      </div>
                      <SpeakButton text={entry.example.es} />
                    </div>
                  )}
                  {entry.note && (
                    <p className="mt-3 flex gap-2 text-sm leading-relaxed text-ink-muted">
                      <Info size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
                      {entry.note}
                    </p>
                  )}
                </div>
              )}
            </article>
            {canType && (!revealed || outcome) && (
              <div className="mt-4">
                <TypedAnswer
                  key={reviewed}
                  value={typed}
                  onChange={setTyped}
                  onSubmit={check}
                  status={outcome ? statusOf(asGrade(outcome.check)) : undefined}
                  hint={hint}
                  onGiveUp={giveUp}
                  lang={entry.slovakFirst ? 'es' : 'sk'}
                  label={entry.slovakFirst ? 'Preklad do španielčiny' : 'Preklad do slovenčiny'}
                  placeholder={entry.slovakFirst ? 'Po španielsky…' : 'Po slovensky…'}
                />
              </div>
            )}
          </>
        ) : (
          <SessionEnd reviewed={reviewed} />
        )}
      </main>

      {/* After a wrong try the buttons sit in the hint under the field, above the phone keyboard. */}
      {entry && !hint && (
        <div className="fixed inset-x-0 bottom-0 z-20">
          <div className="mx-auto max-w-[480px] border-t border-line bg-bg/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
            {!revealed ? (
              canType ? (
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={reveal}>
                    Ukázať preklad
                  </Button>
                  {/* preventDefault keeps the focus (and the phone keyboard) in the answer field for a second try. */}
                  <Button onPointerDown={(e) => e.preventDefault()} onClick={check} disabled={!typed.trim()} className="flex-1">
                    Skontrolovať
                  </Button>
                </div>
              ) : (
                <Button onClick={reveal} className="w-full" autoFocus>
                  Ukázať preklad
                </Button>
              )
            ) : outcome ? (
              <>
                <TypedVerdict grade={outcome.grade} check={outcome.check} interval={intervals?.[outcome.grade]} />
                <Button onClick={() => void rate(outcome.grade)} disabled={busy} className="mt-3 w-full" autoFocus>
                  Pokračovať
                </Button>
              </>
            ) : (
              <>
                <p className="mb-2 text-center text-sm text-ink-muted">Ako dobre si to vedel?</p>
                <div className="grid grid-cols-4 gap-2">
                  {GRADES.map(({ grade, label }) => (
                    <button
                      key={grade}
                      type="button"
                      disabled={busy}
                      onClick={() => void rate(grade)}
                      className={`flex h-16 flex-col items-center justify-center rounded-2xl font-semibold transition duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick disabled:opacity-60 ${GRADE_STYLE[grade]}`}
                    >
                      {label}
                      <span className="text-xs font-normal opacity-80">{intervals?.[grade]}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** How a typed answer went and when the card comes back; the rating was decided by the answer. */
function TypedVerdict({ grade, check, interval }: { grade: Grade; check: CheckResult; interval?: string }) {
  const tone =
    grade === Rating.Again
      ? { title: 'Nevedel si – ešte sa vráti', icon: CircleX, color: 'text-error' }
      : grade === Rating.Hard
        ? { title: 'Správne po oprave', icon: TriangleAlert, color: 'text-ink' }
        : { title: 'Správne!', icon: CircleCheck, color: 'text-leaf' }
  const Icon = tone.icon
  const note = check.spacing
    ? 'Pozor na medzery medzi slovami.'
    : check.typoWord
      ? `Preklep v slove ${check.typoWord}.`
      : check.verdict === 'accent'
        ? `Pozor na prízvuk: ${check.accentWords.join(', ')}.`
        : undefined

  return (
    <div role="status">
      <p className={`flex items-center gap-2 font-semibold ${tone.color}`}>
        <Icon size={20} strokeWidth={2} className="shrink-0" aria-hidden />
        {tone.title}
      </p>
      <p className="mt-0.5 text-sm text-ink-muted">
        {note && `${note} `}
        {interval && `Ďalšie opakovanie: ${interval}.`}
      </p>
    </div>
  )
}

function SessionEnd({ reviewed }: { reviewed: number }) {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="relative h-28 border-b border-line bg-surface-2">
          <Tapestry className="opacity-30 dark:opacity-20" />
        </div>
        <div className="px-6 pt-5 pb-6 text-center">
          <CircleCheck size={32} strokeWidth={1.75} className="mx-auto text-leaf" aria-hidden />
          {reviewed > 0 ? (
            <>
              <h1 className="mt-2 font-serif text-2xl font-semibold">Hotovo na dnes</h1>
              <p className="mt-1 text-ink-muted">
                Zopakoval si {reviewed} {pluralSk(reviewed, ['kartu', 'karty', 'kariet'])}. Ďalšie prídu na rad, keď ich začneš
                zabúdať.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-2 font-serif text-2xl font-semibold">Nič na zopakovanie</h1>
              <p className="mt-1 text-ink-muted">Dnes máš všetko zopakované. Nové slová si ulož hviezdičkou pri slove.</p>
            </>
          )}
        </div>
      </div>
      <div className="grid gap-3">
        <Link
          to="/practice"
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-brick px-5 font-semibold text-on-accent transition duration-150 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
        >
          Precvičiť v lekcii
        </Link>
        <Link
          to="/"
          className="inline-flex h-12 items-center justify-center rounded-2xl border border-line bg-surface px-5 font-semibold transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
        >
          Domov
        </Link>
      </div>
    </div>
  )
}
