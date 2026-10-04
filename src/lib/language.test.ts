import { afterEach, describe, expect, it } from 'vitest'
import { detectLanguage, getLanguage, parseLanguage, setLanguage } from './language'

describe('detectLanguage', () => {
  it.each([
    [['sk-SK', 'en'], 'sk'],
    [['sk'], 'sk'],
    [['cs-CZ'], 'sk'], // a Czech phone reads Slovak better than English
    [['en-US'], 'en'],
    [['en-GB', 'sk'], 'en'], // only the first choice counts
    [['de-DE'], 'en'],
    [[], 'en'],
  ] as const)('%j → %s', (languages, expected) => {
    expect(detectLanguage(languages)).toBe(expected)
  })
})

describe('parseLanguage', () => {
  it('accepts the two languages and nothing else', () => {
    expect(parseLanguage('sk')).toBe('sk')
    expect(parseLanguage('en')).toBe('en')
    for (const bad of ['de', '', 'SK', null, undefined, 1, {}]) expect(parseLanguage(bad)).toBeUndefined()
  })
})

describe('the store', () => {
  afterEach(() => setLanguage('sk'))

  it('works where there is no storage (unit tests, the build)', () => {
    expect(() => setLanguage('en')).not.toThrow()
    expect(getLanguage()).toBe('en')
  })
})
