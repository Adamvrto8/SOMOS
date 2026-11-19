import { describe, expect, it } from 'vitest'
import { sentenceById } from '../../data'
import { addDays } from '../dates'
import type { Attempt } from '../db'
import { clip, describeItem, learnerProfile, type LearnerSnapshot } from './learner'
import { MAX_LEARNER_CHARS } from './limits'

const now = new Date(2026, 10, 16, 12)
const at = (daysAgo: number) => addDays(now, -daysAgo).getTime()
const answers = (daysAgo: number, exercise: string, right: number, wrong: number): Pick<Attempt, 'at' | 'correct' | 'exercise'>[] => [
  ...Array.from({ length: right }, () => ({ at: at(daysAgo), correct: true, exercise })),
  ...Array.from({ length: wrong }, () => ({ at: at(daysAgo), correct: false, exercise })),
]

const empty: LearnerSnapshot = {
  now, language: 'sk', variant: 'mx', signedIn: false, goal: 20, attempts: [], due: { today: 0, tomorrow: 0 },
  mistakes: [], saved: 0, customWords: 0, diaryCount: 0, diary: [], lessons: {}, tests: {},
}

describe('learnerProfile', () => {
  it('describes a fresh device without numbers that make no sense', () => {
    const text = learnerProfile(empty)
    expect(text).toContain('Spolu: zatiaľ žiadne odpovede')
    // The model said it had no date and wrote "Hoy es martes" on a Monday (eval run 3).
    expect(text).toContain('Dnes je: pondelok 16. 11. 2026')
    expect(text).toContain('Dnes: 0/20 (chýba 20)')
    expect(text).toContain('Cesta: hotová alebo nezačatá')
    expect(text).not.toMatch(/NaN|undefined|Infinity/)
  })

  it('gives today, the streak, freezes and the weakest exercise', () => {
    const text = learnerProfile({
      ...empty,
      attempts: [...answers(3, 'cloze', 20, 0), ...answers(2, 'cloze', 20, 0), ...answers(1, 'cloze', 20, 0), ...answers(0, 'conjugation', 5, 15)],
      due: { today: 8, tomorrow: 3 },
    })
    expect(text).toContain('Dnes: 5/20 (chýba 15)')
    expect(text).toContain('Séria: 3 dní (najdlhšia 3)')
    expect(text).toContain('Ochrana série: 1/2')
    expect(text).toContain('Kartičky na zopakovanie: dnes 8, zajtra 3')
    expect(text).toContain('Najslabšie cvičenie: Časovanie (25 %)')
    expect(text).not.toMatch(/\b(cloze|conjugation)\b/)
  })

  it('names the most frequent mistakes in words, not ids', () => {
    const text = learnerProfile({
      ...empty,
      mistakes: [
        { exercise: 'cloze', itemId: 's001#0', firstWrongAt: at(5), lastWrongAt: at(1), wrongCount: 3 },
        { exercise: 'conjugation', itemId: 'tener:preterito:yo', firstWrongAt: at(2), lastWrongAt: at(2), wrongCount: 1 },
      ],
    })
    expect(text).toContain('Chyby na precvičenie: 2')
    expect(text).toContain(sentenceById.get('s001')!.es)
    expect(text).toContain('tener · preterito · yo')
    expect(text).toContain('[Doplňovačka, 3×]')
  })

  it('stays under the limit for a heavy learner', () => {
    const text = learnerProfile({
      ...empty,
      mistakes: Array.from({ length: 300 }, (_, i) => ({ exercise: 'cloze', itemId: `x${i}`, firstWrongAt: at(1), lastWrongAt: at(1), wrongCount: 1 })),
      diary: Array.from({ length: 7 }, (_, i) => ({ date: `2026-11-${10 + i}`, title: 'b'.repeat(200), text: 'a'.repeat(5000) })),
      diaryCount: 7,
    })
    expect(text.length).toBeLessThan(MAX_LEARNER_CHARS)
  })
})

describe('describeItem', () => {
  it('turns task ids into what the learner saw', () => {
    expect(describeItem('s001#0')).toBe(`„${sentenceById.get('s001')!.es}“`)
    expect(describeItem('tener:preterito:yo')).toBe('tener · preterito · yo')
    expect(describeItem('casa')).toBe('casa')
    expect(describeItem('el:sk-es')).toBe('el (SK → ES)')
    expect(describeItem('casa:es-sk')).toBe('casa (ES → SK)')
    expect(describeItem('m:carro,casa')).toBe('carro, casa')
    expect(describeItem('s001#0:t')).toBe(`„${sentenceById.get('s001')!.es}“`)
  })
})

describe('clip', () => {
  it('never cuts an emoji in half, a lone surrogate makes the API refuse the question', () => {
    const out = clip(`${'x'.repeat(158)}\u{1F600} hola`, 160)
    expect(out).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
    expect(out.endsWith('…')).toBe(true)
  })
})
