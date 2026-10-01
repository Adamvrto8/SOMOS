import { sentenceById, sentences, verbById, verbs, wordById, words } from '../data'
import type { Cloze, Level, Person, Sentence, Verb, Word } from '../data/types'
import { checkAnswer, diffWords, type CheckOptions, type CheckResult, type DiffPart, type Verdict } from './checkAnswer'
import { conjugate, formText, PERSONS, TABLE_TENSES, type TableTense } from './conjugate'
import { lookupForm } from './knownForms'
import { matchSpeech, spokenForm, type SpeechMatch } from './speechMatch'

export type ExerciseType = 'cloze' | 'choice' | 'conjugation' | 'builder' | 'translation' | 'vocab' | 'dictation' | 'speaking'

export const LESSON_SIZE = 10

export interface LessonFilter {
  type: ExerciseType
  topic?: string // sentence exercises or 'all'
  level?: Level
  tense?: TableTense | 'all' // conjugation drill or 'all'
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

export interface DictationTask {
  kind: 'dictation'
  itemId: string // sentence id
  sentence: Sentence
}

export interface SpeakingTask {
  kind: 'speaking'
  itemId: string // sentence id
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

export type Task = ClozeTask | ChoiceTask | ConjugationTask | BuilderTask | TranslationTask | VocabTask | DictationTask | SpeakingTask

/** Typed text or chosen option, or tile ids in the chosen order (builder). */
export type Answer = string | string[]

export interface Grade {
  correct: boolean // counts as correct: correct, accent warning or forgiven typo
  verdict: Verdict
  expected: string // correct answer to show
  check?: CheckResult // details for typed answers
  diff?: DiffPart[] // a wrong typed sentence word by word, for a second try
  speech?: SpeechMatch // Vyslovovanie: which words were heard
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
  (!topic || topic === 'all' || s.topics.includes(topic)) && (!level || s.level === level)

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
  const tenses = tense && tense !== 'all' ? [tense] : TABLE_TENSES
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

/** Sentences to hear or say: a digit ("1965") has no single spoken or typed form. */
function listeningSentences(filter: LessonFilter) {
  return sentences.filter((s) => matchesSentence(s, filter) && !/\d/.test(s.es))
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
    case 'speaking':
    case 'dictation':
      return listeningSentences(filter).length
    case 'vocab':
      return words.filter((w) => (!filter.topic || filter.topic === 'all' || w.topics.includes(filter.topic)) && (!filter.level || w.level === filter.level)).length
  }
}

const NUMBER_VALUES: Record<string, number> = {
  cero: 0, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciséis: 16, veinte: 20, treinta: 30, cuarenta: 40,
  cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, mil: 1000, millón: 1000000,
}

// Pronouns and particles a Slovak phrase can do without: "ako sa ti darí?" ≈ "ako sa darí?".
const OPTIONAL_SK = new Set(['ti', 'mi', 'si', 'sa', 'ťa', 'ma', 'to'])

/** Slovak answers accepted for an ES → SK vocab task. */
export function slovakAnswers(word: Word): string[] {
  const out = new Set<string>()
  for (const sk of word.sk) {
    // Parentheses explain usage ("prosím? (keď si nepočul)"), nobody types them.
    const bare = sk.replace(/\s*\([^)]*\)/g, '').trim()
    for (const variant of [sk, bare]) {
      if (!variant) continue
      out.add(variant)
      const parts = variant.split(/\s+/)
      if (parts.length < 3) continue // "volať sa" without "sa" is another verb
      parts.forEach((part, i) => {
        if (OPTIONAL_SK.has(part.toLowerCase())) out.add(parts.filter((_, j) => j !== i).join(' '))
      })
    }
  }
  const value = NUMBER_VALUES[word.es]
  if (value !== undefined) {
    out.add(String(value))
    if (value >= 1000) out.add(value.toLocaleString('sk-SK').replace(/\s/g, ' ')) // "1 000"
  }
  return [...out]
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
    : slovakAnswers(word)

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

/**
 * Each word is asked once in the lessons, every other one towards Spanish. The opposite
 * direction comes days later in review (reviewQueue's slovakFirst), not in the next lesson.
 */
const alternateDirection = (word: Word, i: number): VocabTask => vocabTask(word, i % 2 === 0 ? 'sk-es' : 'es-sk')

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
    case 'dictation':
      return order(listeningSentences(filter), (s) => s.id)
        .slice(0, size)
        .map((sentence): DictationTask => ({ kind: 'dictation', itemId: sentence.id, sentence }))
    case 'speaking':
      return order(listeningSentences(filter), (s) => s.id)
        .slice(0, size)
        .map((sentence): SpeakingTask => ({ kind: 'speaking', itemId: sentence.id, sentence }))
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

function seedFor(type: ExerciseType): number {
  switch (type) {
    case 'cloze': return 1013904223
    case 'choice': return 2147483647
    case 'builder': return 1664525
    case 'translation': return 982451653
    case 'vocab': return 42424242
    case 'conjugation': return 7777777
    case 'dictation': return 314159265
    case 'speaking': return 271828182
  }
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function orderSentences(items: Sentence[], type: ExerciseType, isAllTopics: boolean): Sentence[] {
  if (!isAllTopics) {
    const sorted = [...items]
    sorted.sort(compareSentences)
    return sorted
  }
  const byLevel = new Map<Level, Sentence[]>()
  for (const s of items) {
    const list = byLevel.get(s.level) ?? []
    list.push(s)
    byLevel.set(s.level, list)
  }
  const sortedLevels: Level[] = ['A1', 'A2', 'B1', 'B2']
  const result: Sentence[] = []
  for (const lvl of sortedLevels) {
    const list = byLevel.get(lvl)
    if (list && list.length > 0) {
      list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
      result.push(...shuffle(list, seededRandom(seedFor(type) + (LEVEL_ORDER[lvl] ?? 1))))
    }
  }
  return result
}

/** Deterministic list of all candidate items for a topic/tense filter, sorted stably. */
export function getStablePool(filter: LessonFilter): Task[] {
  switch (filter.type) {
    case 'cloze': {
      const matching = sentences.filter((s) => matchesSentence(s, filter) && (s.cloze?.length ?? 0) > 0)
      const ordered = orderSentences(matching, 'cloze', !filter.topic || filter.topic === 'all')
      return ordered.map((sentence): ClozeTask => ({
        kind: 'cloze',
        itemId: `${sentence.id}#0`,
        sentence,
        cloze: sentence.cloze![0],
      }))
    }
    case 'choice': {
      const matching = sentences.filter((s) => matchesSentence(s, filter) && (s.cloze?.[0].distractors?.length ?? 0) >= 2)
      const ordered = orderSentences(matching, 'choice', !filter.topic || filter.topic === 'all')
      return ordered.map((sentence) => choiceTask(sentence, sentence.cloze![0], `${sentence.id}#0`, () => 0.5))
    }
    case 'conjugation': {
      const isAll = !filter.tense || filter.tense === 'all'
      const tenses: TableTense[] = isAll ? TABLE_TENSES : [filter.tense as TableTense]
      const matchingVerbs = verbs.filter((v) => !filter.level || v.level === filter.level)
      matchingVerbs.sort((a, b) => (LEVEL_ORDER[a.level] ?? 1) - (LEVEL_ORDER[b.level] ?? 1) || a.id.localeCompare(b.id))
      // Round r asks verb i for person i + r: a lesson of 10 verbs has every person twice,
      // and after 5 rounds each verb has been through all of them.
      const allTasks = tenses.flatMap((tense) =>
        PERSONS.flatMap((_, round) =>
          matchingVerbs.map((verb, i) => conjugationTask(verb, tense, PERSONS[(i + round) % PERSONS.length])),
        ),
      )
      if (isAll) {
        allTasks.sort((a, b) => a.itemId.localeCompare(b.itemId))
        return shuffle(allTasks, seededRandom(seedFor('conjugation')))
      }
      return allTasks
    }
    case 'builder': {
      const matching = builderSentences(filter)
      const ordered = orderSentences(matching, 'builder', !filter.topic || filter.topic === 'all')
      return ordered.map((sentence) => builderTask(sentence, () => 0.5))
    }
    case 'translation': {
      const matching = translationSentences(filter)
      const ordered = orderSentences(matching, 'translation', !filter.topic || filter.topic === 'all')
      return ordered.map((sentence): TranslationTask => ({
        kind: 'translation',
        itemId: sentence.id,
        sentence,
      }))
    }
    case 'dictation': {
      const ordered = orderSentences(listeningSentences(filter), 'dictation', !filter.topic || filter.topic === 'all')
      return ordered.map((sentence): DictationTask => ({ kind: 'dictation', itemId: sentence.id, sentence }))
    }
    case 'speaking': {
      const ordered = orderSentences(listeningSentences(filter), 'speaking', !filter.topic || filter.topic === 'all')
      return ordered.map((sentence): SpeakingTask => ({ kind: 'speaking', itemId: sentence.id, sentence }))
    }
    case 'vocab': {
      const isAll = !filter.topic || filter.topic === 'all'
      const matching = words.filter(
        (w) => (isAll || w.topics.includes(filter.topic!)) && (!filter.level || w.level === filter.level),
      )
      if (isAll) {
        const byLevel = new Map<Level, Word[]>()
        for (const w of matching) {
          const list = byLevel.get(w.level) ?? []
          list.push(w)
          byLevel.set(w.level, list)
        }
        const sortedLevels: Level[] = ['A1', 'A2', 'B1', 'B2']
        const orderedWords: Word[] = []
        for (const lvl of sortedLevels) {
          const list = byLevel.get(lvl)
          if (list && list.length > 0) {
            list.sort((a, b) => a.id.localeCompare(b.id))
            orderedWords.push(...shuffle(list, seededRandom(seedFor('vocab') + (LEVEL_ORDER[lvl] ?? 1))))
          }
        }
        return orderedWords.map(alternateDirection)
      }
      matching.sort((a, b) => (LEVEL_ORDER[a.level] ?? 1) - (LEVEL_ORDER[b.level] ?? 1) || a.es.localeCompare(b.es))
      return matching.map(alternateDirection)
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
    case 'dictation': {
      const sentence = sentenceById.get(itemId)
      return sentence ? { kind: 'dictation', itemId, sentence } : undefined
    }
    case 'speaking': {
      const sentence = sentenceById.get(itemId)
      return sentence ? { kind: 'speaking', itemId, sentence } : undefined
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

const EXERCISE_TYPES: ExerciseType[] = ['cloze', 'choice', 'conjugation', 'builder', 'translation', 'vocab', 'dictation', 'speaking']

/**
 * A lesson from the mistakes list: most-missed first, then the ones not seen for longest.
 * `canSpeak` false (no speech recognition) leaves Vyslovovanie mistakes out.
 */
export function mistakesLesson(mistakes: MistakeRef[], size = LESSON_SIZE, random: Random = Math.random, canSpeak = true): Task[] {
  return [...mistakes]
    .filter((m) => canSpeak || m.exercise !== 'speaking')
    .sort((a, b) => b.wrongCount - a.wrongCount || a.lastWrongAt - b.lastWrongAt)
    .flatMap((m) => {
      const task = EXERCISE_TYPES.includes(m.exercise as ExerciseType) ? taskFromItem(m.exercise as ExerciseType, m.itemId, random) : undefined
      return task ? [task] : []
    })
    .slice(0, size)
}

/** "Teraz nemôžem hovoriť": the answered tasks stay, the speaking ones ahead go (a mistakes lesson mixes types). */
export function skipSpeaking(tasks: Task[], index: number): Task[] {
  return tasks.filter((task, i) => i < index || task.kind !== 'speaking')
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

/** A typed answer with one expected text: a wrong one of several words also says which words to fix. */
function typed(text: string, expected: string, options: CheckOptions): Grade {
  const grade = fromCheck(checkAnswer(text, expected, options))
  if (grade.correct) return grade
  const diff = diffWords(text, expected, options)
  return diff.length > 1 ? { ...grade, diff } : grade
}

/** A wrong typed answer may be fixed and checked again; the task counts as wrong only when the learner gives up. */
export function canRetry(task: Task): boolean {
  return task.kind === 'cloze' || task.kind === 'conjugation' || task.kind === 'translation' || task.kind === 'vocab' || task.kind === 'dictation'
}

export function gradeTask(task: Task, answer: Answer): Grade {
  const text = typeof answer === 'string' ? answer : ''
  switch (task.kind) {
    case 'cloze':
      return typed(text, task.cloze.answer, { lookup: lookupForm })
    case 'choice':
      return exact(text === task.cloze.answer, task.cloze.answer)
    case 'conjugation':
      return typed(text, task.answer, { lookup: lookupForm })
    case 'builder': {
      const ids = Array.isArray(answer) ? answer : []
      const built = ids.map((id) => task.tiles.find((t) => t.id === id)?.text ?? '')
      const correct = built.join(' ').toLowerCase() === task.expected.join(' ').toLowerCase()
      return exact(correct, task.sentence.es)
    }
    case 'translation':
      return typed(text, task.sentence.es, { lookup: lookupForm, optionalSubject: true })
    case 'vocab':
      return fromCheck(checkAnswer(text, task.acceptable, task.direction === 'sk-es' ? { lookup: lookupForm } : {}))
    case 'dictation':
      // "8" is what was heard as much as "ocho".
      return typed(spokenForm(text), task.sentence.es, { lookup: lookupForm })
    case 'speaking': {
      const speech = matchSpeech(text, task.sentence.es)
      return { correct: speech.verdict !== 'wrong', verdict: speech.verdict, expected: task.sentence.es, speech }
    }
  }
}
