import { getOnboarding, updateOnboarding, type OnboardingState } from './onboarding'
import { track } from './usage'

// The tour of the app on Domov (docs/superpowers/specs/2026-11-17-app-tour-design.md). The state is the `tour` field of
// the welcome's state: this device only, not synced, not in the backup.

/** Each stop: the `data-tour` attribute it highlights; its text is dictionary.tour.steps[id]. */
export const TOUR_STEPS = [
  { id: 'next', target: 'home-next' },
  { id: 'progress', target: 'home-progress' },
  { id: 'somo', target: 'somo' },
  { id: 'search', target: 'tab-search' },
  { id: 'path', target: 'tab-path' },
  { id: 'practice', target: 'tab-practice' },
  { id: 'profile', target: 'tab-profile' },
] as const

export type TourStep = (typeof TOUR_STEPS)[number]
export type TourStepId = TourStep['id']

/** The steps whose target is on screen now (SOMO's pill is there only for some accounts). */
export function visibleSteps(isPresent: (target: string) => boolean): TourStep[] {
  return TOUR_STEPS.filter((step) => isPresent(step.target))
}

export function shouldOfferTour(state: OnboardingState | null): boolean {
  return state?.done === true && state.tour === 'pending'
}

// Usage numbers go with the welcome's steps: the server's report already counts them (supabase/schema.sql).
export function acceptTour() {
  updateOnboarding({ tour: 'started' })
  track('welcome', { step: 'tour-start' })
}

export function declineTour() {
  updateOnboarding({ tour: 'declined' })
  track('welcome', { step: 'tour-declined' })
}

/** Hotovo on the last step. A replay from Profil changes nothing stored. */
export function finishTour() {
  if (getOnboarding()?.tour !== 'started') return
  updateOnboarding({ tour: 'finished' })
  track('welcome', { step: 'tour-done' })
}

/** Nástroje pre vývoj: the offer on Domov once more (done: true, so the welcome does not open instead). */
export function offerTourAgain() {
  updateOnboarding({ done: true, tour: 'pending' })
}

/** Space between the bubble and the target (the target's air + a gap), and the least between it and the screen edge. */
const BUBBLE_GAP = 18
const EDGE = 8

/**
 * The top of the text bubble: under the target when it fits there (or there is more room there), else above it. Always
 * kept on the screen, over the target if it must be: the buttons of the tour matter more than seeing all of the target.
 */
export function bubbleTop(target: { top: number; bottom: number } | null, bubbleHeight: number, viewportHeight: number): number {
  const lowest = Math.max(EDGE, viewportHeight - bubbleHeight - EDGE)
  if (!target) return Math.min(lowest, Math.max(EDGE, (viewportHeight - bubbleHeight) / 2))
  const below = viewportHeight - target.bottom - BUBBLE_GAP
  const above = target.top - BUBBLE_GAP
  const top = below >= bubbleHeight || below >= above ? target.bottom + BUBBLE_GAP : target.top - BUBBLE_GAP - bubbleHeight
  return Math.min(lowest, Math.max(EDGE, top))
}
