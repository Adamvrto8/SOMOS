import type { Tile } from '../../../lib/lesson'
import type { Status } from './status'

const AREA: Record<Status | 'open', string> = {
  open: 'border-line',
  correct: 'border-leaf bg-leaf/10',
  warn: 'border-amber bg-amber/10',
  wrong: 'border-error bg-error/10',
}

const TILE =
  'h-11 rounded-xl border border-line bg-surface px-3.5 font-serif text-lg shadow-sm transition duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick'

interface TileBuilderProps {
  tiles: Tile[]
  placed: string[] // tile ids in the chosen order
  onChange: (placed: string[]) => void
  status?: Status // set once graded; tiles are then locked
}

export function TileBuilder({ tiles, placed, onChange, status }: TileBuilderProps) {
  const locked = status !== undefined
  const byId = new Map(tiles.map((t) => [t.id, t]))

  return (
    <div className="space-y-5">
      <div
        aria-label="Tvoja veta"
        className={`flex min-h-28 flex-wrap content-start gap-2 rounded-card border-2 border-dashed p-3 ${AREA[status ?? 'open']}`}
      >
        {placed.length === 0 && <p className="self-center px-1 text-ink-muted">Ťukaj na slová nižšie…</p>}
        {placed.map((id) => (
          <button
            key={id}
            type="button"
            lang="es"
            disabled={locked}
            onClick={() => onChange(placed.filter((p) => p !== id))}
            aria-label={`${byId.get(id)?.text}, odobrať`}
            className={TILE}
          >
            {byId.get(id)?.text}
          </button>
        ))}
      </div>

      {/* Used tiles leave a placeholder so the others don't jump around. */}
      <div aria-label="Slová" className="flex flex-wrap justify-center gap-2">
        {tiles.map((tile) =>
          placed.includes(tile.id) ? (
            <span key={tile.id} aria-hidden className={`${TILE} border-dashed bg-transparent text-transparent shadow-none`}>
              {tile.text}
            </span>
          ) : (
            <button key={tile.id} type="button" lang="es" disabled={locked} onClick={() => onChange([...placed, tile.id])} className={TILE}>
              {tile.text}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
