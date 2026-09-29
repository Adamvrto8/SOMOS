import { describe, expect, it } from 'vitest'
import { base64UrlToBytes, parseSettings, VAPID_PUBLIC_KEY } from './reminder'

describe('parseSettings', () => {
  it('reads stored settings', () => {
    expect(parseSettings('{"enabled":true,"time":"07:30"}')).toEqual({ enabled: true, time: '07:30' })
  })

  it('falls back to off at 19:00 for missing or broken values', () => {
    for (const raw of [null, '', '{', '{"enabled":"yes","time":"07:30"}', '{"enabled":true,"time":"7:30"}']) {
      expect(parseSettings(raw)).toEqual({ enabled: false, time: '19:00' })
    }
  })
})

describe('base64UrlToBytes', () => {
  it('decodes base64url without padding', () => {
    expect([...base64UrlToBytes('AQID_-8')]).toEqual([1, 2, 3, 255, 239])
  })

  it('turns the VAPID public key into an uncompressed P-256 point', () => {
    const bytes = base64UrlToBytes(VAPID_PUBLIC_KEY)
    expect(bytes.length).toBe(65)
    expect(bytes[0]).toBe(4)
  })
})
