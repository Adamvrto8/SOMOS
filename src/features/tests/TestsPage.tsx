import { Award, Check, ChevronRight } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { SectionTitle } from '../../components/SectionTitle'
import { Segmented } from '../../components/Segmented'
import { TopicIcon } from '../../components/TopicIcon'
import { topicById } from '../../data'
import { useT } from '../../i18n'
import { topicName } from '../../lib/localized'
import { useTestResults, type TestRecord } from '../../lib/testProgress'
import { LEVEL_EXAM_SIZE, nextGoal, TEST_LEVELS, testKey, topicTests, type TestLevel } from '../../lib/tests'
import { useUpdateParams } from '../../lib/useUrlQuery'
import { shortDate, testHref } from './testTitle'

const CARD =
  'flex items-center gap-3 rounded-card border bg-surface p-3 transition-colors duration-150 hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick'

/** The line under a test's name: passed, best score or not tried. */
function Status({ record }: { record?: TestRecord }) {
  const text = useT().tests
  if (!record) return <>{text.notTried}</>
  if (record.passed) return <>{text.passedOn(record.bestScore, record.total, shortDate(record.passedAt ?? record.lastAt))}</>
  return <>{text.best(record.bestScore, record.total)}</>
}

/** Tests by level: the level exam on top, the topic tests below. Nothing here is locked. */
export function TestsPage() {
  const text = useT().tests
  const results = useTestResults()
  const [params] = useSearchParams()
  const updateParams = useUpdateParams()
  const asked = params.get('level')
  const level: TestLevel = TEST_LEVELS.includes(asked as TestLevel)
    ? (asked as TestLevel)
    : (nextGoal((key) => results[key]?.passed === true)?.level ?? 'A1')

  const topics = topicTests(level)
  const passedTopics = topics.filter((test) => results[testKey(test)]?.passed).length
  const exam = results[testKey({ level })]

  return (
    <div>
      <BackButton fallback="/practice" />
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">{text.title}</h1>
      <p className="mt-2 leading-relaxed text-ink-muted">{text.intro}</p>

      <div className="mt-6">
        <Segmented
          mode="radio"
          label={text.level}
          idPrefix="test-level"
          value={level}
          onChange={(next) => updateParams({ level: next })}
          options={TEST_LEVELS.map((l) => ({ id: l, label: l }))}
        />
      </div>

      <Link
        to={testHref({ level })}
        className={`${CARD} mt-4 p-4 ${exam?.passed ? 'border-leaf/50' : 'border-brick ring-1 ring-brick'}`}
      >
        <span
          className={[
            'flex size-12 shrink-0 items-center justify-center rounded-xl',
            exam?.passed ? 'bg-leaf/15 text-leaf' : 'bg-brick text-on-accent',
          ].join(' ')}
        >
          <Award size={24} strokeWidth={1.75} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-xl font-semibold">{text.exam(level)}</span>
          <span className="block text-sm text-ink-muted">{text.examHint(LEVEL_EXAM_SIZE)}</span>
          <span className="block text-sm text-ink-muted">{text.topicsPassed(passedTopics, topics.length)}</span>
          <span className={`mt-0.5 block text-sm ${exam?.passed ? 'font-medium text-leaf' : 'text-ink-muted'}`}>
            <Status record={exam} />
          </span>
        </span>
        <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
      </Link>

      <section aria-labelledby="topic-tests-heading" className="mt-7">
        <div className="flex items-center justify-between">
          <SectionTitle id="topic-tests-heading">{text.topicTests}</SectionTitle>
          <span className="text-xs text-ink-muted">
            {passedTopics}/{topics.length}
          </span>
        </div>
        <ul className="space-y-2">
          {topics.map((test) => {
            const topic = topicById.get(test.topic!)!
            const record = results[testKey(test)]
            return (
              <li key={test.topic}>
                <Link to={testHref(test)} className={`${CARD} border-line`}>
                  <span
                    className={[
                      'flex size-11 shrink-0 items-center justify-center rounded-xl',
                      record?.passed ? 'bg-leaf/15 text-leaf' : 'bg-surface-2 text-brick',
                    ].join(' ')}
                  >
                    {record?.passed ? <Check size={20} strokeWidth={2.5} aria-hidden /> : <TopicIcon name={topic.icon} size={20} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{topicName(topic)}</span>
                    <span className="block text-sm text-ink-muted">
                      <Status record={record} />
                    </span>
                  </span>
                  <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
