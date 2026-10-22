import { Check, Minus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import { recordAttempt } from '../../lib/attempts'
import { holdCelebrations } from '../../lib/celebration'
import type { DuelBackend, DuelPlayer, DuelSnapshot } from '../../lib/duel/backend'
import { duelTask, phaseAt, resultOf, scoreOf, slotsOf, TASKS_PER_ROUND, type DuelPhase, type DuelResult } from '../../lib/duel/match'
import { gradeTask, type Answer, type Grade } from '../../lib/lesson'
import { recordMistake } from '../../lib/mistakes'
import { playSound, soundForVerdict } from '../../lib/sound'
import { exerciseInfo } from '../exercises/exercises'
import { TaskView } from '../exercises/tasks/TaskView'
import { DuelSuns } from './DuelSuns'

interface DuelPlayProps {
  backend: DuelBackend
  snapshot: DuelSnapshot
  me: DuelPlayer
  now: number // server time
  onFinished: () => void
}

/** How many tasks the suns count now: the ones whose right answer has been shown. */
function countedUpTo(phase: DuelPhase, total: number): number {
  switch (phase.kind) {
    case 'countdown':
      return 0
    case 'task':
      return phase.slot.index
    case 'reveal':
      return phase.slot.index + 1
    case 'break':
      return (phase.round + 1) * TASKS_PER_ROUND
    case 'done':
      return total
  }
}

function ResultMark({ result, points }: { result: DuelResult | null; points: number }) {
  const text = useT().duel
  const Icon = result === null ? Minus : result === 'wrong' ? X : Check
  const tone = result === null || result === 'wrong' ? 'text-error' : result === 'almost' ? 'text-amber' : 'text-leaf'
  return (
    <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${tone}`}>
      <Icon size={18} strokeWidth={2.5} aria-hidden />
      {result === null ? text.noAnswer : `+${points}`}
    </span>
  )
}

/** A live duel from the countdown to the last task; both phones show the same moment (lib/duel/match.ts). */
export function DuelPlay({ backend, snapshot, me, now, onFinished }: DuelPlayProps) {
  const dictionary = useT()
  const text = dictionary.duel
  const { room, answers, online } = snapshot
  const opponent = room.host.id === me.id ? room.guest! : room.host
  const players = useMemo(() => [room.host.id, room.guest!.id], [room.host.id, room.guest])
  const slots = useMemo(() => slotsOf(room.rounds), [room.rounds])
  const tasks = useMemo(() => slots.map((slot) => duelTask(slot, room.seed)), [slots, room.seed])
  const phase = phaseAt(slots, room.startedAt ?? now, answers, players, now)
  const score = scoreOf(slots, room.startedAt ?? now, answers, players, countedUpTo(phase, slots.length))

  const current = phase.kind === 'task' || phase.kind === 'reveal' ? phase.slot : null
  const task = current ? tasks[current.index] : undefined
  // What is typed or picked, for the task on screen only.
  const [draft, setDraft] = useState<{ index: number; value: Answer } | null>(null)
  const emptyAnswer: Answer = task?.kind === 'builder' ? [] : ''
  const answer = draft && current && draft.index === current.index ? draft.value : emptyAnswer
  const setAnswer = (value: Answer) => current && setDraft({ index: current.index, value })
  // My grades by task: shown when the task's right answer is revealed.
  const [grades, setGrades] = useState<Record<number, Grade>>({})
  const recorded = useRef(new Set<number>())
  const mine = current ? grades[current.index] : undefined
  const answeredHere = current !== null && (mine !== undefined || answers.some((a) => a.task === current.index && a.userId === me.id))

  /** The practice it was: counts for the daily goal and the streak; a wrong one goes to Chyby. */
  const record = (index: number, correct: boolean) => {
    if (recorded.current.has(index)) return
    recorded.current.add(index)
    const slot = slots[index]
    void recordAttempt(slot.type, slot.itemId, correct)
    if (!correct) void recordMistake(slot.type, slot.itemId)
  }

  const submit = (value: Answer = answer) => {
    if (phase.kind !== 'task' || answeredHere) return
    const index = phase.slot.index
    const grade = task ? gradeTask(task, value) : null
    const result: DuelResult = grade ? resultOf(grade.verdict) : 'wrong'
    if (grade) setGrades((all) => ({ ...all, [index]: grade }))
    playSound(grade ? soundForVerdict(grade.verdict) : 'wrong')
    void backend.answer(room.id, index, result, Math.max(0, now - phase.startedAt))
    record(index, result !== 'wrong')
  }

  // The daily goal reached mid-match is celebrated after it, not over a running task.
  useEffect(() => holdCelebrations(), [])

  // Leaving the app during a task (a dictionary, a translator) ends it as wrong.
  const submitRef = useRef(submit)
  useEffect(() => {
    submitRef.current = submit
  })
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && submitRef.current('')
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  // Time ran out without an answer: practice too, and it goes to Chyby.
  useEffect(() => {
    if (phase.kind === 'reveal' && !answeredHere) record(phase.slot.index, false)
  })

  const finishedOnce = useRef(false)
  useEffect(() => {
    if (phase.kind !== 'done' || finishedOnce.current) return
    finishedOnce.current = true
    if (room.status === 'playing') void backend.finish(room.id)
    onFinished()
  })

  const opponentAnswered = current !== null && phase.kind === 'task' && answers.some((a) => a.task === current.index && a.userId === opponent.id)
  const suns = (
    <DuelSuns
      me={{ name: me.nickname, points: score.players[me.id].points, leads: score.leader === me.id }}
      opponent={{
        name: opponent.nickname,
        points: score.players[opponent.id].points,
        leads: score.leader === opponent.id,
        answered: opponentAnswered,
        offline: !online.includes(opponent.id),
      }}
    />
  )
  const typeName = (index: number) => exerciseInfo(room.rounds[index].type).label

  if (phase.kind === 'countdown') {
    const seconds = Math.max(1, Math.ceil((phase.until - now) / 1000))
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        {suns}
        <div>
          <p className="text-sm font-semibold tracking-widest text-ink-muted uppercase">{text.getReady}</p>
          <p key={seconds} className="mt-2 animate-pop font-serif text-8xl font-semibold tabular-nums" aria-live="assertive">
            {seconds}
          </p>
          <p className="mt-4 font-medium">
            {text.roundOf(1)} · {typeName(0)}
          </p>
          <p className="text-sm text-ink-muted">{text.perTask(room.rounds[0].seconds)}</p>
        </div>
      </div>
    )
  }

  if (phase.kind === 'break') {
    const round = phase.round
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        {suns}
        <div>
          <p className="font-serif text-3xl font-semibold">{text.roundDone(round + 1)}</p>
          <p className="mt-3 text-ink-muted">
            {me.nickname} {text.points(score.players[me.id].rounds[round])} · {opponent.nickname} {text.points(score.players[opponent.id].rounds[round])}
          </p>
          <p className="mt-6 font-medium">{text.next(`${text.roundOf(round + 2)} · ${typeName(round + 1)}`)}</p>
          <p className="text-sm text-ink-muted">{text.perTask(room.rounds[round + 1].seconds)}</p>
        </div>
      </div>
    )
  }

  if (phase.kind === 'done' || !current) return <div className="flex flex-1 items-center justify-center">{suns}</div>

  const reveal = phase.kind === 'reveal'
  const left = phase.kind === 'task' ? Math.max(0, phase.deadline - now) : 0
  const share = phase.kind === 'task' ? left / (current.seconds * 1000) : 0
  const shownGrade = reveal && task ? (mine ?? gradeTask(task, emptyAnswer)) : null
  const revealed = reveal ? scoreOf(slots, room.startedAt!, answers, players, current.index + 1) : null
  const needsSend = task !== undefined && task.kind !== 'choice'

  return (
    <div className="flex flex-1 flex-col">
      {suns}

      <div className="mt-4 flex items-center justify-between text-xs font-semibold tracking-widest text-ink-muted uppercase">
        <span>
          {text.round(current.round + 1)} · {typeName(current.round)}
        </span>
        <span className="tabular-nums">
          {(current.index % TASKS_PER_ROUND) + 1}/{TASKS_PER_ROUND}
        </span>
      </div>
      {/* The time of the task, running out. */}
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="timer" aria-label={`${Math.ceil(left / 1000)} s`}>
        <div className={`h-full rounded-full transition-[width] duration-100 ease-linear ${share < 0.3 ? 'bg-error' : 'bg-brick'}`} style={{ width: `${share * 100}%` }} />
      </div>

      <main className={`mt-5 flex-1 ${answeredHere && !reveal ? 'pointer-events-none opacity-60' : ''}`}>
        {task ? (
          <TaskView
            key={current.index}
            task={task}
            answer={reveal && mine === undefined ? emptyAnswer : answer}
            onAnswer={(value) => {
              setAnswer(value)
              // Picking an option is the answer: no extra tap against the clock.
              if (task.kind === 'choice') submit(value)
            }}
            onSubmit={(value) => submit(value)}
            grade={shownGrade}
          />
        ) : (
          <p className="text-ink-muted">{text.unavailableTask}</p>
        )}
      </main>

      <div className="sticky bottom-0 -mx-4 mt-4 border-t border-line bg-bg/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        {reveal && revealed ? (
          <div className="space-y-1" aria-live="polite">
            {shownGrade && !shownGrade.correct && (
              <p className="text-sm">
                <span className="text-ink-muted">{dictionary.lesson.correctAnswer}: </span>
                <span lang="es" className="font-semibold">
                  {shownGrade.expected}
                </span>
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm">
                {me.nickname} <ResultMark result={revealed.players[me.id].tasks[current.index].result} points={revealed.players[me.id].tasks[current.index].points} />
              </span>
              <span className="text-sm">
                {opponent.nickname}{' '}
                <ResultMark result={revealed.players[opponent.id].tasks[current.index].result} points={revealed.players[opponent.id].tasks[current.index].points} />
              </span>
            </div>
          </div>
        ) : answeredHere ? (
          <p className="py-3 text-center text-sm text-ink-muted" role="status">
            {text.waitingAnswer}
          </p>
        ) : needsSend ? (
          <Button onPointerDown={(e) => e.preventDefault()} onClick={() => submit()} className="w-full">
            {text.send}
          </Button>
        ) : (
          <p className="py-3 text-center text-sm text-ink-muted">{opponentAnswered ? text.opponentAnswered(opponent.nickname) : ' '}</p>
        )}
      </div>
    </div>
  )
}
