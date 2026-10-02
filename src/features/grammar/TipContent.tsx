import { Fragment } from 'react'
import { SectionTitle } from '../../components/SectionTitle'
import { SpeakButton } from '../../components/SpeakButton'
import { tipById } from '../../data'
import type { Cloze, Sentence, Tip, TipRule } from '../../data/types'
import { spaceBefore } from '../../lib/text'

interface TipContentProps {
  tip: Tip
  /** Opened from a task: the rule that applies there is marked, and with `asked` it is spelled out for that sentence. */
  rule?: TipRule
  asked?: { sentence: Sentence; cloze: Cloze }
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

/** One grammar tip: what the rule is, with examples. Shown over a lesson (TipSheet) and in the handbook (TipPage). */
export function TipContent({ tip, rule, asked, onOpenTip }: TipContentProps) {
  // ser/estar is two lists of reasons; every other tip is one list of rules.
  const verbs = [...new Set(tip.rules.flatMap((r) => r.verb ?? []))]
  const groups = verbs.length ? verbs.map((verb) => ({ title: verb, rules: tip.rules.filter((r) => r.verb === verb) })) : [{ title: undefined, rules: tip.rules }]
  const related = (tip.related ?? []).flatMap((id) => tipById.get(id) ?? [])

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl leading-tight font-semibold tracking-tight">{tip.title}</h1>

      {rule?.because && asked && (
        <aside aria-label="V tejto vete" className="rounded-card border border-amber bg-amber/15 p-4">
          <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">V tejto vete</p>
          <p lang="es" className="mt-1 font-serif text-xl leading-snug">
            {asked.sentence.tokens.map((token, i) => (
              <Fragment key={i}>
                {spaceBefore(asked.sentence.tokens, i) && ' '}
                {i === asked.cloze.tokenIndex ? <strong className="font-semibold text-brick">{token}</strong> : token}
              </Fragment>
            ))}
          </p>
          <p className="mt-1.5">{rule.because}</p>
          {/* The rule itself, here and not only in the list below: nothing to scroll for and look up. */}
          <div className="mt-4 border-t border-amber/60 pt-3">
            <RuleBody rule={rule} />
          </div>
        </aside>
      )}

      <div>
        {rule?.because && asked && <SectionTitle id="overview-heading">Celý prehľad</SectionTitle>}
        <p className="leading-relaxed text-ink-muted">{tip.intro}</p>
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
              <li key={r.id} className={`rounded-card border bg-surface p-4 ${r.id === rule?.id ? 'border-amber ring-1 ring-amber' : 'border-line'}`}>
                <RuleBody rule={r} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {related.length > 0 && (
        <section aria-labelledby="related-heading">
          <SectionTitle id="related-heading">Pozri aj</SectionTitle>
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
