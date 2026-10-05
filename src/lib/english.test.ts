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
// Every word and verb has English.

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

  it('takes an apostrophe as the phone types it, or none at all', () => {
    const worry = vocabTask(wordById.get('no-te-preocupes')!, 'es-sk')
    expect(gradeTask(worry, "don't worry").verdict).toBe('correct')
    expect(gradeTask(worry, 'Don’t worry').verdict).toBe('correct')
    expect(gradeTask(worry, 'dont worry').verdict).toBe('correct')
    expect(gradeTask(worry, 'do not worry').correct).toBe(false)
    // A short word is no typo, so without this "it’s" would be plain wrong.
    const worth = vocabTask(wordById.get('vale-la-pena')!, 'es-sk')
    expect(gradeTask(worth, 'it’s worth it').verdict).toBe('correct')
    expect(gradeTask(worth, 'its worth it').verdict).toBe('correct')
  })

  it('asks for the Spanish word with the English one', () => {
    expect(vocabTask(wordById.get('lluvia')!, 'sk-es').prompt).toBe('rain')
  })

  it('searches the English translations, not the Slovak ones', () => {
    expect(ids('rain')).toContain('lluvia')
    expect(ids('dážď')).not.toContain('lluvia')
    expect(ids('house')).toContain('casa')
    expect(ids('dom')).not.toContain('casa')
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
