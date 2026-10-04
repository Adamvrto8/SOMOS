import { Fragment } from 'react'
import { useT } from '../../../i18n'
import { spaceBefore } from '../../../lib/text'
import type { Status } from './status'

const BLANK: Record<Status | 'open', string> = {
  open: 'border-brick text-brick',
  correct: 'border-leaf text-leaf',
  warn: 'border-amber text-ink',
  wrong: 'border-error text-error line-through decoration-2',
}


interface SentenceWithBlankProps {
  tokens: string[]
  blankIndex: number
  filled: string // what the learner typed or chose so far
  status?: Status
}

export function SentenceWithBlank({ tokens, blankIndex, filled, status }: SentenceWithBlankProps) {
  const text = useT().lesson.task
  return (
    <p lang="es" className="font-serif text-2xl leading-relaxed">
      {tokens.map((token, i) => (
        <Fragment key={i}>
          {spaceBefore(tokens, i) && ' '}
          {i === blankIndex ? (
            <span
              className={`inline-block min-w-[4ch] border-b-2 px-1 text-center font-semibold ${BLANK[status ?? 'open']}`}
              aria-label={filled ? undefined : text.missingWord}
            >
              {filled.trim() || ' '}
            </span>
          ) : (
            token
          )}
        </Fragment>
      ))}
    </p>
  )
}
