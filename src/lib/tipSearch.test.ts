import { afterEach, describe, expect, it } from 'vitest'
import { tips } from '../data'
import { setLanguage } from './language'
import { searchTips } from './tipSearch'

afterEach(() => setLanguage('sk'))

const ids = (query: string) => searchTips(tips, query).map((t) => t.id)

describe('searchTips', () => {
  it('returns every tip, in order, for an empty query', () => {
    expect(ids('')).toEqual(tips.map((t) => t.id))
    expect(ids('   ')).toEqual(tips.map((t) => t.id))
  })

  it('matches the start of a word, so "subj" finds the subjunctive tips', () => {
    const found = ids('subj')
    expect(found).toEqual(expect.arrayContaining(['subjuntivo', 'subjuntivo-wishes', 'subjuntivo-clauses', 'subj-imperfecto']))
  })

  it('ignores accents and capitals', () => {
    expect(ids('quiza')).toContain('doubt')
    expect(ids('QUIZÁ')).toContain('doubt')
  })

  it('needs every word of the query', () => {
    const found = ids('ser estar')
    expect(found).toContain('ser-estar')
    expect(found).toContain('ser-estar-meaning')
    expect(ids('ser estar zzzzz')).toEqual([])
  })

  it('puts a title match before a match in the rules', () => {
    const found = ids('imperativ')
    expect(found[0]).toBe('imperativo')
    expect(ids('por para')[0]).toBe('por-para')
  })

  it('lists a tip once', () => {
    const found = ids('que')
    expect(new Set(found).size).toBe(found.length)
  })

  it('searches the English texts in English', () => {
    setLanguage('en')
    expect(ids('subjunctive')).toContain('subjuntivo')
    setLanguage('sk')
    expect(ids('subjunctive')).not.toContain('subjuntivo-wishes')
  })

  it('finds a tip by a Spanish word from its examples', () => {
    expect(ids('acabo')).toContain('periphrases')
  })
})
