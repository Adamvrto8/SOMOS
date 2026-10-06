import { useId } from 'react'

interface AzulejosProps {
  className?: string
}

const TILE = 48
const HALF = TILE / 2
/** Where four tiles meet, and the middle of each edge. */
const CORNERS = [
  [0, 0],
  [TILE, 0],
  [0, TILE],
  [TILE, TILE],
]
const EDGES = [
  [HALF, 0],
  [0, HALF],
  [TILE, HALF],
  [HALF, TILE],
]

/**
 * Glazed tiles of Puebla (azulejos de talavera) as a quiet pattern: a four-pointed flower in
 * each tile, a ring where four tiles meet. A "character moment" — use sparingly: home header,
 * lesson-complete card, empty archive. Fills its positioned parent; the colours are the style's.
 */
export function Azulejos({ className = '' }: AzulejosProps) {
  // useId output contains characters that break url(#…) references.
  const id = `azulejos-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <svg aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}>
      <defs>
        <pattern id={id} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
          {/* The joints between the tiles. */}
          <path d={`M0 0H${TILE}V${TILE}H0Z`} fill="none" strokeWidth="0.8" opacity="0.6" className="stroke-ink-muted" />
          {[45, 135, 225, 315].map((r) => (
            <path key={r} d="M0 -4C4 -8 4 -14 0 -19C-4 -14 -4 -8 0 -4Z" transform={`translate(${HALF} ${HALF}) rotate(${r})`} className="fill-brick" />
          ))}
          <circle cx={HALF} cy={HALF} r="3" className="fill-amber" />
          {CORNERS.map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <circle cx={x} cy={y} r="7" fill="none" strokeWidth="2" className="stroke-leaf" />
              <circle cx={x} cy={y} r="2.4" className="fill-brick" />
            </g>
          ))}
          {EDGES.map(([x, y]) => (
            <path key={`${x}-${y}`} d={`M${x} ${y - 4}L${x + 4} ${y}L${x} ${y + 4}L${x - 4} ${y}Z`} className="fill-amber" />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}
