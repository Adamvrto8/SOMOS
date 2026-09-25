import { describe, expect, it } from 'vitest'
import { checkAnswer } from './checkAnswer'

// Minimal stand-in for the dataset's known forms.
const known = new Map([
  ['hablo', 'hablar · yo · presente'],
  ['habló', 'hablar · él · pretérito'],
  ['hablas', 'hablar · tú · presente'],
  ['hablan', 'hablar · ellos · presente'],
  ['papa', 'zemiak'],
  ['papá', 'otec'],
])
const lookup = (word: string) => known.get(word)

describe('checkAnswer', () => {
  it('accepts an exact answer', () => {
    expect(checkAnswer('está', 'está').verdict).toBe('correct')
  })

  it('ignores case, extra spaces and ¿?¡!., punctuation', () => {
    expect(checkAnswer('  ¡HOLA!   ¿cómo  estás? ', 'Hola, ¿cómo estás?').verdict).toBe('correct')
  })

  it('accepts a missing accent with a warning naming the word', () => {
    const r = checkAnswer('estan', 'están')
    expect(r.verdict).toBe('accent')
    expect(r.accentWords).toEqual(['están'])
  })

  it('treats a missing ñ like a missing accent', () => {
    expect(checkAnswer('manana', 'mañana').verdict).toBe('accent')
  })

  it('accepts cafe for café with a warning (not a different word)', () => {
    expect(checkAnswer('cafe', 'café', { lookup }).verdict).toBe('accent')
  })

  it.each([
    ['esta', 'está'],
    ['el', 'él'],
    ['tu', 'tú'],
    ['si', 'sí'],
    ['mas', 'más'],
    ['se', 'sé'],
    ['te', 'té'],
    ['de', 'dé'],
    ['mi', 'mí'],
    ['que', 'qué'],
    ['como', 'cómo'],
    ['donde', 'dónde'],
    ['cuando', 'cuándo'],
    ['él', 'el'],
  ])('rejects %s for %s because the accent changes the meaning', (input, expected) => {
    const r = checkAnswer(input, expected)
    expect(r.verdict).toBe('wrong')
    expect(r.meanings).toHaveLength(2)
  })

  it('explains a meaning-changing accent in Slovak', () => {
    expect(checkAnswer('esta', 'está').meanings).toEqual([
      { word: 'esta', gloss: 'táto' },
      { word: 'está', gloss: 'je (estar)' },
    ])
  })

  it('rejects hablo for habló using known verb forms', () => {
    const r = checkAnswer('hablo', 'habló', { lookup })
    expect(r.verdict).toBe('wrong')
    expect(r.meanings).toEqual([
      { word: 'hablo', gloss: 'hablar · yo · presente' },
      { word: 'habló', gloss: 'hablar · él · pretérito' },
    ])
  })

  it('rejects papa for papá using known words', () => {
    const r = checkAnswer('papa', 'papá', { lookup })
    expect(r.verdict).toBe('wrong')
    expect(r.meanings).toEqual([
      { word: 'papa', gloss: 'zemiak' },
      { word: 'papá', gloss: 'otec' },
    ])
  })

  it('forgives one typo in a word of 5+ letters', () => {
    const r = checkAnswer('trabajr', 'trabajar')
    expect(r.verdict).toBe('typo')
    expect(r.typoWord).toBe('trabajar')
  })

  it('does not forgive typos in words shorter than 5 letters', () => {
    expect(checkAnswer('soi', 'soy').verdict).toBe('wrong')
  })

  it('does not treat a different real form as a typo', () => {
    expect(checkAnswer('hablas', 'hablan', { lookup }).verdict).toBe('wrong')
  })

  it('allows only one typo per answer', () => {
    expect(checkAnswer('trabajr en la oficna', 'trabajar en la oficina').verdict).toBe('wrong')
  })

  it('reports a typo over an accent warning, keeping both details', () => {
    const r = checkAnswer('estan en la oficna', 'están en la oficina')
    expect(r.verdict).toBe('typo')
    expect(r.typoWord).toBe('oficina')
    expect(r.accentWords).toEqual(['están'])
  })

  it('rejects a different number of words', () => {
    expect(checkAnswer('estoy', 'estoy hablando').verdict).toBe('wrong')
  })

  it('rejects an empty answer', () => {
    expect(checkAnswer('   ', 'hola').verdict).toBe('wrong')
  })

  it('accepts a leading subject pronoun only when enabled', () => {
    const expected = 'Hablo un poco de español.'
    expect(checkAnswer('Yo hablo un poco de español', expected, { optionalSubject: true }).verdict).toBe('correct')
    expect(checkAnswer('Yo hablo un poco de español', expected).verdict).toBe('wrong')
  })

  it('picks the best of several expected answers', () => {
    const r = checkAnswer('me llamo adam', ['Mi nombre es Adam.', 'Me llamo Adam.'])
    expect(r.verdict).toBe('correct')
    expect(r.expected).toBe('Me llamo Adam.')
  })
})
