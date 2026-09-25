import { ArrowRight, RotateCcw } from 'lucide-react'
import { Button } from '../../components/Button'
import { SectionTitle } from '../../components/SectionTitle'
import { SpeakButton } from '../../components/SpeakButton'
import { Tapestry } from '../../components/Tapestry'
import { PERSON_LABELS, TENSE_LABELS } from '../../lib/conjugate'
import type { Grade, Task } from '../../lib/lesson'
import { pluralSk } from '../../lib/text'

export interface LessonAnswer {
  task: Task
  grade: Grade
  correct: boolean
}

function praise(ratio: number): { es: string; sk: string } {
  if (ratio === 1) return { es: '¡Perfecto!', sk: 'Všetko správne.' }
  if (ratio >= 0.8) return { es: '¡Muy bien!', sk: 'Skvelá práca.' }
  if (ratio >= 0.5) return { es: '¡Bien!', sk: 'Ide ti to. Chyby si zopakuj, kým sú čerstvé.' }
  return { es: '¡Ánimo!', sk: 'Nevadí – chyby si môžeš hneď zopakovať.' }
}

/** What was asked and the right answer, for the mistakes list. */
function summary(task: Task): { prompt: string; answer: string } {
  switch (task.kind) {
    case 'conjugation':
      return { prompt: `${task.verb.id} · ${PERSON_LABELS[task.person]} · ${TENSE_LABELS[task.tense]}`, answer: task.answer }
    default:
      return { prompt: task.sentence.sk, answer: task.sentence.es }
  }
}

interface LessonResultProps {
  answers: LessonAnswer[]
  onRetryMistakes: () => void
  onNewLesson: () => void
  onExit: () => void
}

export function LessonResult({ answers, onRetryMistakes, onNewLesson, onExit }: LessonResultProps) {
  const score = answers.filter((a) => a.correct).length
  const mistakes = answers.filter((a) => !a.correct)
  const { es, sk } = praise(score / answers.length)

  return (
    <div className="space-y-7">
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="relative h-28 border-b border-line bg-surface-2">
          <Tapestry className="opacity-30 dark:opacity-20" />
        </div>
        <div className="px-6 pt-5 pb-6 text-center">
          <h1 className="font-serif text-lg text-ink-muted">Lekcia hotová</h1>
          <p className="mt-1 font-serif text-6xl font-semibold tabular-nums">
            {score}
            <span className="text-3xl text-ink-muted">/{answers.length}</span>
          </p>
          <p lang="es" className="mt-2 font-serif text-2xl font-semibold text-brick">
            {es}
          </p>
          <p className="mt-1 text-sm text-ink-muted">{sk}</p>
        </div>
      </div>

      {mistakes.length > 0 && (
        <section aria-labelledby="mistakes-heading">
          <SectionTitle id="mistakes-heading">Na zopakovanie</SectionTitle>
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {mistakes.map(({ task }, i) => {
              const { prompt, answer } = summary(task)
              return (
                <li key={`${task.itemId}-${i}`} className="flex items-start gap-1 py-3 pr-1 pl-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-muted">{prompt}</p>
                    <p lang="es" className="font-serif text-lg leading-snug">
                      {answer}
                    </p>
                  </div>
                  <SpeakButton text={answer} />
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="grid gap-3">
        {mistakes.length > 0 && (
          <Button icon={RotateCcw} onClick={onRetryMistakes}>
            Zopakovať {mistakes.length} {pluralSk(mistakes.length, ['chybu', 'chyby', 'chýb'])}
          </Button>
        )}
        <Button variant={mistakes.length > 0 ? 'secondary' : 'primary'} icon={ArrowRight} onClick={onNewLesson}>
          Nová lekcia
        </Button>
        <Button variant="secondary" onClick={onExit}>
          Späť na cvičenia
        </Button>
      </div>
    </div>
  )
}
