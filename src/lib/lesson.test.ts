import { describe, expect, it } from 'vitest'
import { sentenceById, sentences, topics, verbById, verbs, wordById } from '../data'
import type { Level } from '../data/types'
import { checkAnswer } from './checkAnswer'
import { taskSubject } from './contentReport'
import {
  availableCount,
  builderWords,
  canRetry,
  conjugationTask,
  createLesson,
  createNumberedLesson,
  findMistakeTask,
  getNumberedLessonCount,
  getStablePool,
  gradeTask,
  LESSON_SIZE,
  lessonSizeOf,
  matchingTask,
  matchingTopics,
  MATCHING_MAX_WRONG,
  MATCHING_SIZE,
  mistakesLesson,
  retryTasks,
  skipSpeaking,
  spreadRepeats,
  synonymsOf,
  taskFromItem,
  trueFalseTask,
  vocabTask,
  type ConjugationTask,
  type Task,
} from './lesson'
import { personsOf, TABLE_TENSES } from './conjugate'
import { lookupForm } from './knownForms'

// Deterministic pseudo-random generator for reproducible lessons.
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const itemIds = (tasks: Task[]) => tasks.map((t) => t.itemId)

describe('createLesson seen counts for truefalse / findmistake', () => {
  it.each([
    ['truefalse', (id: string) => `${id}:t`],
    ['findmistake', (id: string) => `${id}:2`],
  ] as const)('puts an unseen sentence of a %s lesson before the seen ones', (type, suffixed) => {
    const filter = { type, level: 'A1' as const }
    const all = createLesson(filter, Number.MAX_SAFE_INTEGER, seeded(5))
    const keys = [...new Set(all.map((t) => t.itemId.replace(/:.*$/, '')))]
    expect(keys.length).toBeGreaterThan(3)
    const unseen = keys[0]
    // every blank of every other sentence counts as seen (one sentence can offer several blanks)
    const seen = new Map<string, number>()
    for (const sentence of sentences) {
      if (sentence.id === unseen.split('#')[0]) continue
      sentence.cloze?.forEach((_, i) => seen.set(suffixed(`${sentence.id}#${i}`), 3))
    }
    for (const seed of [1, 2, 3]) {
      const first = createLesson(filter, 1, seeded(seed), seen)[0]
      expect(first.itemId.replace(/:.*$/, '')).toBe(unseen)
    }
  })
})

describe('createLesson', () => {
  it.each(['cloze', 'choice', 'conjugation', 'builder', 'translation', 'vocab', 'dictation', 'speaking', 'truefalse', 'findmistake', 'matching'] as const)('builds a %s lesson of lessonSizeOf unique items', (type) => {
    const size = lessonSizeOf(type)
    const tasks = createLesson({ type }, size, seeded(1))
    expect(tasks).toHaveLength(size)
    expect(new Set(itemIds(tasks)).size).toBe(size)
    expect(tasks.every((t) => t.kind === type)).toBe(true)
  })

  it.each(['dictation', 'speaking'] as const)('leaves sentences with digits out of %s', (type) => {
    const ids = itemIds(createLesson({ type }, Number.MAX_SAFE_INTEGER, seeded(30)))
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
    // Every topic has two lessons of sentences at every level; its words are fewer at places (no A1 tech words).
    const count = availableCount({ type: 'vocab', topic: 'hobbies', level: 'B2' })
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(LESSON_SIZE)
    expect(createLesson({ type: 'vocab', topic: 'hobbies', level: 'B2' }, LESSON_SIZE, seeded(5))).toHaveLength(count)
    expect(createLesson({ type: 'vocab', topic: 'tech', level: 'A1' }, LESSON_SIZE, seeded(5))).toHaveLength(0)
  })

  it('counts every conjugation combination', () => {
    const perVerb = TABLE_TENSES.reduce((n, t) => n + personsOf(t).length, 0)
    expect(availableCount({ type: 'conjugation' })).toBe(verbs.length * perVerb)
  })

  it('asks "all tenses" only up to the level', () => {
    const tensesOf = (level: Level) => new Set(getStablePool({ type: 'conjugation', tense: 'all', level }).map((t) => (t as ConjugationTask).tense))
    expect([...tensesOf('A1')].sort()).toEqual(['futuro', 'imperfecto', 'presente', 'preterito', 'progresivo'])
    expect(tensesOf('A2').has('imperativo')).toBe(true)
    expect(tensesOf('B1').has('subjuntivo')).toBe(true)
    expect(tensesOf('B1').has('subjImperfecto')).toBe(false)
    expect(tensesOf('B2').has('subjImperfecto')).toBe(true)
  })

  it('keeps the A1 drill as it was: five tenses, five persons', () => {
    const pool = getStablePool({ type: 'conjugation', tense: 'all', level: 'A1' })
    expect(pool).toHaveLength(verbs.filter((v) => v.level === 'A1').length * 5 * 5)
  })

  it('drills a chosen tense at any level', () => {
    const pool = getStablePool({ type: 'conjugation', tense: 'subjuntivo', level: 'A1' }) as ConjugationTask[]
    expect(pool.length).toBeGreaterThan(0)
    expect(pool.every((t) => t.tense === 'subjuntivo')).toBe(true)
  })

  it('drills the imperative without yo, and rebuilds its tasks from ids', () => {
    const pool = getStablePool({ type: 'conjugation', tense: 'imperativo', level: 'A1' }) as ConjugationTask[]
    expect(pool.length).toBeGreaterThan(0)
    expect(pool.some((t) => t.person === 'yo')).toBe(false)
    expect(taskFromItem('conjugation', 'decir:imperativo:tu')).toMatchObject({ answer: 'di' })
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
    // Spain's vosotros (the drill asks it only there; the task itself works from the stored forms).
    expect(conjugationTask(verbById.get('tener')!, 'preterito', 'vosotros')).toMatchObject({ itemId: 'tener:preterito:vosotros', answer: 'tuvisteis', irregular: true })
    expect(conjugationTask(verbById.get('levantarse')!, 'perfecto', 'vosotros').answer).toBe('os habéis levantado')
    expect(conjugationTask(verbById.get('sentarse')!, 'imperativo', 'vosotros').answer).toBe('sentaos')
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

  it('says which tiles of a wrong sentence sit in a wrong slot', () => {
    const task = taskFromItem('builder', 's004', seeded(11)) // "Hablo un poco de español."
    if (!task || task.kind !== 'builder') throw new Error('task not found')
    const id = (word: string) => (word === '_' ? '' : task.tiles.find((t) => t.text === word)!.id)
    const ids = (sentence: string) => sentence.split(' ').map(id)
    // Slot by slot: the words that are right stay, only the two swapped ones have to change places.
    expect(gradeTask(task, ids('hablo poco un de español')).misplaced).toEqual(ids('poco un'))
    expect(gradeTask(task, ids('español hablo un poco de')).misplaced).toEqual(ids('español hablo un poco de'))
    expect(gradeTask(task, ids('hablo un poco de español')).misplaced).toBeUndefined()
    // A slot left open is wrong, but there is no tile in it to mark.
    expect(gradeTask(task, ids('hablo _ poco de español'))).toMatchObject({ correct: false, misplaced: [] })
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
    const all = createLesson({ type: 'translation' }, Number.MAX_SAFE_INTEGER, seeded(20)).map((t) => t.itemId)
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
    expect(taskFromItem('cloze', 's9999#0')).toBeUndefined()
    expect(taskFromItem('cloze', 's001#9')).toBeUndefined()
    expect(taskFromItem('conjugation', 'volar:presente:yo')).toBeUndefined()
    expect(taskFromItem('conjugation', 'tener:pasado:yo')).toBeUndefined()
    expect(taskFromItem('conjugation', 'decir:imperativo:yo')).toBeUndefined()
  })
})

describe('mistakesLesson', () => {
  it('takes the most-missed items first and skips ones no longer in the data', () => {
    const m = (exercise: string, itemId: string, wrongCount: number, lastWrongAt = 1) => ({ exercise, itemId, wrongCount, lastWrongAt, firstWrongAt: 1 })
    const lesson = mistakesLesson(
      [m('cloze', 's001#0', 1), m('translation', 's004', 3), m('cloze', 's9999#0', 5), m('conjugation', 'tener:preterito:yo', 2)],
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

  it('knows the B1–B2 forms, so an accent that makes another form is wrong', () => {
    expect(lookupForm('tenga')).toContain('subjuntivo')
    expect(lookupForm('levántate')).toContain('imperativo')
    expect(lookupForm('hecho')).toContain('participio')
    expect(checkAnswer('hablé', 'hable', { lookup: lookupForm }).verdict).toBe('wrong')
    expect(checkAnswer('este', 'esté', { lookup: lookupForm }).verdict).toBe('wrong')
    expect(checkAnswer('tuvieramos', 'tuviéramos', { lookup: lookupForm }).verdict).not.toBe('wrong')
  })

  it('knows a form only from the level of its tense, so A1 keeps the accent warning', () => {
    expect(lookupForm('estudiara', 'A1')).toBeUndefined()
    expect(lookupForm('estudiara', 'B2')).toContain('subj. imperfecto')
    expect(lookupForm('estudiara')).toContain('subj. imperfecto')
    const futuro = conjugationTask(verbById.get('estudiar')!, 'futuro', 'el')
    expect(gradeTask(futuro, 'estudiara').verdict).toBe('accent')
    const preterito = conjugationTask(verbById.get('hablar')!, 'preterito', 'yo')
    expect(gradeTask(preterito, 'hable').verdict).toBe('accent')
    const subjuntivo = conjugationTask(verbById.get('hablar')!, 'subjuntivo', 'yo')
    expect(gradeTask(subjuntivo, 'hablé').verdict).toBe('wrong')
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


describe('articles', () => {
  it('are never vocab tasks, not even from the mistakes list', () => {
    const all = createLesson({ type: 'vocab', topic: 'basics', level: 'A1' }, Number.MAX_SAFE_INTEGER, seeded(1))
    expect(all.map((t) => (t.kind === 'vocab' ? t.word.id : '')).filter((id) => ['el', 'la', 'un', 'una'].includes(id))).toEqual([])
    expect(taskFromItem('vocab', 'el:es-sk')).toBeUndefined()
    expect(taskFromItem('vocab', 'un:sk-es')).toBeUndefined()
  })
})

describe('same translation', () => {
  const word = (id: string) => {
    const w = wordById.get(id)
    if (!w) throw new Error(`no word ${id}`)
    return w
  }

  it('accepts a synonym towards Spanish ("otec": padre, papá)', () => {
    expect(synonymsOf(word('padre')).map((w) => w.id)).toContain('papa-2')
    const task = vocabTask(word('padre'), 'sk-es')
    expect(gradeTask(task, 'papá').correct).toBe(true)
    expect(gradeTask(task, 'el papá').correct).toBe(true)
    expect(gradeTask(task, 'madre').correct).toBe(false)
  })

  it('tells ser and estar apart in the prompt', () => {
    expect(vocabTask(word('ser'), 'sk-es').prompt).not.toBe(vocabTask(word('estar'), 'sk-es').prompt)
    expect(synonymsOf(word('ser'))).toEqual([])
  })

  it('never puts two of them one after the other', () => {
    const tasks = [vocabTask(word('despues'), 'es-sk'), vocabTask(word('luego'), 'es-sk'), vocabTask(word('perro'), 'es-sk')]
    expect(spreadRepeats(tasks).map((t) => t.itemId)).toEqual(['despues:es-sk', 'perro:es-sk', 'luego:es-sk'])
  })

  it('keeps only one of them in a vocab lesson', () => {
    const lesson = createLesson({ type: 'vocab', topic: 'time', level: 'A1' }, Number.MAX_SAFE_INTEGER, seeded(3))
    const ids = lesson.map((t) => (t.kind === 'vocab' ? t.word.id : ''))
    expect(ids.includes('despues') && ids.includes('luego')).toBe(false)
  })

  it('stay apart after a retry shuffle', () => {
    const tasks = [vocabTask(word('despues'), 'es-sk'), vocabTask(word('luego'), 'es-sk'), vocabTask(word('perro'), 'es-sk'), vocabTask(word('gato'), 'es-sk')]
    for (let seed = 1; seed < 30; seed++) {
      const ids = retryTasks(tasks, seeded(seed)).map((t) => t.itemId)
      expect(Math.abs(ids.indexOf('despues:es-sk') - ids.indexOf('luego:es-sk'))).toBeGreaterThan(1)
    }
  })
})

describe('numbered lessons of different exercise types', () => {
  // A topic has about 20 sentences of a level, so some are shared; before, lesson 1 was the same 10 in every type.
  it('ask mostly different sentences of a topic, not the same ones in another form', () => {
    for (const type of ['choice', 'builder', 'translation', 'dictation'] as const) {
      let shared = 0
      for (const topic of topics) {
        const ids = (t: typeof type | 'cloze') =>
          createNumberedLesson({ type: t, topic: topic.id, level: 'A1' }, 1, seeded(1)).map((task) => ('sentence' in task ? task.sentence.id : ''))
        const cloze = new Set(ids('cloze'))
        shared += ids(type).filter((id) => cloze.has(id)).length
      }
      expect(shared / topics.length, type).toBeLessThan(LESSON_SIZE * 0.7)
    }
  })
})

describe('truefalse', () => {
  it('shows the sentence as it is, or with one word swapped', () => {
    const sentence = sentenceById.get('s372')! // Quiero un café sin azúcar.
    const real = trueFalseTask(sentence, 0, true)!
    const fake = trueFalseTask(sentence, 0, false, 0)!
    expect(real.itemId).toBe('s372#0:t')
    expect(real.corrupted).toBeUndefined()
    expect(fake.itemId).toBe('s372#0:f0')
    expect(fake.corrupted!.es).toBe('Quiero un café con azúcar.')
  })

  it('is graded by the swipe: right = pravda, left = nepravda', () => {
    const sentence = sentenceById.get('s372')!
    const real = trueFalseTask(sentence, 0, true)!
    const fake = trueFalseTask(sentence, 0, false, 0)!
    expect(gradeTask(real, 'true').correct).toBe(true)
    expect(gradeTask(real, 'false').correct).toBe(false)
    expect(gradeTask(fake, 'false').correct).toBe(true)
    expect(gradeTask(fake, 'true').correct).toBe(false)
    expect(gradeTask(fake, 'true').expected).toBe(sentence.es)
  })

  it('has no second try', () => {
    expect(canRetry(trueFalseTask(sentenceById.get('s372')!, 0, true)!)).toBe(false)
  })

  it('gives both truths in a lesson and one blank per sentence', () => {
    const tasks = createLesson({ type: 'truefalse' }, 40, seeded(5))
    const truths = tasks.map((t) => (t.kind === 'truefalse' ? t.truth : undefined))
    expect(truths).toContain(true)
    expect(truths).toContain(false)
    const ids = tasks.map((t) => (t.kind === 'truefalse' ? t.sentence.id : ''))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('is rebuilt from its item id, and a stale id gives nothing', () => {
    for (const task of createLesson({ type: 'truefalse' }, 30, seeded(6))) {
      const again = taskFromItem('truefalse', task.itemId)
      expect(again?.itemId).toBe(task.itemId)
      if (task.kind === 'truefalse' && again?.kind === 'truefalse') expect(again.corrupted?.es).toBe(task.corrupted?.es)
    }
    for (const stale of ['nope#0:t', 's372#9:t', 's372#0:f9', 's372#0:x', 'garbage', '', 's372#0:f-1']) {
      expect(taskFromItem('truefalse', stale), stale).toBeUndefined()
    }
  })

  it('has a stable pool for numbered lessons, with both truths', () => {
    const a = getStablePool({ type: 'truefalse', level: 'A1' })
    const b = getStablePool({ type: 'truefalse', level: 'A1' })
    expect(itemIds(a)).toEqual(itemIds(b))
    const truths = new Set(a.map((t) => t.kind === 'truefalse' && t.truth))
    expect(truths.size).toBe(2)
    expect(availableCount({ type: 'truefalse', level: 'A1' })).toBeGreaterThanOrEqual(a.length)
  })

  it('is reported with a detail the server accepts', () => {
    for (const task of createLesson({ type: 'truefalse' }, 20, seeded(7))) {
      const subject = taskSubject(task)
      expect(subject.exercise).toBe('truefalse')
      expect(subject.target).toMatch(/^sentence:[a-z0-9ñ-]{1,60}$/)
      expect(subject.detail).toMatch(/^[a-z0-9:-]{0,40}$/)
      if (task.kind === 'truefalse') expect(subject.shown.es).toBe(task.corrupted?.es ?? task.sentence.es)
    }
  })

  it('is rebuilt from mistakes like any other type', () => {
    const task = createLesson({ type: 'truefalse' }, 1, seeded(8))[0]
    const lesson = mistakesLesson([{ exercise: 'truefalse', itemId: task.itemId, wrongCount: 1, lastWrongAt: 1 }])
    expect(itemIds(lesson)).toEqual([task.itemId])
  })
})

describe('findmistake', () => {
  const sentence = sentenceById.get('s372')! // Quiero un café sin azúcar. (sin: con, para, por)
  const task = () => findMistakeTask(sentence, 0, 0, () => 0.5)!

  it('swaps one word and offers the right one among the options', () => {
    const t = task()
    expect(t.itemId).toBe('s372#0:0')
    expect(t.corrupted.index).toBe(3)
    expect(t.corrupted.right).toBe('sin')
    expect(t.options).toContain('sin')
    expect(t.options).not.toContain('con') // the word that stands in the sentence now
    expect(new Set(t.options).size).toBe(t.options.length)
    expect(t.options.length).toBeLessThanOrEqual(4)
  })

  it('keeps the options in one casing and free of duplicates', () => {
    const pool = getStablePool({ type: 'findmistake' }).filter((t) => t.kind === 'findmistake')
    expect(pool.length).toBeGreaterThan(100)
    const initial = pool.find((t) => t.kind === 'findmistake' && /^\p{Lu}/u.test(t.corrupted.right))
    expect(initial).toBeDefined()
    for (const t of pool) {
      if (t.kind !== 'findmistake') continue
      const capitals = t.options.filter((o) => /^\p{Lu}/u.test(o)).length
      expect(capitals === 0 || capitals === t.options.length, t.itemId).toBe(true)
      expect(new Set(t.options.map((o) => o.toLowerCase())).size, t.itemId).toBe(t.options.length)
    }
  })

  it('drops a distractor that repeats the answer or another distractor', () => {
    const base = sentenceById.get('s372')!
    const cloze = base.cloze![0]
    const dup = { ...base, cloze: [{ ...cloze, distractors: ['con', 'Sin', 'para', 'PARA', 'por'] }, ...base.cloze!.slice(1)] }
    const t = findMistakeTask(dup, 0, 0, () => 0.5)!
    expect(t.options.filter((o) => o === 'sin')).toHaveLength(1)
    expect(new Set(t.options.map((o) => o.toLowerCase())).size).toBe(t.options.length)
  })

  it('is right only with the right word and the right fix', () => {
    const t = task()
    expect(gradeTask(t, ['3', 'sin']).correct).toBe(true)
    expect(gradeTask(t, ['3', 'para']).correct).toBe(false)
    expect(gradeTask(t, ['1', 'sin']).correct).toBe(false)
    expect(gradeTask(t, ['1', '']).correct).toBe(false) // gave up after two wrong taps
    expect(gradeTask(t, '').correct).toBe(false)
    expect(gradeTask(t, ['3', 'sin']).expected).toBe(sentence.es)
  })

  it('has no second try and reshuffles its options', () => {
    const t = task()
    expect(canRetry(t)).toBe(false)
    const again = retryTasks([t], seeded(3))[0]
    expect(again.kind === 'findmistake' && [...again.options].sort()).toEqual([...t.options].sort())
  })

  it('is rebuilt from its item id, and a stale id gives nothing', () => {
    for (const t of createLesson({ type: 'findmistake' }, 30, seeded(9))) {
      const again = taskFromItem('findmistake', t.itemId)
      expect(again?.itemId).toBe(t.itemId)
      if (t.kind === 'findmistake' && again?.kind === 'findmistake') expect(again.corrupted.es).toBe(t.corrupted.es)
    }
    for (const stale of ['nope#0:0', 's372#9:0', 's372#0:9', 's372#0', 'garbage', '', 's372#0:t']) {
      expect(taskFromItem('findmistake', stale), stale).toBeUndefined()
    }
  })

  it('has a stable pool and is reported with a detail the server accepts', () => {
    const a = getStablePool({ type: 'findmistake', level: 'A1' })
    expect(itemIds(a)).toEqual(itemIds(getStablePool({ type: 'findmistake', level: 'A1' })))
    expect(a.length).toBeGreaterThan(10)
    for (const t of createLesson({ type: 'findmistake' }, 20, seeded(10))) {
      const subject = taskSubject(t)
      expect(subject.exercise).toBe('findmistake')
      expect(subject.detail).toMatch(/^[a-z0-9:-]{0,40}$/)
      if (t.kind === 'findmistake') expect(subject.shown.es).toBe(t.corrupted.es)
    }
  })
})

describe('matching', () => {
  const round = () => ['casa', 'perro', 'agua', 'libro', 'mesa'].map((id) => wordById.get(id)!)

  it('has 5 pairs, a left and a right column in different orders, and a sorted item id', () => {
    const t = matchingTask(round(), seeded(2))
    expect(t.pairs).toHaveLength(MATCHING_SIZE)
    expect([...t.rightOrder].sort()).toEqual([0, 1, 2, 3, 4])
    expect(t.itemId).toBe(`m:${round().map((w) => w.id).sort().join(',')}`)
    expect(t.pairs.every((p) => p.sk.length > 0 && p.es.endsWith(p.word.es))).toBe(true)
  })

  it('is right with at most two wrong pairings and lists the words that were paired wrong', () => {
    const t = matchingTask(round(), seeded(3))
    expect(gradeTask(t, 'm:').correct).toBe(true)
    const two = gradeTask(t, 'm:casa,casa')
    expect(two.correct).toBe(true)
    expect(two.misplaced).toEqual(['casa'])
    const three = gradeTask(t, 'm:casa,perro,agua')
    expect(three.correct).toBe(false)
    expect(three.misplaced).toEqual(['casa', 'perro', 'agua'])
    expect(MATCHING_MAX_WRONG).toBe(2)
    expect(gradeTask(t, '').correct).toBe(false) // not an answer of this type
  })

  it('has no second try and reshuffles on retry', () => {
    const t = matchingTask(round(), seeded(4))
    expect(canRetry(t)).toBe(false)
    const again = retryTasks([t], seeded(5))[0]
    expect(again.itemId).toBe(t.itemId)
    expect(again.kind === 'matching' && again.pairs.map((p) => p.word.id).sort()).toEqual(t.pairs.map((p) => p.word.id).sort())
  })

  it('is rebuilt from its item id, and a stale id gives nothing', () => {
    const t = matchingTask(round(), seeded(6))
    expect(taskFromItem('matching', t.itemId)?.itemId).toBe(t.itemId)
    for (const stale of ['m:', 'm:casa', 'm:casa,nope', 'casa,perro', '', 'm:nope1,nope2']) {
      expect(taskFromItem('matching', stale), stale).toBeUndefined()
    }
  })

  it('makes rounds of 5 distinct words with different first translations, from one level and topic', () => {
    const pool = getStablePool({ type: 'matching', topic: 'all' })
    expect(pool.length).toBeGreaterThan(20)
    for (const t of pool) {
      if (t.kind !== 'matching') throw new Error('wrong kind')
      const words = t.pairs.map((p) => p.word)
      expect(new Set(words.map((w) => w.id)).size).toBe(MATCHING_SIZE)
      expect(new Set(words.map((w) => w.sk[0].toLowerCase())).size).toBe(MATCHING_SIZE)
      expect(new Set(words.map((w) => w.level)).size).toBe(1)
      expect(new Set(words.map((w) => w.topics[0])).size).toBe(1)
    }
  })

  it('gives lessons of 4 rounds and survives a topic with too few words', () => {
    const filter = { type: 'matching', topic: 'food', level: 'A1' } as const
    const pool = getStablePool(filter)
    expect(createNumberedLesson(filter, 1).length).toBe(Math.min(pool.length, lessonSizeOf('matching')))
    expect(getNumberedLessonCount(filter)).toBe(Math.ceil(pool.length / lessonSizeOf('matching')) || 0)
    expect(getStablePool({ type: 'matching', topic: 'nope' })).toEqual([])
    expect(getNumberedLessonCount({ type: 'matching', topic: 'nope' })).toBe(0)
  })

  it('has the topics all its words share, else all of them', () => {
    const t = matchingTask(round(), seeded(8))
    const shared = matchingTopics(t)
    expect(shared.length).toBeGreaterThan(0)
    const lists = t.pairs.map((p) => p.word.topics)
    expect(shared.every((topic) => lists.some((l) => l.includes(topic)))).toBe(true)
    const odd = { ...t, pairs: t.pairs.map((p, i) => ({ ...p, word: { ...p.word, topics: [`x${i}`] } })) }
    expect(matchingTopics(odd).sort()).toEqual(['x0', 'x1', 'x2', 'x3', 'x4'])
    const same = { ...t, pairs: t.pairs.map((p) => ({ ...p, word: { ...p.word, topics: ['a', `b${p.word.id}`] } })) }
    expect(matchingTopics(same)).toEqual(['a'])
  })

  it('is reported by its first word, with a detail the server accepts', () => {
    const subject = taskSubject(matchingTask(round(), seeded(7)))
    expect(subject.exercise).toBe('matching')
    expect(subject.target).toMatch(/^word:[a-z0-9ñ-]{1,60}$/)
    expect(subject.detail).toMatch(/^[a-z0-9:-]{0,40}$/)
  })
})
