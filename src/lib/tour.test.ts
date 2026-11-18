import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { finishOnboarding, forgetOnboardingForTesting, getOnboarding, parseOnboardingForTesting } from './onboarding'
import { acceptTour, bubbleTop, declineTour, finishTour, offerTourAgain, shouldOfferTour, TOUR_STEPS, visibleSteps } from './tour'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    key: () => null,
    length: 0,
  },
  writable: true,
})

beforeEach(() => forgetOnboardingForTesting())

describe('the tour offer', () => {
  it('is offered once the welcome finished with the tour pending', () => {
    finishOnboarding({ tour: 'pending' })
    expect(shouldOfferTour(getOnboarding())).toBe(true)
  })

  it('is not offered to devices welcomed before the tour existed, restored ones or new ones', () => {
    expect(shouldOfferTour(null)).toBe(false)
    expect(shouldOfferTour({ done: true })).toBe(false) // old welcome, "Už mám účet", Playwright default
    expect(shouldOfferTour({ done: false, tour: 'pending' })).toBe(false) // still in the welcome
  })

  it('goes away for good once accepted, declined or finished', () => {
    finishOnboarding({ tour: 'pending' })
    acceptTour()
    expect(getOnboarding()?.tour).toBe('started')
    expect(shouldOfferTour(getOnboarding())).toBe(false)
    finishTour()
    expect(getOnboarding()?.tour).toBe('finished')

    finishOnboarding({ tour: 'pending' })
    declineTour()
    expect(getOnboarding()?.tour).toBe('declined')
    expect(shouldOfferTour(getOnboarding())).toBe(false)
  })

  it('a replay from Profil does not change what was stored', () => {
    finishOnboarding({ tour: 'pending' })
    declineTour()
    finishTour()
    expect(getOnboarding()?.tour).toBe('declined')
  })

  it('Nástroje pre vývoj offer it again, also on a device that never stored the welcome', () => {
    offerTourAgain()
    expect(getOnboarding()).toMatchObject({ done: true, tour: 'pending' })
    expect(shouldOfferTour(getOnboarding())).toBe(true)
  })

  it('keeps the tour status across a reload and drops values it does not know', () => {
    expect(parseOnboardingForTesting('{"done":true,"tour":"started"}')?.tour).toBe('started')
    expect(parseOnboardingForTesting('{"done":true,"tour":"maybe"}')?.tour).toBeUndefined()
  })
})

describe('the tour steps', () => {
  it('go Domov first (next, progress, goal), then SOMO, then the tabs left to right', () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual(['next', 'progress', 'goal', 'somo', 'search', 'path', 'practice', 'profile'])
  })

  it('leave out a target that is not on screen (SOMO without its pill)', () => {
    const steps = visibleSteps((target) => target !== 'somo')
    expect(steps.map((s) => s.id)).toEqual(['next', 'progress', 'goal', 'search', 'path', 'practice', 'profile'])
  })
})

describe('where the text bubble goes', () => {
  it('goes under a target when it fits there', () => {
    expect(bubbleTop({ top: 100, bottom: 280 }, 230, 800)).toBe(298)
  })

  it('goes above a target at the bottom (the tab bar)', () => {
    expect(bubbleTop({ top: 736, bottom: 800 }, 230, 800)).toBe(736 - 18 - 230)
  })

  it('stays on a short screen with its buttons, over the target if it must', () => {
    // 375×560: the tiles centred, room on neither side for a 230px bubble.
    const top = bubbleTop({ top: 215, bottom: 345 }, 230, 560)
    expect(top).toBeGreaterThanOrEqual(8)
    expect(top + 230).toBeLessThanOrEqual(560 - 8)
  })

  it('never starts above the screen in landscape', () => {
    expect(bubbleTop({ top: 180, bottom: 360 }, 230, 380)).toBe(8)
  })

  it('sits in the middle without a target', () => {
    expect(bubbleTop(null, 200, 800)).toBe(300)
  })
})
