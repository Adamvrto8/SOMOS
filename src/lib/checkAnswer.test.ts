import { describe, expect, it } from 'vitest'
import { checkAnswer, diffWords } from './checkAnswer'

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

describe('spacing slips', () => {
  it('accepts a missing or an extra space as a typo', () => {
    expect(checkAnswer('nieje za co', 'nie je za čo')).toMatchObject({ verdict: 'typo', spacing: true })
    expect(checkAnswer('porfavor', 'por favor', { lookup })).toMatchObject({ verdict: 'typo', spacing: true })
    expect(checkAnswer('buenos días', 'buenosdías').verdict).toBe('typo')
  })

  it('rejects another known word written together', () => {
    const porque = (word: string) => (word === 'porque' ? 'pretože' : undefined)
    expect(checkAnswer('porque', 'por qué', { lookup: porque }).verdict).toBe('wrong')
  })

  it('still rejects a missing word', () => {
    expect(checkAnswer('nie za čo', 'nie je za čo').verdict).toBe('wrong')
  })
})

describe('diffWords', () => {
  const states = (input: string, expected: string, options = {}) =>
    diffWords(input, expected, options).map((p) => (p.state === 'missing' ? '_' : p.state === 'wrong' ? `*${p.text}*` : p.text))

  it('marks a misspelled word, keeping what the learner typed', () => {
    expect(states('Aceptan tarcheta de crédito', '¿Aceptan tarjeta de crédito?')).toEqual(['Aceptan', '*tarcheta*', 'de', 'crédito'])
  })

  it('marks every slip, not only the first', () => {
    expect(states('mi quarto está aribba a la derecha', 'Mi cuarto está arriba, a la derecha.')).toEqual([
      'mi', '*quarto*', 'está', '*aribba*', 'a', 'la', 'derecha',
    ])
  })

  it('shows where a word is missing', () => {
    expect(states('voy al mercado comprar fruta', 'Voy al mercado a comprar fruta.')).toEqual(['voy', 'al', 'mercado', '_', 'comprar', 'fruta'])
    expect(states('voy mercdo a comprar', 'Voy al mercado a comprar')).toEqual(['voy', '_', '*mercdo*', 'a', 'comprar'])
  })

  it('marks a word that does not belong', () => {
    expect(states('voy a al mercado', 'Voy al mercado.')).toEqual(['voy', '*a*', 'al', 'mercado'])
  })

  it('lets a missing accent pass, unless it changes the meaning', () => {
    const parts = diffWords('el volcan esta muy cerca', 'El volcán está muy cerca.')
    expect(parts.map((p) => p.state)).toEqual(['ok', 'ok', 'wrong', 'ok', 'ok'])
    expect(parts[2]).toMatchObject({ text: 'esta', accent: true })
    expect(states('hablo mucho', 'habló mucho', { lookup })).toEqual(['*hablo*', 'mucho'])
  })

  it('leaves an accepted subject pronoun alone', () => {
    expect(states('Yo hablo un poco de espanol', 'Hablo un poco de francés.', { optionalSubject: true })).toEqual([
      'Yo', 'hablo', 'un', 'poco', 'de', '*espanol*',
    ])
  })

  it('marks everything missing for an empty answer', () => {
    expect(states('', 'de nada')).toEqual(['_', '_'])
  })
})
