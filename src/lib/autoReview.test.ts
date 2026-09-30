import { describe, expect, it } from 'vitest'
import { DEFAULT_AUTO_REVIEW, parseAutoReview } from './autoReview'

describe('parseAutoReview', () => {
  it('defaults to on with 20 words a day', () => {
    expect(parseAutoReview(null)).toEqual({ enabled: true, limit: 20 })
    expect(DEFAULT_AUTO_REVIEW).toEqual({ enabled: true, limit: 20 })
  })

  it('reads stored settings', () => {
    expect(parseAutoReview('{"enabled":false,"limit":50}')).toEqual({ enabled: false, limit: 50 })
  })

  it.each(['not json', '{"enabled":true,"limit":25}', '{"enabled":"yes","limit":20}', '[]', '42'])('falls back to the default for %s', (raw) => {
    expect(parseAutoReview(raw)).toEqual(DEFAULT_AUTO_REVIEW)
  })
})
