import { Volume2 } from 'lucide-react'
import { Fragment, useState } from 'react'
import { SectionTitle } from '../../components/SectionTitle'
import { Segmented } from '../../components/Segmented'
import type { Verb } from '../../data/types'
import { useT } from '../../i18n'
import { conjugate, formText, PERSON_LABELS, PERSONS, TABLE_TENSES, TENSE_LABELS, type TableTense } from '../../lib/conjugate'
import { speak, ttsSupported } from '../../lib/tts'

const IRREGULAR = 'rounded-md bg-amber/30 px-1 font-semibold'

interface ConjugationTableProps {
  verb: Verb
  estar: Verb
}

export function ConjugationTable({ verb, estar }: ConjugationTableProps) {
  const [tense, setTense] = useState<TableTense>('presente')
  const labels = useT().word
  const rows = PERSONS.map((person) => ({ person, parts: conjugate(verb, tense, person, estar) }))
  const hasIrregular = rows.some((row) => row.parts.some((p) => p.irregular))

  return (
    <section aria-labelledby="conjugation-heading">
      <SectionTitle id="conjugation-heading">{labels.conjugation}</SectionTitle>

      <Segmented
        mode="tabs"
        label={labels.tense}
        idPrefix="tab"
        panelId="conjugation-panel"
        options={TABLE_TENSES.map((t) => ({ id: t, label: TENSE_LABELS[t] }))}
        value={tense}
        onChange={setTense}
        scroll
      />

      <div role="tabpanel" id="conjugation-panel" aria-labelledby={`tab-${tense}`} className="mt-3">
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {rows.map(({ person, parts }) => {
            const text = formText(parts)
            return (
              <li key={person}>
                <button
                  type="button"
                  onClick={() => speak(text)}
                  disabled={!ttsSupported}
                  aria-label={ttsSupported ? `${PERSON_LABELS[person]}: ${text}. ${labels.play}` : undefined}
                  className="flex min-h-13 w-full items-center gap-3 px-4 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brick active:bg-surface-2 disabled:active:bg-transparent"
                >
                  <span className="w-24 shrink-0 text-sm leading-tight text-ink-muted">{PERSON_LABELS[person]}</span>
                  <span lang="es" className="flex-1 font-serif text-lg">
                    {parts.map((part, i) => (
                      <Fragment key={i}>
                        {i > 0 && ' '}
                        <span className={part.irregular ? IRREGULAR : undefined}>{part.text}</span>
                      </Fragment>
                    ))}
                  </span>
                  {ttsSupported && <Volume2 size={16} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />}
                </button>
              </li>
            )
          })}
        </ul>

        {tense === 'progresivo' && (
          <p className="mt-3 text-sm text-ink-muted">
            {labels.progresivoNote} <span lang="es" className={`font-serif text-ink ${verb.gerundIrregular ? IRREGULAR : ''}`}>{verb.gerund}</span>
          </p>
        )}
        {tense === 'imperfecto' && (
          <p className="mt-3 text-sm text-ink-muted">
            {labels.imperfectoBefore}{' '}
            <span lang="es" className="font-serif text-ink">
              De niño jugaba fútbol.
            </span>{' '}
            {labels.imperfectoAfter}
          </p>
        )}
        {tense === 'futuro' && (
          <p className="mt-3 text-sm text-ink-muted">
            {labels.futuroNote}{' '}
            <span lang="es" className="font-serif text-ink">
              voy a {verb.reflexive ? `${verb.id.slice(0, -2)}me` : verb.id}
            </span>
            .
          </p>
        )}
        {hasIrregular && (
          <p className="mt-2 flex items-center gap-2 text-sm text-ink-muted">
            <span className="inline-block size-3 rounded-sm bg-amber/60" aria-hidden />
            {labels.irregularForm}
          </p>
        )}
      </div>
    </section>
  )
}
