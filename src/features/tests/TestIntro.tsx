import { Dumbbell, Play } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { SectionTitle } from '../../components/SectionTitle'
import { useT } from '../../i18n'
import { passThreshold } from '../../lib/lessonProgress'
import { useTestResults } from '../../lib/testProgress'
import { testKey, testSize, testTypes, type TestId } from '../../lib/tests'
import { exerciseInfo } from '../exercises/exercises'
import { shortDate, testTitle } from './testTitle'

/** Before a test: what is in it, the rules, the best result so far; prepare or start. */
export function TestIntro({ test, onStart }: { test: TestId; onStart: () => void }) {
  const text = useT().tests
  const record = useTestResults()[testKey(test)]
  const size = testSize(test)

  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-balance">{testTitle(test)}</h1>
        <p className="mt-2 text-ink-muted">{text.tasks(size)}</p>
      </div>

      {record && (
        <section aria-labelledby="best-heading" className="rounded-card border border-line bg-surface p-4">
          <SectionTitle id="best-heading">{text.yourBest}</SectionTitle>
          <p className="font-serif text-3xl font-semibold tabular-nums">
            {record.bestScore}
            <span className="text-xl text-ink-muted">/{record.total}</span>
          </p>
          <p className={`mt-1 text-sm ${record.passed ? 'font-medium text-leaf' : 'text-ink-muted'}`}>
            {record.passed ? `${text.passed} · ${shortDate(record.passedAt ?? record.lastAt)}` : text.attempts(record.attempts)}
          </p>
        </section>
      )}

      <section aria-labelledby="inside-heading">
        <SectionTitle id="inside-heading">{text.whatsInside}</SectionTitle>
        <ul className="flex flex-wrap gap-2">
          {testTypes(test).map((type) => {
            const { label, icon: Icon } = exerciseInfo(type)
            return (
              <li key={type} className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-sm">
                <Icon size={15} strokeWidth={1.75} className="text-brick" aria-hidden />
                {label}
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="rules-heading">
        <SectionTitle id="rules-heading">{text.rules}</SectionTitle>
        <ul className="list-disc space-y-1.5 pl-5 text-ink-muted marker:text-brick">
          <li>{text.ruleNoFeedback}</li>
          <li>{text.ruleOneTry}</li>
          <li>{text.rulePass(passThreshold(size), size)}</li>
          <li>{text.ruleNew}</li>
        </ul>
      </section>

      <div className="grid gap-3">
        <Button icon={Play} onClick={onStart}>
          {record ? text.again : text.start}
        </Button>
        <Link
          to={`/practice/lesson?prepare=${testKey(test)}`}
          className="flex items-center gap-3 rounded-card border border-line bg-surface p-3 transition-colors duration-150 hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-brick">
            <Dumbbell size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block font-medium">{text.prepare}</span>
            <span className="block text-sm text-ink-muted">{text.prepareHint}</span>
          </span>
        </Link>
      </div>
    </div>
  )
}
