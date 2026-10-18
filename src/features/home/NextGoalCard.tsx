import { Award, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { topicById } from '../../data'
import { useT } from '../../i18n'
import { topicName } from '../../lib/localized'
import { useTestResults } from '../../lib/testProgress'
import { nextGoal } from '../../lib/tests'
import { testHref } from '../tests/testTitle'

/** The next test to aim at: the current level's topics passed so far and the next test, then its exam. */
export function NextGoalCard() {
  const text = useT().tests
  const results = useTestResults()
  const goal = nextGoal((key) => results[key]?.passed === true)
  const topic = goal?.test.topic ? topicById.get(goal.test.topic) : undefined

  return (
    <Link
      to={goal ? testHref(goal.test) : '/practice/tests'}
      className="flex items-center gap-4 rounded-card border border-line bg-surface px-5 py-4 transition-colors duration-150 hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-brick">
        <Award size={22} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink-muted">{text.nextGoal}</span>
        {goal ? (
          <>
            <span className="block font-semibold">{topic ? text.goalTopic(topicName(topic), goal.level) : text.goalExam(goal.level)}</span>
            <span className="block text-sm text-ink-muted">
              {topic ? text.goalProgress(goal.level, goal.passed, goal.total) : text.goalExamReady(goal.level)}
            </span>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <span
                className="block h-full rounded-full bg-leaf transition-[width] duration-300"
                style={{ width: `${goal.total ? (goal.passed / goal.total) * 100 : 0}%` }}
              />
            </span>
          </>
        ) : (
          <span className="block font-semibold">{text.allDone}</span>
        )}
      </span>
      <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
    </Link>
  )
}
