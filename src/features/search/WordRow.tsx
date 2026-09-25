import { ChevronRight, Star } from 'lucide-react'
import { Link } from 'react-router'
import type { Word } from '../../data/types'
import { articleFor } from '../../lib/grammar'
import type { WordNavState } from '../word/wordNav'

interface WordRowProps {
  word: Word
  matchedForm?: string
  saved?: boolean
  /** Ids of the list this row is in: the detail can then swipe to neighbours. */
  list?: string[]
}

export function WordRow({ word, matchedForm, saved, list }: WordRowProps) {
  const article = articleFor(word)

  return (
    <li>
      <Link
        to={`/word/${word.id}`}
        state={list ? ({ wordList: list } satisfies WordNavState) : undefined}
        className="flex min-h-16 items-center gap-3 py-2.5 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick active:bg-surface-2"
      >
        <div className="min-w-0 flex-1">
          <p lang="es" className="truncate font-serif text-lg font-semibold">
            {article && <span className="font-normal text-ink-muted">{article} </span>}
            {word.es}
          </p>
          <p className="truncate text-sm text-ink-muted">
            {matchedForm && (
              <span className="text-ink">
                tvar <span lang="es">„{matchedForm}“</span> ·{' '}
              </span>
            )}
            {word.sk.join(', ')}
          </p>
        </div>
        {saved && (
          <Star size={16} strokeWidth={1.75} className="shrink-0 fill-amber text-amber" aria-label="Uložené" role="img" />
        )}
        <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
      </Link>
    </li>
  )
}
