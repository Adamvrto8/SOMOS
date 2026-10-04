import { Fragment } from 'react'
import { SectionTitle } from '../../components/SectionTitle'
import { SpeakButton } from '../../components/SpeakButton'
import { tipById } from '../../data'
import { useT } from '../../i18n'
import type { Cloze, Sentence, Tip, TipRule } from '../../data/types'
import { spaceBefore } from '../../lib/text'

/** The answer to "Prečo?" for one task: what was asked, why the answer is what it is, and the rule behind it. */
export interface TipHere {
  because: string
  rule?: TipRule
  /** A blank in a sentence, or a bare prompt ("tener · yo · pretérito") with its answer. */
  asked?: { sentence: Sentence; cloze: Cloze } | { prompt: string; answer: string }
}

interface TipContentProps {
  tip: Tip
  /** Opened with "Prečo?" from a task: its answer comes first, the handbook page follows. */
  here?: TipHere
  onOpenTip: (id: string) => void // "Pozri aj"
}

/** One rule: its name, a line of explanation and the examples with 🔊. */
function RuleBody({ rule }: { rule: TipRule }) {
  return (
    <>
      <h3 className="font-semibold">{rule.title}</h3>
      {rule.text && <p className="mt-1 text-sm leading-relaxed text-ink-muted">{rule.text}</p>}
      <ul className="mt-2 divide-y divide-line border-t border-line">
        {rule.examples.map((example) => (
          <li key={example.es} className="flex items-center gap-1 py-1.5">
            <div className="min-w-0 flex-1">
              <p lang="es" className="font-serif text-lg leading-snug">
                {example.es}
              </p>
              <p className="text-sm text-ink-muted">{example.sk}</p>
            </div>
            <SpeakButton text={example.es} />
          </li>
        ))}
      </ul>
    </>
  )
}

/** What was asked, with the right answer marked. */
function Asked({ asked }: { asked: NonNullable<TipHere['asked']> }) {
  if ('prompt' in asked) {
    return (
      <>
        <p className="mt-1 text-sm text-ink-muted">{asked.prompt}</p>
        <p lang="es" className="font-serif text-2xl leading-snug font-semibold text-brick">
          {asked.answer}
        </p>
      </>
    )
  }
  const { sentence, cloze } = asked
  return (
    <>
      <p lang="es" className="mt-1 font-serif text-xl leading-snug">
        {sentence.tokens.map((token, i) => (
          <Fragment key={i}>
            {spaceBefore(sentence.tokens, i) && ' '}
            {i === cloze.tokenIndex ? <strong className="font-semibold text-brick">{token}</strong> : token}
          </Fragment>
        ))}
      </p>
      {cloze.hint && <p className="mt-0.5 text-sm text-ink-muted">{cloze.hint}</p>}
    </>
  )
}

/** One grammar tip: what the rule is, with examples. Shown over a lesson (TipSheet) and in the handbook (TipPage). */
export function TipContent({ tip, here, onOpenTip }: TipContentProps) {
  // ser/estar is two lists of reasons; every other tip is one list of rules.
  const verbs = [...new Set(tip.rules.flatMap((r) => r.verb ?? []))]
  const groups = verbs.length ? verbs.map((verb) => ({ title: verb, rules: tip.rules.filter((r) => r.verb === verb) })) : [{ title: undefined, rules: tip.rules }]
  const related = (tip.related ?? []).flatMap((id) => tipById.get(id) ?? [])
  const text = useT().grammar
  const hereLabel = here?.asked && 'sentence' in here.asked ? text.inSentence : text.inTask

  return (
    <div className="space-y-6">
      {here && (
        // First on the page: "Prečo?" is a question about this task, the handbook below is only the background.
        <aside aria-label={hereLabel} className="rounded-card border border-amber bg-amber/15 p-4">
          <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">{hereLabel}</p>
          {here.asked && <Asked asked={here.asked} />}
          <p className="mt-2 font-medium">{here.because}</p>
          {/* The rule itself, here and not only in the list below: nothing to scroll for and look up. */}
          {here.rule && (
            <div className="mt-4 border-t border-amber/60 pt-3">
              <p className="mb-1 text-xs font-semibold tracking-widest text-ink-muted uppercase">{text.rule}</p>
              <RuleBody rule={here.rule} />
            </div>
          )}
        </aside>
      )}

      <div>
        {here && <SectionTitle id="overview-heading">{text.overview}</SectionTitle>}
        <h1 className="font-serif text-3xl leading-tight font-semibold tracking-tight">{tip.title}</h1>
        <p className="mt-3 leading-relaxed text-ink-muted">{tip.intro}</p>
      </div>

      {groups.map((group) => (
        <section key={group.title ?? tip.id} className="space-y-3">
          {group.title && (
            <h2 lang="es" className="font-serif text-2xl font-semibold">
              {group.title}
            </h2>
          )}
          <ul className="space-y-3">
            {group.rules.map((r) => (
              <li key={r.id} className={`rounded-card border bg-surface p-4 ${r.id === here?.rule?.id ? 'border-amber ring-1 ring-amber' : 'border-line'}`}>
                <RuleBody rule={r} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {related.length > 0 && (
        <section aria-labelledby="related-heading">
          <SectionTitle id="related-heading">{text.related}</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {related.map((other) => (
              <button
                key={other.id}
                type="button"
                onClick={() => onOpenTip(other.id)}
                className="flex min-h-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-left text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
              >
                {other.title}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
