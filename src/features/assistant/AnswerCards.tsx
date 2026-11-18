import { ChevronRight, Volume2 } from 'lucide-react'
import { Link } from 'react-router'
import { tipById, verbById, wordById, wordIdByVerb } from '../../data'
import { useT } from '../../i18n'
import type { AnswerCard } from '../../lib/assistant/answerText'
import { conjugationRows, formText, TENSE_LABELS } from '../../lib/conjugate'
import { articleFor } from '../../lib/grammar'
import { localizedTip, wordTranslations } from '../../lib/localized'
import { speak, ttsSupported } from '../../lib/tts'
import { Forms } from '../word/ConjugationTable'
import { SaveButton } from '../word/SaveButton'

// SOMO's cards: what the model only names by a marker, drawn from the app's own data (lib/assistant/answerText.ts).

const CARD = 'rounded-card border border-line bg-surface'
const LINK_ROW =
  'flex min-h-11 items-center justify-between gap-2 border-t border-line px-3 text-sm font-medium text-brick focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brick active:bg-surface-2'

function SpeakButton({ text, label }: { text: string; label: string }) {
  if (!ttsSupported) return null
  return (
    <button
      type="button"
      onClick={() => speak(text)}
      aria-label={label}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick"
    >
      <Volume2 size={20} strokeWidth={1.75} aria-hidden />
    </button>
  )
}

function WordCard({ id }: { id: string }) {
  const text = useT().assistant
  const word = wordById.get(id)
  if (!word) return null
  const article = articleFor(word)
  const spoken = article ? `${article} ${word.es}` : word.es
  return (
    <div className={`${CARD} flex items-center gap-1 py-1 pl-3 pr-1`}>
      <Link to={`/word/${word.id}`} className="min-w-0 flex-1 py-1 focus-visible:outline-2 focus-visible:outline-brick">
        <span lang="es" className="block font-serif text-xl leading-tight">
          {article && <span className="text-ink-muted">{article} </span>}
          {word.es}
        </span>
        <span className="block truncate text-sm text-ink-muted">{wordTranslations(word).join(', ')}</span>
      </Link>
      <SpeakButton text={spoken} label={text.listen(spoken)} />
      <SaveButton type="word" id={word.id} size="md" />
    </div>
  )
}

function ConjCard({ verbId, tense }: Extract<AnswerCard, { type: 'conj' }>) {
  const text = useT().assistant
  const verb = verbById.get(verbId)
  const estar = verbById.get('estar')
  if (!verb || !estar) return null
  const rows = conjugationRows(verb, tense, estar)
  const wordId = wordIdByVerb.get(verb.id)
  return (
    <section className={CARD} aria-label={`${verb.id} · ${TENSE_LABELS[tense]}`}>
      <p className="px-3 pt-2 text-sm text-ink-muted">
        <span lang="es" className="font-serif text-base text-ink">
          {verb.id}
        </span>{' '}
        · {TENSE_LABELS[tense]}
      </p>
      <ul className="divide-y divide-line">
        {rows.map(({ person, label, parts, negative }) => {
          const spoken = negative ? `${formText(parts)}, ${formText(negative)}` : formText(parts)
          return (
            <li key={person}>
              <button
                type="button"
                onClick={() => speak(spoken)}
                disabled={!ttsSupported}
                aria-label={ttsSupported ? `${label}: ${spoken}. ${text.play}` : undefined}
                className="flex min-h-11 w-full items-center gap-3 px-3 py-1.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brick active:bg-surface-2 disabled:active:bg-transparent"
              >
                <span className="w-20 shrink-0 text-sm leading-tight text-ink-muted">{label}</span>
                <span lang="es" className="min-w-0 flex-1 font-serif text-lg">
                  <Forms parts={parts} />
                  {negative && (
                    <span className="block text-base text-ink-muted">
                      <Forms parts={negative} />
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {wordId && (
        <Link to={`/word/${wordId}`} className={LINK_ROW}>
          {text.wholeConjugation}
          <ChevronRight size={18} strokeWidth={1.75} aria-hidden />
        </Link>
      )}
    </section>
  )
}

function TipCard({ id }: { id: string }) {
  const text = useT().assistant
  const tip = tipById.get(id)
  if (!tip) return null
  const local = localizedTip(tip)
  return (
    <Link to={`/practice/grammar/${tip.id}`} className={`${CARD} block focus-visible:outline-2 focus-visible:outline-brick active:bg-surface-2`}>
      <span className="block px-3 pt-2 text-xs font-semibold tracking-wide text-ink-muted">
        {text.tip} · {local.level}
      </span>
      <span className="block px-3 font-serif text-lg leading-snug">{local.title}</span>
      {local.intro && <span className="line-clamp-2 block px-3 pb-2 text-sm text-ink-muted">{local.intro}</span>}
      <span className={LINK_ROW}>
        {text.openTip}
        <ChevronRight size={18} strokeWidth={1.75} aria-hidden />
      </span>
    </Link>
  )
}

export function AnswerCardView({ card }: { card: AnswerCard }) {
  if (card.type === 'word') return <WordCard id={card.id} />
  if (card.type === 'conj') return <ConjCard {...card} />
  return <TipCard id={card.id} />
}
