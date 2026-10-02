import { describe, expect, it } from 'vitest'
import { sentences, tipById, verbById } from '../data'
import { TABLE_TENSES } from './conjugate'
import { conjugationTask, gradeTask, taskFromItem, type ExerciseType, type Grade, type Task } from './lesson'
import { tipFor, tipLabel } from './tips'

const WRONG: Grade = { correct: false, verdict: 'wrong', expected: '' }

function task(exercise: ExerciseType, itemId: string): Task {
  const found = taskFromItem(exercise, itemId)
  if (!found) throw new Error(`no task ${exercise} ${itemId}`)
  return found
}
const tipOf = (exercise: ExerciseType, itemId: string) => tipFor(task(exercise, itemId), WRONG)

describe('tipFor', () => {
  it('gives a ser/estar cloze its tip and the reason of that sentence', () => {
    const found = tipOf('cloze', 's063#0') // "Somos de Eslovaquia."
    expect(found?.tip.id).toBe('ser-estar')
    expect(found?.rule?.id).toBe('origin')
    expect(found?.rule?.because).toContain('ser')
    expect(found?.targeted).toBe(true)
    // The same blank as a multiple choice.
    expect(tipOf('choice', 's063#0')?.rule?.id).toBe('origin')
  })

  it.each([
    ['s378#0', 'preterito'], // "llegar · tú · pretérito"
    ['s458#0', 'imperfecto'], // "tener · yo · imperfecto"
    ['s254#0', 'progresivo'], // "hacer · gerundio"
    ['s242#0', 'articles'], // "člen"
    ['s249#0', 'adjectives'], // "prídavné meno: cansado"
  ])('reads the tip of cloze %s from its hint: %s', (itemId, tipId) => {
    const found = tipOf('cloze', itemId)
    expect(found?.tip.id).toBe(tipId)
    expect(found?.targeted).toBe(true)
    expect(found?.rule).toBeUndefined()
  })

  it('has no tip for a blank that asks for vocabulary', () => {
    expect(tipOf('cloze', 's243#0')).toBeUndefined() // hint "oči"
  })

  it.each(TABLE_TENSES)('gives a conjugation task the tip of its tense: %s', (tense) => {
    const found = tipFor(conjugationTask(verbById.get('hablar')!, tense, 'yo'), WRONG)
    expect(found?.tip.id).toBe(tense)
    expect(found?.targeted).toBe(true)
  })

  it('gives a whole sentence its main grammar topic, without claiming to explain the mistake', () => {
    // s520 is tagged imperfecto, preterito, ser-estar: ser/estar is the one most worth explaining.
    for (const exercise of ['translation', 'builder', 'dictation', 'speaking'] as const) {
      const found = tipOf(exercise, 's520')
      expect(found?.tip.id).toBe('ser-estar')
      expect(found?.targeted).toBe(false)
      expect(found?.rule).toBeUndefined()
    }
    expect(tipOf('translation', 's378')?.tip.id).toBe('preterito')
    expect(tipOf('translation', 's369')).toBeUndefined() // no grammar tags
  })

  it('has no tip for vocabulary', () => {
    expect(tipOf('vocab', 'de-nada:es-sk')).toBeUndefined()
  })

  it('explains an accent that changed the meaning before anything else', () => {
    const drill = conjugationTask(verbById.get('hablar')!, 'preterito', 'el') // habló
    const grade = gradeTask(drill, 'hablo')
    expect(grade.check?.meanings).toBeDefined()
    expect(tipFor(drill, grade)?.tip.id).toBe('accents')
    expect(tipFor(drill, grade)?.targeted).toBe(true)
  })

  it('finds a rule for every ser/estar cloze of the dataset and a tip wherever it promises one', () => {
    for (const sentence of sentences) {
      sentence.cloze?.forEach((cloze, i) => {
        const found = tipOf('cloze', `${sentence.id}#${i}`)
        if (cloze.hint?.startsWith('ser/estar')) expect(found?.rule, sentence.id).toBeDefined()
        if (found) expect(tipById.get(found.tip.id), sentence.id).toBe(found.tip)
      })
      for (const tag of sentence.grammar ?? []) expect(tipById.has(tag), tag).toBe(true)
    }
  })
})

describe('tipLabel', () => {
  it('asks "Prečo?" only when the tip is about the thing that was asked', () => {
    expect(tipLabel(tipOf('cloze', 's063#0')!)).toBe('Prečo?')
    expect(tipLabel(tipOf('translation', 's378')!)).toBe('Gramatika k vete')
  })
})
