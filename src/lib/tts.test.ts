import { describe, expect, it } from 'vitest'
import { preferredLangs } from './tts'

describe('preferredLangs', () => {
  it('looks for the voice of the Spanish being learned first', () => {
    expect(preferredLangs('mx')[0]).toBe('es-mx')
    expect(preferredLangs('es')).toEqual(['es-es', 'es-mx', 'es-us', 'es-419'])
  })
})
