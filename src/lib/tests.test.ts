import { describe, expect, it } from 'vitest'
import { topics } from '../data'
import type { Task } from './lesson'
import { lessonKey, type LessonProgressionMap } from './lessonProgress'
import {
  createTest,
  EXERCISE_TEST_SIZE,
  exerciseTestProgress,
  isTestUnlocked,
  nextGoal,
  hasTest,
  itemKey,
  LEVEL_EXAM_SIZE,
  parseTestKey,
  prepareLesson,
  TEST_LEVELS,
  testKey,
  testTenses,
  TOPIC_TEST_SIZE,
  topicTests,
  type TestId,
} from './tests'

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const kinds = (tasks: Task[]) => tasks.map((t) => t.kind)
const sentenceIds = (tasks: Task[]) => tasks.flatMap((t) => ('sentence' in t ? [t.sentence.id] : []))

describe('which tests exist', () => {
  it('has an exam for every level', () => {
    for (const level of TEST_LEVELS) expect(hasTest({ level })).toBe(true)
  })

  it('has a topic test only where the topic has enough content', () => {
    expect(hasTest({ level: 'A1', topic: 'food' })).toBe(true)
    expect(hasTest({ level: 'A1', topic: 'tech' })).toBe(false) // no A1 words or sentences
    expect(hasTest({ level: 'A1', topic: 'nope' })).toBe(false)
  })

  it('lists most topics at every level', () => {
    for (const level of TEST_LEVELS) expect(topicTests(level).length).toBeGreaterThan(topics.length / 2)
  })

  it('reads its keys back', () => {
    const ids: TestId[] = [{ level: 'A1' }, { level: 'B1', topic: 'work' }]
    for (const id of ids) expect(parseTestKey(testKey(id))).toEqual(id)
    expect(parseTestKey('C2')).toBeUndefined()
    expect(parseTestKey('tech:A1')).toBeUndefined()
  })
})

describe('createTest', () => {
  it.each(TEST_LEVELS)('builds a full %s exam with every type but speaking', (level) => {
    const tasks = createTest({ level }, seeded(3))
    expect(tasks).toHaveLength(LEVEL_EXAM_SIZE)
    expect(new Set(kinds(tasks))).toEqual(new Set(['vocab', 'choice', 'cloze', 'conjugation', 'builder', 'dictation', 'translation']))
  })

  it('builds a full test for every topic test', () => {
    for (const level of TEST_LEVELS) {
      for (const id of topicTests(level)) {
        const tasks = createTest(id, seeded(7))
        expect(tasks, testKey(id)).toHaveLength(TOPIC_TEST_SIZE)
        expect(new Set(tasks.map((t) => `${t.kind}|${t.itemId}`)).size, testKey(id)).toBe(TOPIC_TEST_SIZE)
      }
    }
  })

  it('never shows one sentence twice', () => {
    for (let seed = 1; seed < 20; seed++) {
      const ids = sentenceIds(createTest({ level: 'A1', topic: 'weather' }, seeded(seed)))
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('keeps the tasks grouped by type, easier types first', () => {
    const order = kinds(createTest({ level: 'A2' }, seeded(5)))
    const groups = order.filter((kind, i) => kind !== order[i - 1])
    expect(groups).toEqual(['vocab', 'choice', 'cloze', 'conjugation', 'builder', 'dictation', 'translation'])
  })

  it('asks only the tenses of the level', () => {
    expect(testTenses('A1')).not.toContain('futuro')
    for (let seed = 1; seed < 10; seed++) {
      const tenses = createTest({ level: 'A1' }, seeded(seed)).flatMap((t) => (t.kind === 'conjugation' ? [t.tense] : []))
      for (const tense of tenses) expect(testTenses('A1')).toContain(tense)
    }
  })

  it('draws a topic test from its topic', () => {
    const tasks = createTest({ level: 'A1', topic: 'food' }, seeded(9))
    for (const task of tasks) {
      if ('sentence' in task) expect(task.sentence.topics).toContain('food')
      if (task.kind === 'vocab') expect(task.word.topics).toContain('food')
    }
  })

  it('draws other tasks on another attempt', () => {
    const first = createTest({ level: 'A1', topic: 'food' }, seeded(1)).map((t) => t.itemId)
    const second = createTest({ level: 'A1', topic: 'food' }, seeded(2)).map((t) => t.itemId)
    expect(second).not.toEqual(first)
  })

  it('tops a small topic up from the level below', () => {
    // Pozdravy has no A2 sentences: its sentence tasks come from A1.
    const tasks = createTest({ level: 'A2', topic: 'greetings' }, seeded(4))
    expect(tasks).toHaveLength(TOPIC_TEST_SIZE)
    expect(tasks.some((t) => 'sentence' in t && t.sentence.level === 'A1')).toBe(true)
  })
})

describe('prepareLesson', () => {
  it('builds a mixed lesson of 10 tasks', () => {
    const tasks = prepareLesson({ level: 'A1', topic: 'food' }, new Set(), new Map(), seeded(1))
    expect(tasks).toHaveLength(10)
    expect(new Set(kinds(tasks)).size).toBeGreaterThan(4)
  })

  it('puts the mistakes first', () => {
    const test = createTest({ level: 'A1', topic: 'food' }, seeded(1))
    const vocab = test.find((t) => t.kind === 'vocab')!
    const tasks = prepareLesson({ level: 'A1', topic: 'food' }, new Set([itemKey(vocab.kind, vocab.itemId)]), new Map(), seeded(8))
    expect(tasks[0].itemId).toBe(vocab.itemId)
  })
})

describe('nextGoal', () => {
  it('starts with the first A1 topic', () => {
    expect(nextGoal(() => false)).toEqual({ level: 'A1', test: topicTests('A1')[0], passed: 0, total: topicTests('A1').length })
  })

  it('offers the exam once every topic of the level is passed', () => {
    const goal = nextGoal((key) => key.endsWith(':A1'))
    expect(goal?.test).toEqual({ level: 'A1' })
    expect(goal?.passed).toBe(goal?.total)
  })

  it('moves on to the next level after its exam, and ends after B1', () => {
    expect(nextGoal((key) => key === 'A1')?.level).toBe('A2')
    expect(nextGoal(() => true)).toBeUndefined()
  })
})

describe('one test', () => {
  it('never conjugates a verb that a cloze asks for', () => {
    for (let seed = 1; seed < 40; seed++) {
      const tasks = createTest({ level: 'A1', topic: 'food' }, seeded(seed))
      const lemmas = tasks.flatMap((t) => (t.kind === 'cloze' || t.kind === 'choice' ? [t.cloze.lemma] : []))
      const verbs = tasks.flatMap((t) => (t.kind === 'conjugation' ? [t.verb.id] : []))
      expect(verbs.filter((v) => lemmas.includes(v))).toEqual([])
      expect(new Set(lemmas).size).toBe(lemmas.length)
    }
  })
})

describe('exercise tests', () => {
  const vocabA1: TestId = { level: 'A1', type: 'vocab' }

  it('read their keys back', () => {
    expect(testKey(vocabA1)).toBe('exercise:vocab:A1')
    expect(parseTestKey('exercise:vocab:A1')).toEqual(vocabA1)
    expect(parseTestKey('exercise:nope:A1')).toBeUndefined()
  })

  it.each(['vocab', 'cloze', 'choice', 'conjugation', 'builder', 'translation', 'dictation', 'speaking'] as const)(
    'ask 30 %s tasks of the level only',
    (type) => {
      const tasks = createTest({ level: 'A1', type }, seeded(2))
      expect(tasks).toHaveLength(EXERCISE_TEST_SIZE)
      expect(new Set(tasks.map((t) => t.itemId)).size).toBe(EXERCISE_TEST_SIZE)
      for (const task of tasks) {
        expect(task.kind).toBe(type)
        const level = task.kind === 'vocab' ? task.word.level : task.kind === 'conjugation' ? task.verb.level : task.sentence.level
        expect(level).toBe('A1')
      }
    },
  )

  it('open only when every lesson before them is passed', () => {
    const { total } = exerciseTestProgress('vocab', 'A1', {})
    expect(total).toBeGreaterThan(10)
    const map: LessonProgressionMap = {}
    for (let n = 1; n < total; n++) map[lessonKey('vocab', 'all:A1', n)] = { bestScore: 10, total: 10, passed: true }
    expect(isTestUnlocked(vocabA1, map)).toBe(false)
    expect(exerciseTestProgress('vocab', 'A1', map)).toEqual({ passed: total - 1, total })
    map[lessonKey('vocab', 'all:A1', total)] = { bestScore: 8, total: 10, passed: true }
    expect(isTestUnlocked(vocabA1, map)).toBe(true)
    // Topic tests and exams are never locked.
    expect(isTestUnlocked({ level: 'A1' }, {})).toBe(true)
  })

  it('prepare with a lesson of the same exercise, mistakes first', () => {
    const mistake = createTest(vocabA1, seeded(5))[7]
    const tasks = prepareLesson(vocabA1, new Set([itemKey(mistake.kind, mistake.itemId)]), new Map(), seeded(6))
    expect(tasks).toHaveLength(10)
    expect(tasks.every((t) => t.kind === 'vocab')).toBe(true)
    expect(tasks[0].itemId).toBe(mistake.itemId)
  })
})
