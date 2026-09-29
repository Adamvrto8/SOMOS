import { CircleCheck, CircleX, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../../components/Button'
import { SpeakButton } from '../../components/SpeakButton'
import { wordIdByVerb } from '../../data'
import type { Verdict } from '../../lib/checkAnswer'
import { PERSON_LABELS, TENSE_LABELS } from '../../lib/conjugate'
import type { Grade, Task } from '../../lib/lesson'
import { SaveButton } from '../word/SaveButton'

const TONE: Record<Verdict, { title: string; icon: LucideIcon; panel: string; heading: string }> = {
  correct: { title: 'Správne!', icon: CircleCheck, panel: 'bg-leaf/15 border-leaf/50', heading: 'text-leaf' },
  accent: { title: 'Správne, len pozor na prízvuk', icon: TriangleAlert, panel: 'bg-amber/20 border-amber', heading: 'text-ink' },
  typo: { title: 'Takmer! Malý preklep', icon: TriangleAlert, panel: 'bg-amber/20 border-amber', heading: 'text-ink' },
  wrong: { title: 'Nesprávne', icon: CircleX, panel: 'bg-error/10 border-error/50', heading: 'text-error' },
}

/** The full correct answer to show and speak, with its Slovak meaning where helpful. */
function reference(task: Task): { label?: string; es: string; sk?: string } {
  switch (task.kind) {
    case 'cloze':
    case 'choice':
      return { es: task.sentence.es, sk: task.sentence.sk }
    case 'conjugation':
      return { label: `${task.verb.id} · ${PERSON_LABELS[task.person]} · ${TENSE_LABELS[task.tense]}`, es: task.answer }
    case 'builder':
      return { es: task.sentence.es }
    case 'translation':
      return { es: task.sentence.es }
    case 'vocab':
      return {
        label: task.direction === 'sk-es' ? 'Preklad do španielčiny' : 'Preklad do slovenčiny',
        es: task.word.es,
        sk: task.word.sk.join(', '),
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
}

export function FeedbackSheet({ task, grade, onContinue, onOverride, mistakeChoice }: FeedbackSheetProps) {
  const tone = TONE[grade.verdict]
  const Icon = tone.icon
  const ref = reference(task)
  const check = grade.check
  const notes: ReactNode[] = []

  if (check?.typoWord) {
    notes.push(
      <>
        Preklep v slove <strong lang="es">{check.typoWord}</strong>
      </>,
    )
  }
  if (grade.verdict !== 'wrong' && check?.accentWords.length) {
    notes.push(
      <>
        Pozor na prízvuk: <strong lang="es">{check.accentWords.join(', ')}</strong>
      </>,
    )
  }
  if (check?.meanings) {
    notes.push(
      <>
        Prízvuk mení význam:
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
  if (task.kind === 'conjugation' && task.irregular) notes.push(<>Nepravidelný tvar – oplatí sa ho zapamätať.</>)
  if (!grade.correct) notes.push(<>{mistakeChoice ? 'Ostáva v Chybách' : 'Uložené do Archív → Chyby'}, zopakuješ si to neskôr.</>)

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
            {tone.title}
          </p>
          <SaveButton type={star.type} id={star.id} size="pill" />
        </div>

        <div className="mt-3">
          {grade.verdict === 'wrong' && <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">Správna odpoveď</p>}
          {ref.label && <p className="text-sm text-ink-muted">{ref.label}</p>}
          <div className="flex items-start gap-1">
            <p lang="es" className="min-w-0 flex-1 pt-1.5 font-serif text-xl leading-snug">
              {ref.es}
            </p>
            <SpeakButton text={ref.es} />
          </div>
          {ref.sk && <p className="text-sm text-ink-muted">{ref.sk}</p>}
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
            <p className="mt-4 text-sm font-medium">Vedel si to. Odstrániť z Chýb, alebo nechať na neskôr?</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={mistakeChoice.onKeep}>
                Nechať
              </Button>
              <Button onClick={mistakeChoice.onResolve} autoFocus>
                Odstrániť
              </Button>
            </div>
          </>
        ) : (
          <Button onClick={onContinue} autoFocus className="mt-4 w-full">
            Pokračovať
          </Button>
        )}
        {onOverride && grade.verdict === 'wrong' && (
          <button
            type="button"
            onClick={onOverride}
            className="mt-1 h-11 w-full text-sm font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            Moja odpoveď bola tiež správna
          </button>
        )}
      </div>
    </div>
  )
}
