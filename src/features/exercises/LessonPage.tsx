import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { recordAttempt } from '../../lib/attempts'
import { createLesson, gradeTask, retryTasks, type Answer, type Grade, type Task } from '../../lib/lesson'
import { exerciseInfo, filterFromParams, filterToParams } from './exercises'
import { FeedbackSheet } from './FeedbackSheet'
import { LessonResult, type LessonAnswer } from './LessonResult'
import { TaskView } from './tasks/TaskView'

const emptyAnswer = (task?: Task): Answer => (task?.kind === 'builder' ? [] : '')

/** Full-screen lesson player (no tab bar): one task per screen, check, feedback, result. */
export function LessonPage() {
  const [params] = useSearchParams()
  const filter = useMemo(() => filterFromParams(params), [params])
  const navigate = useNavigate()
  const location = useLocation()

  const [tasks, setTasks] = useState(() => createLesson(filter))
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<Answer>(() => emptyAnswer(tasks[0]))
  const [grade, setGrade] = useState<Grade | null>(null)
  const [answers, setAnswers] = useState<LessonAnswer[]>([])
  const [confirmExit, setConfirmExit] = useState(false)

  const task: Task | undefined = tasks[index]
  const finished = tasks.length > 0 && index >= tasks.length

  // Braces matter: newer browsers return a Promise from scrollTo, which React
  // would treat as an (invalid) effect cleanup.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [index, tasks])

  const exit = () => {
    if (location.key === 'default') void navigate(`/practice?${filterToParams(filter)}`, { replace: true })
    else void navigate(-1)
  }

  const start = (next: Task[]) => {
    setTasks(next)
    setIndex(0)
    setAnswer(emptyAnswer(next[0]))
    setGrade(null)
    setAnswers([])
  }

  const canCheck = task
    ? task.kind === 'builder'
      ? Array.isArray(answer) && answer.length === task.tiles.length
      : typeof answer === 'string' && answer.trim() !== ''
    : false

  const check = () => {
    if (!task || grade || !canCheck) return
    setGrade(gradeTask(task, answer))
    // Close the phone keyboard so the feedback sheet is visible.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }

  const next = (override?: boolean) => {
    if (!task || !grade) return
    const correct = override ?? grade.correct
    void recordAttempt(filter.type, task.itemId, correct)
    setAnswers((prev) => [...prev, { task, grade, correct }])
    setIndex(index + 1)
    setAnswer(emptyAnswer(tasks[index + 1]))
    setGrade(null)
  }

  const progress = tasks.length ? (answers.length / tasks.length) * 100 : 0

  return (
    <div className="mx-auto min-h-dvh max-w-[480px] sm:border-x sm:border-line">
      <header className="sticky top-0 z-10 box-content flex h-14 items-center gap-2 bg-bg px-2 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={() => (answers.length > 0 && !finished ? setConfirmExit(true) : exit())}
          aria-label="Ukončiť lekciu"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick"
        >
          <X size={22} strokeWidth={1.75} aria-hidden />
        </button>
        <div
          role="progressbar"
          aria-label="Priebeh lekcie"
          aria-valuemin={0}
          aria-valuemax={tasks.length}
          aria-valuenow={answers.length}
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2"
        >
          <div className="h-full rounded-full bg-brick transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="w-14 shrink-0 pr-2 text-right text-sm text-ink-muted tabular-nums">
          {Math.min(index + 1, tasks.length)}/{tasks.length}
        </span>
      </header>

      <main className="px-4 pt-4 pb-80">
        {tasks.length === 0 ? (
          <div className="pt-10 text-center">
            <p className="font-serif text-2xl font-semibold">Žiadne úlohy</p>
            <p className="mt-2 text-ink-muted">Pre tento výber zatiaľ nie sú úlohy. Skús inú tému alebo úroveň.</p>
            <Button variant="secondary" onClick={exit} className="mt-6">
              Späť na cvičenia
            </Button>
          </div>
        ) : finished ? (
          <LessonResult
            answers={answers}
            onRetryMistakes={() => start(retryTasks(answers.filter((a) => !a.correct).map((a) => a.task)))}
            onNewLesson={() => start(createLesson(filter))}
            onExit={exit}
          />
        ) : (
          task && (
            <>
              <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">{exerciseInfo(task.kind).instruction}</p>
              <div className="mt-4">
                <TaskView key={`${index}-${task.itemId}`} task={task} answer={answer} onAnswer={setAnswer} onSubmit={check} grade={grade} />
              </div>
            </>
          )
        )}
      </main>

      {task && !finished && (
        <div className="fixed inset-x-0 bottom-0 z-20">
          <div className="mx-auto max-w-[480px]">
            {confirmExit ? (
              <div className="animate-sheet-up rounded-t-3xl border-t border-line bg-surface px-5 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(0_0_0/0.08)]">
                <p className="text-lg font-semibold">Ukončiť lekciu?</p>
                <p className="mt-1 text-sm text-ink-muted">Odpovede, ktoré si už dal, ostanú uložené.</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Button variant="secondary" onClick={() => setConfirmExit(false)} autoFocus>
                    Pokračovať
                  </Button>
                  <Button variant="danger" onClick={exit}>
                    Ukončiť
                  </Button>
                </div>
              </div>
            ) : grade ? (
              <FeedbackSheet
                task={task}
                grade={grade}
                onContinue={() => next()}
                onOverride={task.kind === 'translation' ? () => next(true) : undefined}
              />
            ) : (
              <div className="border-t border-line bg-bg/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
                <Button onClick={check} disabled={!canCheck} className="w-full">
                  Skontrolovať
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
