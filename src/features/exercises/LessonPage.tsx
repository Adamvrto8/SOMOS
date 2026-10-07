import { Repeat, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { tipById } from '../../data'
import { useT } from '../../i18n'
import { loadSeenCounts, recordAttempt } from '../../lib/attempts'
import { playSound, soundForVerdict } from '../../lib/sound'
import { PERSON_LABELS, TENSE_LABELS } from '../../lib/conjugate'
import {
  canRetry,
  createLesson,
  createNumberedLesson,
  getNumberedLessonCount,
  gradeTask,
  LESSON_SIZE,
  mistakesLesson,
  retryTasks,
  skipSpeaking,
  type Answer,
  type Grade,
  type LessonFilter,
  type Task,
} from '../../lib/lesson'
import {
  getLessonRecord,
  isLessonUnlocked,
  progressionGroup,
  recordLessonAttempt,
  rememberActiveLesson,
  useLessonProgression,
  type LessonRecord,
} from '../../lib/lessonProgress'
import { loadMistakes, recordMistake, removeMistake } from '../../lib/mistakes'
import { localizedTip } from '../../lib/localized'
import { recordPractice } from '../../lib/practice'
import { speechSupported } from '../../lib/speech'
import { tipFor, tipLabel } from '../../lib/tips'
import { TipContent, type TipHere } from '../grammar/TipContent'
import { TipSheet } from '../grammar/TipSheet'
import { exerciseInfo, filterFromParams, filterToParams } from './exercises'
import { FeedbackSheet } from './FeedbackSheet'
import { LessonOverview } from './LessonOverview'
import { LessonResult, type LessonAnswer } from './LessonResult'
import { TaskView } from './tasks/TaskView'

const emptyAnswer = (task?: Task): Answer => (task?.kind === 'builder' ? [] : '')

/** What the task asked, as the tip repeats it above its reason. */
function askedIn(task: Task): TipHere['asked'] {
  if (task.kind === 'cloze' || task.kind === 'choice') return { sentence: task.sentence, cloze: task.cloze }
  if (task.kind === 'conjugation') return { prompt: `${task.verb.id} · ${PERSON_LABELS[task.person]} · ${TENSE_LABELS[task.tense]}`, answer: task.answer }
  return undefined
}

/** A fresh lesson: from the mistakes list, or numbered lesson, or least-practised items. */
async function buildLesson(filter: LessonFilter, fromMistakes: boolean, lessonNumber?: number): Promise<Task[]> {
  if (fromMistakes) return mistakesLesson(await loadMistakes(), LESSON_SIZE, Math.random, speechSupported)
  if (lessonNumber) return createNumberedLesson(filter, lessonNumber)
  return createLesson(filter, LESSON_SIZE, Math.random, await loadSeenCounts(filter.type))
}

/**
 * Full-screen lesson player (no tab bar): one task per screen, check, feedback, result.
 * `?mistakes=1` practises the mistakes list instead of the filter.
 * `?lesson=X` plays the fixed, numbered lesson X.
 */
export function LessonPage() {
  const dictionary = useT()
  const text = dictionary.lesson
  const [params] = useSearchParams()
  const filter = useMemo(() => filterFromParams(params), [params])
  const fromMistakes = params.get('mistakes') === '1'
  const lessonParam = fromMistakes ? null : params.get('lesson')
  const lessonNumber = lessonParam === null ? undefined : Number(lessonParam)
  const rawGroup = filter.type === 'conjugation' ? (filter.tense ?? 'all') : (filter.topic ?? 'all')
  const group = progressionGroup(rawGroup, filter.level)
  const totalLessons = useMemo(() => getNumberedLessonCount(filter), [filter])
  const progression = useLessonProgression()
  // A typed URL, an old link or browser history must not open (and then pass) a locked lesson.
  const locked =
    lessonNumber !== undefined &&
    !(
      Number.isInteger(lessonNumber) &&
      lessonNumber >= 1 &&
      lessonNumber <= totalLessons &&
      isLessonUnlocked(filter.type, group, lessonNumber, progression)
    )

  const navigate = useNavigate()
  const location = useLocation()

  const [tasks, setTasks] = useState<Task[] | null>(null) // null = loading
  // The numbered lesson these tasks belong to (its full run or a correction round).
  // Kept with the tasks, not read from the URL: after "Ďalšia lekcia" the URL already
  // names the next lesson while the finished one is still on screen.
  const [runLesson, setRunLesson] = useState<number | undefined>()
  // Correction round: the mistakes of the previous round again.
  const [isRetry, setIsRetry] = useState(false)
  // Numbered lesson score: tasks answered right in the full run or in any correction round.
  const [solved, setSolved] = useState<ReadonlySet<string>>(new Set())
  const [lessonTotal, setLessonTotal] = useState(0)
  // A passed lesson opens on its overview (correct answers) instead of starting right away.
  const [overview, setOverview] = useState<LessonRecord | null>(null)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<Answer>('')
  const [grade, setGrade] = useState<Grade | null>(null)
  // A wrong try at a typed task: shown as a hint while the learner fixes the answer.
  const [hint, setHint] = useState<Grade | null>(null)
  const [answers, setAnswers] = useState<LessonAnswer[]>([]) // this round
  const [confirmExit, setConfirmExit] = useState(false)
  const [recording, setRecording] = useState(false) // Vyslovovanie: the mic is open
  // The grammar tip open over the feedback ("Prečo?"). Opening it also adds a history entry (same URL,
  // so the lesson is not rebuilt): the phone's back button then closes the tip instead of leaving the lesson.
  const [openTip, setOpenTip] = useState<string | null>(null)
  const tipInHistory = (location.state as { tip?: true } | null)?.tip === true

  const start = (next: Task[], lesson?: number, retry = false) => {
    setOverview(null)
    setTasks(next)
    setRunLesson(lesson)
    setIsRetry(retry)
    if (!retry) {
      setSolved(new Set())
      setLessonTotal(next.length)
    }
    setIndex(0)
    setAnswer(emptyAnswer(next[0]))
    setGrade(null)
    setHint(null)
    setAnswers([])
    setConfirmExit(false)
  }

  useEffect(() => {
    if (locked) return
    let active = true
    void buildLesson(filter, fromMistakes, lessonNumber).then((next) => {
      if (!active) return
      start(next, lessonNumber)
      // Read once, on entry: the record also changes while the lesson is being played.
      const record = lessonNumber === undefined ? undefined : getLessonRecord(filter.type, group, lessonNumber)
      setOverview(record?.passed && next.length > 0 ? record : null)
    })
    if (lessonNumber !== undefined) rememberActiveLesson(filter.type, rawGroup, lessonNumber, filter.level)
    return () => {
      active = false
    }
  }, [filter, fromMistakes, lessonNumber, locked, rawGroup, group])

  const task: Task | undefined = tasks?.[index]
  const total = tasks?.length ?? 0
  const finished = total > 0 && index >= total

  // Braces matter: newer browsers return a Promise from scrollTo, which React
  // would treat as an (invalid) effect cleanup.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [index, tasks, overview])

  const exit = () => {
    if (location.key !== 'default') void navigate(-1)
    else void navigate(fromMistakes ? '/archive?tab=mistakes' : `/practice?${filterToParams(filter)}`, { replace: true })
  }

  const isAnswered = (value: Answer) =>
    task
      ? task.kind === 'builder'
        ? Array.isArray(value) && value.length === task.tiles.length
        : typeof value === 'string' && value.trim() !== ''
      : false
  const canCheck = isAnswered(answer)

  const showGrade = (result: Grade) => {
    setHint(null)
    setGrade(result)
    // Close the phone keyboard so the feedback sheet is visible.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }

  /** `value` lets a task submit an answer it has just set (Vyslovovanie's 3rd recording). */
  const check = (value: Answer = answer) => {
    if (!task || grade || !isAnswered(value)) return
    setAnswer(value)
    const result = gradeTask(task, value)
    // A wrong typed answer can be fixed and checked again, as often as it takes:
    // it sounds like "not yet", the sound of a wrong answer is kept for the one that stands.
    if (!result.correct && canRetry(task)) {
      playSound('almost')
      setHint(result)
    } else {
      playSound(soundForVerdict(result.verdict))
      showGrade(result)
    }
  }

  /** "Vzdať sa": shows the correct answer; the task counts as wrong. */
  const giveUp = () => {
    if (!task || grade) return
    playSound('wrong')
    showGrade(gradeTask(task, answer))
  }

  /**
   * "Teraz nemôžem hovoriť": the speaking tasks ahead are dropped and count neither way; a mistakes
   * lesson goes on with its other tasks, otherwise the lesson ends here.
   */
  const skipRest = () => {
    if (!tasks || grade) return
    const rest = skipSpeaking(tasks, index)
    if (rest.length === index && answers.length === 0) return exit()
    setTasks(rest)
    setAnswer(emptyAnswer(rest[index]))
  }

  /** Records the answer and moves on. `resolve` drops the item from the mistakes list. */
  const next = ({ override, resolve }: { override?: boolean; resolve?: boolean } = {}) => {
    if (!task || !grade || !tasks) return
    const correct = override ?? grade.correct
    void recordAttempt(task.kind, task.itemId, correct)
    void recordPractice(task.kind, task.itemId, correct)
    if (!correct) void recordMistake(task.kind, task.itemId)
    // A mistake fixed in a correction round leaves Chyby; the ones left behind stay there.
    // (The mistakes list itself asks "Nechať / Odstrániť" instead.)
    if (resolve || (isRetry && correct && !fromMistakes)) void removeMistake(task.kind, task.itemId)
    setAnswers([...answers, { task, grade, correct }])
    if (runLesson !== undefined) {
      const nextSolved = correct ? new Set(solved).add(task.itemId) : solved
      setSolved(nextSolved)
      // Saved on every right answer and at the end of each round, so quitting a
      // correction round halfway keeps the credit (the store keeps the best score).
      if (correct || index + 1 === tasks.length) recordLessonAttempt(filter.type, group, runLesson, nextSolved.size, lessonTotal)
    }
    if (index + 1 === tasks.length) playSound('lesson')
    setIndex(index + 1)
    setAnswer(emptyAnswer(tasks[index + 1]))
    setGrade(null)
    setHint(null)
    setOpenTip(null)
  }

  const taskTip = task && grade ? tipFor(task, grade) : undefined
  // Both are needed: after a reload the history entry is still there, but nothing was opened.
  const shownTip = grade && tipInHistory && openTip ? tipById.get(openTip) : undefined
  const isTaskTip = shownTip !== undefined && shownTip === taskTip?.tip

  const showTip = (id: string) => {
    setOpenTip(id)
    void navigate({ search: location.search }, { state: { tip: true } })
  }

  const closeTip = () => {
    setOpenTip(null)
    void navigate(-1)
  }

  const progress = total ? (answers.length / total) * 100 : 0

  return (
    <div className="mx-auto min-h-dvh max-w-[480px] sm:border-x sm:border-line">
      <header className="sticky top-0 z-10 box-content flex h-14 items-center gap-2 bg-bg px-2 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={() => (answers.length > 0 && !finished ? setConfirmExit(true) : exit())}
          aria-label={text.quit}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick"
        >
          <X size={22} strokeWidth={1.75} aria-hidden />
        </button>
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
        <span className="w-16 shrink-0 pr-2 text-right text-sm text-ink-muted tabular-nums">
          {runLesson ? `L${runLesson}` : ''}
          {total && !overview ? `${runLesson ? ' · ' : ''}${Math.min(index + 1, total)}/${total}` : ''}
        </span>
      </header>

      <main className="px-4 pt-4 pb-80">
        {locked ? (
          <div className="pt-10 text-center">
            <p className="font-serif text-2xl font-semibold">{text.locked}</p>
            <p className="mt-2 text-ink-muted">{text.lockedHint}</p>
            <Button variant="secondary" onClick={exit} className="mt-6">
              {dictionary.common.back}
            </Button>
          </div>
        ) : tasks === null ? null : total === 0 ? (
          <div className="pt-10 text-center">
            <p className="font-serif text-2xl font-semibold">{fromMistakes ? text.noMistakes : text.noTasks}</p>
            <p className="mt-2 text-ink-muted">
              {fromMistakes
                ? text.noMistakesHint
                : text.noTasksHint}
            </p>
            <Button variant="secondary" onClick={exit} className="mt-6">
              {dictionary.common.back}
            </Button>
          </div>
        ) : overview && runLesson !== undefined ? (
          <LessonOverview lessonNumber={runLesson} record={overview} tasks={tasks} />
        ) : finished ? (
          <LessonResult
            answers={answers}
            fromMistakes={fromMistakes}
            lessonNumber={runLesson}
            lessonScore={runLesson !== undefined ? { score: solved.size, total: lessonTotal } : undefined}
            isRetry={isRetry}
            totalLessons={totalLessons}
            onRetryMistakes={() => {
              start(retryTasks(answers.filter((a) => !a.correct).map((a) => a.task)), runLesson, true)
            }}
            onRepeatAll={() => {
              if (lessonNumber !== undefined) {
                void buildLesson(filter, fromMistakes, lessonNumber).then((next) => start(next, lessonNumber))
              } else if (tasks) {
                start(retryTasks(tasks))
              }
            }}
            onNewLesson={() => {
              void buildLesson(filter, fromMistakes, lessonNumber).then((next) => start(next, lessonNumber))
            }}
            onNextLesson={() => {
              if (runLesson === undefined) return
              void navigate(`/practice/lesson?${filterToParams(filter)}&lesson=${runLesson + 1}`, { replace: true })
            }}
            onExit={exit}
          />
        ) : (
          task && (
            <>
              <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">
                {fromMistakes ? `${dictionary.archive.tabs.mistakes} · ` : runLesson ? `${dictionary.practice.lesson(runLesson)}${isRetry ? ` · ${text.fixing}` : ''} · ` : ''}
                {exerciseInfo(task.kind).instruction}
              </p>
              <div className="mt-4">
                <TaskView key={`${index}-${task.itemId}`} task={task} answer={answer} onAnswer={setAnswer} onSubmit={check} onSkipRest={skipRest} onRecordingChange={setRecording} grade={grade} hint={hint} />
              </div>
            </>
          )
        )}
      </main>

      {!locked && task && !finished && (
        <div className="fixed inset-x-0 bottom-0 z-20">
          <div className="mx-auto max-w-[480px]">
            {overview ? (
              <div className="flex gap-3 border-t border-line bg-bg/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
                <Button variant="secondary" onClick={exit}>
                  {dictionary.common.back}
                </Button>
                <Button icon={Repeat} onClick={() => setOverview(null)} className="flex-1" autoFocus>
                  {text.repeat}
                </Button>
              </div>
            ) : confirmExit ? (
              <div className="animate-sheet-up rounded-t-3xl border-t border-line bg-surface px-5 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(0_0_0/0.08)]">
                <p className="text-lg font-semibold">{text.quitQuestion}</p>
                <p className="mt-1 text-sm text-ink-muted">{text.quitHint}</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Button variant="secondary" onClick={() => setConfirmExit(false)} autoFocus>
                    {text.carryOn}
                  </Button>
                  <Button variant="danger" onClick={exit}>
                    {text.quitShort}
                  </Button>
                </div>
              </div>
            ) : grade ? (
              <FeedbackSheet
                task={task}
                grade={grade}
                onContinue={() => next()}
                onOverride={task.kind === 'translation' || task.kind === 'vocab' || task.kind === 'speaking' ? () => next({ override: true, resolve: fromMistakes }) : undefined}
                mistakeChoice={fromMistakes ? { onKeep: () => next(), onResolve: () => next({ resolve: true }) } : undefined}
                why={taskTip && { label: tipLabel(taskTip), onOpen: () => showTip(taskTip.tip.id) }}
              />
            ) : (
              // Rides on top of the open phone keyboard and drops back to the bottom without it (src/lib/keyboard.ts).
              <div className="flex gap-3 border-t border-line bg-bg/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
                {canRetry(task) && (
                  <Button variant="secondary" onClick={giveUp}>
                    {text.giveUp}
                  </Button>
                )}
                {/* preventDefault keeps the focus (and the phone keyboard) in the answer field for a second try. */}
                <Button onPointerDown={(e) => e.preventDefault()} onClick={() => check()} disabled={!canCheck || recording} className="flex-1">
                  {text.check}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {shownTip && (
        <TipSheet key={shownTip.id} label={localizedTip(shownTip).title} onClose={closeTip}>
          <TipContent
            tip={shownTip}
            // The task's own reason only in the task's own tip, not in one reached through "Pozri aj".
            here={isTaskTip && task && taskTip?.because ? { because: taskTip.because, rule: taskTip.rule, asked: askedIn(task) } : undefined}
            onOpenTip={setOpenTip}
          />
        </TipSheet>
      )}
    </div>
  )
}
