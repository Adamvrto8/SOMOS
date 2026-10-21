import { Award, BookOpen, Dumbbell, Play, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { useT } from '../../i18n'
import type { TableTense } from '../../lib/conjugate'
import { getNumberedLessonCount, type ExerciseType, type LessonFilter } from '../../lib/lesson'
import { getLessonRecord, getRememberedLesson, progressionGroup, useLessonProgression, type LessonProgressionMap } from '../../lib/lessonProgress'
import { useMistakes } from '../../lib/mistakes'
import { continueLesson } from '../home/continueLesson'
import { EXERCISES, filterToParams, isLessonGroup, LEVELS, selectionLabel } from './exercises'

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

/** Cvičiť: where to go on, the shortcuts (mistakes, tests, grammar) and the exercises as a grid. */
export function PracticeHub() {
  const dictionary = useT()
  const text = dictionary.practice
  const progression = useLessonProgression()
  const mistakes = useMistakes()
  const next = continueLesson(progression)
  const mistakeCount = mistakes?.length ?? 0

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">{text.title}</h1>

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

      <div className={`grid gap-2 ${mistakeCount > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {mistakeCount > 0 && <Shortcut to="/practice/lesson?mistakes=1" icon={Dumbbell} label={text.mistakes} badge={mistakeCount} tone="error" />}
        <Shortcut to="/practice/tests" icon={Award} label={dictionary.tests.title} />
        <Shortcut to="/practice/grammar" icon={BookOpen} label={text.grammar} />
      </div>

      <section aria-labelledby="exercises-heading">
        <h2 id="exercises-heading" className="mb-2 text-xs font-semibold tracking-widest text-ink-muted uppercase">
          {text.exercises}
        </h2>
        <ul className="grid grid-cols-2 gap-3">
          {EXERCISES.map(({ type, label, description, icon: Icon, unavailable }) => {
            const filter = exerciseFilter(type)
            const played = getRememberedLesson(type) !== undefined
            const { passed, total } = passedOf(filter, progression)
            const body = (
              <>
                <span className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-surface-2 text-brick">
                    <Icon size={20} strokeWidth={1.75} aria-hidden />
                  </span>
                  {!unavailable && total > 0 && (
                    <span className="text-xs text-ink-muted tabular-nums">
                      {passed}/{total}
                    </span>
                  )}
                </span>
                <span>
                  <span className="block leading-snug font-medium">{label}</span>
                  <span className="block text-sm text-ink-muted">
                    {unavailable ?? (played ? selectionLabel(filter, text.everyLevel) : description)}
                  </span>
                </span>
              </>
            )
            return (
              <li key={type}>
                {unavailable ? (
                  <div aria-disabled="true" className={`${TILE} flex h-full flex-col gap-3 p-4 opacity-50`}>
                    {body}
                  </div>
                ) : (
                  <Link to={`/practice?${filterToParams(filter)}`} className={`${TILE} flex h-full flex-col gap-3 p-4 active:bg-surface-2`}>
                    {body}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
