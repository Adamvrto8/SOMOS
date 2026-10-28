import { ArrowRight, Info } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { SpeakButton } from '../../components/SpeakButton'
import type { Word } from '../../data/types'
import { useT } from '../../i18n'
import { articleFor } from '../../lib/grammar'
import { wordExamples, wordNote, wordTranslations } from '../../lib/localized'
import { slideClass, usePageTurn, type TurnDirection } from '../../lib/pageTurn'

/** One new word: the word with its article and 🔊, what it means, one example. Nothing to answer. */
function WordCard({ word }: { word: Word }) {
  const text = useT()
  const article = articleFor(word)
  const [primary, ...others] = wordTranslations(word)
  const [example] = wordExamples(word)
  const note = wordNote(word)
  return (
    <article className="rounded-card border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <h2
          lang="es"
          className={`min-w-0 font-serif leading-tight font-semibold tracking-tight hyphens-auto ${word.es.length > 9 && !word.es.includes(' ') ? 'text-4xl' : 'text-5xl'}`}
        >
          {article && <span className="text-3xl font-normal text-ink-muted">{article} </span>}
          {word.es}
        </h2>
        <SpeakButton text={article ? `${article} ${word.es}` : word.es} size="lg" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge>{text.word.pos[word.pos]}</Badge>
        {word.gender && <Badge>{text.word.gender[word.gender]}</Badge>}
      </div>
      <p className="mt-4 text-xl">
        {primary}
        {others.length > 0 && <span className="text-ink-muted">, {others.join(', ')}</span>}
      </p>
      {(word.plural || word.feminine) && (
        <p className="mt-1 text-sm text-ink-muted">
          {word.plural ? text.word.plural : text.word.feminine}{' '}
          <span lang="es" className="font-serif text-ink">
            {word.plural ?? word.feminine}
          </span>
        </p>
      )}
      {example && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">{text.path.meetExample}</p>
          <div className="mt-1 flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <p lang="es" className="font-serif text-lg leading-snug">
                {example.es}
              </p>
              <p className="text-sm text-ink-muted">{example.text}</p>
            </div>
            <SpeakButton text={example.es} />
          </div>
        </div>
      )}
      {note && (
        <p className="mt-4 flex gap-2 rounded-xl bg-surface-2 p-3 text-sm leading-relaxed">
          <Info size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-brick" aria-hidden />
          <span>{note}</span>
        </p>
      )}
    </article>
  )
}

/**
 * The new words of a step of the path, one card each, before its tasks ask them (docs/guided-path-spec.md §2).
 * A swipe or the arrow keys turn the cards too. Seen, not answered: nothing is recorded.
 */
export function MeetCards({ words, onDone }: { words: Word[]; onDone: () => void }) {
  const dictionary = useT()
  const text = dictionary.path
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState<TurnDirection>()
  const last = index === words.length - 1
  const turn = (to: TurnDirection) => {
    if (to === 'next' && last) return onDone()
    if (to === 'prev' && index === 0) return
    setDir(to)
    setIndex(index + (to === 'next' ? 1 : -1))
  }
  usePageTurn(turn)
  const word = words[index]

  return (
    <div className="touch-pan-y">
      <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">{text.meetLabel(index + 1, words.length)}</p>
      <div key={word.id} className={`mt-4 ${slideClass(dir)}`}>
        <WordCard word={word} />
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20">
        <div className="mx-auto flex max-w-[480px] gap-3 border-t border-line bg-bg/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          <Button variant="secondary" onClick={() => (index === 0 ? onDone() : turn('prev'))}>
            {index === 0 ? text.meetSkip : dictionary.common.back}
          </Button>
          <Button icon={last ? undefined : ArrowRight} onClick={() => turn('next')} className="flex-1" autoFocus>
            {last ? text.meetStart : text.meetNext}
          </Button>
        </div>
      </div>
    </div>
  )
}
