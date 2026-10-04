import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { verbById, wordById } from '../data'
import { checkAnswer } from './checkAnswer'
import { lookupForm } from './knownForms'
import { setLanguage } from './language'
import { conjugationTask, gradeTask, nativeAnswers, vocabTask, type Grade } from './lesson'
import { wordTranslations } from './localized'
import { searchWords } from './search'
import { tipFor } from './tips'
import { guessLang } from './translate'

// What changes with the language besides the texts: answers, search, glosses, reasons.
// lluvia (weather) and the core verbs have English; casa has not.

const WRONG: Grade = { correct: false, verdict: 'wrong', expected: '' }
const ids = (query: string) => searchWords(query, 'all').map((hit) => hit.word.id)

afterEach(() => setLanguage('sk'))

describe('in Slovak nothing changes', () => {
  it('searches and answers in Slovak', () => {
    expect(ids('dážď')).toContain('lluvia')
    expect(ids('rain')).not.toContain('lluvia')
    expect(nativeAnswers(wordById.get('lluvia')!)).toEqual(['dážď'])
    expect(lookupForm('lluvia')).toBe('dážď')
  })
})

describe('in English', () => {
  beforeEach(() => setLanguage('en'))

  it('a verb in the dictionary takes its translations from the verb', () => {
    expect(wordTranslations(wordById.get('tener')!)).toEqual(['to have'])
  })

  it('accepts a verb with or without "to", a noun with or without an article', () => {
    expect(nativeAnswers(wordById.get('tener')!)).toEqual(expect.arrayContaining(['to have', 'have']))
    const rain = nativeAnswers(wordById.get('lluvia')!)
    expect(rain).toEqual(expect.arrayContaining(['rain', 'the rain']))
    expect(gradeTask(vocabTask(wordById.get('lluvia')!, 'es-sk'), 'The rain').correct).toBe(true)
    expect(gradeTask(vocabTask(wordById.get('tener')!, 'es-sk'), 'have').correct).toBe(true)
    expect(gradeTask(vocabTask(wordById.get('lluvia')!, 'es-sk'), 'snow').correct).toBe(false)
  })

  it('asks for the Spanish word with the English one', () => {
    expect(vocabTask(wordById.get('lluvia')!, 'sk-es').prompt).toBe('rain')
  })

  it('searches the English translations, and the Slovak ones of words without English', () => {
    expect(ids('rain')).toContain('lluvia')
    expect(ids('dážď')).not.toContain('lluvia')
    expect(ids('dom')).toContain('casa')
    expect(ids('lluvia')).toContain('lluvia')
  })

  it('follows the language when it changes back', () => {
    expect(ids('rain')).toContain('lluvia')
    setLanguage('sk')
    expect(ids('rain')).not.toContain('lluvia')
    expect(ids('dážď')).toContain('lluvia')
  })

  it('glosses a known form in English', () => {
    expect(lookupForm('lluvia')).toBe('rain')
    const check = checkAnswer('esta', ['está'])
    expect(check.meanings?.map((m) => m.gloss)).toEqual(['this (feminine)', 'is (estar)'])
  })

  it('gives the reason behind a verb form in English', () => {
    const found = tipFor(conjugationTask(verbById.get('tener')!, 'preterito', 'yo'), WRONG)
    expect(found?.rule?.id).toBe('stems')
    expect(found?.because).toBe('tener is one of the irregular verbs in the pretérito: its endings have no accent.')
  })

  it('guesses whether a query is Spanish or English', () => {
    expect(guessLang('mañana')).toBe('es')
    expect(guessLang('tengo hambre')).toBe('es')
    expect(guessLang('ice cream seller')).toBe('en')
  })
})

describe('guessLang in Slovak', () => {
  it('still tells Slovak from Spanish', () => {
    expect(guessLang('zmrzlinár')).toBe('sk')
    expect(guessLang('mañana')).toBe('es')
  })
})
