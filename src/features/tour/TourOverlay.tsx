import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import { bubbleSide, visibleSteps, type TourStep } from '../../lib/tour'

/** Air around the highlighted target, and the gap to the text bubble, in px. */
const PAD = 6
const GAP = 12
/** The dark layer: the same in both themes, dark enough that the highlight stands out on the dark one too. */
const SHADE = 'rgb(0 0 0 / 0.72)'

const find = (target: string) => document.querySelector<HTMLElement>(`[data-tour="${target}"]`)

/** The target with whatever sticks out of it, like the raised Cesta button above its tab. */
function outline(el: HTMLElement): DOMRect {
  const boxes = [el, ...el.querySelectorAll('*')].map((node) => node.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0)
  const left = Math.min(...boxes.map((r) => r.left))
  const top = Math.min(...boxes.map((r) => r.top))
  return new DOMRect(left, top, Math.max(...boxes.map((r) => r.right)) - left, Math.max(...boxes.map((r) => r.bottom)) - top)
}
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

interface TourOverlayProps {
  /** Preskočiť, Escape: the tour ends where it is. */
  onClose: () => void
  /** Hotovo on the last step. */
  onFinish: () => void
}

/**
 * The screen darkened around one highlighted part of Domov, with a short text, step after step. Rendered on <body>,
 * with the app (#root) inert meanwhile: nothing behind it can be tapped, focused or read by a screen reader.
 */
export function TourOverlay({ onClose, onFinish }: TourOverlayProps) {
  const text = useT().tour
  // Fixed when the tour starts: a step whose target is not on screen is left out. Looked up after the first commit,
  // as the overlay can mount together with a target (Domov's tiles appear with its numbers).
  const [steps, setSteps] = useState<TourStep[] | null>(null)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const step = steps?.[index]
  const last = steps !== null && index === steps.length - 1

  useEffect(() => {
    const frame = requestAnimationFrame(() => setSteps(visibleSteps((target) => find(target) !== null)))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (steps?.length === 0) onClose() // nothing to show
  }, [steps, onClose])

  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    root.inert = true
    return () => {
      root.inert = false
    }
  }, [])

  // The target into view, then followed while the page scrolls there or the screen turns.
  useLayoutEffect(() => {
    if (!step) return
    const el = find(step.target)
    let frame = 0
    // Each frame at most once; null (the screen just darkened) when the target has gone meanwhile.
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setRect(el?.isConnected ? outline(el) : null))
    }
    el?.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
    measure()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [step])

  // Focus on the main button of each step, so Enter goes on and a screen reader reads the new text.
  useEffect(() => {
    bubble.current?.querySelector<HTMLButtonElement>('[data-primary]')?.focus({ preventScroll: true })
  }, [index, steps])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!steps || !step) return null
  const content = text.steps[step.id]
  const side = rect ? bubbleSide(rect, window.innerHeight) : 'below'
  const place =
    side === 'below'
      ? { top: (rect ? rect.bottom : 96) + PAD + GAP }
      : { bottom: window.innerHeight - (rect ? rect.top : window.innerHeight) + PAD + GAP }

  return createPortal(
    // touch-none: a finger on the dark part does not scroll the page behind.
    <div className="fixed inset-0 z-40 touch-none">
      {rect ? (
        // The cut-out: a box over the target whose huge shadow is the dark layer.
        <div
          aria-hidden
          data-tour-spotlight
          // The brick outline: on the dark theme the page is dark already, the shade alone would hardly show the target.
          className="pointer-events-none fixed rounded-2xl outline-2 outline-brick motion-safe:transition-all motion-safe:duration-300"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + 2 * PAD,
            height: rect.height + 2 * PAD,
            boxShadow: `0 0 0 9999px ${SHADE}`,
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0" style={{ background: SHADE }} />
      )}
      <div className="fixed inset-x-0 px-4" style={place}>
        <div
          ref={bubble}
          key={step.id}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
          aria-describedby="tour-body"
          className="mx-auto max-w-[448px] rounded-card border border-line bg-surface p-5 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.45)] motion-safe:animate-fade-in"
        >
          <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">{text.progress(index + 1, steps.length)}</p>
          <h2 id="tour-title" className="mt-1 font-serif text-2xl font-semibold tracking-tight">
            {content.title}
          </h2>
          <p id="tour-body" className="mt-2 text-ink-muted">
            {content.body}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="-ml-2 h-11 rounded-full px-3 text-sm font-semibold text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-brick"
            >
              {text.skip}
            </button>
            <span className="flex-1" />
            {index > 0 && (
              <Button variant="secondary" onClick={() => setIndex(index - 1)}>
                {text.back}
              </Button>
            )}
            <Button data-primary onClick={() => (last ? onFinish() : setIndex(index + 1))}>
              {last ? text.done : text.next}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
