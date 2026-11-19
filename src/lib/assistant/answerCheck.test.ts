import { describe, expect, it } from 'vitest'
import { checkAnswer } from './answerCheck'

describe('checkAnswer', () => {
  it('passes a clean answer', () => {
    expect(checkAnswer('Auto je el carro.\n{{word:carro}}\n{{dalej:Ako sa povie autobus?}}','Ako sa povie auto?', 'mx')).toEqual([])
  })

  it('finds a path with a placeholder of the app map', () => {
    const [note] = checkAnswer('Na detaile slova (/word/<id>) nájdeš príklady.', 'x', 'mx')
    expect(note).toContain('/word/<id>')
  })

  it('finds a note on where an example comes from, not a note like (ser)', () => {
    const [note] = checkAnswer('- Estoy en casa. – Som doma. (vzor na estar, mimo appky)', 'x', 'mx')
    expect(note).toContain('mimo appky')
    expect(checkAnswer('- Ayer fue martes. – Včera bol utorok. (ser)', 'x', 'mx')).toEqual([])
  })

  it('finds cards the app does not have', () => {
    const [note] = checkAnswer('{{word:flarpo}} a {{conj:tener:pasado}}', 'x', 'mx')
    expect(note).toContain('{{word:flarpo}}')
    expect(note).toContain('{{conj:tener:pasado}}')
  })

  it('finds Spain-only words in the Mexican variant, not in Spain', () => {
    const [note] = checkAnswer('Auto je el coche.', 'Ako sa povie auto?', 'mx')
    expect(note).toContain('"coche" (v Mexiku "carro")')
    expect(checkAnswer('Auto je el coche.', 'Ako sa povie auto?', 'es')).toEqual([])
  })

  it('lets an answer name a Spain word the learner asked about, or explain it beside the Mexican one', () => {
    expect(checkAnswer('Zumo sa hovorí v Španielsku.', 'Čo je zumo?', 'mx')).toEqual([])
    expect(checkAnswer('V Španielsku coche, v Mexiku carro.', 'Ako sa povie auto?', 'mx')).toEqual([])
    expect(checkAnswer('Coger je v Mexiku tomar alebo agarrar.', 'x', 'mx')).toEqual([])
  })

  it('finds vosotros unless the learner asked about it or ustedes stands beside it', () => {
    expect(checkAnswer('Vosotros habláis.', 'Ako sa časuje hablar?', 'mx')).toHaveLength(1)
    expect(checkAnswer('Vosotros sa v Mexiku nepoužíva.', 'Čo je vosotros?', 'mx')).toEqual([])
    expect(checkAnswer('Namiesto vosotros sa hovorí ustedes.', 'x', 'mx')).toEqual([])
    // Slovak "os" and numbers ending like a vosotros form are no finding.
    expect(checkAnswer('Os x, dieciséis.', 'x', 'mx')).toEqual([])
  })
})
