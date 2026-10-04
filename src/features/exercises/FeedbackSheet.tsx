import { CircleCheck, CircleX, Info, Lightbulb, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../../components/Button'
import { SpeakButton } from '../../components/SpeakButton'
import { wordIdByVerb } from '../../data'
import { t, useT } from '../../i18n'
import type { Verdict } from '../../lib/checkAnswer'
import { PERSON_LABELS, TENSE_LABELS } from '../../lib/conjugate'
import type { Grade, Task } from '../../lib/lesson'
import { SaveButton } from '../word/SaveButton'
import { SpeechWords } from './tasks/SpeechWords'

const TONE: Record<Verdict, { icon: LucideIcon; panel: string; heading: string }> = {
  correct: { icon: CircleCheck, panel: 'bg-leaf/15 border-leaf/50', heading: 'text-leaf' },
  accent: { icon: TriangleAlert, panel: 'bg-amber/20 border-amber', heading: 'text-ink' },
  typo: { icon: TriangleAlert, panel: 'bg-amber/20 border-amber', heading: 'text-ink' },
  wrong: { icon: CircleX, panel: 'bg-error/10 border-error/50', heading: 'text-error' },
}

interface Reference {
  label?: string
  correct: string
  correctLang: 'es' | 'sk'
  detail?: string
  detailLang?: 'es' | 'sk'
  speak?: string
}

/** The full correct answer to show and speak, with secondary meaning where helpful. */
function reference(task: Task): Reference {
  switch (task.kind) {
    case 'cloze':
    case 'choice':
      return { correct: task.sentence.es, correctLang: 'es', detail: task.sentence.sk, detailLang: 'sk', speak: task.sentence.es }
    case 'conjugation':
      return {
        label: `${task.verb.id} · ${PERSON_LABELS[task.person]} · ${TENSE_LABELS[task.tense]}`,
        correct: task.answer,
        correctLang: 'es',
        speak: task.answer,
      }
    case 'builder':
    case 'translation':
    case 'dictation':
    case 'speaking':
      return { correct: task.sentence.es, correctLang: 'es', detail: task.sentence.sk, detailLang: 'sk', speak: task.sentence.es }
    case 'vocab': {
      const esFormatted = task.word.gender ? `${task.word.gender === 'm' ? 'el' : 'la'} ${task.word.es}` : task.word.es
      const skFormatted = task.word.sk.join(', ')
      if (task.direction === 'sk-es') {
        return {
          label: t().lesson.toSpanish,
          correct: esFormatted,
          correctLang: 'es',
          detail: skFormatted,
          detailLang: 'sk',
          speak: task.word.es,
        }
      }
      return {
        label: t().lesson.toNative,
        correct: skFormatted,
        correctLang: 'sk',
        detail: esFormatted,
        detailLang: 'es',
        speak: task.word.es,
      }
    }
  }
}

interface FeedbackSheetProps {
  task: Task
  grade: Grade
  onContinue: () => void
  /** Free translation has many valid answers: let the learner overrule the checker. */
  onOverride?: () => void
  /** Practising the mistakes list: after a right answer, keep the item or drop it. */
  mistakeChoice?: { onKeep: () => void; onResolve: () => void }
  /** The grammar tip behind a wrong answer ("Prečo?"), when there is one. */
  why?: { label: string; onOpen: () => void }
}

export function FeedbackSheet({ task, grade, onContinue, onOverride, mistakeChoice, why }: FeedbackSheetProps) {
  const text = useT().lesson
  const tone = TONE[grade.verdict]
  const Icon = tone.icon
  const title = grade.speech && grade.verdict === 'typo' ? text.almost : text.verdicts[grade.verdict]
  const ref = reference(task)
  const check = grade.check
  const notes: ReactNode[] = []

  if (check?.typoWord) {
    notes.push(
      <>
        {text.typoIn} <strong lang="es">{check.typoWord}</strong>
      </>,
    )
  }
  if (check?.spacing) notes.push(<>{text.spacing}</>)
  if (grade.verdict !== 'wrong' && check?.accentWords.length) {
    notes.push(
      <>
        {text.accentNote} <strong lang="es">{check.accentWords.join(', ')}</strong>
      </>,
    )
  }
  if (check?.meanings) {
    notes.push(
      <>
        {text.meaningNote}
        {check.meanings.map(({ word, gloss }) => (
          <span key={word} className="block">
            <strong lang="es" className="font-serif">
              {word}
            </strong>{' '}
            = {gloss}
          </span>
        ))}
      </>,
    )
  }
  if (grade.speech && grade.verdict === 'typo') notes.push(<>{text.speechAlmost}</>)
  if (task.kind === 'conjugation' && task.irregular) notes.push(<>{text.irregularNote}</>)
  if (!grade.correct) notes.push(<>{mistakeChoice ? text.staysInMistakes : text.savedToMistakes}</>)

  // ⭐ saves the verb or vocab word, the whole sentence otherwise.
  const star =
    task.kind === 'conjugation'
      ? ({ type: 'word', id: wordIdByVerb.get(task.verb.id) ?? task.verb.id } as const)
      : task.kind === 'vocab'
        ? ({ type: 'word', id: task.word.id } as const)
        : ({ type: 'sentence', id: task.sentence.id } as const)

  return (
    // Opaque base + tinted layer: the sheet covers the task underneath.
    <div role="status" className="animate-sheet-up rounded-t-3xl bg-surface shadow-[0_-8px_24px_rgb(0_0_0/0.08)]">
      <div className={`rounded-t-3xl border-t-2 px-5 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))] ${tone.panel}`}>
        <div className="flex items-center justify-between gap-2">
          <p className={`flex items-center gap-2 text-lg font-semibold ${tone.heading}`}>
            <Icon size={24} strokeWidth={2} className={grade.correct ? 'animate-pop' : ''} aria-hidden />
            {title}
          </p>
          <SaveButton type={star.type} id={star.id} size="pill" />
        </div>

        <div className="mt-3">
          {grade.verdict === 'wrong' && <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">{text.correctAnswer}</p>}
          {ref.label && <p className="text-sm text-ink-muted">{ref.label}</p>}
          <div className="flex items-start gap-1">
            <p lang={ref.correctLang} className="min-w-0 flex-1 pt-1.5 font-serif text-xl leading-snug">
              {ref.correct}
            </p>
            {ref.correctLang === 'es' && ref.speak && <SpeakButton text={ref.speak} />}
          </div>
          {ref.detail && (
            <div className="flex items-center gap-1.5 text-sm text-ink-muted">
              <span lang={ref.detailLang}>{ref.detail}</span>
              {ref.detailLang === 'es' && ref.speak && <SpeakButton text={ref.speak} size="sm" />}
            </div>
          )}
          {grade.speech && grade.verdict !== 'correct' && (
            <div className="mt-2">
              <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">{text.heard}</p>
              <SpeechWords words={grade.speech.words} />
            </div>
          )}
        </div>

        {notes.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-sm">
            {notes.map((note, i) => (
              <li key={i} className="flex gap-2">
                <Info size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        )}

        {mistakeChoice && grade.correct ? (
          <>
            <p className="mt-4 text-sm font-medium">{text.knewIt}</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={mistakeChoice.onKeep}>
                {text.keep}
              </Button>
              <Button onClick={mistakeChoice.onResolve} autoFocus>
                {text.remove}
              </Button>
            </div>
          </>
        ) : (
          <div className="mt-4 flex gap-3">
            {why && grade.verdict === 'wrong' && (
              <Button variant="secondary" icon={Lightbulb} onClick={why.onOpen}>
                {why.label}
              </Button>
            )}
            <Button onClick={onContinue} autoFocus className="flex-1">
              {text.carryOn}
            </Button>
          </div>
        )}
        {onOverride && grade.verdict === 'wrong' && (
          <button
            type="button"
            onClick={onOverride}
            className="mt-1 h-11 w-full text-sm font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            {text.override}
          </button>
        )}
      </div>
    </div>
  )
}
