import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { loadSeenCounts, recordAttempt } from '../../lib/attempts'
import {
  createLesson,
  createNumberedLesson,
  getNumberedLessonCount,
  gradeTask,
  LESSON_SIZE,
  mistakesLesson,
  retryTasks,
  type Answer,
  type Grade,
  type LessonFilter,
  type Task,
} from '../../lib/lesson'
import { progressionGroup, recordLessonAttempt } from '../../lib/lessonProgress'
import { loadMistakes, recordMistake, removeMistake } from '../../lib/mistakes'
import { exerciseInfo, filterFromParams, filterToParams } from './exercises'
import { FeedbackSheet } from './FeedbackSheet'
import { LessonResult, type LessonAnswer } from './LessonResult'
import { TaskView } from './tasks/TaskView'

const emptyAnswer = (task?: Task): Answer => (task?.kind === 'builder' ? [] : '')

/** A fresh lesson: from the mistakes list, or numbered lesson, or least-practised items. */
async function buildLesson(filter: LessonFilter, fromMistakes: boolean, lessonNumber?: number): Promise<Task[]> {
  if (fromMistakes) return mistakesLesson(await loadMistakes())
  if (lessonNumber) return createNumberedLesson(filter, lessonNumber)
  return createLesson(filter, LESSON_SIZE, Math.random, await loadSeenCounts(filter.type))
}

/**
 * Full-screen lesson player (no tab bar): one task per screen, check, feedback, result.
 * `?mistakes=1` practises the mistakes list instead of the filter.
 * `?lesson=X` plays the fixed, numbered lesson X.
 */
export function LessonPage() {
  const [params] = useSearchParams()
  const filter = useMemo(() => filterFromParams(params), [params])
  const fromMistakes = params.get('mistakes') === '1'
  const lessonParam = params.get('lesson')
  const lessonNumber = lessonParam ? Number(lessonParam) : undefined
  const rawGroup = filter.type === 'conjugation' ? (filter.tense ?? 'all') : (filter.topic ?? 'all')
  const group = progressionGroup(rawGroup, filter.level)
  const totalLessons = getNumberedLessonCount(filter)

  const navigate = useNavigate()
  const location = useLocation()

  const [tasks, setTasks] = useState<Task[] | null>(null) // null = loading
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<Answer>('')
  const [grade, setGrade] = useState<Grade | null>(null)
  const [answers, setAnswers] = useState<LessonAnswer[]>([])
  const [confirmExit, setConfirmExit] = useState(false)

  const start = (next: Task[]) => {
    setTasks(next)
    setIndex(0)
    setAnswer(emptyAnswer(next[0]))
    setGrade(null)
    setAnswers([])
  }

  useEffect(() => {
    let active = true
    void buildLesson(filter, fromMistakes, lessonNumber).then((next) => active && start(next))
    return () => {
      active = false
    }
  }, [filter, fromMistakes, lessonNumber])

  const task: Task | undefined = tasks?.[index]
  const total = tasks?.length ?? 0
  const finished = total > 0 && index >= total

  // Record progress when a numbered lesson finishes
  useEffect(() => {
    if (finished && lessonNumber) {
      const score = answers.filter((a) => a.correct).length
      recordLessonAttempt(filter.type, group, lessonNumber, score, answers.length)
    }
  }, [finished, lessonNumber, filter.type, group, answers])

  // Braces matter: newer browsers return a Promise from scrollTo, which React
  // would treat as an (invalid) effect cleanup.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [index, tasks])

  const exit = () => {
    if (location.key !== 'default') void navigate(-1)
    else void navigate(fromMistakes ? '/archive?tab=mistakes' : `/practice?${filterToParams(filter)}`, { replace: true })
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

  /** Records the answer and moves on. `resolve` drops the item from the mistakes list. */
  const next = ({ override, resolve }: { override?: boolean; resolve?: boolean } = {}) => {
    if (!task || !grade || !tasks) return
    const correct = override ?? grade.correct
    void recordAttempt(task.kind, task.itemId, correct)
    if (!correct) void recordMistake(task.kind, task.itemId)
    if (resolve) void removeMistake(task.kind, task.itemId)
    setAnswers((prev) => [...prev, { task, grade, correct }])
    setIndex(index + 1)
    setAnswer(emptyAnswer(tasks[index + 1]))
    setGrade(null)
  }

  const progress = total ? (answers.length / total) * 100 : 0

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
          aria-valuemax={total}
          aria-valuenow={answers.length}
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2"
        >
          <div className="h-full rounded-full bg-brick transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="w-16 shrink-0 pr-2 text-right text-sm text-ink-muted tabular-nums">
          {lessonNumber ? `L${lessonNumber} · ` : ''}{total ? `${Math.min(index + 1, total)}/${total}` : ''}
        </span>
      </header>

      <main className="px-4 pt-4 pb-80">
        {tasks === null ? null : total === 0 ? (
          <div className="pt-10 text-center">
            <p className="font-serif text-2xl font-semibold">{fromMistakes ? 'Žiadne chyby' : 'Žiadne úlohy'}</p>
            <p className="mt-2 text-ink-muted">
              {fromMistakes
                ? 'V zozname chýb nič nie je. Zlé odpovede z lekcií sa sem ukladajú automaticky.'
                : 'Pre tento výber zatiaľ nie sú úlohy. Skús inú tému alebo úroveň.'}
            </p>
            <Button variant="secondary" onClick={exit} className="mt-6">
              Späť
            </Button>
          </div>
        ) : finished ? (
          <LessonResult
            answers={answers}
            fromMistakes={fromMistakes}
            lessonNumber={lessonNumber}
            totalLessons={totalLessons}
            onRetryMistakes={() => start(retryTasks(answers.filter((a) => !a.correct).map((a) => a.task)))}
            onRepeatAll={() => start(retryTasks(tasks))}
            onNewLesson={() => void buildLesson(filter, fromMistakes, lessonNumber).then(start)}
            onNextLesson={() => {
              if (!lessonNumber) return
              const nextNum = lessonNumber + 1
              const nextParams = filterToParams(filter)
              void navigate(`/practice/lesson?${nextParams}&lesson=${nextNum}`)
            }}
            onExit={exit}
          />
        ) : (
          task && (
            <>
              <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">
                {fromMistakes ? 'Chyby · ' : lessonNumber ? `Lekcia ${lessonNumber} · ` : ''}
                {exerciseInfo(task.kind).instruction}
              </p>
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
                onOverride={task.kind === 'translation' || task.kind === 'vocab' ? () => next({ override: true, resolve: fromMistakes }) : undefined}
                mistakeChoice={fromMistakes ? { onKeep: () => next(), onResolve: () => next({ resolve: true }) } : undefined}
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
