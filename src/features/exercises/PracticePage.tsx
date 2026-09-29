import { Check, ChevronRight, Dumbbell, Lock, Play } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { Chip } from '../../components/Chip'
import { SectionTitle } from '../../components/SectionTitle'
import { Segmented } from '../../components/Segmented'
import { topics } from '../../data'
import { TABLE_TENSES, TENSE_LABELS, type TableTense } from '../../lib/conjugate'
import { getNumberedLessonCount, type ExerciseType, type LessonFilter } from '../../lib/lesson'
import {
  getActiveLesson,
  getFirstUnpassedLesson,
  getLessonRecord,
  isLessonUnlocked,
  progressionGroup,
  useLessonProgression,
} from '../../lib/lessonProgress'
import { useMistakes } from '../../lib/mistakes'
import { pluralSk } from '../../lib/text'
import { useUpdateParams } from '../../lib/useUrlQuery'
import { EXERCISES, filterFromParams, filterToParams, LEVELS } from './exercises'

export function PracticePage() {
  const [params] = useSearchParams()
  const updateParams = useUpdateParams()
  const navigate = useNavigate()
  const mistakes = useMistakes()
  const progression = useLessonProgression()

  const rawFilter = filterFromParams(params)

  // Default to saved active topic/tense or standard defaults
  const activeMemory = getActiveLesson(
    rawFilter.type,
    'all',
  )

  const group =
    rawFilter.type === 'conjugation'
      ? (rawFilter.tense ?? activeMemory.group ?? 'all')
      : (rawFilter.topic ?? activeMemory.group ?? 'all')

  const filter: LessonFilter =
    rawFilter.type === 'conjugation'
      ? { ...rawFilter, tense: group as TableTense | 'all' }
      : { ...rawFilter, topic: group }

  const progGroup = progressionGroup(group, filter.level)
  const totalLessons = getNumberedLessonCount(filter)
  const unpassedLesson = getFirstUnpassedLesson(filter.type, progGroup, totalLessons, progression)

  // Passed lessons count in this topic & level
  let passedCount = 0
  for (let i = 1; i <= totalLessons; i++) {
    if (getLessonRecord(filter.type, progGroup, i, progression)?.passed) {
      passedCount++
    }
  }
  const allPassed = totalLessons > 0 && passedCount === totalLessons

  const selectType = (type: ExerciseType) => {
    const memory = getActiveLesson(type, 'all')
    if (type === 'conjugation') {
      updateParams({ type, tense: memory.group, topic: null })
    } else {
      updateParams({ type, topic: memory.group, tense: null })
    }
  }

  const navigateToLesson = (num: number) => {
    void navigate(`/practice/lesson?${filterToParams(filter)}&lesson=${num}`)
  }

  return (
    <div className="space-y-7">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Cvičiť</h1>

      {mistakes && mistakes.length > 0 && (
        <Link
          to="/practice/lesson?mistakes=1"
          className="flex items-center gap-3 rounded-card border border-line bg-surface p-3 transition-colors duration-150 hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-error/10 text-error">
            <Dumbbell size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Precvičiť chyby</span>
            <span className="block text-sm text-ink-muted">
              {mistakes.length} {pluralSk(mistakes.length, ['úloha', 'úlohy', 'úloh'])}, v ktorých si sa pomýlil
            </span>
          </span>
          <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
        </Link>
      )}

      <section aria-labelledby="type-heading">
        <SectionTitle id="type-heading">Typ cvičenia</SectionTitle>
        <div role="radiogroup" aria-labelledby="type-heading" className="space-y-2">
          {EXERCISES.map(({ type, label, description, icon: Icon }) => {
            const selected = filter.type === type
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => selectType(type)}
                className={[
                  'flex w-full items-center gap-3 rounded-card border bg-surface p-3 text-left transition-colors duration-150',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick',
                  selected ? 'border-brick ring-1 ring-brick' : 'border-line hover:border-ink-muted',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-150',
                    selected ? 'bg-brick text-on-accent' : 'bg-surface-2 text-brick',
                  ].join(' ')}
                >
                  <Icon size={20} strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{label}</span>
                  <span className="block text-sm text-ink-muted">{description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {filter.type === 'conjugation' ? (
        <section aria-labelledby="tense-heading">
          <SectionTitle id="tense-heading">Čas</SectionTitle>
          <div role="group" aria-labelledby="tense-heading" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            <Chip selected={group === 'all'} onClick={() => updateParams({ tense: 'all' })}>
              Všetky časy
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
          <SectionTitle id="topic-heading">Téma</SectionTitle>
          <div role="group" aria-labelledby="topic-heading" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            <Chip selected={group === 'all'} onClick={() => updateParams({ topic: 'all' })}>
              Všetko
            </Chip>
            {topics.map((t) => (
              <Chip key={t.id} selected={group === t.id} onClick={() => updateParams({ topic: t.id })}>
                {t.sk}
              </Chip>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="level-heading">
        <SectionTitle id="level-heading">Úroveň</SectionTitle>
        <Segmented
          mode="radio"
          label="Úroveň"
          idPrefix="level"
          value={filter.level ?? 'all'}
          onChange={(level) => updateParams({ level: level === 'all' ? null : level })}
          options={[{ id: 'all', label: 'Všetky' }, ...LEVELS.map((l) => ({ id: l, label: l }))]}
        />
      </section>

      {/* Numbered Lessons List */}
      <section aria-labelledby="lessons-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle id="lessons-heading">Lekcie</SectionTitle>
          <span className="text-xs text-ink-muted">
            {passedCount}/{totalLessons} {pluralSk(totalLessons, ['splnená', 'splnené', 'splnených'])}
          </span>
        </div>

        {totalLessons === 0 ? (
          <p className="rounded-card border border-line bg-surface p-4 text-center text-sm text-ink-muted">
            Pre tento výber zatiaľ nie sú žiadne úlohy.
          </p>
        ) : (
          <div className="grid gap-2">
            {Array.from({ length: totalLessons }, (_, i) => i + 1).map((num) => {
              const record = getLessonRecord(filter.type, progGroup, num, progression)
              const unlocked = isLessonUnlocked(filter.type, progGroup, num, progression)
              const isCurrent = num === unpassedLesson && (!record || !record.passed)
              const isPassed = record?.passed === true

              return (
                <button
                  key={num}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => navigateToLesson(num)}
                  className={[
                    'flex w-full items-center justify-between rounded-card border p-3 text-left transition-colors duration-150',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick',
                    unlocked
                      ? isCurrent
                        ? 'border-brick ring-1 ring-brick bg-surface'
                        : 'border-line bg-surface hover:border-ink-muted'
                      : 'border-line/60 bg-surface/40 opacity-60 cursor-not-allowed',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={[
                        'flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold',
                        isPassed
                          ? 'bg-success/15 text-success'
                          : isCurrent
                            ? 'bg-brick text-on-accent'
                            : unlocked
                              ? 'bg-surface-2 text-ink'
                              : 'bg-surface-2 text-ink-muted',
                      ].join(' ')}
                    >
                      {isPassed ? <Check size={16} strokeWidth={2.5} /> : unlocked ? num : <Lock size={15} />}
                    </span>
                    <div>
                      <span className="block font-medium">Lekcia {num}</span>
                      <span className="block text-xs text-ink-muted">
                        {isPassed
                          ? `Splnené (${record.bestScore}/${record.total}) · ťukni pre opakovanie`
                          : record
                            ? `Najlepšie: ${record.bestScore}/${record.total} (potrebuješ aspoň 8/10)`
                            : unlocked
                              ? '10 úloh · pripravené'
                              : `Odomkne sa po splnení Lekcie ${num - 1}`}
                      </span>
                    </div>
                  </div>

                  <div>
                    {isPassed ? (
                      <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                        {record.bestScore}/{record.total}
                      </span>
                    ) : record ? (
                      <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                        {record.bestScore}/{record.total}
                      </span>
                    ) : isCurrent ? (
                      <span className="rounded-full bg-brick/10 px-2.5 py-1 text-xs font-medium text-brick">
                        Aktuálna
                      </span>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* Stays visible above the tab bar while scrolling the options. */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-4 bg-bg/95 px-4 pt-3 pb-3 backdrop-blur">
        <Button
          icon={Play}
          disabled={totalLessons === 0}
          onClick={() => navigateToLesson(unpassedLesson)}
          className="w-full"
        >
          {allPassed ? 'Zopakovať Lekciu 1' : `Pokračovať (Lekcia ${unpassedLesson})`}
        </Button>
        <p className="mt-2 text-center text-sm text-ink-muted" aria-live="polite">
          {totalLessons === 0
            ? 'Pre tento výber zatiaľ nie sú žiadne úlohy.'
            : allPassed
              ? group === 'all'
                ? 'Všetky lekcie sú úspešne zvládnuté! ✓'
                : 'Všetky lekcie v tejto téme sú úspešne zvládnuté! ✓'
              : 'Na odomknutie ďalšej lekcie potrebuješ aspoň 8/10 (80 %)'}
        </p>
      </div>
    </div>
  )
}
