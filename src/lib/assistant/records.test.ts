import { describe, expect, it } from 'vitest'
import { recordsOf, type RecordsInput } from './records'

const day = (d: number) => new Date(2026, 10, d, 12).getTime()
const input: RecordsInput = {
  mistakes: [
    { exercise: 'conjugation', itemId: 'tener:preterito:yo', firstWrongAt: day(1), lastWrongAt: day(3), wrongCount: 2 },
    { exercise: 'cloze', itemId: 'casa', firstWrongAt: day(1), lastWrongAt: day(9), wrongCount: 1 },
  ],
  diary: [
    { date: '2026-11-14', learned: 'pretérito', es: 'Ayer fui al cine.', createdAt: day(14), updatedAt: day(14) },
    { date: '2026-11-15', learned: 'x'.repeat(900), es: '', createdAt: day(15), updatedAt: day(15) },
  ],
  tests: { 'food:A1': { bestScore: 9, total: 10, passed: true, passedAt: day(5), attempts: 2, lastAt: day(5) } },
  lessons: { 'cloze:food:A1:1': { bestScore: 10, total: 10, passed: true, passedAt: day(4) }, 'cloze:food:A1:2': { bestScore: 3, total: 10, passed: false } },
  saved: [{ itemType: 'word', itemId: 'casa', savedAt: day(2) }],
  custom: [{ id: 'c1', es: 'chamba', sk: 'práca', note: 'MX hovorovo', createdAt: day(6) }],
}

describe('recordsOf', () => {
  it('gives the newest mistakes first, in words', () => {
    expect(recordsOf('mistakes', input, 10)).toEqual([
      { item: 'casa', exercise: 'Doplňovačka', wrongCount: 1, lastWrong: '2026-11-09' },
      { item: 'tener · preterito · yo', exercise: 'Časovanie', wrongCount: 2, lastWrong: '2026-11-03' },
    ])
  })

  it('clips long diary entries and respects the limit', () => {
    const [newest] = recordsOf('diary', input, 1)
    expect(newest.date).toBe('2026-11-15')
    expect(String(newest.learned).length).toBeLessThanOrEqual(300)
    expect(recordsOf('diary', input, 1)).toHaveLength(1)
  })

  it('gives tests, passed lessons only, saved words and custom words', () => {
    expect(recordsOf('tests', input, 10)).toEqual([{ test: 'food:A1', passed: true, best: '9/10', attempts: 2, last: '2026-11-05' }])
    expect(recordsOf('lessons', input, 10)).toEqual([{ lesson: 'cloze:food:A1:1', best: '10/10', passed: '2026-11-04' }])
    expect(recordsOf('saved', input, 10)).toEqual([{ type: 'word', item: 'casa' }])
    expect(recordsOf('custom', input, 10)).toEqual([{ es: 'chamba', sk: 'práca', note: 'MX hovorovo' }])
  })
})
