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

const GAP = 'h-11 w-14 rounded-xl border-2 border-dashed'

interface TileBuilderProps {
  tiles: Tile[]
  placed: string[] // tile ids slot by slot, '' = a slot left open
  onChange: (placed: string[]) => void
  status?: Status // set once graded; tiles are then locked
  hint?: Grade | null // a wrong try that may still be fixed
}

export function TileBuilder({ tiles, placed, onChange, status, hint }: TileBuilderProps) {
  const text = useT().lesson.task
  const locked = status !== undefined
  const byId = new Map(tiles.map((t) => [t.id, t]))
  // The order a hint is about, and its tiles in a wrong slot: each stays red until it is taken out.
  // Once the order changes, the hint belongs to the previous try and fades.
  const [checked, setChecked] = useState({ hint, order: placed.join(), red: hint?.misplaced ?? [] })
  if (checked.hint !== hint) setChecked({ hint, order: placed.join(), red: hint?.misplaced ?? [] })
  const stale = checked.hint === hint && checked.order !== placed.join()
  const open = placed.indexOf('') // the slot the next word goes to; -1 = the end of the sentence

  const change = (next: string[]) => {
    playSound('tap')
    onChange(next)
  }
  const add = (id: string) => change(open === -1 ? [...placed, id] : placed.map((p, i) => (i === open ? id : p)))
  // A word taken out leaves its slot open, so the words around it stay where they are
  // and another one can take its place. Open slots at the end are just the end of the sentence.
  const remove = (id: string) => {
    setChecked({ ...checked, red: checked.red.filter((r) => r !== id) })
    const next = placed.map((p) => (p === id ? '' : p))
    while (next.length > 0 && next.at(-1) === '') next.pop()
    change(next)
  }

  return (
    <div className="space-y-5">
      <div>
        <div
          aria-label={text.yourSentence}
          className={`flex min-h-28 flex-wrap content-start gap-2 rounded-card border-2 border-dashed p-3 ${AREA[status ?? 'open']}`}
        >
          {placed.length === 0 && <p className="self-center px-1 text-ink-muted">{text.tapWords}</p>}
          {placed.map((id, i) =>
            id === '' ? (
              <span key={`gap-${i}`} role="img" aria-label={text.gapMissing} className={`${GAP} ${i === open && !locked ? 'border-brick' : 'border-line'}`} />
            ) : (
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
            ),
          )}
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
            <button key={tile.id} type="button" lang="es" disabled={locked} onClick={() => add(tile.id)} className={TILE}>
              {tile.text}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
