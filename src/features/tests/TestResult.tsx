import { Award, Check, Dumbbell, Repeat, X } from 'lucide-react'
import { Azulejos } from '../../components/Azulejos'
import { Button } from '../../components/Button'
import { SectionTitle } from '../../components/SectionTitle'
import { SpeakButton } from '../../components/SpeakButton'
import { useT } from '../../i18n'
import { useLanguage } from '../../lib/language'
import type { Answer, Grade, Task } from '../../lib/lesson'
import { passThreshold } from '../../lib/lessonProgress'
import type { TestId } from '../../lib/tests'
import type { UnitState } from '../../lib/path'
import { taskSummary } from '../exercises/taskSummary'
import { UnitDone } from '../path/UnitDone'
import { testTitle } from './testTitle'

export interface TestAnswer {
  task: Task
  answer: Answer
  grade: Grade
}

/** What the learner gave, as text: the built sentence of tiles, or the typed / chosen answer. */
function answerText(task: Task, answer: Answer): string {
  if (task.kind === 'builder' && Array.isArray(answer)) {
    return answer.map((id) => task.tiles.find((tile) => tile.id === id)?.text ?? '').filter(Boolean).join(' ')
  }
  return typeof answer === 'string' ? answer.trim() : ''
}

/** Free answers that may be right in another way, as in a lesson ("Moja odpoveď bola tiež správna"). */
const canAccept = (task: Task) => task.kind === 'translation' || task.kind === 'vocab' || task.kind === 'speaking'

interface TestResultProps {
  test: TestId
  answers: TestAnswer[]
  accepted: ReadonlySet<number>
  onAccept: (index: number) => void
  onAgain: () => void
  onPrepare: () => void
  onExit: () => void
  /** The test is a unit's of the path: passed, it ends the unit (with the path's state, for the next one). */
  pathUnit?: { unit: UnitState; states: readonly UnitState[] }
}

export function TestResult({ test, answers, accepted, onAccept, onAgain, onPrepare, onExit, pathUnit }: TestResultProps) {
  const dictionary = useT()
  const text = dictionary.tests
  const language = useLanguage()
  const total = answers.length
  const isRight = (a: TestAnswer, i: number) => a.grade.correct || accepted.has(i)
  const score = answers.filter(isRight).length
  const needed = passThreshold(total)
  const passed = score >= needed
  const anyWrong = answers.some((a) => !a.grade.correct)

  return (
    <div className="space-y-7">
      {passed && pathUnit && <UnitDone unit={pathUnit.unit} states={pathUnit.states} />}
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="relative flex h-28 items-center justify-center border-b border-line bg-surface-2">
          <Azulejos className="opacity-30 dark:opacity-20" />
          {passed && (
            <span className="relative flex size-16 items-center justify-center rounded-full bg-leaf text-on-accent shadow-lg">
              <Award size={32} strokeWidth={1.75} aria-hidden />
            </span>
          )}
        </div>
        <div className="px-6 pt-5 pb-6 text-center">
          <h1 className="font-serif text-lg text-ink-muted">{testTitle(test)}</h1>
          <p className="mt-1 font-serif text-6xl font-semibold tabular-nums">
            {score}
            <span className="text-3xl text-ink-muted">/{total}</span>
          </p>
          <p className={`mt-2 font-serif text-2xl font-semibold ${passed ? 'text-leaf' : 'text-brick'}`}>
            {passed ? (test.topic ? text.resultPassed : text.resultExamPassed(test.level)) : text.resultNotPassed}
          </p>
          {passed ? (
            <p className="mt-1 text-sm text-ink-muted">{text.praisePassed}</p>
          ) : (
            <div className="mt-4 rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">
              <p className="font-medium">{text.needed(needed, total, needed - score)}</p>
              <p className="mt-0.5 text-xs opacity-90">{text.neededHint}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3">
        {passed ? (
          <>
            <Button variant={pathUnit ? 'secondary' : 'primary'} onClick={onExit}>
              {pathUnit ? dictionary.path.backToPath : text.backToTests}
            </Button>
            <Button variant="secondary" icon={Repeat} onClick={onAgain}>
              {text.again}
            </Button>
          </>
        ) : (
          <>
            <Button icon={Dumbbell} onClick={onPrepare}>
              {text.prepare}
            </Button>
            <Button variant="secondary" icon={Repeat} onClick={onAgain}>
              {text.again}
            </Button>
            <Button variant="secondary" onClick={onExit}>
              {pathUnit ? dictionary.path.backToPath : text.backToTests}
            </Button>
          </>
        )}
      </div>

      <section aria-labelledby="answers-heading">
        <SectionTitle id="answers-heading">{text.answers}</SectionTitle>
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {answers.map((item, i) => {
            const { task, answer, grade } = item
            const { prompt, answer: correct } = taskSummary(task)
            const right = isRight(item, i)
            const given = answerText(task, answer)
            const isNativeAnswer = task.kind === 'vocab' && task.direction === 'es-sk'
            return (
              <li key={`${task.kind}-${task.itemId}`} className="flex items-start gap-3 py-3 pr-1 pl-4">
                <span
                  className={`mt-1 flex size-6 shrink-0 items-center justify-center rounded-full ${right ? 'bg-leaf/15 text-leaf' : 'bg-error/15 text-error'}`}
                >
                  {right ? <Check size={14} strokeWidth={2.5} aria-label={dictionary.lesson.verdicts.correct} /> : <X size={14} strokeWidth={2.5} aria-label={dictionary.lesson.verdicts.wrong} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-muted">{prompt}</p>
                  {!grade.correct && (
                    <p className={`text-sm ${right ? 'text-ink-muted' : 'text-error'}`}>
                      {text.yourAnswer}: <span className={right || !given ? '' : 'line-through'}>{given || text.noAnswer}</span>
                    </p>
                  )}
                  <p lang={isNativeAnswer ? language : 'es'} className="font-serif text-lg leading-snug">
                    {correct}
                  </p>
                  {!grade.correct &&
                    canAccept(task) &&
                    given !== '' &&
                    (accepted.has(i) ? (
                      <p className="mt-1 text-xs font-medium text-leaf">{text.accepted}</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAccept(i)}
                        className="mt-1 min-h-11 text-left text-sm font-medium text-brick underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brick"
                      >
                        {dictionary.lesson.override}
                      </button>
                    ))}
                </div>
                <SpeakButton text={task.kind === 'vocab' ? task.word.es : correct} />
              </li>
            )
          })}
        </ul>
        {anyWrong && <p className="mt-2 text-sm text-ink-muted">{text.mistakesSaved}</p>}
      </section>
    </div>
  )
}
