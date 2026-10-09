import { useState } from 'react'
import { useT } from '../../../i18n'
import type { Grade, Tile } from '../../../lib/lesson'
import { playSound } from '../../../lib/sound'
import { RetryHint } from './RetryHint'
import type { Status } from './status'

const AREA: Record<Status | 'open', string> = {
  open: 'border-line',
  correct: 'border-leaf bg-leaf/10',
  warn: 'border-amber bg-amber/10',
  wrong: 'border-error bg-error/10',
}

const SHAPE =
  'h-11 rounded-xl border px-3.5 font-serif text-lg shadow-sm transition duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick'
const TILE = `${SHAPE} border-line bg-surface`
const MISPLACED = `${SHAPE} border-error bg-error/15 font-semibold text-error`

interface TileBuilderProps {
  tiles: Tile[]
  placed: string[] // tile ids in the chosen order
  onChange: (placed: string[]) => void
  status?: Status // set once graded; tiles are then locked
  hint?: Grade | null // a wrong try that may still be fixed
}

export function TileBuilder({ tiles, placed, onChange, status, hint }: TileBuilderProps) {
  const text = useT().lesson.task
  const locked = status !== undefined
  const byId = new Map(tiles.map((t) => [t.id, t]))
  // The order a hint is about, and its tiles that are out of place: each stays red until it is taken out.
  // Once the order changes, the hint belongs to the previous try and fades.
  const [checked, setChecked] = useState({ hint, order: placed.join(), red: hint?.misplaced ?? [] })
  if (checked.hint !== hint) setChecked({ hint, order: placed.join(), red: hint?.misplaced ?? [] })
  const stale = checked.hint === hint && checked.order !== placed.join()

  const change = (next: string[]) => {
    playSound('tap')
    onChange(next)
  }
  const remove = (id: string) => {
    setChecked({ ...checked, red: checked.red.filter((r) => r !== id) })
    change(placed.filter((p) => p !== id))
  }

  return (
    <div className="space-y-5">
      <div>
        <div
          aria-label={text.yourSentence}
          className={`flex min-h-28 flex-wrap content-start gap-2 rounded-card border-2 border-dashed p-3 ${AREA[status ?? 'open']}`}
        >
          {placed.length === 0 && <p className="self-center px-1 text-ink-muted">{text.tapWords}</p>}
          {placed.map((id) => (
            <button
              key={id}
              type="button"
              lang="es"
              disabled={locked}
              onClick={() => remove(id)}
              aria-label={text.removeTile(byId.get(id)?.text ?? '')}
              className={!locked && checked.red.includes(id) ? MISPLACED : TILE}
            >
              {byId.get(id)?.text}
            </button>
          ))}
        </div>
        {hint && !locked && <RetryHint grade={hint} stale={stale} />}
      </div>

      {/* Used tiles leave a placeholder so the others don't jump around. */}
      <div aria-label={text.words} className="flex flex-wrap justify-center gap-2">
        {tiles.map((tile) =>
          placed.includes(tile.id) ? (
            <span key={tile.id} aria-hidden className={`${TILE} border-dashed bg-transparent text-transparent shadow-none`}>
              {tile.text}
            </span>
          ) : (
            <button key={tile.id} type="button" lang="es" disabled={locked} onClick={() => change([...placed, tile.id])} className={TILE}>
              {tile.text}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
