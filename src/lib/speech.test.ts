import { describe, expect, it } from 'vitest'
import { speechErrorCode } from './speech'

describe('speechErrorCode', () => {
  it.each([
    ['not-allowed', 'denied'],
    ['service-not-allowed', 'denied'],
    ['network', 'offline'],
    ['no-speech', 'no-speech'],
    ['audio-capture', 'no-speech'],
    ['aborted', 'aborted'],
    ['language-not-supported', 'failed'],
    ['something-new', 'failed'],
  ])('%s → %s', (error, code) => {
    expect(speechErrorCode(error)).toBe(code)
  })
})
