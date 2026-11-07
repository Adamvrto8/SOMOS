import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowUp, Award, BookOpen, ChevronRight, Dumbbell, Pencil, Play, Route, Swords, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useT } from '../../i18n'
import { Button } from '../../components/Button'
import { loadLastPlayed } from '../../lib/attempts'
import type { TableTense } from '../../lib/conjugate'
import { EXERCISE_TYPES, moveExercise, orderExercises, setExerciseOrder, useExerciseOrder, type ExerciseOrderMode } from '../../lib/exerciseOrder'
import { getNumberedLessonCount, type ExerciseType, type LessonFilter } from '../../lib/lesson'
import { getLessonRecord, getRememberedLesson, progressionGroup, useLessonProgression, type LessonProgressionMap } from '../../lib/lessonProgress'
import { duelsAvailable } from '../../lib/duel/backend'
import { useMistakes } from '../../lib/mistakes'
import { nextStep, unitTitle, usePathState } from '../../lib/path'
import { continueLesson } from '../home/continueLesson'
import { exerciseInfo, EXERCISES, filterToParams, isLessonGroup, LEVELS, selectionLabel } from './exercises'

/** Where an exercise's tile leads: its last picked topic (or tense) and level, or Všetko · A1. */
function exerciseFilter(type: ExerciseType): LessonFilter {
  const remembered = getRememberedLesson(type)
  const group = remembered && isLessonGroup(type, remembered.group) ? remembered.group : 'all'
  const level = remembered ? LEVELS.find((l) => l === remembered.level) : 'A1'
  return type === 'conjugation' ? { type, tense: group as TableTense | 'all', level } : { type, topic: group, level }
}

function passedOf(filter: LessonFilter, map: LessonProgressionMap): { passed: number; total: number } {
  const total = getNumberedLessonCount(filter)
  const group = progressionGroup((filter.type === 'conjugation' ? filter.tense : filter.topic) ?? 'all', filter.level)
  let passed = 0
  for (let n = 1; n <= total; n++) if (getLessonRecord(filter.type, group, n, map)?.passed) passed++
  return { passed, total }
}

const TILE =
  'rounded-card border border-line bg-surface transition-colors duration-150 hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick'

function Shortcut({ to, icon: Icon, label, badge, tone = 'brick' }: { to: string; icon: LucideIcon; label: string; badge?: number; tone?: 'brick' | 'error' }) {
  return (
    <Link to={to} className={`${TILE} flex min-h-12 items-center justify-center gap-2 px-2 text-center`}>
      <Icon size={18} strokeWidth={1.75} className={`shrink-0 ${tone === 'error' ? 'text-error' : 'text-brick'}`} aria-hidden />
      <span className="text-sm font-medium">{label}</span>
      {badge !== undefined && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1.5 text-[0.7rem] leading-none font-semibold text-on-accent tabular-nums">
          {badge}
        </span>
      )}
    </Link>
  )
}

/** The path (Cesta): its unit to do, or the level walked. */
function PathCard() {
  const text = useT().path
  const states = usePathState()
  const next = nextStep(states)
  const level = next?.unit.unit.level ?? states[states.length - 1]?.unit.level ?? 'A1'
  const ofLevel = states.filter((s) => s.unit.level === level)
  return (
    <Link to="/practice/path" className={`${TILE} flex items-center gap-4 p-4`}>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brick text-on-accent shadow-[0_6px_20px_-6px_var(--brick)]">
        <Route size={22} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink-muted">{text.title}</span>
        <span className="block font-serif text-xl leading-snug font-semibold">{next ? unitTitle(next.unit.unit) : text.cardDone(level)}</span>
        {next && <span className="block truncate text-sm text-ink-muted">{text.cardLine(level, next.unit.number, ofLevel.length)}</span>}
      </span>
      <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
    </Link>
  )
}

const SEGMENT = 'min-h-11 rounded-full px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-brick'
const ICON_BUTTON =
  'flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-brick'

/** The exercises, by the last played or in the learner's own order (arranged with arrows, no dragging). */
function ExerciseList() {
  const text = useT().practice
  const progression = useLessonProgression()
  const order = useExerciseOrder()
  const lastPlayed = useLiveQuery(() => loadLastPlayed(EXERCISE_TYPES), [])
  const [editing, setEditing] = useState(false)
  // By recency the list waits for the attempts, so it does not jump into place.
  if (order.mode === 'recent' && !lastPlayed) return null
  const shown = orderExercises(
    EXERCISES.map((e) => e.type),
    order,
    lastPlayed ?? new Map(),
  )

  const pick = (mode: ExerciseOrderMode) => {
    if (mode === order.mode) return
    if (mode === 'recent') setEditing(false)
    // The first time, the learner's order starts as the list shown now and opens for arranging.
    if (mode === 'custom' && order.custom.length === 0) setEditing(true)
    setExerciseOrder({ mode, custom: mode === 'custom' && order.custom.length === 0 ? shown : order.custom })
  }
  const move = (type: ExerciseType, by: -1 | 1) => setExerciseOrder({ mode: 'custom', custom: moveExercise(shown, type, by) })

  return (
    <section aria-labelledby="exercises-heading">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="exercises-heading" className="text-xs font-semibold tracking-widest text-ink-muted uppercase">
          {text.exercises}
        </h2>
        <div className="flex items-center gap-1">
          {order.mode === 'custom' && !editing && (
            <button type="button" onClick={() => setEditing(true)} aria-label={text.order.edit} className={ICON_BUTTON}>
              <Pencil size={16} strokeWidth={1.75} aria-hidden />
            </button>
          )}
          <div role="group" aria-label={text.order.label} className="flex rounded-full bg-surface-2 p-0.5">
            {(['recent', 'custom'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={order.mode === mode}
                onClick={() => pick(mode)}
                className={`${SEGMENT} ${order.mode === mode ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
              >
                {text.order[mode]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <ul className="space-y-2">
        {shown.map((type, at) => {
          const { label, description, icon: Icon, unavailable } = exerciseInfo(type)
          const filter = exerciseFilter(type)
          const played = getRememberedLesson(type) !== undefined
          const { passed, total } = passedOf(filter, progression)
          const info = (
            <>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-brick">
                <Icon size={20} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-ink-muted">
                  {unavailable ?? (played ? selectionLabel(filter, text.everyLevel) : description)}
                </span>
              </span>
            </>
          )
          return (
            <li key={type}>
              {editing ? (
                <div className={`${TILE} flex items-center gap-2 p-3 pr-1`}>
                  {info}
                  <button type="button" onClick={() => move(type, -1)} disabled={at === 0} aria-label={text.order.up(label)} className={ICON_BUTTON}>
                    <ArrowUp size={18} strokeWidth={1.75} aria-hidden />
                  </button>
                  <button type="button" onClick={() => move(type, 1)} disabled={at === shown.length - 1} aria-label={text.order.down(label)} className={ICON_BUTTON}>
                    <ArrowDown size={18} strokeWidth={1.75} aria-hidden />
                  </button>
                </div>
              ) : unavailable ? (
                <div aria-disabled="true" className={`${TILE} flex items-center gap-3 p-3 opacity-50`}>
                  {info}
                </div>
              ) : (
                <Link to={`/practice?${filterToParams(filter)}`} className={`${TILE} flex items-center gap-3 p-3 active:bg-surface-2`}>
                  {info}
                  {total > 0 && (
                    <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                      {passed}/{total}
                    </span>
                  )}
                  <ChevronRight size={18} strokeWidth={1.75} className="-ml-1 shrink-0 text-ink-muted" aria-hidden />
                </Link>
              )}
            </li>
          )
        })}
      </ul>
      {editing && (
        <Button onClick={() => setEditing(false)} className="mt-3 w-full">
          {text.order.done}
        </Button>
      )}
    </section>
  )
}

/** Cvičiť: the path, where to go on, the shortcuts (mistakes, tests, grammar) and the exercises as a grid. */
export function PracticeHub() {
  const dictionary = useT()
  const text = dictionary.practice
  const progression = useLessonProgression()
  const mistakes = useMistakes()
  const next = continueLesson(progression)
  const mistakeCount = mistakes?.length ?? 0
  const shortcutCount = 2 + (mistakeCount > 0 ? 1 : 0) + (duelsAvailable ? 1 : 0)

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">{text.title}</h1>

      <PathCard />

      <Link to={next.href} className={`${TILE} flex items-center gap-4 p-4`}>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brick text-on-accent shadow-[0_6px_20px_-6px_var(--brick)]">
          <Play size={22} strokeWidth={1.75} className="translate-x-px" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-ink-muted">{next.started ? dictionary.home.continueLesson : dictionary.home.firstLesson}</span>
          <span className="block font-serif text-xl leading-snug font-semibold">{text.lesson(next.lesson)}</span>
          <span className="block truncate text-sm text-ink-muted">{next.label}</span>
        </span>
      </Link>

      {/* Three in a row; two or four as 2 × 2. */}
      <div className={`grid gap-2 ${shortcutCount === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {mistakeCount > 0 && <Shortcut to="/practice/lesson?mistakes=1" icon={Dumbbell} label={text.mistakes} badge={mistakeCount} tone="error" />}
        {duelsAvailable && <Shortcut to="/duel" icon={Swords} label={text.duel} />}
        <Shortcut to="/practice/tests" icon={Award} label={dictionary.tests.title} />
        <Shortcut to="/practice/grammar" icon={BookOpen} label={text.grammar} />
      </div>

      <ExerciseList />
    </div>
  )
}
