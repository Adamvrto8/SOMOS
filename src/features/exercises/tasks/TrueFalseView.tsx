import { useEffect, useRef, useState } from 'react'
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
  /** A lesson of only these cards: the card flies off and the next one comes, the verdicts wait for the end. */
  flow?: boolean
}

const BORDER: Record<Status | 'open', string> = {
  open: 'border-line',
  correct: 'border-leaf bg-leaf/10',
  warn: 'border-amber bg-amber/10',
  wrong: 'border-error bg-error/10',
}

/** How long the card takes to fly off the screen (ms). */
const FLY = 200

/** The sentence fills the screen as a card: swipe it right for pravda, left for nepravda (← → on a keyboard). */
export function TrueFalseView({ task, onAnswer, onSubmit, status, flow = false }: TrueFalseViewProps) {
  const text = useT().lesson.task
  const [dx, setDx] = useState(0)
  const [leaving, setLeaving] = useState<'left' | 'right' | null>(null)
  const start = useRef<{ x: number; at: number } | null>(null)
  const locked = status !== undefined || leaving !== null

  const decide = (direction: 'left' | 'right') => {
    const value = direction === 'right' ? 'true' : 'false'
    if (!flow) {
      onAnswer(value)
      onSubmit(value)
      return
    }
    setLeaving(direction)
    window.setTimeout(() => {
      onAnswer(value)
      onSubmit(value)
    }, FLY)
  }

  useEffect(() => {
    if (locked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') decide('right')
      else if (e.key === 'ArrowLeft') decide('left')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const stamp = Math.min(Math.abs(dx) / SWIPE_DISTANCE, 1)
  const transform = leaving
    ? `translateX(${leaving === 'right' ? '' : '-'}120vw) rotate(${leaving === 'right' ? '' : '-'}20deg)`
    : `translateX(${dx}px) rotate(${dx / 25}deg)`

  return (
    <div className="flex min-h-[calc(100dvh-10.5rem)] flex-col gap-4">
      <p className="text-ink-muted">{text.tfQuestion}</p>
      <div
        role="group"
        aria-label={text.tfCard}
        className={`relative flex flex-1 touch-pan-y flex-col justify-center rounded-card border-2 bg-surface p-6 select-none ${BORDER[status ?? 'open']}`}
        style={{ transform, transition: leaving ? `transform ${FLY}ms ease-in` : dx === 0 ? 'transform 150ms' : undefined }}
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
          if (direction) decide(direction)
        }}
        onPointerCancel={() => {
          start.current = null
          setDx(0)
        }}
      >
        {/* Each stamp trails the card on the side that stays on the screen. */}
        <span
          aria-hidden
          className="absolute top-4 left-4 rounded-lg border-2 border-leaf px-2 py-0.5 text-sm font-bold tracking-widest text-leaf uppercase"
          style={{ opacity: leaving === 'right' ? 1 : dx > 0 ? stamp : 0 }}
        >
          {text.tfTrue}
        </span>
        <span
          aria-hidden
          className="absolute top-4 right-4 rounded-lg border-2 border-error px-2 py-0.5 text-sm font-bold tracking-widest text-error uppercase"
          style={{ opacity: leaving === 'left' ? 1 : dx < 0 ? stamp : 0 }}
        >
          {text.tfFalse}
        </span>
        <p lang="es" className="font-serif text-3xl leading-snug">
          {task.corrupted?.es ?? task.sentence.es}
        </p>
        <p className="mt-4 text-lg text-ink-muted">{sentenceTranslation(task.sentence)}</p>
      </div>
      {status === undefined && <p className="pb-2 text-center text-sm text-ink-muted">{text.tfHint}</p>}
    </div>
  )
}
