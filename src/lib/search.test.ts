import { describe, expect, it } from 'vitest'
import { searchWords } from './search'

// The tests run the Mexican variant (no somos.variant stored).
describe('searchWords', () => {
  it('finds a Mexican word by its name in Spain, and says so', () => {
    const [hit] = searchWords('coche', 'all')
    expect(hit.word.id).toBe('carro')
    expect(hit.otherForm).toBe('coche')
  })
  it('finds the Mexican verb by the one Spain says instead', () => {
    expect(searchWords('conducir', 'all')[0]).toMatchObject({ word: { id: 'manejar' }, otherForm: 'conducir' })
  })
  it('does not mark a word found by its own name', () => {
    expect(searchWords('carro', 'all')[0]).toMatchObject({ word: { id: 'carro' }, otherForm: undefined })
  })
})
