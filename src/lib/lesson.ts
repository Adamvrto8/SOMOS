import { sentenceById, sentences, verbById, verbs, wordById, words } from '../data'
import type { Cloze, Level, Person, Sentence, Verb, Word } from '../data/types'
import { checkAnswer, type CheckResult, type Verdict } from './checkAnswer'
import { conjugate, formText, PERSONS, TABLE_TENSES, type TableTense } from './conjugate'
import { lookupForm } from './knownForms'

export type ExerciseType = 'cloze' | 'choice' | 'conjugation' | 'builder' | 'translation' | 'vocab'

export const LESSON_SIZE = 10

export interface LessonFilter {
  type: ExerciseType
  topic?: string // sentence exercises
  level?: Level
  tense?: TableTense // conjugation drill
}

export interface ClozeTask {
  kind: 'cloze'
  itemId: string
  sentence: Sentence
  cloze: Cloze
}

export interface ChoiceTask {
  kind: 'choice'
  itemId: string
  sentence: Sentence
  cloze: Cloze
  options: string[]
}

export interface ConjugationTask {
  kind: 'conjugation'
  itemId: string
  verb: Verb
  tense: TableTense
  person: Person
  answer: string
  irregular: boolean
}

export interface Tile {
  id: string
  text: string
}

export interface BuilderTask {
  kind: 'builder'
  itemId: string
  sentence: Sentence
  tiles: Tile[] // shuffled
  expected: string[] // words in the right order
}

export interface TranslationTask {
  kind: 'translation'
  itemId: string
  sentence: Sentence
}

export interface VocabTask {
  kind: 'vocab'
  itemId: string
  word: Word
  direction: 'sk-es' | 'es-sk'
  prompt: string
  expected: string
  acceptable: string[]
}

export type Task = ClozeTask | ChoiceTask | ConjugationTask | BuilderTask | TranslationTask | VocabTask

/** Typed text or chosen option, or tile ids in the chosen order (builder). */
export type Answer = string | string[]

export interface Grade {
  correct: boolean // counts as correct: correct, accent warning or forgiven typo
  verdict: Verdict
  expected: string // correct answer to show
  check?: CheckResult // details for typed answers
}

type Random = () => number

const PUNCTUATION = /^[¿?¡!.,;:]$/
const MAX_TASKS_PER_VERB = 2

// ---------- helpers ----------

function shuffle<T>(items: T[], random: Random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Takes up to `size` items, at most `max` per key. */
function takeLimited<T>(items: T[], size: number, key: (item: T) => string, max: number): T[] {
  const counts = new Map<string, number>()
  const out: T[] = []
  for (const item of items) {
    if (out.length === size) break
    const k = key(item)
    const n = counts.get(k) ?? 0
    if (n >= max) continue
    counts.set(k, n + 1)
    out.push(item)
  }
  return out
}

const matchesSentence = (s: Sentence, { topic, level }: LessonFilter) =>
  (!topic || s.topics.includes(topic)) && (!level || s.level === level)

/** Words for the sentence builder: no punctuation, sentence-initial capital dropped. */
export function builderWords(sentence: Sentence): string[] {
  return sentence.tokens
    .filter((t) => !PUNCTUATION.test(t))
    .map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w))
}

function shuffleTiles(words: string[], random: Random): Tile[] {
  const tiles = words.map((text, i) => ({ id: `t${i}`, text }))
  let shuffled = shuffle(tiles, random)
  // A "shuffle" that happens to be the answer would be a free point.
  for (let attempt = 0; attempt < 10 && shuffled.map((t) => t.text).join(' ') === words.join(' '); attempt++) {
    shuffled = shuffle(tiles, random)
  }
  return shuffled
}

// ---------- pools ----------

function clozeItems(filter: LessonFilter) {
  return sentences
    .filter((s) => matchesSentence(s, filter))
    .flatMap((sentence) => (sentence.cloze ?? []).map((cloze, index) => ({ sentence, cloze, itemId: `${sentence.id}#${index}` })))
}

function choiceItems(filter: LessonFilter) {
  return clozeItems(filter).filter((item) => (item.cloze.distractors?.length ?? 0) >= 2)
}

function conjugationItems({ level, tense }: LessonFilter) {
  const tenses = tense ? [tense] : TABLE_TENSES
  return verbs
    .filter((v) => !level || v.level === level)
    .flatMap((verb) => tenses.flatMap((t) => PERSONS.map((person) => ({ verb, tense: t, person }))))
}

function builderSentences(filter: LessonFilter) {
  return sentences.filter((s) => matchesSentence(s, filter) && builderWords(s).length >= 3)
}

function translationSentences(filter: LessonFilter) {
  return sentences.filter((s) => matchesSentence(s, filter))
}

export function availableCount(filter: LessonFilter): number {
  switch (filter.type) {
    case 'cloze':
      return clozeItems(filter).length
    case 'choice':
      return choiceItems(filter).length
    case 'conjugation':
      return conjugationItems(filter).length
    case 'builder':
      return builderSentences(filter).length
    case 'translation':
      return translationSentences(filter).length
    case 'vocab':
      return words.filter((w) => (!filter.topic || w.topics.includes(filter.topic)) && (!filter.level || w.level === filter.level)).length * 2
  }
}

export function vocabTask(word: Word, direction: 'sk-es' | 'es-sk'): VocabTask {
  const isToSpanish = direction === 'sk-es'
  const prompt = isToSpanish
    ? word.sk.join(', ')
    : word.gender
      ? `${word.gender === 'm' ? 'el' : 'la'} ${word.es}`
      : word.es
  const expected = isToSpanish ? word.es : word.sk[0]
  const acceptable = isToSpanish
    ? [word.es, ...(word.gender ? [`${word.gender === 'm' ? 'el' : 'la'} ${word.es}`] : [])]
    : word.sk

  return {
    kind: 'vocab',
    itemId: `${word.id}:${direction}`,
    word,
    direction,
    prompt,
    expected,
    acceptable,
  }
}

// ---------- lesson ----------

export function conjugationTask(verb: Verb, tense: TableTense, person: Person): ConjugationTask {
  const parts = conjugate(verb, tense, person, verbById.get('estar')!)
  return {
    kind: 'conjugation',
    itemId: `${verb.id}:${tense}:${person}`,
    verb,
    tense,
    person,
    answer: formText(parts),
    irregular: parts.some((p) => p.irregular),
  }
}

const choiceTask = (sentence: Sentence, cloze: Cloze, itemId: string, random: Random): ChoiceTask => ({
  kind: 'choice',
  itemId,
  sentence,
  cloze,
  options: shuffle([cloze.answer, ...(cloze.distractors ?? [])], random),
})

const builderTask = (sentence: Sentence, random: Random): BuilderTask => {
  const expected = builderWords(sentence)
  return { kind: 'builder', itemId: sentence.id, sentence, expected, tiles: shuffleTiles(expected, random) }
}

/**
 * A lesson for the filter. `seen` (answers per itemId) makes items practised least come
 * first, so lessons don't keep repeating the same sentences; ties stay random.
 */
export function createLesson(
  filter: LessonFilter,
  size = LESSON_SIZE,
  random: Random = Math.random,
  seen?: Map<string, number>,
): Task[] {
  const order = <T>(items: T[], itemId: (item: T) => string) => {
    const shuffled = shuffle(items, random)
    return seen ? shuffled.sort((a, b) => (seen.get(itemId(a)) ?? 0) - (seen.get(itemId(b)) ?? 0)) : shuffled
  }

  switch (filter.type) {
    case 'cloze':
      // One cloze per sentence, so a lesson never shows the same sentence twice.
      return takeLimited(order(clozeItems(filter), (i) => i.itemId), size, (i) => i.sentence.id, 1).map(
        (i): ClozeTask => ({ kind: 'cloze', ...i }),
      )
    case 'choice':
      return takeLimited(order(choiceItems(filter), (i) => i.itemId), size, (i) => i.sentence.id, 1).map((i) =>
        choiceTask(i.sentence, i.cloze, i.itemId, random),
      )
    case 'conjugation':
      return takeLimited(
        order(conjugationItems(filter), (i) => `${i.verb.id}:${i.tense}:${i.person}`),
        size,
        (i) => i.verb.id,
        MAX_TASKS_PER_VERB,
      ).map(({ verb, tense, person }) => conjugationTask(verb, tense, person))
    case 'builder':
      return order(builderSentences(filter), (s) => s.id)
        .slice(0, size)
        .map((sentence) => builderTask(sentence, random))
    case 'translation':
      return order(translationSentences(filter), (s) => s.id)
        .slice(0, size)
        .map((sentence): TranslationTask => ({ kind: 'translation', itemId: sentence.id, sentence }))
    case 'vocab':
      return order(getStablePool(filter), (t) => t.itemId).slice(0, size)
  }
}

const LEVEL_ORDER: Record<Level, number> = { A1: 1, A2: 2, B1: 3, B2: 4 }

function compareSentences(a: Sentence, b: Sentence): number {
  const levelDiff = (LEVEL_ORDER[a.level] ?? 1) - (LEVEL_ORDER[b.level] ?? 1)
  if (levelDiff !== 0) return levelDiff
  return a.id.localeCompare(b.id, undefined, { numeric: true })
}

/** Deterministic list of all candidate items for a topic/tense filter, sorted stably. */
export function getStablePool(filter: LessonFilter): Task[] {
  switch (filter.type) {
    case 'cloze': {
      const matching = sentences.filter((s) => matchesSentence(s, filter) && (s.cloze?.length ?? 0) > 0)
      matching.sort(compareSentences)
      return matching.map((sentence): ClozeTask => ({
        kind: 'cloze',
        itemId: `${sentence.id}#0`,
        sentence,
        cloze: sentence.cloze![0],
      }))
    }
    case 'choice': {
      const matching = sentences.filter((s) => matchesSentence(s, filter) && (s.cloze?.[0].distractors?.length ?? 0) >= 2)
      matching.sort(compareSentences)
      return matching.map((sentence) => choiceTask(sentence, sentence.cloze![0], `${sentence.id}#0`, () => 0.5))
    }
    case 'conjugation': {
      const tenses = filter.tense ? [filter.tense] : TABLE_TENSES
      const matchingVerbs = verbs.filter((v) => !filter.level || v.level === filter.level)
      matchingVerbs.sort((a, b) => (LEVEL_ORDER[a.level] ?? 1) - (LEVEL_ORDER[b.level] ?? 1) || a.id.localeCompare(b.id))
      return tenses.flatMap((tense) =>
        PERSONS.flatMap((person) =>
          matchingVerbs.map((verb) => conjugationTask(verb, tense, person)),
        ),
      )
    }
    case 'builder': {
      const matching = builderSentences(filter)
      matching.sort(compareSentences)
      return matching.map((sentence) => builderTask(sentence, () => 0.5))
    }
    case 'translation': {
      const matching = translationSentences(filter)
      matching.sort(compareSentences)
      return matching.map((sentence): TranslationTask => ({
        kind: 'translation',
        itemId: sentence.id,
        sentence,
      }))
    }
    case 'vocab': {
      const matching = words.filter(
        (w) => (!filter.topic || w.topics.includes(filter.topic)) && (!filter.level || w.level === filter.level),
      )
      matching.sort((a, b) => (LEVEL_ORDER[a.level] ?? 1) - (LEVEL_ORDER[b.level] ?? 1) || a.es.localeCompare(b.es))
      return [
        ...matching.map((w, i) => vocabTask(w, i % 2 === 0 ? 'sk-es' : 'es-sk')),
        ...matching.map((w, i) => vocabTask(w, i % 2 === 0 ? 'es-sk' : 'sk-es')),
      ]
    }
  }
}

export function getNumberedLessonCount(filter: LessonFilter): number {
  const pool = getStablePool(filter)
  if (pool.length === 0) return 0
  if (pool.length <= LESSON_SIZE) return 1
  return Math.ceil(pool.length / LESSON_SIZE)
}

export function createNumberedLesson(
  filter: LessonFilter,
  lessonNumber: number,
  random: Random = Math.random,
): Task[] {
  const pool = getStablePool(filter)
  if (pool.length === 0) return []
  if (pool.length <= LESSON_SIZE) return retryTasks(pool, random)

  const totalLessons = Math.ceil(pool.length / LESSON_SIZE)
  const clampedNum = Math.max(1, Math.min(lessonNumber, totalLessons))

  let slice: Task[]
  if (clampedNum < totalLessons) {
    const start = (clampedNum - 1) * LESSON_SIZE
    slice = pool.slice(start, start + LESSON_SIZE)
  } else {
    slice = pool.slice(Math.max(0, pool.length - LESSON_SIZE))
  }

  return retryTasks(slice, random)
}

/** Rebuilds a task from what attempts and mistakes store: exercise type + itemId. */
export function taskFromItem(exercise: ExerciseType, itemId: string, random: Random = Math.random): Task | undefined {
  switch (exercise) {
    case 'cloze':
    case 'choice': {
      const [sentenceId, index] = itemId.split('#')
      const sentence = sentenceById.get(sentenceId)
      const cloze = sentence?.cloze?.[Number(index)]
      if (!sentence || !cloze) return undefined
      return exercise === 'cloze' ? { kind: 'cloze', itemId, sentence, cloze } : choiceTask(sentence, cloze, itemId, random)
    }
    case 'conjugation': {
      const [verbId, tense, person] = itemId.split(':')
      const verb = verbById.get(verbId)
      if (!verb || !TABLE_TENSES.includes(tense as TableTense) || !PERSONS.includes(person as Person)) return undefined
      return conjugationTask(verb, tense as TableTense, person as Person)
    }
    case 'builder': {
      const sentence = sentenceById.get(itemId)
      return sentence ? builderTask(sentence, random) : undefined
    }
    case 'translation': {
      const sentence = sentenceById.get(itemId)
      return sentence ? { kind: 'translation', itemId, sentence } : undefined
    }
    case 'vocab': {
      const [wordId, direction] = itemId.split(':')
      const word = wordById.get(wordId)
      if (!word || (direction !== 'sk-es' && direction !== 'es-sk')) return undefined
      return vocabTask(word, direction)
    }
  }
}

export interface MistakeRef {
  exercise: string
  itemId: string
  wrongCount: number
  lastWrongAt: number
}

const EXERCISE_TYPES: ExerciseType[] = ['cloze', 'choice', 'conjugation', 'builder', 'translation', 'vocab']

/** A lesson from the mistakes list: most-missed first, then the ones not seen for longest. */
export function mistakesLesson(mistakes: MistakeRef[], size = LESSON_SIZE, random: Random = Math.random): Task[] {
  return [...mistakes]
    .sort((a, b) => b.wrongCount - a.wrongCount || a.lastWrongAt - b.lastWrongAt)
    .flatMap((m) => {
      const task = EXERCISE_TYPES.includes(m.exercise as ExerciseType) ? taskFromItem(m.exercise as ExerciseType, m.itemId, random) : undefined
      return task ? [task] : []
    })
    .slice(0, size)
}

/** The same tasks again (e.g. "repeat mistakes") with options and tiles reshuffled. */
export function retryTasks(tasks: Task[], random: Random = Math.random): Task[] {
  return shuffle(tasks, random).map((task) => {
    if (task.kind === 'choice') return { ...task, options: shuffle(task.options, random) }
    if (task.kind === 'builder') return { ...task, tiles: shuffleTiles(task.expected, random) }
    return task
  })
}

// ---------- grading ----------

const fromCheck = (check: CheckResult): Grade => ({
  correct: check.verdict !== 'wrong',
  verdict: check.verdict,
  expected: check.expected,
  check,
})

const exact = (correct: boolean, expected: string): Grade => ({ correct, verdict: correct ? 'correct' : 'wrong', expected })

export function gradeTask(task: Task, answer: Answer): Grade {
  const text = typeof answer === 'string' ? answer : ''
  switch (task.kind) {
    case 'cloze':
      return fromCheck(checkAnswer(text, task.cloze.answer, { lookup: lookupForm }))
    case 'choice':
      return exact(text === task.cloze.answer, task.cloze.answer)
    case 'conjugation':
      return fromCheck(checkAnswer(text, task.answer, { lookup: lookupForm }))
    case 'builder': {
      const ids = Array.isArray(answer) ? answer : []
      const built = ids.map((id) => task.tiles.find((t) => t.id === id)?.text ?? '')
      const correct = built.join(' ').toLowerCase() === task.expected.join(' ').toLowerCase()
      return exact(correct, task.sentence.es)
    }
    case 'translation':
      return fromCheck(checkAnswer(text, task.sentence.es, { lookup: lookupForm, optionalSubject: true }))
    case 'vocab':
      return fromCheck(checkAnswer(text, task.acceptable, task.direction === 'sk-es' ? { lookup: lookupForm } : {}))
  }
}
