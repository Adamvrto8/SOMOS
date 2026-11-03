import { describe, expect, it } from 'vitest'
import { swipeDirection } from './swipe'

describe('swipeDirection', () => {
  it('needs 80 px', () => {
    expect(swipeDirection(80, 500)).toBe('right')
    expect(swipeDirection(-80, 500)).toBe('left')
    expect(swipeDirection(79, 500)).toBeNull()
  })
  it('takes a quick short fling', () => {
    expect(swipeDirection(45, 50)).toBe('right')
    expect(swipeDirection(-45, 50)).toBe('left')
    expect(swipeDirection(45, 300)).toBeNull()
    expect(swipeDirection(-30, 10)).toBeNull()
  })
  it('ignores a tap', () => {
    expect(swipeDirection(0, 80)).toBeNull()
  })
})
