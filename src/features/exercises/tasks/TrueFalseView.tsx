import { Check, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '../../../components/Button'
import { useT } from '../../../i18n'
import type { Answer, TrueFalseTask } from '../../../lib/lesson'
import { sentenceTranslation } from '../../../lib/localized'
import { SWIPE_DISTANCE, swipeDirection } from '../../../lib/swipe'
import type { Status } from './status'

interface TrueFalseViewProps {
  task: TrueFalseTask
  onAnswer: (answer: Answer) => void
  onSubmit: (value?: Answer) => void
  status?: Status
}

const BORDER: Record<Status | 'open', string> = {
  open: 'border-line',
  correct: 'border-leaf bg-leaf/10',
  warn: 'border-amber bg-amber/10',
  wrong: 'border-error bg-error/10',
}

/** The sentence is a card: swipe it right for pravda, left for nepravda, or press a button. */
export function TrueFalseView({ task, onAnswer, onSubmit, status }: TrueFalseViewProps) {
  const text = useT().lesson.task
  const [dx, setDx] = useState(0)
  const start = useRef<{ x: number; at: number } | null>(null)
  const locked = status !== undefined

  const answer = (value: 'true' | 'false') => {
    onAnswer(value)
    onSubmit(value)
  }
  const stamp = Math.min(Math.abs(dx) / SWIPE_DISTANCE, 1)

  return (
    <div className="space-y-5">
      <p className="text-ink-muted">{text.tfQuestion}</p>
      <div
        role="group"
        aria-label={text.tfCard}
        className={`relative touch-pan-y rounded-card border-2 bg-surface p-5 select-none ${BORDER[status ?? 'open']}`}
        style={{ transform: `translateX(${dx}px) rotate(${dx / 25}deg)`, transition: dx === 0 ? 'transform 150ms' : undefined }}
        onPointerDown={(e) => {
          if (locked) return
          start.current = { x: e.clientX, at: e.timeStamp }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (start.current) setDx(e.clientX - start.current.x)
        }}
        onPointerUp={(e) => {
          const from = start.current
          start.current = null
          setDx(0)
          if (!from) return
          const direction = swipeDirection(e.clientX - from.x, e.timeStamp - from.at)
          if (direction) answer(direction === 'right' ? 'true' : 'false')
        }}
        onPointerCancel={() => {
          start.current = null
          setDx(0)
        }}
      >
        <span
          aria-hidden
          className="absolute top-3 left-3 rounded-lg border-2 border-leaf px-2 py-0.5 text-sm font-bold tracking-widest text-leaf uppercase"
          style={{ opacity: dx > 0 ? stamp : 0 }}
        >
          {text.tfTrue}
        </span>
        <span
          aria-hidden
          className="absolute top-3 right-3 rounded-lg border-2 border-error px-2 py-0.5 text-sm font-bold tracking-widest text-error uppercase"
          style={{ opacity: dx < 0 ? stamp : 0 }}
        >
          {text.tfFalse}
        </span>
        <p lang="es" className="pt-6 font-serif text-2xl leading-snug">
          {task.corrupted?.es ?? task.sentence.es}
        </p>
        <p className="mt-3 text-ink-muted">{sentenceTranslation(task.sentence)}</p>
      </div>
      {!locked && <p className="text-center text-sm text-ink-muted">{text.tfHint}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" icon={X} onClick={() => answer('false')} disabled={locked}>
          {text.tfFalse}
        </Button>
        <Button variant="secondary" icon={Check} onClick={() => answer('true')} disabled={locked}>
          {text.tfTrue}
        </Button>
      </div>
    </div>
  )
}
