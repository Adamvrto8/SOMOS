import { describe, expect, it } from 'vitest'
import { sentences, verbById, verbs } from '../data'
import {
  availableCount,
  builderWords,
  canRetry,
  conjugationTask,
  createLesson,
  createNumberedLesson,
  getNumberedLessonCount,
  gradeTask,
  LESSON_SIZE,
  mistakesLesson,
  retryTasks,
  skipSpeaking,
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
  it.each(['cloze', 'choice', 'conjugation', 'builder', 'translation', 'vocab', 'dictation', 'speaking'] as const)('builds a %s lesson of LESSON_SIZE unique items', (type) => {
    const tasks = createLesson({ type }, LESSON_SIZE, seeded(1))
    expect(tasks).toHaveLength(LESSON_SIZE)
    expect(new Set(itemIds(tasks)).size).toBe(LESSON_SIZE)
    expect(tasks.every((t) => t.kind === type)).toBe(true)
  })

  it.each(['dictation', 'speaking'] as const)('leaves sentences with digits out of %s', (type) => {
    const ids = itemIds(createLesson({ type }, 1000, seeded(30)))
    expect(ids).not.toContain('s479')
    expect(ids).toHaveLength(sentences.filter((s) => !/\d/.test(s.es)).length)
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

  it('grades dictation against the exact sentence', () => {
    const task = taskFromItem('dictation', 's004')
    if (!task || task.kind !== 'dictation') throw new Error('task not found')
    expect(gradeTask(task, 'Hablo un poco de español').verdict).toBe('correct')
    expect(gradeTask(task, 'hablo un poco de espanol').correct).toBe(true) // accent + ñ only
    expect(gradeTask(task, 'Yo hablo un poco de español').correct).toBe(false) // not what was said
  })

  it('says which words of a wrong sentence to fix', () => {
    const task = taskFromItem('dictation', 's004') // "Hablo un poco de español."
    if (!task || task.kind !== 'dictation') throw new Error('task not found')
    expect(gradeTask(task, 'hablo un poko español').diff?.map((p) => p.state)).toEqual(['ok', 'ok', 'wrong', 'missing', 'ok'])
    expect(gradeTask(task, 'hablo un poco de español').diff).toBeUndefined()
  })

  it('repeats a wrong answer back, so each new try shows what was checked', () => {
    const wrong = [{ text: 'hablas', state: 'wrong' }]
    expect(gradeTask(conjugationTask(verbById.get('hablar')!, 'presente', 'ellos'), 'hablas').diff).toEqual(wrong)
    // Several accepted answers: nothing to line the words up with, the answer is wrong as a whole.
    const vocab = taskFromItem('vocab', 'de-nada:es-sk')
    if (!vocab) throw new Error('task not found')
    expect(gradeTask(vocab, '  nic   sa nestalo ').diff).toEqual([{ text: 'nic sa nestalo', state: 'wrong' }])
    expect(gradeTask(vocab, 'nie je za čo').diff).toBeUndefined()
  })

  it.each([
    ['cloze', true],
    ['conjugation', true],
    ['translation', true],
    ['vocab', true],
    ['dictation', true],
    ['choice', true],
    ['builder', true],
    ['speaking', false], // has its own three recordings
  ] as const)('lets a wrong %s answer be fixed: %s', (type, retry) => {
    expect(canRetry(createLesson({ type }, 1, seeded(5))[0])).toBe(retry)
  })

  it('says which tiles of a wrong sentence are out of place', () => {
    const task = taskFromItem('builder', 's004', seeded(11)) // "Hablo un poco de español."
    if (!task || task.kind !== 'builder') throw new Error('task not found')
    const id = (word: string) => task.tiles.find((t) => t.text === word)!.id
    const ids = (sentence: string) => sentence.split(' ').map(id)
    // One word moved: only that one, the rest are in the right order among themselves.
    expect(gradeTask(task, ids('español hablo un poco de')).misplaced).toEqual([id('español')])
    expect(gradeTask(task, ids('hablo poco un de español')).misplaced).toHaveLength(1)
    expect(gradeTask(task, ids('hablo un poco de español')).misplaced).toBeUndefined()
  })

  it('repeats a wrong option back, so it can be taken out of the choice', () => {
    const task = createLesson({ type: 'choice' }, 1, seeded(13))[0]
    if (task.kind !== 'choice') throw new Error('wrong kind')
    const wrong = task.options.find((o) => o !== task.cloze.answer)!
    expect(gradeTask(task, wrong).diff).toEqual([{ text: wrong, state: 'wrong' }])
    expect(gradeTask(task, task.cloze.answer).diff).toBeUndefined()
  })

  it('accepts digits typed in a dictation', () => {
    const task = taskFromItem('dictation', 's174') // "Son las ocho y cuarto."
    if (!task || task.kind !== 'dictation') throw new Error('task not found')
    expect(gradeTask(task, 'Son las 8 y cuarto').correct).toBe(true)
    expect(gradeTask(task, 'son las 8:15').correct).toBe(true)
    expect(gradeTask(task, 'Son las 9 y cuarto').correct).toBe(false)
  })

  it('grades speaking word by word, lenient by one word', () => {
    const task = taskFromItem('speaking', 's004') // "Hablo un poco de español." (5 words)
    if (!task || task.kind !== 'speaking') throw new Error('task not found')
    expect(gradeTask(task, 'hablo un poco de espanol')).toMatchObject({ correct: true, verdict: 'correct' })
    const almost = gradeTask(task, 'hablo un poco de')
    expect(almost).toMatchObject({ correct: true, verdict: 'typo' })
    expect(almost.speech?.missed).toBe(1)
    expect(gradeTask(task, 'hablo poco')).toMatchObject({ correct: false, verdict: 'wrong' })
  })

  it('grades choice answers by exact option', () => {
    const task = createLesson({ type: 'choice' }, 1, seeded(13))[0]
    if (task.kind !== 'choice') throw new Error('wrong kind')
    expect(gradeTask(task, task.cloze.answer).correct).toBe(true)
    expect(gradeTask(task, task.options.find((o) => o !== task.cloze.answer)!).correct).toBe(false)
  })

  it('grades vocab answers for both directions', () => {
    const toEs = taskFromItem('vocab', 'perro:sk-es')
    if (!toEs || toEs.kind !== 'vocab') throw new Error('task not found')
    expect(gradeTask(toEs, 'perro').correct).toBe(true)
    expect(gradeTask(toEs, 'el perro').correct).toBe(true)
    expect(gradeTask(toEs, 'gato').correct).toBe(false)

    const toSk = taskFromItem('vocab', 'perro:es-sk')
    if (!toSk || toSk.kind !== 'vocab') throw new Error('task not found')
    expect(gradeTask(toSk, 'pes').correct).toBe(true)
    expect(gradeTask(toSk, 'mačka').correct).toBe(false)
  })

  it.each([
    ['como-te-va', 'ako sa darí', true], // a phrase may drop "ti"
    ['como-te-va', 'ako sa ti darí', true],
    ['mande', 'prosím', true], // "(keď si nepočul)" is an explanation
    ['cincuenta', '50', true],
    ['cincuenta', '60', false],
    ['mil', '1000', true],
    ['llamarse', 'volať', false], // "volať" alone is llamar
  ])('accepts natural Slovak answers: %s ← "%s"', (id, typed, correct) => {
    const task = taskFromItem('vocab', `${id}:es-sk`)
    if (!task || task.kind !== 'vocab') throw new Error('task not found')
    expect(gradeTask(task, typed).correct).toBe(correct)
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
  it.each(['cloze', 'choice', 'conjugation', 'builder', 'translation', 'vocab', 'dictation', 'speaking'] as const)('rebuilds a %s task from its itemId', (type) => {
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

describe('mistakesLesson without a microphone', () => {
  it('leaves speaking mistakes out when speech recognition is missing', () => {
    const m = (exercise: string, itemId: string) => ({ exercise, itemId, wrongCount: 1, lastWrongAt: 1, firstWrongAt: 1 })
    const mistakes = [m('speaking', 's004'), m('cloze', 's001#0')]
    expect(mistakesLesson(mistakes, LESSON_SIZE, seeded(25)).map((t) => t.kind)).toContain('speaking')
    expect(mistakesLesson(mistakes, LESSON_SIZE, seeded(25), false).map((t) => t.kind)).toEqual(['cloze'])
  })
})

describe('skipSpeaking', () => {
  const task = (exercise: 'speaking' | 'cloze' | 'translation', itemId: string) => taskFromItem(exercise, itemId)!
  const tasks = [task('cloze', 's001#0'), task('speaking', 's004'), task('translation', 's004'), task('speaking', 's005')]

  it('keeps the answered tasks and drops only the speaking ones ahead', () => {
    expect(skipSpeaking(tasks, 1).map((t) => t.kind)).toEqual(['cloze', 'translation'])
  })

  it('ends a speaking-only lesson where it is', () => {
    const speakingOnly = [task('speaking', 's004'), task('speaking', 's005'), task('speaking', 's006')]
    expect(skipSpeaking(speakingOnly, 1)).toEqual(speakingOnly.slice(0, 1))
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

describe('createNumberedLesson', () => {
  it('creates stable tasks for each lesson number', () => {
    const filter = { type: 'cloze' as const, topic: 'basics' }
    const count = getNumberedLessonCount(filter)
    expect(count).toBeGreaterThan(0)

    const lesson1AttemptA = createNumberedLesson(filter, 1, seeded(1))
    const lesson1AttemptB = createNumberedLesson(filter, 1, seeded(2))

    // The set of items in lesson 1 must be identical across attempts
    expect(itemIds(lesson1AttemptA).sort()).toEqual(itemIds(lesson1AttemptB).sort())
    expect(lesson1AttemptA).toHaveLength(LESSON_SIZE)

    if (count > 1) {
      const lesson2 = createNumberedLesson(filter, 2, seeded(3))
      // Lesson 2 must have different tasks from Lesson 1
      const ids1 = new Set(itemIds(lesson1AttemptA))
      const ids2 = new Set(itemIds(lesson2))
      // Not identical
      expect(Array.from(ids1).sort()).not.toEqual(Array.from(ids2).sort())
    }
  })

  it('creates deterministically mixed tasks across topics when topic is all', () => {
    const filter = { type: 'vocab' as const, topic: 'all' }
    const count = getNumberedLessonCount(filter)
    expect(count).toBeGreaterThan(1)

    const lesson1AttemptA = createNumberedLesson(filter, 1, seeded(1))
    const lesson1AttemptB = createNumberedLesson(filter, 1, seeded(2))

    // Set of items in lesson 1 must be identical across attempts
    expect(itemIds(lesson1AttemptA).sort()).toEqual(itemIds(lesson1AttemptB).sort())
    expect(lesson1AttemptA).toHaveLength(LESSON_SIZE)

    // Lesson 1 must contain words from multiple topics (mixed)
    const topicsInLesson1 = new Set(
      lesson1AttemptA.flatMap((t) => (t.kind === 'vocab' ? t.word.topics : [])),
    )
    expect(topicsInLesson1.size).toBeGreaterThan(1)

    // Lesson 2 must not repeat any items from Lesson 1
    const lesson2 = createNumberedLesson(filter, 2, seeded(3))
    const ids1 = new Set(itemIds(lesson1AttemptA))
    for (const task of lesson2) {
      expect(ids1.has(task.itemId)).toBe(false)
    }
  })

  it.each(['all', 'food'])('asks every word of topic %s once, in one direction', (topic) => {
    const filter = { type: 'vocab' as const, topic, level: 'A1' as const }
    const all = Array.from({ length: getNumberedLessonCount(filter) }, (_, i) => createNumberedLesson(filter, i + 1, seeded(i))).flat()
    const tasks = [...new Map(all.map((t) => [t.itemId, t])).values()] // the last lesson overlaps the one before
    const wordIds = tasks.map((t) => (t.kind === 'vocab' ? t.word.id : ''))
    expect(new Set(wordIds).size).toBe(wordIds.length)
    expect(wordIds).toHaveLength(availableCount(filter))
    expect(new Set(tasks.map((t) => (t.kind === 'vocab' ? t.direction : ''))).size).toBe(2)
  })

  it('mixes the persons in the lessons of one tense', () => {
    const filter = { type: 'conjugation' as const, tense: 'presente' as const, level: 'A1' as const }
    const a1Verbs = verbs.filter((v) => v.level === 'A1')
    const persons = (tasks: Task[]) => tasks.map((t) => (t.kind === 'conjugation' ? t.person : ''))

    for (const lessonNumber of [1, 2]) {
      const lesson = createNumberedLesson(filter, lessonNumber, seeded(lessonNumber))
      expect(new Set(lesson.map((t) => (t.kind === 'conjugation' ? t.verb.id : ''))).size).toBe(LESSON_SIZE)
      // Each of the 5 persons twice.
      for (const person of ['yo', 'tu', 'el', 'nosotros', 'ellos']) {
        expect(persons(lesson).filter((p) => p === person)).toHaveLength(2)
      }
    }

    // Every verb still comes in every person, once.
    const all = Array.from({ length: getNumberedLessonCount(filter) }, (_, i) => createNumberedLesson(filter, i + 1, seeded(i))).flat()
    expect(new Set(itemIds(all)).size).toBe(a1Verbs.length * 5)
  })

  it('creates deterministically mixed tasks for sentences when topic is all', () => {
    const filter = { type: 'translation' as const, topic: 'all' }
    const lesson1AttemptA = createNumberedLesson(filter, 1, seeded(1))
    const lesson1AttemptB = createNumberedLesson(filter, 1, seeded(2))
    expect(itemIds(lesson1AttemptA).sort()).toEqual(itemIds(lesson1AttemptB).sort())

    const lesson2 = createNumberedLesson(filter, 2, seeded(3))
    const ids1 = new Set(itemIds(lesson1AttemptA))
    for (const task of lesson2) {
      expect(ids1.has(task.itemId)).toBe(false)
    }
  })
})

