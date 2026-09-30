import { describe, expect, it } from 'vitest'
import { bestMatch, matchSpeech, numberWords } from './speechMatch'

const heard = (transcript: string, expected: string) =>
  matchSpeech(transcript, expected).words.map((w) => `${w.word}${w.heard ? '' : '✗'}`).join(' ')

describe('matchSpeech', () => {
  it('accepts an exact transcript', () => {
    expect(matchSpeech('Hablo un poco de español', 'Hablo un poco de español.')).toMatchObject({ missed: 0, verdict: 'correct' })
  })

  it('ignores case, accents, ñ and punctuation', () => {
    expect(matchSpeech('hablo un poco de espanol', '¿Hablo un poco de español?').verdict).toBe('correct')
    expect(matchSpeech('¡ESTÁ BIEN!', 'Está bien.').verdict).toBe('correct')
  })

  it('keeps the sentence words as written and marks the missed ones', () => {
    expect(heard('hablo poco de español', 'Hablo un poco de español.')).toBe('Hablo un✗ poco de español.')
  })

  it('does not count extra spoken words against the learner', () => {
    expect(matchSpeech('eh hablo un poco de español sí', 'Hablo un poco de español.').verdict).toBe('correct')
  })

  it('reads digits as number words', () => {
    expect(matchSpeech('tengo 3 hermanos', 'Tengo tres hermanos.').verdict).toBe('correct')
    expect(matchSpeech('son las 21', 'Son las veintiuno.').verdict).toBe('correct')
    expect(matchSpeech('tengo 35 años', 'Tengo treinta y cinco años.').verdict).toBe('correct')
  })

  it('treats 1, un, una and uno as the same word', () => {
    expect(matchSpeech('es la 1', 'Es la una.').verdict).toBe('correct')
    expect(matchSpeech('quiero 1 café', 'Quiero un café.').verdict).toBe('correct')
  })

  it('is lenient by one word in sentences of five or more words', () => {
    expect(matchSpeech('hablo un poco de', 'Hablo un poco de español.')).toMatchObject({ missed: 1, verdict: 'typo' })
    expect(matchSpeech('tengo mucha', 'Tengo mucha hambre hoy.')).toMatchObject({ missed: 2, verdict: 'wrong' })
    expect(matchSpeech('tengo mucha hambre', 'Tengo mucha hambre hoy.')).toMatchObject({ missed: 1, verdict: 'wrong' })
  })

  it('fails an empty transcript', () => {
    expect(matchSpeech('', 'Hola.')).toMatchObject({ missed: 1, verdict: 'wrong' })
  })

  it.each([
    ['tiene cambio de 200', '¿Tiene cambio de doscientos?'],
    ['mi celular cuesta 5000 pesos', 'Mi celular cuesta cinco mil pesos.'],
    ['mi celular cuesta $5,000', 'Mi celular cuesta cinco mil pesos.'],
    ['mi celular cuesta 5.000 pesos', 'Mi celular cuesta cinco mil pesos.'],
    ['me levanto a las 6:30', 'Me levanto a las seis y media.'],
    ['son las 8:15', 'Son las ocho y cuarto.'],
    ['la tienda cierra a las 9:00', 'La tienda cierra a las nueve.'],
    ['estamos a 35°', 'Estamos a treinta y cinco grados.'],
  ])('reads the transcript "%s" as words', (transcript, expected) => {
    expect(matchSpeech(transcript, expected)).toMatchObject({ missed: 0, verdict: 'correct' })
  })

  it('aligns in order, so a repeated word is matched once per occurrence', () => {
    expect(heard('mañana', 'Mañana voy mañana.')).toBe('Mañana voy✗ mañana.✗')
  })
})

describe('numberWords', () => {
  it.each([
    [0, 'cero'],
    [16, 'dieciséis'],
    [22, 'veintidós'],
    [30, 'treinta'],
    [47, 'cuarenta y siete'],
    [100, 'cien'],
    [101, 'ciento uno'],
    [200, 'doscientos'],
    [555, 'quinientos cincuenta y cinco'],
    [1000, 'mil'],
    [1965, 'mil novecientos sesenta y cinco'],
    [5000, 'cinco mil'],
    [21000, 'veintiún mil'],
    [31000, 'treinta y un mil'],
    [1000000, 'un millón'],
    [2500000, 'dos millones quinientos mil'],
  ])('%i → %s', (n, word) => {
    expect(numberWords(n)).toBe(word)
  })

  it('leaves numbers from a billion up alone', () => {
    expect(numberWords(1_000_000_000)).toBeUndefined()
  })
})

describe('bestMatch', () => {
  it('picks the alternative with the fewest missed words, the first on ties', () => {
    const result = bestMatch(['hablo poco', 'hablo un poco de español', 'hablo un poco de español'], 'Hablo un poco de español.')
    expect(result.transcript).toBe('hablo un poco de español')
    expect(result.match.verdict).toBe('correct')
  })
})
