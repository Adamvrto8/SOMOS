import { Fragment, useState } from 'react'
import { useT } from '../../../i18n'
import type { Answer, FindMistakeTask } from '../../../lib/lesson'
import { sentenceTranslation } from '../../../lib/localized'
import { playSound } from '../../../lib/sound'
import { spaceBefore } from '../../../lib/text'
import { ChoiceOptions } from './ChoiceOptions'
import type { Status } from './status'

interface FindMistakeViewProps {
  task: FindMistakeTask
  onSubmit: (value?: Answer) => void
  status?: Status
}

const PUNCTUATION = /^[¿?¡!.,;:]$/
const MAX_MISSES = 2

/** Tap the wrong word (two wrong taps end the task), then pick what should stand there. */
export function FindMistakeView({ task, onSubmit, status }: FindMistakeViewProps) {
  const text = useT().lesson.task
  const [found, setFound] = useState(false)
  const [missed, setMissed] = useState<number[]>([])
  const [choice, setChoice] = useState('')
  const graded = status !== undefined
  const { tokens, index } = task.corrupted

  const tap = (i: number) => {
    if (graded || found || missed.includes(i)) return
    if (i === index) {
      playSound('tap')
      setFound(true)
      return
    }
    playSound('almost')
    const next = [...missed, i]
    setMissed(next)
    if (next.length >= MAX_MISSES) onSubmit([String(i), '']) // gave up: no fix
  }

  return (
    <div className="space-y-5">
      <p className="text-xl leading-snug font-medium">{sentenceTranslation(task.sentence)}</p>
      <p lang="es" className="font-serif text-2xl leading-loose">
        {tokens.map((token, i) => (
          <Fragment key={i}>
            {spaceBefore(tokens, i) && ' '}
            {PUNCTUATION.test(token) ? (
              token
            ) : (
              <button
                type="button"
                onClick={() => tap(i)}
                disabled={graded && i !== index}
                className={`min-h-11 rounded-lg px-1.5 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-brick ${
                  i === index && (found || graded) ? 'bg-error/15 font-semibold text-error underline' : missed.includes(i) ? 'text-ink-muted line-through' : 'hover:bg-surface-2'
                }`}
              >
                {token}
              </button>
            )}
          </Fragment>
        ))}
      </p>
      {!found && !graded && <p className="text-sm text-ink-muted">{missed.length > 0 ? text.fmMissed : text.fmTap}</p>}
      {found && (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">{text.fmFix}</p>
          <ChoiceOptions
            options={task.options}
            selected={choice}
            onSelect={(option) => {
              setChoice(option)
              onSubmit([String(index), option])
            }}
            correctAnswer={graded ? task.corrupted.right : undefined}
          />
        </div>
      )}
    </div>
  )
}
