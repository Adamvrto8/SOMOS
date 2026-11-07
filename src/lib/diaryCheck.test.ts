import { describe, expect, it } from 'vitest'
import { checkDiary, type DiarySegment } from './diaryCheck'

type Word = Extract<DiarySegment, { word: true }>
const words = (segments: DiarySegment[]) => segments.filter((s): s is Word => 'word' in s)
const unknown = (text: string, custom?: string[]) =>
  words(checkDiary(text, custom))
    .filter((w) => !w.known)
    .map((w) => w.text)

describe('checkDiary', () => {
  it('gives the text back exactly as typed', () => {
    const text = '¿Qué hiciste hoy?\nFui al mercado, 3 veces.'
    expect(
      checkDiary(text)
        .map((s) => s.text)
        .join(''),
    ).toBe(text)
  })

  it('marks only words it does not know', () => {
    expect(unknown('Hoy fui al mercado con mi hermana.')).toEqual([])
    expect(unknown('Hoy fui al merkado.')).toEqual(['merkado'])
  })

  it('suggests the word without its missing accent or ñ', () => {
    expect(words(checkDiary('manana'))[0].suggestions).toContain('mañana')
    expect(words(checkDiary('tambien'))[0].suggestions).toContain('también')
  })

  it('leaves numbers and names alone, but not the first word of a sentence', () => {
    expect(unknown('Ayer platiqué con Juan en Monterrey. Fui 2 veces.')).toEqual([])
    expect(unknown('Xyzw es bueno.')).toEqual(['Xyzw'])
    expect(unknown('Hola.\nXyzw')).toEqual(['Xyzw'])
  })

  it('knows the learner’s own words', () => {
    expect(unknown('Comí un tlacoyo.')).toEqual(['tlacoyo'])
    expect(unknown('Comí un tlacoyo.', ['Tlacoyo'])).toEqual([])
  })

  it('links a dictionary word and a verb form to their pages', () => {
    const [casa, tengo, raro] = words(checkDiary('casa tengo xyzw'))
    expect(casa.href).toBe('/word/casa')
    expect(tengo.href).toBe('/word/tener')
    expect(raro.href).toBeUndefined()
  })
})
