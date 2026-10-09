import { useState } from 'react'
import { useT } from '../../../i18n'
import type { Grade } from '../../../lib/lesson'
import { RetryHint } from './RetryHint'

interface ChoiceOptionsProps {
  options: string[]
  selected: string
  onSelect: (option: string) => void
  correctAnswer?: string // set once graded
  hint?: Grade | null // a wrong try: its option is out, another one may be picked
}

export function ChoiceOptions({ options, selected, onSelect, correctAnswer, hint }: ChoiceOptionsProps) {
  const text = useT().lesson.task
  const graded = correctAnswer !== undefined
  // The options already tried and wrong: every hint adds the one it is about.
  const [tried, setTried] = useState<{ hint?: Grade | null; options: string[] }>({ options: [] })
  if (hint && tried.hint !== hint) setTried({ hint, options: [...tried.options, ...(hint.diff ?? []).map((part) => part.text)] })

  return (
    <div>
      <div role="radiogroup" aria-label={text.options} className="grid grid-cols-2 gap-3">
        {options.map((option) => {
          const isSelected = option === selected
          const isOut = tried.options.includes(option)
          const style = graded
            ? option === correctAnswer
              ? 'border-leaf bg-leaf/15'
              : isSelected || isOut
                ? 'border-error bg-error/10'
                : 'border-line bg-surface opacity-60'
            : isOut
              ? 'border-error bg-error/10 text-error line-through'
              : isSelected
                ? 'border-brick bg-brick/10 ring-1 ring-brick'
                : 'border-line bg-surface hover:border-ink-muted'
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={graded || isOut}
              onClick={() => onSelect(option)}
              lang="es"
              className={`h-14 rounded-2xl border-2 px-3 font-serif text-xl transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick ${style}`}
            >
              {option}
            </button>
          )
        })}
      </div>
      {/* Picking another option makes the hint one about the previous try. */}
      {hint && !graded && <RetryHint grade={hint} stale={selected !== ''} />}
    </div>
  )
}
