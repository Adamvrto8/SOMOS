import { Flame, Snowflake } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { dismissCelebration, useCelebration, type Celebration } from '../lib/celebration'

/**
 * How long the sun stays before it leaves by itself (ms). `null` while Adam is tuning its look
 * (since 2026-10-08): it stays until it is tapped. Back to 2400 when he is done.
 */
const STAY: number | null = null
/**
 * How long the sun cannot be sent away (ms): until all its pieces have come up, plus a moment to see them.
 * The answer that earns it is often followed by a tap on "Pokračovať" at once, which would close it unseen.
 */
const HOLD = 1000
/** How long leaving takes (ms). */
const FADE = 300

/** Twelve long rays, a short one between each two. */
const RAYS = Array.from({ length: 12 }, (_, i) => i * 30)

/**
 * The daily goal was just reached: a sun with the streak over whatever screen is open.
 * It leaves by itself (see STAY); a touch sends it away at once, after its first moment (HOLD). Lives beside the router, because the
 * lesson and the review are outside AppLayout.
 */
export function GoalCelebration() {
  const celebration = useCelebration()
  return celebration && <Sun key={celebration.at} celebration={celebration} />
}

function Sun({ celebration }: { celebration: Celebration }) {
  const text = useT().home
  const { goal, streakDays, freezeEarned } = celebration
  const [leaving, setLeaving] = useState(false)
  const [held, setHeld] = useState(true)
  const leave = () => {
    if (!held) setLeaving(true)
  }
  const size = streakDays > 99 ? 34 : 46
  const number = useRef<SVGTextElement>(null)
  const ruler = useRef<HTMLCanvasElement>(null)
  // The baseline that puts the digits themselves in the middle of the disc. It is measured, not assumed:
  // every style draws them in its own typeface, and old-style figures (Young Serif, Alegreya) hang below the line.
  const [baseline, setBaseline] = useState(size * 0.35)

  useLayoutEffect(() => {
    const el = number.current
    const pen = ruler.current?.getContext('2d')
    if (!el || !pen) return
    let active = true
    const measure = () => {
      if (!active) return
      const { fontWeight, fontFamily, fontFeatureSettings } = getComputedStyle(el)
      // The ruler has to draw the figures the number is drawn with: Agave asks for lining ones (tokens.css),
      // which stand on the line. A canvas has no setting for that; it takes it from its own style,
      // and only while it is part of the page.
      pen.canvas.style.fontFeatureSettings = fontFeatureSettings
      pen.font = `${fontWeight} ${size}px ${fontFamily}`
      const ink = pen.measureText(String(streakDays))
      setBaseline((ink.actualBoundingBoxAscent - ink.actualBoundingBoxDescent) / 2)
    }
    measure()
    // Again once the typeface is there: until then the fallback's digits were measured.
    void document.fonts.ready.then(measure)
    return () => {
      active = false
    }
  }, [size, streakDays])

  useEffect(() => {
    const timer = setTimeout(() => setHeld(false), HOLD)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (STAY === null) return
    const timer = setTimeout(() => setLeaving(true), STAY)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(dismissCelebration, FADE)
    return () => clearTimeout(timer)
  }, [leaving])

  return (
    // The whole screen is the button: while the sun is up, a touch closes it and does not reach the task below.
    // The touch itself, not the tap it may become: a swipe closes it too, and (touch-none) does not scroll
    // the screen under it. Fading out, it still takes the tap, which would land on the task otherwise;
    // so it does while it is held, when a touch does nothing at all.
    // Only the children animate in; the button itself just fades out.
    <button
      type="button"
      aria-disabled={held}
      onPointerDown={leave}
      onClick={leave}
      className={`fixed inset-0 z-50 flex cursor-default touch-none flex-col items-center justify-center px-6 text-center transition-opacity duration-300 ${leaving ? 'opacity-0' : ''}`}
    >
      <canvas ref={ruler} aria-hidden className="hidden" />
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
          ref={number}
          y={baseline}
          fontSize={size}
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
      {freezeEarned && (
        <span className="relative mt-1 flex animate-rise-in items-center justify-center gap-1.5 text-sm text-ink-muted [animation-delay:600ms]">
          <Snowflake size={16} strokeWidth={1.75} className="text-brick" aria-hidden />
          {text.freezeEarned}
        </span>
      )}
    </button>
  )
}
