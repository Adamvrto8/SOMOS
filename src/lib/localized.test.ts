import { afterEach, describe, expect, it } from 'vitest'
import { sentenceById, tipById, topicById, verbById, wordById } from '../data'
import { setLanguage } from './language'
import {
  clozeHint,
  localizedTip,
  sentenceTranslation,
  topicName,
  verbTranslations,
  wordExamples,
  wordNote,
  wordTranslations,
} from './localized'

afterEach(() => setLanguage('sk'))

// "lluvia" (weather) is translated; "casa" (home) is not yet.
const lluvia = wordById.get('lluvia')!
const clima = wordById.get('clima')!
const casa = wordById.get('casa')!

describe('in Slovak', () => {
  it('gives the base data as it is', () => {
    expect(wordTranslations(lluvia)).toEqual(lluvia.sk)
    expect(wordExamples(lluvia)).toEqual(lluvia.examples.map((e) => ({ es: e.es, text: e.sk })))
    expect(wordNote(clima)).toBe(clima.note)
    expect(verbTranslations(verbById.get('tener')!)).toEqual(['mať'])
    expect(sentenceTranslation(sentenceById.get('s272')!)).toBe('V Monterrey je veľké teplo.')
    expect(topicName(topicById.get('weather')!)).toBe('Počasie')
    expect(localizedTip(tipById.get('futuro')!).title).toBe('Budúci čas (futuro)')
  })
})

describe('in English', () => {
  it('gives the English overlay of a word', () => {
    setLanguage('en')
    expect(wordTranslations(lluvia)).toEqual(['rain'])
    expect(wordExamples(lluvia)).toEqual([{ es: lluvia.examples[0].es, text: 'I like the sound of the rain.' }])
    expect(wordNote(clima)).toContain('masculine')
    // A translated word's note is the English one, or none: a Slovak note under English text helps nobody.
    expect(wordNote(lluvia)).toBeUndefined()
  })

  it('falls back to Slovak for a word that has no English yet', () => {
    setLanguage('en')
    expect(wordTranslations(casa)).toEqual(casa.sk)
    expect(wordExamples(casa)[0].text).toBe(casa.examples[0].sk)
    expect(wordNote(casa)).toBe(casa.note)
  })

  it('translates verbs, sentences and topic names, each with its own fallback', () => {
    setLanguage('en')
    expect(verbTranslations(verbById.get('tener')!)).toEqual(['to have'])
    const untranslated = [...verbById.values()].find((v) => v.id === 'aprender')!
    expect(verbTranslations(untranslated)).toEqual(untranslated.sk)
    expect(sentenceTranslation(sentenceById.get('s272')!)).toBe("It's very hot in Monterrey.")
    expect(sentenceTranslation(sentenceById.get('s001')!)).toBe(sentenceById.get('s001')!.sk)
    expect(topicName(topicById.get('weather')!)).toBe('Weather')
  })

  it('translates a Slovak cloze hint and leaves a verb hint alone', () => {
    const cold = sentenceById.get('s275')! // hint "zima (chlad)"
    const verb = sentenceById.get('s272')! // hint "hacer · él · presente"
    expect(clozeHint(cold, cold.cloze![0])).toBe('zima (chlad)')
    setLanguage('en')
    expect(clozeHint(cold, cold.cloze![0])).toBe('cold')
    expect(clozeHint(verb, verb.cloze![0])).toBe('hacer · él · presente')
  })

  it('gives a tip in English with the same rules, or the Slovak tip when there is none', () => {
    setLanguage('en')
    const base = tipById.get('futuro')!
    const tip = localizedTip(base)
    expect(tip.title).toBe('Future tense (futuro)')
    expect(tip.rules.map((r) => r.id)).toEqual(base.rules.map((r) => r.id))
    expect(tip.rules[0].examples[0]).toEqual({ es: base.rules[0].examples[0].es, text: 'Tomorrow I will talk to the boss.' })
    expect(tip.related).toEqual(base.related)
    expect(localizedTip(tipById.get('presente')!).title).toBe(tipById.get('presente')!.title)
  })
})
