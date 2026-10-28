import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import { recordAttempt } from '../../lib/attempts'
import { gradeTask, type Answer, type Grade, type Task } from '../../lib/lesson'
import { recordMistake, removeMistake } from '../../lib/mistakes'
import { recordPractice } from '../../lib/practice'
import { playSound } from '../../lib/sound'
import { useLessonProgression } from '../../lib/lessonProgress'
import { unitOfTest, usePathState } from '../../lib/path'
import { recordTestResult } from '../../lib/testProgress'
import { createTest, exerciseFilter, isTestUnlocked, testFromParams, testKey, type TestId } from '../../lib/tests'
import { exerciseInfo, filterToParams } from '../exercises/exercises'
import { TaskView } from '../exercises/tasks/TaskView'
import { TestIntro } from './TestIntro'
import { TestResult, type TestAnswer } from './TestResult'
import { testTitle } from './testTitle'

/** Where a test leads back to: an exercise test to its lessons, the others to the tests of the level. */
const backTo = (test?: TestId) =>
  test?.type ? `/practice?${filterToParams(exerciseFilter(test.type, test.level))}` : `/practice/tests${test ? `?level=${test.level}` : ''}`

const emptyAnswer = (task?: Task): Answer => (task?.kind === 'builder' ? [] : '')

const isAnswered = (task: Task, value: Answer) =>
  task.kind === 'builder'
    ? Array.isArray(value) && value.length === task.tiles.length && value.every(Boolean)
    : typeof value === 'string' && value.trim() !== ''

/** Stores a finished test's answers like a lesson's: attempts (streak, daily goal), practice, Chyby. */
async function storeAnswers(answers: TestAnswer[]) {
  // One after another: the answer that reaches the daily goal has to be counted in order.
  for (const { task, grade } of answers) {
    await recordAttempt(task.kind, task.itemId, grade.correct)
    await recordPractice(task.kind, task.itemId, grade.correct)
    if (!grade.correct) await recordMistake(task.kind, task.itemId)
  }
}

/**
 * A test (full screen, no tab bar): intro, then one task per screen without feedback, then the result.
 * `?level=A1` is the level exam, `?level=A1&topic=food` a topic test.
 */
export function TestPage() {
  const dictionary = useT()
  const text = dictionary.tests
  const [params] = useSearchParams()
  const test = useMemo<TestId | undefined>(() => testFromParams(params), [params])
  const navigate = useNavigate()
  const location = useLocation()
  const pathStates = usePathState()
  // The test of a unit of the path: its result ends the unit and leads back to the path.
  const pathUnit = test && unitOfTest(pathStates, testKey(test))

  const [phase, setPhase] = useState<'intro' | 'test' | 'result'>('intro')
  const [tasks, setTasks] = useState<Task[]>([])
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<Answer>('')
  const [answers, setAnswers] = useState<TestAnswer[]>([])
  // Wrong answers the learner says were right too ("Moja odpoveď bola tiež správna"), by index.
  const [accepted, setAccepted] = useState<ReadonlySet<number>>(new Set())
  const [confirmExit, setConfirmExit] = useState(false)
  const [recording, setRecording] = useState(false) // Vyslovovanie: the mic is open
  const progression = useLessonProgression()

  const task: Task | undefined = tasks[index]
  const total = tasks.length

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [index, phase])

  const exit = () => {
    if (location.key !== 'default') void navigate(-1)
    else void navigate(backTo(test), { replace: true })
  }

  const start = () => {
    if (!test) return
    const next = createTest(test)
    setTasks(next)
    setIndex(0)
    setAnswer(emptyAnswer(next[0]))
    setAnswers([])
    setAccepted(new Set())
    setConfirmExit(false)
    setPhase('test')
  }

  const finish = (all: TestAnswer[]) => {
    if (!test) return
    const score = all.filter((a) => a.grade.correct).length
    recordTestResult(testKey(test), score, all.length)
    playSound('lesson')
    setPhase('result')
    void storeAnswers(all)
  }

  /** Settles the task (no verdict on screen) and moves on; `value` '' = "Neviem". */
  const next = (value: Answer = answer) => {
    if (!task) return
    const grade: Grade = gradeTask(task, value)
    const all = [...answers, { task, answer: value, grade }]
    setAnswers(all)
    if (document.activeElement instanceof HTMLElement && index + 1 === total) document.activeElement.blur()
    if (index + 1 === total) return finish(all)
    playSound('tap')
    setIndex(index + 1)
    setAnswer(emptyAnswer(tasks[index + 1]))
  }

  const accept = (i: number) => {
    if (!test || accepted.has(i)) return
    const nextAccepted = new Set(accepted).add(i)
    setAccepted(nextAccepted)
    const { task: accTask } = answers[i]
    void removeMistake(accTask.kind, accTask.itemId)
    const score = answers.filter((a, j) => a.grade.correct || nextAccepted.has(j)).length
    if (recordTestResult(testKey(test), score, answers.length, false).newlyPassed) playSound('lesson')
  }

  // A typed URL or an old link must not open an exercise test before its lessons are passed.
  if (test && !isTestUnlocked(test, progression)) {
    return (
      <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
        <p className="font-serif text-2xl font-semibold">{text.locked}</p>
        <p className="mt-2 text-ink-muted">{text.lockedHint}</p>
        <Button variant="secondary" onClick={exit} className="mt-6">
          {dictionary.common.back}
        </Button>
      </div>
    )
  }

  if (!test) {
    return (
      <div className="mx-auto max-w-[480px] px-4 pt-16 text-center">
        <p className="font-serif text-2xl font-semibold">{text.notFound}</p>
        <p className="mt-2 text-ink-muted">{text.notFoundHint}</p>
        <Button variant="secondary" onClick={() => void navigate('/practice/tests', { replace: true })} className="mt-6">
          {text.backToTests}
        </Button>
      </div>
    )
  }

  const running = phase === 'test' && task !== undefined
  const progress = total ? (answers.length / total) * 100 : 0

  return (
    <div className="mx-auto min-h-dvh max-w-[480px] sm:border-x sm:border-line">
      <header className="sticky top-0 z-10 box-content flex h-14 items-center gap-2 bg-bg px-2 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={() => (running && answers.length > 0 ? setConfirmExit(true) : exit())}
          aria-label={running ? text.quit : dictionary.common.back}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick"
        >
          <X size={22} strokeWidth={1.75} aria-hidden />
        </button>
        {running ? (
          <>
            <div
              role="progressbar"
              aria-label={text.progress}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={answers.length}
              className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2"
            >
              <div className="h-full rounded-full bg-brick transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
            <span className="w-14 shrink-0 pr-2 text-right text-sm text-ink-muted tabular-nums">
              {index + 1}/{total}
            </span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate pr-2 text-sm text-ink-muted">{testTitle(test)}</span>
        )}
      </header>

      <main className="px-4 pt-4 pb-80">
        {phase === 'intro' ? (
          <TestIntro test={test} onStart={start} />
        ) : phase === 'result' ? (
          <TestResult
            test={test}
            answers={answers}
            accepted={accepted}
            onAccept={accept}
            onAgain={start}
            onPrepare={() => void navigate(`/practice/lesson?prepare=${testKey(test)}`)}
            onExit={() => void navigate(pathUnit ? '/practice/path' : backTo(test), { replace: true })}
            pathUnit={pathUnit && { unit: pathUnit, states: pathStates }}
          />
        ) : (
          task && (
            <>
              <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">
                {testTitle(test)} · {exerciseInfo(task.kind).instruction}
              </p>
              <div className="mt-4">
                <TaskView key={`${index}-${task.itemId}`} task={task} answer={answer} onAnswer={setAnswer} onSubmit={(value) => isAnswered(task, value ?? answer) && next(value ?? answer)} onRecordingChange={setRecording} grade={null} />
              </div>
            </>
          )
        )}
      </main>

      {running && (
        <div className="fixed inset-x-0 bottom-0 z-20">
          <div className="mx-auto max-w-[480px]">
            {confirmExit ? (
              <div className="animate-sheet-up rounded-t-3xl border-t border-line bg-surface px-5 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(0_0_0/0.08)]">
                <p className="text-lg font-semibold">{text.quitQuestion}</p>
                <p className="mt-1 text-sm text-ink-muted">{text.quitHint}</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Button variant="secondary" onClick={() => setConfirmExit(false)} autoFocus>
                    {dictionary.lesson.carryOn}
                  </Button>
                  <Button variant="danger" onClick={exit}>
                    {dictionary.lesson.quitShort}
                  </Button>
                </div>
              </div>
            ) : (
              // Rides on top of the open phone keyboard, like the lesson's bar (src/lib/keyboard.ts).
              <div className="flex gap-3 border-t border-line bg-bg/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
                <Button variant="secondary" onPointerDown={(e) => e.preventDefault()} onClick={() => next(emptyAnswer(task))} disabled={recording}>
                  {text.dontKnow}
                </Button>
                {/* preventDefault keeps the phone keyboard open for the next typed task. */}
                <Button onPointerDown={(e) => e.preventDefault()} onClick={() => next()} disabled={!isAnswered(task, answer) || recording} className="flex-1">
                  {index + 1 === total ? text.finish : text.next}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
