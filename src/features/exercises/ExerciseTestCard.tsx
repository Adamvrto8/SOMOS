import { Award, Check, ChevronRight, Lock } from 'lucide-react'
import { Link } from 'react-router'
import { useT } from '../../i18n'
import type { TestRecord } from '../../lib/testProgress'
import { EXERCISE_TEST_SIZE, type TestId } from '../../lib/tests'
import { shortDate, testHref, testTitle } from '../tests/testTitle'

interface ExerciseTestCardProps {
  test: TestId
  record?: TestRecord
  /** Lessons passed before it, of all of them: the test opens when they all are. */
  passed: number
  total: number
}

/** The last item of an exercise's lessons (Všetko × level): its test, locked until the lessons are passed. */
export function ExerciseTestCard({ test, record, passed, total }: ExerciseTestCardProps) {
  const text = useT().tests
  const open = total > 0 && passed === total
  const status = record?.passed
    ? text.passedOn(record.bestScore, record.total, shortDate(record.passedAt ?? record.lastAt))
    : record
      ? text.best(record.bestScore, record.total)
      : open
        ? text.exerciseTestHint(EXERCISE_TEST_SIZE)
        : text.exerciseLocked(passed, total)

  const body = (
    <>
      <span
        className={[
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          record?.passed ? 'bg-leaf/15 text-leaf' : open ? 'bg-brick text-on-accent' : 'bg-surface-2 text-ink-muted',
        ].join(' ')}
      >
        {record?.passed ? <Check size={16} strokeWidth={2.5} aria-hidden /> : open ? <Award size={18} strokeWidth={1.75} aria-hidden /> : <Lock size={15} aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{testTitle(test)}</span>
        <span className={`block text-xs ${record?.passed ? 'font-medium text-leaf' : 'text-ink-muted'}`}>{status}</span>
      </span>
      {open && <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />}
    </>
  )

  const card = 'flex w-full items-center gap-3 rounded-card border p-3 text-left'
  return open ? (
    <Link
      to={testHref(test)}
      className={`${card} transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick ${record?.passed ? 'border-leaf/50 bg-surface hover:border-ink-muted' : 'border-brick bg-surface ring-1 ring-brick'}`}
    >
      {body}
    </Link>
  ) : (
    <div aria-disabled="true" className={`${card} cursor-not-allowed border-line/60 bg-surface/40 opacity-60`}>
      {body}
    </div>
  )
}
