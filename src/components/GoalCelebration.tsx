import { Flame } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { dismissCelebration, useCelebration, type Celebration } from '../lib/celebration'

/** How long the sun stays before it leaves by itself, and how long leaving takes (ms). */
const STAY = 2400
const FADE = 300

/** Twelve long rays, a short one between each two. */
const RAYS = Array.from({ length: 12 }, (_, i) => i * 30)

/**
 * The daily goal was just reached: a sun with the streak over whatever screen is open.
 * It leaves by itself; a tap sends it away at once. Lives beside the router, because the
 * lesson and the review are outside AppLayout.
 */
export function GoalCelebration() {
  const celebration = useCelebration()
  return celebration && <Sun key={celebration.at} celebration={celebration} />
}

function Sun({ celebration }: { celebration: Celebration }) {
  const text = useT().home
  const { goal, streakDays } = celebration
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setLeaving(true), STAY)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(dismissCelebration, FADE)
    return () => clearTimeout(timer)
  }, [leaving])

  return (
    // The whole screen is the button: while the sun is up, a tap closes it and does not reach the task below.
    // Only the children animate in; the button itself just fades out.
    <button
      type="button"
      onClick={() => setLeaving(true)}
      className={`fixed inset-0 z-50 flex cursor-default flex-col items-center justify-center px-6 text-center transition-opacity duration-300 ${leaving ? 'pointer-events-none opacity-0' : ''}`}
    >
      <span aria-hidden className="absolute inset-0 animate-fade-in bg-bg/92 backdrop-blur-[2px]" />

      <svg viewBox="-80 -80 160 160" aria-hidden className="relative size-44 animate-sun-rise">
        {/* fill-box: the ring of rays turns around its own middle, not around a corner of the drawing. */}
        <g className="origin-center animate-sun-turn fill-amber [transform-box:fill-box]">
          {RAYS.map((angle) => (
            <g key={angle} transform={`rotate(${angle})`}>
              <path d="M-7 -47L0 -76L7 -47Z" />
              <path d="M-4.5 -47L0 -61L4.5 -47Z" transform="rotate(15)" />
            </g>
          ))}
        </g>
        <circle r="43" className="fill-amber" />
        {/* Dark on the amber disc in both themes. */}
        <text
          y={streakDays > 99 ? 12 : 16}
          fontSize={streakDays > 99 ? 34 : 46}
          textAnchor="middle"
          className="animate-rise-in fill-ink font-serif font-semibold [animation-delay:200ms] dark:fill-bg"
        >
          {streakDays}
        </text>
        <g className="origin-center animate-badge-pop [animation-delay:550ms] [transform-box:fill-box]">
          <circle cx="33" cy="-33" r="15" strokeWidth="3.5" className="fill-surface stroke-bg" />
          <Flame x={24} y={-42} size={18} strokeWidth={2} className="fill-amber/30 text-amber" />
        </g>
      </svg>

      <span lang="es" className="relative mt-3 block animate-rise-in font-serif text-3xl font-semibold tracking-tight [animation-delay:300ms]">
        ¡Meta cumplida!
      </span>
      <span className="relative mt-1 block animate-rise-in text-ink-muted [animation-delay:400ms]">{text.goalReachedOf(goal)}</span>
      <span className="relative mt-1.5 block animate-rise-in text-sm font-semibold [animation-delay:500ms]">
        {streakDays} {text.streakDays(streakDays)}
      </span>
    </button>
  )
}
