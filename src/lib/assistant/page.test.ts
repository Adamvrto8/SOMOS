import { describe, expect, it } from 'vitest'
import { describePage } from './page'
import { MAX_PAGE_CHARS } from './limits'

describe('describePage', () => {
  it('names the word on its page, with its translations', () => {
    expect(describePage('/word/casa')).toBe('Detail slova „casa“ (dom, domov), /word/casa')
  })

  it('names the grammar tip and its level', () => {
    expect(describePage('/practice/grammar/por-para')).toBe('Gramatický tip „por alebo para“ (úroveň B1), /practice/grammar/por-para')
  })

  it('names the topic', () => {
    expect(describePage('/topic/city')).toBe('Téma „Mesto“, /topic/city')
  })

  it('names any other screen by its section of the app guide, Domov included', () => {
    expect(describePage('/')).toBe('Obrazovka „Domov“, /')
    expect(describePage('/diary')).toBe('Obrazovka „Denník“, /diary')
    expect(describePage('/practice', '?type=conjugation')).toMatch(/, \/practice\?type=conjugation$/)
  })

  it('still says where the learner is when the id is unknown', () => {
    expect(describePage('/word/neexistuje')).toBe('Detail slova, /word/neexistuje')
  })

  it('stays under the limit the server accepts', () => {
    expect(describePage('/search', `?q=${'x'.repeat(400)}`).length).toBeLessThanOrEqual(MAX_PAGE_CHARS)
  })
})
