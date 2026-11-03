// When a drag of a card counts as an answer: far enough, or a short quick fling.

export const SWIPE_DISTANCE = 80
const FLING_DISTANCE = 40
const FLING_SPEED = 0.6 // px per ms

export function swipeDirection(dx: number, ms: number): 'left' | 'right' | null {
  const far = Math.abs(dx) >= SWIPE_DISTANCE
  const fling = Math.abs(dx) >= FLING_DISTANCE && Math.abs(dx) / Math.max(ms, 1) >= FLING_SPEED
  if (!far && !fling) return null
  return dx > 0 ? 'right' : 'left'
}
