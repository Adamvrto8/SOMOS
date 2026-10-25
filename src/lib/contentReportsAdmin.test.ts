import { describe, expect, it } from 'vitest'
import { sentenceById } from '../data'
import { copyText, currentContent, groupReports, type StoredReport } from './contentReportsAdmin'

const report = (over: Partial<StoredReport>): StoredReport => ({
  id: 1,
  target: 'word:casa',
  detail: '',
  exercise: 'word',
  reason: 'spanish',
  note: '',
  answer: null,
  shown: { es: 'la casa', translation: 'dom, domov' },
  version: 'abc1234',
  language: 'sk',
  created_at: '2026-10-25T10:00:00Z',
  status: 'open',
  handled_at: null,
  ...over,
})

const REASONS = { spanish: 'Chyba v španielčine', translation: 'Zlý preklad', answer: 'Moja odpoveď mala byť uznaná', other: 'Iné' }

describe('content reports admin', () => {
  it('groups by target: most reported first, then the newest; reports newest first', () => {
    const groups = groupReports([
      report({ id: 1, target: 'word:casa', created_at: '2026-10-20T10:00:00Z' }),
      report({ id: 2, target: 'sentence:s001', created_at: '2026-10-25T10:00:00Z' }),
      report({ id: 3, target: 'word:casa', created_at: '2026-10-21T10:00:00Z' }),
      report({ id: 4, target: 'verb:tener', created_at: '2026-10-24T10:00:00Z' }),
    ])
    expect(groups.map((g) => g.target)).toEqual(['word:casa', 'sentence:s001', 'verb:tener'])
    expect(groups[0].reports.map((r) => r.id)).toEqual([3, 1])
  })

  it('looks up what the content says now, and null when it is gone', () => {
    expect(currentContent('word:casa', '')).toEqual({ es: 'la casa', translation: 'dom, domov' })
    expect(currentContent('verb:tener', 'preterito:yo')).toEqual({ es: 'tuve', translation: 'tener · yo · pretérito' })
    expect(currentContent('verb:tener', '')?.es).toBe('tener')
    expect(currentContent('sentence:s001', '0')?.es).toBe(sentenceById.get('s001')?.es)
    expect(currentContent('word:no-such-word', '')).toBeNull()
    expect(currentContent('verb:no-such-verb', 'presente:yo')).toBeNull()
  })

  it('copies the reports as text for Claude', () => {
    const text = copyText(groupReports([report({ note: 'Rod?' }), report({ id: 2, reason: 'answer', answer: 'el casa', created_at: '2026-10-24T10:00:00Z' })]), REASONS)
    expect(text).toContain('word:casa (2×) · word')
    expect(text).toContain('Videné: la casa — dom, domov')
    expect(text).toContain('Teraz: rovnaké')
    expect(text).toContain('- Chyba v španielčine: Rod? (2026-10-25)')
    expect(text).toContain('- Moja odpoveď mala byť uznaná · odpoveď: el casa (2026-10-24)')
  })

  it('says when the content is gone or changed', () => {
    expect(copyText(groupReports([report({ target: 'word:gone' })]), REASONS)).toContain('Teraz: už neexistuje')
    expect(copyText(groupReports([report({ shown: { es: 'la cassa', translation: 'dom' } })]), REASONS)).toContain('Teraz: la casa — dom, domov')
  })
})
