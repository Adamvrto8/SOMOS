import { describe, expect, it } from 'vitest'
import { plainAnswer } from './answerText'

describe('plainAnswer', () => {
  it('removes bold markers', () => {
    expect(plainAnswer('To je **casa** a __carro__.')).toBe('To je casa a carro.')
  })

  it('turns a Markdown link to an app path into the bare path', () => {
    expect(plainAnswer('Pozri [casa](/word/casa) alebo [tip](/practice/grammar/ser-estar).')).toBe(
      'Pozri /word/casa alebo /practice/grammar/ser-estar.',
    )
  })

  it('leaves plain text, bare paths and snake_case words alone', () => {
    expect(plainAnswer('Pozri /word/casa a my_var_name.')).toBe('Pozri /word/casa a my_var_name.')
  })
})
