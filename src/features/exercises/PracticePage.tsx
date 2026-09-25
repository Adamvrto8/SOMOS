import { Play } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { Chip } from '../../components/Chip'
import { SectionTitle } from '../../components/SectionTitle'
import { Segmented } from '../../components/Segmented'
import { topics } from '../../data'
import { TENSE_LABELS, type TableTense } from '../../lib/conjugate'
import { availableCount, LESSON_SIZE, type ExerciseType } from '../../lib/lesson'
import { pluralSk } from '../../lib/text'
import { useUpdateParams } from '../../lib/useUrlQuery'
import { EXERCISES, filterFromParams, filterToParams, LEVELS } from './exercises'

const TENSES: TableTense[] = ['presente', 'progresivo', 'preterito']

export function PracticePage() {
  const [params] = useSearchParams()
  const updateParams = useUpdateParams()
  const navigate = useNavigate()

  const filter = filterFromParams(params)
  const count = availableCount(filter)
  const lessonSize = Math.min(count, LESSON_SIZE)

  const selectType = (type: ExerciseType) => updateParams({ type, topic: null, tense: null })

  return (
    <div className="space-y-7">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Cvičiť</h1>

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
            <Chip selected={!filter.tense} onClick={() => updateParams({ tense: null })}>
              Všetky
            </Chip>
            {TENSES.map((t) => (
              <Chip key={t} selected={filter.tense === t} onClick={() => updateParams({ tense: t })}>
                {TENSE_LABELS[t]}
              </Chip>
            ))}
          </div>
        </section>
      ) : (
        <section aria-labelledby="topic-heading">
          <SectionTitle id="topic-heading">Téma</SectionTitle>
          <div role="group" aria-labelledby="topic-heading" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            <Chip selected={!filter.topic} onClick={() => updateParams({ topic: null })}>
              Všetky
            </Chip>
            {topics.map((t) => (
              <Chip key={t.id} selected={filter.topic === t.id} onClick={() => updateParams({ topic: t.id })}>
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

      {/* Stays visible above the tab bar while scrolling the options. */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-4 bg-bg/95 px-4 pt-3 pb-3 backdrop-blur">
        <Button
          icon={Play}
          disabled={count === 0}
          onClick={() => void navigate(`/practice/lesson?${filterToParams(filter)}`)}
          className="w-full"
        >
          Začať lekciu
        </Button>
        <p className="mt-2 text-center text-sm text-ink-muted" aria-live="polite">
          {count === 0
            ? 'Pre tento výber zatiaľ nie sú žiadne úlohy.'
            : `${lessonSize} ${pluralSk(lessonSize, ['úloha', 'úlohy', 'úloh'])} · k dispozícii ${count}`}
        </p>
      </div>
    </div>
  )
}
