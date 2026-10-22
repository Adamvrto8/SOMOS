import { Crown } from 'lucide-react'
import { useId } from 'react'
import { useT } from '../../i18n'
import { MAX_POINTS } from '../../lib/duel/match'

interface SunPlayer {
  name: string
  points: number
  leads: boolean
  /** Has answered the task on screen now (shown, not whether it was right). */
  answered?: boolean
  offline?: boolean
}

const RAYS = 12

/** One sun: fills from below with its points, rays and a crown while ahead. */
function Sun({ player, tone, max }: { player: SunPlayer; tone: 'amber' | 'brick'; max: number }) {
  const text = useT().duel
  const id = useId()
  const color = tone === 'amber' ? 'var(--amber)' : 'var(--brick)'
  const share = Math.min(1, player.points / max)
  const level = 80 - 60 * share // the surface of the "liquid" inside the circle (y from 20 to 80)

  return (
    <figure className={`flex w-32 flex-col items-center transition-transform duration-500 ${player.leads ? 'scale-105' : 'scale-95'}`}>
      <div className="relative pt-5">
        {player.leads && <Crown size={22} strokeWidth={2} className="absolute top-0 left-1/2 -translate-x-1/2 fill-amber/40 text-amber" aria-hidden />}
        {player.answered && <span aria-hidden className="absolute inset-x-3 top-8 bottom-3 animate-ping rounded-full opacity-40" style={{ backgroundColor: color }} />}
        <svg viewBox="0 0 100 100" className={`size-24 ${player.offline ? 'opacity-40' : ''}`} aria-hidden>
          <defs>
            <clipPath id={`${id}-disc`}>
              <circle cx="50" cy="50" r="30" />
            </clipPath>
          </defs>
          {Array.from({ length: RAYS }, (_, i) => {
            const angle = (i / RAYS) * Math.PI * 2
            const [x1, y1, x2, y2] = [50 + Math.cos(angle) * 37, 50 + Math.sin(angle) * 37, 50 + Math.cos(angle) * 46, 50 + Math.sin(angle) * 46]
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={color}
                strokeWidth="4"
                strokeLinecap="round"
                className="transition-opacity duration-500"
                opacity={player.leads ? 1 : 0.25}
              />
            )
          })}
          <circle cx="50" cy="50" r="30" fill="var(--surface-2)" stroke={color} strokeWidth="3" />
          <rect
            x="20"
            y={level}
            width="60"
            height={80 - level + 1}
            fill={color}
            opacity="0.85"
            clipPath={`url(#${id}-disc)`}
            className="transition-all duration-700 ease-out"
          />
          <text x="50" y="57" textAnchor="middle" className="fill-ink font-serif text-[22px] font-semibold tabular-nums">
            {player.points}
          </text>
        </svg>
      </div>
      <figcaption className="mt-1 max-w-full truncate text-center text-sm font-medium">{player.name}</figcaption>
      <span className="text-xs text-ink-muted">{player.offline ? text.notConnected : player.leads ? text.leads : ' '}</span>
    </figure>
  )
}

/** The two suns side by side: you on the left, your opponent on the right. */
export function DuelSuns({ me, opponent, max = MAX_POINTS * 15 }: { me: SunPlayer; opponent: SunPlayer; max?: number }) {
  const text = useT().duel
  return (
    <div
      className="flex items-start justify-center gap-4"
      role="group"
      aria-label={`${me.name} ${text.points(me.points)}, ${opponent.name} ${text.points(opponent.points)}`}
    >
      <Sun player={me} tone="amber" max={max} />
      <span className="mt-14 font-serif text-lg text-ink-muted" aria-hidden>
        vs
      </span>
      <Sun player={opponent} tone="brick" max={max} />
    </div>
  )
}
