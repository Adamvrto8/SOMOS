import { describe, expect, it } from 'vitest'
import { isKeyboardOpen } from './keyboard'

describe('isKeyboardOpen', () => {
  it('sees a keyboard when the page lost a good part of its height while typing', () => {
    expect(isKeyboardOpen(533, 881, true)).toBe(true)
    expect(isKeyboardOpen(881, 881, true)).toBe(false)
  })

  it('does not take a browser toolbar sliding in for a keyboard', () => {
    expect(isKeyboardOpen(825, 881, true)).toBe(false)
  })

  it('needs a field being typed into: a short window alone is not a keyboard', () => {
    expect(isKeyboardOpen(533, 881, false)).toBe(false)
  })
})
