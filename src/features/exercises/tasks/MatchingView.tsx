import { useState } from 'react'
import { useT } from '../../../i18n'
import { useLanguage } from '../../../lib/language'
import type { Answer, MatchingTask } from '../../../lib/lesson'
import { playSound } from '../../../lib/sound'
import type { Status } from './status'

interface MatchingViewProps {
  task: MatchingTask
  onAnswer: (answer: Answer) => void
  onSubmit: (value?: Answer) => void
  status?: Status
}

type Side = 'es' | 'sk'

const CHIP =
  'min-h-14 w-full rounded-2xl border-2 px-3 py-2 text-lg leading-tight transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick'

/** Tap a Spanish word and its translation; a right pair locks green, a wrong one flashes red. */
export function MatchingView({ task, onAnswer, onSubmit, status }: MatchingViewProps) {
  const text = useT().lesson.task
  const language = useLanguage()
  const [done, setDone] = useState<number[]>([]) // pairs paired right (indices into task.pairs)
  const [pick, setPick] = useState<{ side: Side; pair: number } | null>(null)
  const [flash, setFlash] = useState<{ es: number; sk: number } | null>(null)
  const [wrong, setWrong] = useState<string[]>([]) // the word of every wrong pairing
  const graded = status !== undefined

  const choose = (side: Side, pair: number) => {
    if (graded || flash || done.includes(pair)) return
    if (!pick || pick.side === side) {
      playSound('tap')
      setPick({ side, pair })
      return
    }
    const es = side === 'es' ? pair : pick.pair
    const sk = side === 'sk' ? pair : pick.pair
    setPick(null)
    if (es === sk) {
      playSound('tap')
      const next = [...done, es]
      setDone(next)
      if (next.length === task.pairs.length) {
        const value = `m:${wrong.join(',')}`
        onAnswer(value)
        onSubmit(value)
      }
      return
    }
    playSound('almost')
    setWrong([...wrong, task.pairs[es].word.id])
    setFlash({ es, sk })
    window.setTimeout(() => setFlash(null), 500)
  }

  const style = (side: Side, pair: number) => {
    if (done.includes(pair)) return 'border-leaf bg-leaf/15 opacity-70'
    if (flash && flash[side] === pair) return 'border-error bg-error/10'
    if (pick?.side === side && pick.pair === pair) return 'border-brick bg-brick/10 ring-1 ring-brick'
    return 'border-line bg-surface hover:border-ink-muted'
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">{text.matchHint}</p>
      <div className="grid grid-cols-2 gap-3">
        <div role="group" aria-label={text.matchEs} className="space-y-3">
          {task.pairs.map((p, i) => (
            <button key={p.word.id} type="button" lang="es" disabled={graded || done.includes(i)} onClick={() => choose('es', i)} className={`${CHIP} font-serif ${style('es', i)}`}>
              {p.es}
            </button>
          ))}
        </div>
        <div role="group" aria-label={text.matchSk} className="space-y-3">
          {task.rightOrder.map((i) => (
            <button key={task.pairs[i].word.id} type="button" lang={language} disabled={graded || done.includes(i)} onClick={() => choose('sk', i)} className={`${CHIP} ${style('sk', i)}`}>
              {task.pairs[i].sk}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
