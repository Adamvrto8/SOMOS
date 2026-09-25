import { sentences, verbById, verbs } from '../data'
import type { Cloze, Level, Person, Sentence, Verb } from '../data/types'
import { checkAnswer, type CheckResult, type Verdict } from './checkAnswer'
import { conjugate, formText, PERSONS, type TableTense } from './conjugate'
import { lookupForm } from './knownForms'

export type ExerciseType = 'cloze' | 'choice' | 'conjugation' | 'builder' | 'translation'

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

export type Task = ClozeTask | ChoiceTask | ConjugationTask | BuilderTask | TranslationTask

/** Typed text or chosen option, or tile ids in the chosen order (builder). */
export type Answer = string | string[]

export interface Grade {
  correct: boolean // counts as correct: correct, accent warning or forgiven typo
  verdict: Verdict
  expected: string // correct answer to show
  check?: CheckResult // details for typed answers
}

type Random = () => number

const TENSES: TableTense[] = ['presente', 'progresivo', 'preterito']
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
  const tenses = tense ? [tense] : TENSES
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

export function createLesson(filter: LessonFilter, size = LESSON_SIZE, random: Random = Math.random): Task[] {
  switch (filter.type) {
    case 'cloze':
      // One cloze per sentence, so a lesson never shows the same sentence twice.
      return takeLimited(shuffle(clozeItems(filter), random), size, (i) => i.sentence.id, 1).map(
        (i): ClozeTask => ({ kind: 'cloze', ...i }),
      )
    case 'choice':
      return takeLimited(shuffle(choiceItems(filter), random), size, (i) => i.sentence.id, 1).map(
        (i): ChoiceTask => ({ kind: 'choice', ...i, options: shuffle([i.cloze.answer, ...(i.cloze.distractors ?? [])], random) }),
      )
    case 'conjugation':
      return takeLimited(shuffle(conjugationItems(filter), random), size, (i) => i.verb.id, MAX_TASKS_PER_VERB).map(
        ({ verb, tense, person }) => conjugationTask(verb, tense, person),
      )
    case 'builder':
      return shuffle(builderSentences(filter), random)
        .slice(0, size)
        .map((sentence): BuilderTask => {
          const expected = builderWords(sentence)
          return { kind: 'builder', itemId: sentence.id, sentence, expected, tiles: shuffleTiles(expected, random) }
        })
    case 'translation':
      return shuffle(translationSentences(filter), random)
        .slice(0, size)
        .map((sentence): TranslationTask => ({ kind: 'translation', itemId: sentence.id, sentence }))
  }
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
  }
}
