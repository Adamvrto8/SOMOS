import { ArrowRight, Check, Lock, Repeat, RotateCcw } from 'lucide-react'
import { Button } from '../../components/Button'
import { SectionTitle } from '../../components/SectionTitle'
import { Azulejos } from '../../components/Azulejos'
import type { Grade, Task } from '../../lib/lesson'
import { passThreshold as calcPassThreshold } from '../../lib/lessonProgress'
import { useT } from '../../i18n'
import { TaskAnswerList } from './TaskAnswerList'

export interface LessonAnswer {
  task: Task
  grade: Grade
  correct: boolean
}

/** The Spanish cheer and which line of the dictionary goes under it. */
function praise(ratio: number): { es: string; key: 'perfect' | 'great' | 'good' | 'low' } {
  if (ratio === 1) return { es: '¡Perfecto!', key: 'perfect' }
  if (ratio >= 0.8) return { es: '¡Muy bien!', key: 'great' }
  if (ratio >= 0.5) return { es: '¡Bien!', key: 'good' }
  return { es: '¡Ánimo!', key: 'low' }
}

interface LessonResultProps {
  answers: LessonAnswer[]
  fromMistakes: boolean // practising the mistakes list
  lessonNumber?: number
  // Numbered lesson score: right in the full run or in a correction round.
  lessonScore?: { score: number; total: number }
  isRetry?: boolean // `answers` are a correction round
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
  lessonScore,
  isRetry = false,
  totalLessons = 1,
  onRetryMistakes,
  onRepeatAll,
  onNewLesson,
  onNextLesson,
  onExit,
}: LessonResultProps) {
  const mistakes = answers.filter((a) => !a.correct)
  const isNumbered = typeof lessonNumber === 'number' && lessonScore !== undefined
  const score = isNumbered ? lessonScore.score : answers.length - mistakes.length
  const total = isNumbered ? lessonScore.total : answers.length
  const requiredScore = calcPassThreshold(total)
  const isPassed = !isNumbered || score >= requiredScore
  const hasNext = isNumbered && lessonNumber < totalLessons
  const fixed = answers.length - mistakes.length
  const dictionary = useT()
  const text = dictionary.lesson.result
  const { es, key } = praise(total > 0 ? score / total : 0)

  return (
    <div className="space-y-7">
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="relative h-28 border-b border-line bg-surface-2">
          <Azulejos className="opacity-30 dark:opacity-20" />
        </div>
        <div className="px-6 pt-5 pb-6 text-center">
          <h1 className="font-serif text-lg text-ink-muted">
            {isNumbered ? (isPassed ? text.passed(lessonNumber) : text.notPassed(lessonNumber)) : text.done}
          </h1>
          {isNumbered && isRetry && (
            <p className="mt-1 text-sm text-ink-muted">
              {text.fixed(fixed, answers.length)}
            </p>
          )}
          <p className="mt-1 font-serif text-6xl font-semibold tabular-nums">
            {score}
            <span className="text-3xl text-ink-muted">/{total}</span>
          </p>
          <p lang="es" className="mt-2 font-serif text-2xl font-semibold text-brick">
            {es}
          </p>
          <p className="mt-1 text-sm text-ink-muted">{text.praise[key]}</p>

          {isNumbered && (
            <div className="mt-4">
              {isPassed ? (
                <div className="inline-flex items-center gap-2 rounded-xl bg-leaf/10 px-4 py-2 text-sm font-medium text-leaf">
                  <Check size={18} strokeWidth={2.5} aria-hidden />
                  <span>
                    {text.passedLine(score, total, hasNext)}
                  </span>
                </div>
              ) : (
                <div className="rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">
                  <p className="font-medium">
                    {text.needed(requiredScore, total, requiredScore - score)}
                  </p>
                  <p className="mt-0.5 text-xs opacity-90">
                    {text.fixHint}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {mistakes.length > 0 && (
        <section aria-labelledby="mistakes-heading">
          <SectionTitle id="mistakes-heading">{isNumbered ? text.toFix : text.toRepeat}</SectionTitle>
          <TaskAnswerList tasks={mistakes.map((a) => a.task)} />
          {!fromMistakes && (
            <p className="mt-2 text-sm text-ink-muted">
              {isNumbered
                ? text.mistakesStay
                : text.mistakesSaved}
            </p>
          )}
        </section>
      )}

      <div className="grid gap-3">
        {/* Not passed yet: fixing the mistakes is the way forward, every fix counts. */}
        {isNumbered && !isPassed ? (
          <>
            {mistakes.length > 0 && (
              <Button variant="primary" icon={RotateCcw} onClick={onRetryMistakes}>
                {text.fixMistakes(mistakes.length)}
              </Button>
            )}
            <Button variant={mistakes.length > 0 ? 'secondary' : 'primary'} icon={Repeat} onClick={onRepeatAll}>
              {text.repeatLesson(lessonNumber)}
            </Button>
            <Button variant="secondary" disabled icon={Lock}>
              {text.nextLocked}
            </Button>
          </>
        ) : isNumbered && isPassed ? (
          <>
            {hasNext && (
              <Button variant="primary" icon={ArrowRight} onClick={onNextLesson ?? onNewLesson}>
                {text.next(lessonNumber + 1)}
              </Button>
            )}
            {mistakes.length > 0 && (
              <Button variant={hasNext ? 'secondary' : 'primary'} icon={RotateCcw} onClick={onRetryMistakes}>
                {text.fixMistakes(mistakes.length)}
              </Button>
            )}
            <Button variant="secondary" icon={Repeat} onClick={onRepeatAll}>
              {text.repeatAll}
            </Button>
          </>
        ) : (
          <>
            {mistakes.length > 0 && (
              <Button icon={RotateCcw} onClick={onRetryMistakes}>
                {text.repeatMistakes(mistakes.length)}
              </Button>
            )}
            <Button variant="secondary" icon={Repeat} onClick={onRepeatAll}>
              {text.repeatAll}
            </Button>
            <Button variant={mistakes.length > 0 ? 'secondary' : 'primary'} icon={ArrowRight} onClick={onNewLesson}>
              {fromMistakes ? text.moreMistakes : text.newLesson}
            </Button>
          </>
        )}
        <Button variant="secondary" onClick={onExit}>
          {dictionary.common.back}
        </Button>
      </div>
    </div>
  )
}
