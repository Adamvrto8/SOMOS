import { describe, expect, it } from 'vitest'
import { sentenceById, topics, verbById, wordById } from '../data'
import {
  conjugationTask,
  createLesson,
  createNumberedLesson,
  getNumberedLessonCount,
  mistakesLesson,
  pickVaried,
  retryTasks,
  seededRandom,
  spreadRepeats,
  taskKeys,
  vocabTask,
  type ExerciseType,
  type Task,
} from './lesson'
import { isFixedStep, reviewTasks, stepTasks, unitSteps } from './path'
import { pathUnits } from './pathUnits'
import { createTest, prepareLesson, TEST_LEVELS, topicTests, type TestId } from './tests'

// A lesson asks a sentence once, and a word (a vocab word, a conjugated verb, a blank's lemma) once while
// it can: "tener · yo" and then "Yo ___ dos hermanos" in one lesson gives the answer away and feels repeated.

const TYPES: ExerciseType[] = ['cloze', 'choice', 'conjugation', 'builder', 'translation', 'vocab', 'dictation', 'speaking', 'truefalse', 'findmistake', 'matching']

function counts(tasks: Task[]) {
  const sentences = new Map<string, number>()
  const words = new Map<string, number>()
  for (const task of tasks) {
    const { sentence, words: ws } = taskKeys(task)
    if (sentence) sentences.set(sentence, (sentences.get(sentence) ?? 0) + 1)
    for (const w of ws) words.set(w, (words.get(w) ?? 0) + 1)
  }
  return { sentences, words }
}

const repeated = (map: Map<string, number>) => [...map].filter(([, n]) => n > 1).map(([k]) => k)

/** Two neighbours share a word only when one word fills more than half the lesson (a ser/estar unit). */
function adjacentRepeats(tasks: Task[]): string[] {
  const { words } = counts(tasks)
  const crowded = Math.max(0, ...words.values()) > Math.ceil(tasks.length / 2)
  if (crowded) return []
  const out: string[] = []
  for (let i = 1; i < tasks.length; i++) {
    const a = taskKeys(tasks[i - 1]).words
    for (const w of taskKeys(tasks[i]).words) if (a.includes(w)) out.push(`${w} at ${i}`)
  }
  return out
}

/** Every lesson the app makes, by where it comes from, each with whether a word may come twice. */
function allLessons(): { source: string; tasks: Task[]; wordsOnce: boolean }[] {
  const random = seededRandom(7)
  const out: { source: string; tasks: Task[]; wordsOnce: boolean }[] = []
  for (const unit of pathUnits) {
    for (const step of unitSteps(unit)) {
      const source = `path ${unit.id} ${step}`
      // The grammar step drills one point (ser/estar, the articles, por/para): its word comes again by design;
      // a unit's sentence step places every sentence of the unit, some of which blank the same word.
      if (isFixedStep(step)) out.push({ source, tasks: retryTasks(stepTasks(unit, step, random), random), wordsOnce: step !== 'grammar' && step !== 'sentences' })
      else if (step === 'review') out.push({ source, tasks: spreadRepeats(reviewTasks(unit, pathUnits, new Set(), new Map(), random)), wordsOnce: true })
    }
  }
  for (const type of TYPES) {
    for (const topic of ['all', ...topics.map((t) => t.id)]) {
      if (type === 'conjugation' && topic !== 'all') continue
      for (const level of [undefined, 'A1', 'A2', 'B1', 'B2'] as const) {
        const filter = { type, topic, level }
        // Numbered lessons cut a fixed pool: the last one of a small pool may have a word left over twice.
        for (let k = 1; k <= getNumberedLessonCount(filter); k++) {
          out.push({ source: `lesson ${type} ${topic} ${level} #${k}`, tasks: createNumberedLesson(filter, k, random), wordsOnce: false })
        }
        out.push({ source: `lesson ${type} ${topic} ${level}`, tasks: createLesson(filter, undefined, random), wordsOnce: true })
      }
    }
  }
  for (const level of TEST_LEVELS) {
    const ids: TestId[] = [...topicTests(level), { level }, ...TYPES.map((type) => ({ level, type }))]
    for (const id of ids) {
      out.push({ source: `test ${JSON.stringify(id)}`, tasks: createTest(id, random), wordsOnce: true })
      out.push({ source: `prepare ${JSON.stringify(id)}`, tasks: spreadRepeats(prepareLesson(id, new Set(), new Map(), random)), wordsOnce: true })
    }
  }
  return out
}

describe('lesson variety', () => {
  const lessons = allLessons()

  it('never asks a sentence twice in one lesson, test or path step', () => {
    const bad = lessons.flatMap(({ source, tasks }) => repeated(counts(tasks).sentences).map((s) => `${source}: ${s}`))
    expect(bad).toEqual([])
  })

  it('asks a word once in free lessons, tests, the path’s word, listening and review steps', () => {
    const bad = lessons.filter((l) => l.wordsOnce).flatMap(({ source, tasks }) => repeated(counts(tasks).words).map((w) => `${source}: ${w}`))
    expect(bad).toEqual([])
  })

  it('never puts a word right after itself while the lesson could avoid it', () => {
    const bad = lessons.flatMap(({ source, tasks }) => adjacentRepeats(tasks).map((w) => `${source}: ${w}`))
    expect(bad).toEqual([])
  })
})

describe('pickVaried', () => {
  const keys = (item: { s?: string; w: string }) => ({ sentence: item.s, words: [item.w] })

  it('takes a new word first, a word again only when nothing else is left, a sentence never again', () => {
    const items = [
      { s: 's1', w: 'tener' },
      { s: 's2', w: 'tener' },
      { s: 's3', w: 'ir' },
      { s: 's1', w: 'ser' },
    ]
    expect(pickVaried(items, 2, keys)).toEqual([items[0], items[2]])
    expect(pickVaried(items, 4, keys)).toEqual([items[0], items[2], items[1]])
  })
})

describe('spreadRepeats', () => {
  it('moves a blank of a verb away from its conjugation', () => {
    const tener = conjugationTask(verbById.get('tener')!, 'presente', 'yo')
    const cloze: Task = { kind: 'cloze', itemId: 's1#0', sentence: sentenceById.get('s001')!, cloze: { ...sentenceById.get('s001')!.cloze![0], lemma: 'tener' } }
    const other = vocabTask(wordById.get('casa')!, 'es-sk')
    expect(spreadRepeats([tener, cloze, other]).map((t) => t.kind)).toEqual(['conjugation', 'vocab', 'cloze'])
  })
})

describe('mistakesLesson', () => {
  it('asks two mistakes of one sentence in separate lessons', () => {
    const m = (exercise: string, itemId: string) => ({ exercise, itemId, firstWrongAt: 0, lastWrongAt: 0, wrongCount: 1 })
    const tasks = mistakesLesson([m('cloze', 's001#0'), m('builder', 's001')])
    expect(tasks).toHaveLength(1)
  })
})
