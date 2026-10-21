import { Check } from 'lucide-react'
import { useT } from '../../i18n'
import type { ExerciseType } from '../../lib/lesson'
import { getLessonRecord, isLessonUnlocked, type LessonProgressionMap } from '../../lib/lessonProgress'

interface LessonGridProps {
  type: ExerciseType
  group: string // progression group: "all:A1"
  total: number
  current: number // the first lesson not passed yet
  progression: LessonProgressionMap
  onOpen: (lesson: number) => void
}

/**
 * The numbered lessons as a grid of round buttons, six to a row: passed ✓, the current one filled,
 * tried but not passed with an amber ring, locked ones faded (a lock on each would only repeat itself).
 */
export function LessonGrid({ type, group, total, current, progression, onOpen }: LessonGridProps) {
  const text = useT().practice
  return (
    <ol className="grid grid-cols-6 gap-x-2 gap-y-3">
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
        const record = getLessonRecord(type, group, n, progression)
        const unlocked = isLessonUnlocked(type, group, n, progression)
        const passed = record?.passed === true
        const isCurrent = n === current && !passed
        const state = passed
          ? text.lessonState.passed
          : !unlocked
            ? text.lessonState.locked
            : record
              ? text.lessonState.tried(record.bestScore, record.total)
              : isCurrent
                ? text.lessonState.current
                : undefined
        return (
          <li key={n} className="flex justify-center">
            <button
              type="button"
              disabled={!unlocked}
              onClick={() => onOpen(n)}
              aria-label={state ? `${text.lesson(n)}, ${state}` : text.lesson(n)}
              aria-current={isCurrent ? 'step' : undefined}
              className={[
                'relative flex size-12 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition duration-150',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick active:scale-95',
                passed
                  ? 'border border-leaf/40 bg-leaf/20 text-leaf hover:bg-leaf/30'
                  : isCurrent
                    ? 'bg-brick text-on-accent shadow-[0_4px_14px_-4px_var(--brick)] hover:brightness-110'
                    : !unlocked
                      ? 'cursor-not-allowed bg-surface-2/50 font-normal text-ink-muted/60'
                      : record
                        ? 'border-2 border-amber bg-surface text-ink hover:bg-surface-2'
                        : 'border border-line bg-surface text-ink hover:bg-surface-2',
              ].join(' ')}
            >
              {n}
              {passed && (
                <span className="absolute -top-0.5 -right-0.5 flex size-4.5 items-center justify-center rounded-full bg-leaf text-on-accent ring-2 ring-bg">
                  <Check size={11} strokeWidth={3} aria-hidden />
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
