import { describe, expect, it } from 'vitest'
import { guessLang } from './translate'

describe('guessLang', () => {
  it('spots Spanish by its letters, known forms and endings', () => {
    expect(guessLang('mañana')).toBe('es')
    expect(guessLang('¿dónde?')).toBe('es')
    expect(guessLang('tengo hambre')).toBe('es')
    expect(guessLang('regresar')).toBe('es')
    expect(guessLang('la contaminación')).toBe('es')
  })

  it('spots Slovak and defaults to it', () => {
    expect(guessLang('ďakujem')).toBe('sk')
    expect(guessLang('zmrzlinár')).toBe('sk')
    expect(guessLang('a potom domov')).toBe('sk') // "a" is also Spanish, the majority is not
    expect(guessLang('kvetináč')).toBe('sk')
  })
})
