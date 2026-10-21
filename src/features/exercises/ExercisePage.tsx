import { Play } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { Button } from '../../components/Button'
import { Chip } from '../../components/Chip'
import { SectionTitle } from '../../components/SectionTitle'
import { Segmented } from '../../components/Segmented'
import { topics } from '../../data'
import { useT } from '../../i18n'
import { TABLE_TENSES, TENSE_LABELS, type TableTense } from '../../lib/conjugate'
import { getStablePool, LESSON_SIZE, type ExerciseType, type LessonFilter } from '../../lib/lesson'
import {
  getActiveLesson,
  getFirstUnpassedLesson,
  getLessonRecord,
  passThreshold,
  progressionGroup,
  useLessonProgression,
} from '../../lib/lessonProgress'
import { topicName } from '../../lib/localized'
import { useTestResults } from '../../lib/testProgress'
import { TEST_LEVELS, testKey, type TestId, type TestLevel } from '../../lib/tests'
import { useUpdateParams } from '../../lib/useUrlQuery'
import { testHref } from '../tests/testTitle'
import { ExerciseTestCard } from './ExerciseTestCard'
import { exerciseInfo, filterFromParams, filterToParams, isLessonGroup, LEVELS } from './exercises'
import { LessonGrid } from './LessonGrid'

/** The topic (or tense) of an exercise's last played lesson, so coming back finds it picked. */
function rememberedGroup(type: ExerciseType): string {
  const { group } = getActiveLesson(type, 'all')
  return isLessonGroup(type, group) ? group : 'all'
}

/** One exercise (`/practice?type=…`): topic or tense, level, its numbered lessons and their test. */
export function ExercisePage() {
  const dictionary = useT()
  const text = dictionary.practice
  const [params] = useSearchParams()
  const updateParams = useUpdateParams()
  const navigate = useNavigate()
  const progression = useLessonProgression()
  const testResults = useTestResults()

  const rawFilter = filterFromParams(params)
  const info = exerciseInfo(rawFilter.type)
  const group = (rawFilter.type === 'conjugation' ? rawFilter.tense : rawFilter.topic) ?? rememberedGroup(rawFilter.type)
  const filter: LessonFilter =
    rawFilter.type === 'conjugation' ? { ...rawFilter, tense: group as TableTense | 'all' } : { ...rawFilter, topic: group }

  const progGroup = progressionGroup(group, filter.level)
  const poolSize = getStablePool(filter).length
  const totalLessons = Math.ceil(poolSize / LESSON_SIZE)
  const lessonSize = Math.min(poolSize, LESSON_SIZE)
  const current = getFirstUnpassedLesson(filter.type, progGroup, totalLessons, progression)
  let passedCount = 0
  for (let n = 1; n <= totalLessons; n++) if (getLessonRecord(filter.type, progGroup, n, progression)?.passed) passedCount++
  const allPassed = totalLessons > 0 && passedCount === totalLessons
  const currentRecord = getLessonRecord(filter.type, progGroup, current, progression)

  // Všetko × a level: the lessons end with a test of the exercise.
  const exerciseTest: TestId | undefined =
    group === 'all' && TEST_LEVELS.includes(filter.level as TestLevel) && totalLessons > 0
      ? { level: filter.level as TestLevel, type: filter.type }
      : undefined
  const exerciseTestRecord = exerciseTest ? testResults[testKey(exerciseTest)] : undefined
  const takeTest = exerciseTest !== undefined && allPassed && !exerciseTestRecord?.passed

  const openLesson = (n: number) => void navigate(`/practice/lesson?${filterToParams(filter)}&lesson=${n}`)
  const Icon = info.icon

  return (
    <div className="space-y-7">
      <div>
        <BackButton fallback="/practice" />
        <div className="mt-2 flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brick text-on-accent">
            <Icon size={24} strokeWidth={1.75} aria-hidden />
          </span>
          <h1 className="font-serif text-3xl leading-tight font-semibold tracking-tight">{info.label}</h1>
        </div>
        <p className="mt-2 text-ink-muted">{info.description}</p>
      </div>

      {filter.type === 'conjugation' ? (
        <section aria-labelledby="tense-heading">
          <SectionTitle id="tense-heading">{text.tense}</SectionTitle>
          <div role="group" aria-labelledby="tense-heading" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            <Chip selected={group === 'all'} onClick={() => updateParams({ tense: 'all' })}>
              {dictionary.exercise.allTenses}
            </Chip>
            {TABLE_TENSES.map((t) => (
              <Chip key={t} selected={group === t} onClick={() => updateParams({ tense: t })}>
                {TENSE_LABELS[t]}
              </Chip>
            ))}
          </div>
        </section>
      ) : (
        <section aria-labelledby="topic-heading">
          <SectionTitle id="topic-heading">{text.topic}</SectionTitle>
          <div role="group" aria-labelledby="topic-heading" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            <Chip selected={group === 'all'} onClick={() => updateParams({ topic: 'all' })}>
              {text.all}
            </Chip>
            {topics.map((t) => (
              <Chip key={t.id} selected={group === t.id} onClick={() => updateParams({ topic: t.id })}>
                {topicName(t)}
              </Chip>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="level-heading">
        <SectionTitle id="level-heading">{text.level}</SectionTitle>
        <Segmented
          mode="radio"
          label={text.level}
          idPrefix="level"
          value={filter.level ?? 'all'}
          onChange={(level) => updateParams({ level: level === 'all' ? null : level })}
          options={[{ id: 'all', label: text.allLevels }, ...LEVELS.map((l) => ({ id: l, label: l }))]}
        />
      </section>

      <section aria-labelledby="lessons-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle id="lessons-heading">{text.lessons}</SectionTitle>
          <span className="text-xs text-ink-muted">{text.passedOf(passedCount, totalLessons)}</span>
        </div>

        {totalLessons === 0 ? (
          <p className="rounded-card border border-line bg-surface p-4 text-center text-sm text-ink-muted">{text.noTasks}</p>
        ) : (
          <>
            {/* What each card of the old list said, for the one lesson that matters now: above the grid, not below 50 lessons. */}
            <p className="text-sm text-ink-muted" aria-live="polite">
              {allPassed
                ? group === 'all'
                  ? text.allDone
                  : text.allDoneTopic
                : `${text.lesson(current)} · ${
                    currentRecord
                      ? text.best(currentRecord.bestScore, currentRecord.total, passThreshold(currentRecord.total))
                      : text.ready(lessonSize)
                  }`}
            </p>
            <LessonGrid type={filter.type} group={progGroup} total={totalLessons} current={current} progression={progression} onOpen={openLesson} />
            {exerciseTest && <ExerciseTestCard test={exerciseTest} record={exerciseTestRecord} passed={passedCount} total={totalLessons} />}
          </>
        )}
      </section>

      {/* Above the tab bar while the lessons scroll. */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-4 bg-bg/95 px-4 pt-2 pb-3 backdrop-blur">
        <Button
          icon={Play}
          disabled={totalLessons === 0}
          onClick={() => (takeTest ? void navigate(testHref(exerciseTest)) : openLesson(current))}
          className="w-full"
        >
          {takeTest ? dictionary.tests.takeTest : allPassed ? text.repeatFirst : text.continueWith(current)}
        </Button>
      </div>
    </div>
  )
}
