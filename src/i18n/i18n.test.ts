import { afterEach, describe, expect, it } from 'vitest'
import { setLanguage } from '../lib/language'
import { dictionaries, pluralEn, t } from './index'

afterEach(() => setLanguage('sk'))

describe('t', () => {
  it('follows the language', () => {
    expect(t().languageName).toBe('Slovenčina')
    setLanguage('en')
    expect(t().languageName).toBe('English')
  })

  it('has a date locale per language', () => {
    expect(dictionaries.sk.dateLocale).toBe('sk-SK')
    expect(dictionaries.en.dateLocale).toBe('en-US')
  })
})

describe('plurals', () => {
  it('English: one form for 1, another for everything else', () => {
    expect([0, 1, 2].map((n) => pluralEn(n, 'day', 'days'))).toEqual(['days', 'day', 'days'])
  })

  it('counts days in both languages', () => {
    expect([1, 2, 5].map((n) => dictionaries.sk.home.streakDays(n))).toEqual(['deň v rade', 'dni v rade', 'dní v rade'])
    expect([0, 1, 2].map((n) => dictionaries.en.home.streakDays(n))).toEqual(['days in a row', 'day in a row', 'days in a row'])
  })

  it('counts words with their number', () => {
    expect([1, 2, 5].map((n) => dictionaries.sk.home.words(n))).toEqual(['1 slovo', '2 slová', '5 slov'])
    expect([1, 2].map((n) => dictionaries.en.home.words(n))).toEqual(['1 word', '2 words'])
  })
})
