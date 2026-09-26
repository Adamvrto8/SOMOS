import { describe, expect, it } from 'vitest'
import { sentences, verbById, verbs } from '../data'
import {
  availableCount,
  builderWords,
  conjugationTask,
  createLesson,
  gradeTask,
  LESSON_SIZE,
  mistakesLesson,
  retryTasks,
  taskFromItem,
  type Task,
} from './lesson'
import { TABLE_TENSES } from './conjugate'
import { lookupForm } from './knownForms'

// Deterministic pseudo-random generator for reproducible lessons.
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const itemIds = (tasks: Task[]) => tasks.map((t) => t.itemId)

describe('createLesson', () => {
  it.each(['cloze', 'choice', 'conjugation', 'builder', 'translation'] as const)('builds a %s lesson of LESSON_SIZE unique items', (type) => {
    const tasks = createLesson({ type }, LESSON_SIZE, seeded(1))
    expect(tasks).toHaveLength(LESSON_SIZE)
    expect(new Set(itemIds(tasks)).size).toBe(LESSON_SIZE)
    expect(tasks.every((t) => t.kind === type)).toBe(true)
  })

  it('never uses the same sentence twice in a cloze lesson', () => {
    const tasks = createLesson({ type: 'cloze' }, 40, seeded(2))
    const ids = tasks.map((t) => (t.kind === 'cloze' ? t.sentence.id : ''))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('respects topic and level filters', () => {
    const tasks = createLesson({ type: 'translation', topic: 'food', level: 'A1' }, LESSON_SIZE, seeded(3))
    expect(tasks.length).toBeGreaterThan(0)
    for (const t of tasks) {
      if (t.kind !== 'translation') throw new Error('wrong kind')
      expect(t.sentence.topics).toContain('food')
      expect(t.sentence.level).toBe('A1')
    }
  })

  it('respects the tense filter and uses each verb at most twice', () => {
    const tasks = createLesson({ type: 'conjugation', tense: 'preterito' }, LESSON_SIZE, seeded(4))
    const perVerb = new Map<string, number>()
    for (const t of tasks) {
      if (t.kind !== 'conjugation') throw new Error('wrong kind')
      expect(t.tense).toBe('preterito')
      perVerb.set(t.verb.id, (perVerb.get(t.verb.id) ?? 0) + 1)
    }
    expect(Math.max(...perVerb.values())).toBeLessThanOrEqual(2)
  })

  it('returns fewer tasks when the pool is small, none when empty', () => {
    const count = availableCount({ type: 'translation', topic: 'numbers', level: 'A2' })
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(LESSON_SIZE)
    expect(createLesson({ type: 'translation', topic: 'numbers', level: 'A2' }, LESSON_SIZE, seeded(5))).toHaveLength(count)
    expect(createLesson({ type: 'translation', level: 'B2' }, LESSON_SIZE, seeded(5))).toHaveLength(0)
  })

  it('counts every conjugation combination', () => {
    expect(availableCount({ type: 'conjugation' })).toBe(verbs.length * TABLE_TENSES.length * 5)
  })

  it('offers the answer plus distractors, shuffled, without duplicates', () => {
    for (const t of createLesson({ type: 'choice' }, LESSON_SIZE, seeded(6))) {
      if (t.kind !== 'choice') throw new Error('wrong kind')
      expect(t.options).toContain(t.cloze.answer)
      expect(new Set(t.options).size).toBe(t.options.length)
      expect(t.options.length).toBe(1 + (t.cloze.distractors?.length ?? 0))
    }
  })

  it('shuffles builder tiles into a different order', () => {
    for (const t of createLesson({ type: 'builder' }, LESSON_SIZE, seeded(7))) {
      if (t.kind !== 'builder') throw new Error('wrong kind')
      expect(t.tiles.map((x) => x.text).sort()).toEqual([...t.expected].sort())
      expect(t.tiles.map((x) => x.text)).not.toEqual(t.expected)
    }
  })

  it('builds conjugation answers, incl. reflexive progresivo and irregular flag', () => {
    const llamarse = conjugationTask(verbById.get('llamarse')!, 'progresivo', 'yo')
    expect(llamarse.answer).toBe('me estoy llamando')
    expect(llamarse.irregular).toBe(false)
    expect(conjugationTask(verbById.get('tener')!, 'preterito', 'el')).toMatchObject({ answer: 'tuvo', irregular: true })
    expect(conjugationTask(verbById.get('ir')!, 'progresivo', 'yo')).toMatchObject({ answer: 'estoy yendo', irregular: true })
  })

  it('conjugates imperfecto and futuro, irregular ones flagged', () => {
    expect(conjugationTask(verbById.get('hablar')!, 'imperfecto', 'nosotros')).toMatchObject({ answer: 'hablábamos', irregular: false })
    expect(conjugationTask(verbById.get('vivir')!, 'imperfecto', 'ellos')).toMatchObject({ answer: 'vivían', irregular: false })
    expect(conjugationTask(verbById.get('ir')!, 'imperfecto', 'yo')).toMatchObject({ answer: 'iba', irregular: true })
    expect(conjugationTask(verbById.get('comer')!, 'futuro', 'tu')).toMatchObject({ answer: 'comerás', irregular: false })
    expect(conjugationTask(verbById.get('tener')!, 'futuro', 'el')).toMatchObject({ answer: 'tendrá', irregular: true })
    expect(conjugationTask(verbById.get('levantarse')!, 'futuro', 'yo').answer).toBe('me levantaré')
  })
})

describe('builderWords', () => {
  it('drops punctuation and lowercases the first word', () => {
    const s = sentences.find((x) => x.id === 's002')!
    expect(builderWords(s)).toEqual(['cómo', 'te', 'llamas'])
  })
})

describe('gradeTask', () => {
  it('grades typed cloze answers with checkAnswer', () => {
    const task = createLesson({ type: 'cloze' }, 1, seeded(9))[0]
    if (task.kind !== 'cloze') throw new Error('wrong kind')
    expect(gradeTask(task, task.cloze.answer.toLowerCase()).verdict).toBe('correct')
    expect(gradeTask(task, 'xyz').correct).toBe(false)
  })

  it('grades a wrong real verb form as wrong, not as a typo', () => {
    const task = conjugationTask(verbById.get('hablar')!, 'presente', 'ellos')
    expect(gradeTask(task, 'hablan').correct).toBe(true)
    expect(gradeTask(task, 'hablas').verdict).toBe('wrong')
  })

  it('rejects hablo for habló with an explanation', () => {
    const grade = gradeTask(conjugationTask(verbById.get('hablar')!, 'preterito', 'el'), 'hablo')
    expect(grade.verdict).toBe('wrong')
    expect(grade.check?.meanings).toEqual([
      { word: 'hablo', gloss: 'hablar · yo · presente' },
      { word: 'habló', gloss: 'hablar · él / ella / usted · pretérito' },
    ])
  })

  it('grades builder answers by tile order, whichever copy of a repeated word is used', () => {
    const task = taskFromItem('builder', 's054', seeded(11))
    if (!task || task.kind !== 'builder') throw new Error('task not found') // "mañana" appears twice
    const inOrder = (words: string[]) => {
      const unused = [...task.tiles]
      return words.map((word) => unused.splice(unused.findIndex((t) => t.text === word), 1)[0].id)
    }
    expect(gradeTask(task, inOrder(task.expected)).correct).toBe(true)
    expect(gradeTask(task, inOrder([...task.expected].reverse())).correct).toBe(false)
  })

  it('accepts a translation with an extra subject pronoun', () => {
    const task = taskFromItem('translation', 's004')
    if (!task || task.kind !== 'translation') throw new Error('task not found')
    expect(gradeTask(task, 'Yo hablo un poco de español').correct).toBe(true)
  })

  it('grades choice answers by exact option', () => {
    const task = createLesson({ type: 'choice' }, 1, seeded(13))[0]
    if (task.kind !== 'choice') throw new Error('wrong kind')
    expect(gradeTask(task, task.cloze.answer).correct).toBe(true)
    expect(gradeTask(task, task.options.find((o) => o !== task.cloze.answer)!).correct).toBe(false)
  })
})

describe('least-seen first', () => {
  it('puts items never answered before the ones already practised', () => {
    const all = createLesson({ type: 'translation' }, 1000, seeded(20)).map((t) => t.itemId)
    const fresh = new Set(all.slice(0, 4))
    const seen = new Map(all.filter((id) => !fresh.has(id)).map((id) => [id, 3]))
    const lesson = createLesson({ type: 'translation' }, LESSON_SIZE, seeded(21), seen)
    expect(new Set(itemIds(lesson).slice(0, 4))).toEqual(fresh)
  })
})

describe('taskFromItem', () => {
  it.each(['cloze', 'choice', 'conjugation', 'builder', 'translation'] as const)('rebuilds a %s task from its itemId', (type) => {
    for (const task of createLesson({ type }, LESSON_SIZE, seeded(22))) {
      const rebuilt = taskFromItem(type, task.itemId, seeded(23))
      expect(rebuilt?.kind).toBe(type)
      expect(rebuilt?.itemId).toBe(task.itemId)
      if (rebuilt && gradeTask(rebuilt, '').expected !== gradeTask(task, '').expected) throw new Error(`answer differs for ${task.itemId}`)
    }
  })

  it('returns undefined for unknown items', () => {
    expect(taskFromItem('cloze', 's999#0')).toBeUndefined()
    expect(taskFromItem('cloze', 's001#9')).toBeUndefined()
    expect(taskFromItem('conjugation', 'volar:presente:yo')).toBeUndefined()
    expect(taskFromItem('conjugation', 'tener:condicional:yo')).toBeUndefined()
  })
})

describe('mistakesLesson', () => {
  it('takes the most-missed items first and skips ones no longer in the data', () => {
    const m = (exercise: string, itemId: string, wrongCount: number, lastWrongAt = 1) => ({ exercise, itemId, wrongCount, lastWrongAt, firstWrongAt: 1 })
    const lesson = mistakesLesson(
      [m('cloze', 's001#0', 1), m('translation', 's004', 3), m('cloze', 's999#0', 5), m('conjugation', 'tener:preterito:yo', 2)],
      LESSON_SIZE,
      seeded(24),
    )
    expect(lesson.map((t) => `${t.kind}:${t.itemId}`)).toEqual(['translation:s004', 'conjugation:tener:preterito:yo', 'cloze:s001#0'])
  })
})

describe('retryTasks', () => {
  it('keeps the same items (in a new order)', () => {
    const tasks = createLesson({ type: 'builder' }, 3, seeded(14))
    const retry = retryTasks(tasks, seeded(15))
    expect(itemIds(retry).sort()).toEqual(itemIds(tasks).sort())
  })
})

describe('lookupForm', () => {
  it('describes verb forms and words from the dataset', () => {
    expect(lookupForm('habló')).toBe('hablar · él / ella / usted · pretérito')
    expect(lookupForm('hablábamos')).toBe('hablar · nosotros · imperfecto')
    expect(lookupForm('tendrás')).toBe('tener · tú · futuro')
    expect(lookupForm('fui')).toContain('alebo')
    expect(lookupForm('papa')).toBe('zemiak')
    expect(lookupForm('cafe')).toBeUndefined()
  })
})
