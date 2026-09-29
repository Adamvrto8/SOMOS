import { ArrowRight, Check, Lock, Repeat, RotateCcw } from 'lucide-react'
import { Button } from '../../components/Button'
import { SectionTitle } from '../../components/SectionTitle'
import { SpeakButton } from '../../components/SpeakButton'
import { Tapestry } from '../../components/Tapestry'
import type { Grade, Task } from '../../lib/lesson'
import { passThreshold as calcPassThreshold } from '../../lib/lessonProgress'
import { pluralSk } from '../../lib/text'
import { taskSummary } from './taskSummary'

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

interface LessonResultProps {
  answers: LessonAnswer[]
  fromMistakes: boolean // practising the mistakes list
  lessonNumber?: number
  totalLessons?: number
  onRetryMistakes: () => void
  onRepeatAll: () => void
  onNewLesson: () => void
  onNextLesson?: () => void
  onExit: () => void
}

export function LessonResult({
  answers,
  fromMistakes,
  lessonNumber,
  totalLessons = 1,
  onRetryMistakes,
  onRepeatAll,
  onNewLesson,
  onNextLesson,
  onExit,
}: LessonResultProps) {
  const score = answers.filter((a) => a.correct).length
  const mistakes = answers.filter((a) => !a.correct)
  const total = answers.length
  const requiredScore = calcPassThreshold(total)
  const isNumbered = typeof lessonNumber === 'number'
  const isPassed = !isNumbered || score >= requiredScore
  const hasNext = isNumbered && lessonNumber < totalLessons

  const { es, sk } = praise(total > 0 ? score / total : 0)

  return (
    <div className="space-y-7">
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="relative h-28 border-b border-line bg-surface-2">
          <Tapestry className="opacity-30 dark:opacity-20" />
        </div>
        <div className="px-6 pt-5 pb-6 text-center">
          <h1 className="font-serif text-lg text-ink-muted">
            {isNumbered ? `Lekcia ${lessonNumber} ${isPassed ? 'dokončená' : 'neúspešná'}` : 'Lekcia hotová'}
          </h1>
          <p className="mt-1 font-serif text-6xl font-semibold tabular-nums">
            {score}
            <span className="text-3xl text-ink-muted">/{total}</span>
          </p>
          <p lang="es" className="mt-2 font-serif text-2xl font-semibold text-brick">
            {es}
          </p>
          <p className="mt-1 text-sm text-ink-muted">{sk}</p>

          {isNumbered && (
            <div className="mt-4">
              {isPassed ? (
                <div className="inline-flex items-center gap-2 rounded-xl bg-leaf/10 px-4 py-2 text-sm font-medium text-leaf">
                  <Check size={18} strokeWidth={2.5} aria-hidden />
                  <span>Splnené ({score}/{total}) · Ďalšia lekcia odomknutá!</span>
                </div>
              ) : (
                <div className="rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">
                  <p className="font-medium">Potrebuješ aspoň {requiredScore}/{total} (80 %)</p>
                  <p className="mt-0.5 text-xs opacity-90">
                    Aby si si učivo vryl do pamäti, zopakuj si lekciu a získaj aspoň {requiredScore} bodov.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {mistakes.length > 0 && (
        <section aria-labelledby="mistakes-heading">
          <SectionTitle id="mistakes-heading">Na zopakovanie</SectionTitle>
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {mistakes.map(({ task }, i) => {
              const { prompt, answer } = taskSummary(task)
              const isSlovakAnswer = task.kind === 'vocab' && task.direction === 'es-sk'
              return (
                <li key={`${task.itemId}-${i}`} className="flex items-start gap-1 py-3 pr-1 pl-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-muted">{prompt}</p>
                    <p lang={isSlovakAnswer ? 'sk' : 'es'} className="font-serif text-lg leading-snug">
                      {answer}
                    </p>
                  </div>
                  <SpeakButton text={task.kind === 'vocab' ? task.word.es : answer} />
                </li>
              )
            })}
          </ul>
          {!fromMistakes && <p className="mt-2 text-sm text-ink-muted">Chyby sa uložili do Archív → Chyby, môžeš sa k nim vrátiť kedykoľvek.</p>}
        </section>
      )}

      <div className="grid gap-3">
        {/* If numbered lesson failed (<8/10), Primary action is to Repeat lesson */}
        {isNumbered && !isPassed ? (
          <>
            <Button variant="primary" icon={RotateCcw} onClick={onRepeatAll}>
              Zopakovať Lekciu {lessonNumber}
            </Button>
            {mistakes.length > 0 && (
              <Button variant="secondary" icon={RotateCcw} onClick={onRetryMistakes}>
                Precvičiť {mistakes.length} {pluralSk(mistakes.length, ['chybu', 'chyby', 'chýb'])}
              </Button>
            )}
            <Button variant="secondary" disabled icon={Lock}>
              Ďalšia lekcia (zamknutá)
            </Button>
          </>
        ) : isNumbered && isPassed ? (
          <>
            {hasNext && (
              <Button variant="primary" icon={ArrowRight} onClick={onNextLesson ?? onNewLesson}>
                Ďalšia lekcia (Lekcia {lessonNumber + 1})
              </Button>
            )}
            {mistakes.length > 0 && (
              <Button variant="secondary" icon={RotateCcw} onClick={onRetryMistakes}>
                Zopakovať {mistakes.length} {pluralSk(mistakes.length, ['chybu', 'chyby', 'chýb'])}
              </Button>
            )}
            <Button variant="secondary" icon={Repeat} onClick={onRepeatAll}>
              Zopakovať celú lekciu
            </Button>
          </>
        ) : (
          <>
            {mistakes.length > 0 && (
              <Button icon={RotateCcw} onClick={onRetryMistakes}>
                Zopakovať {mistakes.length} {pluralSk(mistakes.length, ['chybu', 'chyby', 'chýb'])}
              </Button>
            )}
            <Button variant="secondary" icon={Repeat} onClick={onRepeatAll}>
              Zopakovať celú lekciu
            </Button>
            <Button variant={mistakes.length > 0 ? 'secondary' : 'primary'} icon={ArrowRight} onClick={onNewLesson}>
              {fromMistakes ? 'Ďalšie chyby' : 'Nová lekcia'}
            </Button>
          </>
        )}
        <Button variant="secondary" onClick={onExit}>
          Späť
        </Button>
      </div>
    </div>
  )
}
