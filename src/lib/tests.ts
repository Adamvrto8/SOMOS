import { sentences, topicById, verbById, verbs, words } from '../data'
import type { Level, Sentence, Verb } from '../data/types'
import { PERSONS, TABLE_TENSES, type TableTense } from './conjugate'
import { conjugationTask, createLesson, LESSON_SIZE, type ExerciseType, type Task } from './lesson'

// Tests: a checkpoint per topic and level, and an exam per level. Each mixes the exercise types
// (all but Vyslovovanie, which needs a microphone) and draws new tasks on every attempt.

export type TestLevel = 'A1' | 'A2' | 'B1'
export const TEST_LEVELS: TestLevel[] = ['A1', 'A2', 'B1']

/** A topic test (topic × level) or, without a topic, the exam of the level. */
export interface TestId {
  level: TestLevel
  topic?: string
}

type Mix = [ExerciseType, number][]
type Random = () => number

// Easier types first; the test keeps this order so the instruction changes rarely.
const TOPIC_MIX: Mix = [['vocab', 4], ['choice', 2], ['cloze', 3], ['conjugation', 2], ['builder', 2], ['dictation', 1], ['translation', 1]]
const EXAM_MIX: Mix = [['vocab', 8], ['choice', 3], ['cloze', 5], ['conjugation', 5], ['builder', 3], ['dictation', 3], ['translation', 3]]
const PREPARE_MIX: Mix = [['vocab', 3], ['choice', 1], ['cloze', 2], ['conjugation', 1], ['builder', 1], ['dictation', 1], ['translation', 1]]

export const TEST_TYPES: ExerciseType[] = TOPIC_MIX.map(([type]) => type)

/** Words + sentences a topic needs at a level to have a test there. */
export const MIN_TOPIC_ITEMS = 10
/** Sentences it needs at that level or below. */
const MIN_TOPIC_SENTENCES = 5

const sizeOf = (mix: Mix) => mix.reduce((sum, [, n]) => sum + n, 0)
export const TOPIC_TEST_SIZE = sizeOf(TOPIC_MIX)
export const LEVEL_EXAM_SIZE = sizeOf(EXAM_MIX)

/** "food:A1" for a topic test, "A1" for the level exam: the key of its results and of `?prepare=`. */
export const testKey = ({ level, topic }: TestId): string => (topic ? `${topic}:${level}` : level)

const isTestLevel = (level: string | null | undefined): level is TestLevel => TEST_LEVELS.includes(level as TestLevel)

export function parseTestKey(key: string | null): TestId | undefined {
  if (!key) return undefined
  const [first, second] = key.split(':')
  const id: TestId | undefined = second === undefined ? (isTestLevel(first) ? { level: first } : undefined) : isTestLevel(second) ? { level: second, topic: first } : undefined
  return id && hasTest(id) ? id : undefined
}

/** The test a URL names: `?level=A1` (exam) or `?level=A1&topic=food`. */
export function testFromParams(params: URLSearchParams): TestId | undefined {
  const level = params.get('level')
  const topic = params.get('topic')
  if (!isTestLevel(level)) return undefined
  const id: TestId = topic ? { level, topic } : { level }
  return hasTest(id) ? id : undefined
}

export function testToParams({ level, topic }: TestId): string {
  return new URLSearchParams(topic ? { level, topic } : { level }).toString()
}

/** The tenses a level's conjugation asks: imperfecto and futuro come with A2. */
export function testTenses(level: TestLevel): TableTense[] {
  return level === 'A1' ? ['presente', 'progresivo', 'preterito'] : TABLE_TENSES
}

/** The level itself first, then the ones below it (topic tests top up from them). */
function levelsFor({ level, topic }: TestId): Level[] {
  const index = TEST_LEVELS.indexOf(level)
  return topic ? TEST_LEVELS.slice(0, index + 1).reverse() : [level]
}

export function hasTest(id: TestId): boolean {
  if (!isTestLevel(id.level)) return false
  if (!id.topic) return true
  const { topic, level } = id
  if (!topicById.has(topic)) return false
  const count =
    words.filter((w) => w.level === level && w.topics.includes(topic)).length +
    sentences.filter((s) => s.level === level && s.topics.includes(topic)).length
  // Words alone would make it a vocabulary test.
  const levels = levelsFor(id)
  const sentenceCount = sentences.filter((s) => levels.includes(s.level) && s.topics.includes(topic)).length
  return count >= MIN_TOPIC_ITEMS && sentenceCount >= MIN_TOPIC_SENTENCES
}

/** The topics with a test at a level, in the order of the topic list. */
export function topicTests(level: TestLevel): TestId[] {
  return [...topicById.keys()].map((topic) => ({ level, topic })).filter(hasTest)
}

export const testSize = (id: TestId) => (id.topic ? TOPIC_TEST_SIZE : LEVEL_EXAM_SIZE)

/** The verbs a test conjugates: a topic's own verbs, or the level's when the topic has none. */
function testVerbs(id: TestId): Verb[] {
  const levels = levelsFor(id)
  const ofLevel = verbs.filter((v) => levels.includes(v.level))
  if (!id.topic) return ofLevel
  const own = words
    .filter((w) => w.verbId && w.topics.includes(id.topic!) && levels.includes(w.level))
    .flatMap((w) => verbById.get(w.verbId!) ?? [])
  return own.length > 0 ? own : verbs.filter((v) => v.level === id.level)
}

function shuffle<T>(items: T[], random: Random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Conjugation tasks, one verb after another (a second round only when there are few verbs). */
function conjugationCandidates(id: TestId, random: Random): Task[] {
  const tenses = testTenses(id.level)
  const verbList = shuffle(testVerbs(id), random)
  const out: Task[] = []
  const seen = new Set<string>()
  for (let round = 0; round < 3; round++) {
    for (const verb of verbList) {
      const tense = tenses[Math.floor(random() * tenses.length)]
      const person = PERSONS[Math.floor(random() * PERSONS.length)]
      const task = conjugationTask(verb, tense, person)
      if (seen.has(task.itemId)) continue
      seen.add(task.itemId)
      out.push(task)
    }
  }
  return out
}

interface Candidate {
  task: Task
  rank: number // 0 = the test's own level, then the levels below it
}

/** Every task a type could put into the test, its own level first, each level shuffled. */
function candidates(id: TestId, type: ExerciseType, random: Random): Candidate[] {
  if (type === 'conjugation') return conjugationCandidates(id, random).map((task) => ({ task, rank: 0 }))
  return levelsFor(id).flatMap((level, rank) =>
    createLesson({ type, topic: id.topic ?? 'all', level }, Number.MAX_SAFE_INTEGER, random).map((task) => ({ task, rank })),
  )
}

const sentenceOf = (task: Task): Sentence | undefined => ('sentence' in task ? task.sentence : undefined)

/** The verb (or word) a task asks to put in shape: a cloze's lemma, a conjugated verb. */
const lemmaOf = (task: Task): string | undefined =>
  task.kind === 'cloze' || task.kind === 'choice' ? task.cloze.lemma : task.kind === 'conjugation' ? task.verb.id : undefined

/**
 * Fills the mix from the candidates: no sentence twice (a builder would give away a cloze), no verb
 * both in a cloze and conjugated ("comer · nosotros · progresivo" would answer "Estamos ___ tacos"),
 * a type that runs short leaves its places to the others. Tasks come grouped by type.
 */
function compose(mix: Mix, lists: Map<ExerciseType, Candidate[]>): Task[] {
  const usedSentences = new Set<string>()
  const usedLemmas = new Set<string>()
  const picked = new Map<ExerciseType, Task[]>(mix.map(([type]) => [type, []]))
  const position = new Map<ExerciseType, number>(mix.map(([type]) => [type, 0]))

  const takeOne = (type: ExerciseType): boolean => {
    const list = lists.get(type) ?? []
    for (let i = position.get(type)!; i < list.length; i++) {
      const { task } = list[i]
      const sentence = sentenceOf(task)
      const lemma = lemmaOf(task)
      if (sentence && usedSentences.has(sentence.id)) continue
      if (lemma && usedLemmas.has(lemma)) continue
      if (sentence) usedSentences.add(sentence.id)
      if (lemma) usedLemmas.add(lemma)
      picked.get(type)!.push(task)
      position.set(type, i + 1)
      return true
    }
    position.set(type, list.length)
    return false
  }

  let missing = 0
  for (const [type, n] of mix) {
    for (let i = 0; i < n; i++) if (!takeOne(type)) missing++
  }
  // Round by round over the types that still have tasks.
  while (missing > 0) {
    let took = false
    for (const [type] of mix) {
      if (missing > 0 && takeOne(type)) {
        missing--
        took = true
      }
    }
    if (!took) break
  }
  return mix.flatMap(([type]) => picked.get(type)!)
}

/** A new attempt at a test: fresh tasks every time. */
export function createTest(id: TestId, random: Random = Math.random): Task[] {
  const mix = id.topic ? TOPIC_MIX : EXAM_MIX
  return compose(mix, new Map(mix.map(([type]) => [type, candidates(id, type, random)])))
}

/** `${kind}|${itemId}`: how the preparation knows a task across exercise types. */
export const itemKey = (exercise: string, itemId: string) => `${exercise}|${itemId}`

/**
 * "Pripraviť sa": a practice lesson from the test's material. What is on the mistakes list comes
 * first, then the test's own level, then what was practised least.
 */
export function prepareLesson(
  id: TestId,
  mistakes: ReadonlySet<string>,
  seen: ReadonlyMap<string, number>,
  random: Random = Math.random,
): Task[] {
  const order = (list: Candidate[]) => {
    const key = ({ task }: Candidate) => itemKey(task.kind, task.itemId)
    return [...list].sort(
      (a, b) =>
        Number(!mistakes.has(key(a))) - Number(!mistakes.has(key(b))) ||
        a.rank - b.rank ||
        (seen.get(key(a)) ?? 0) - (seen.get(key(b)) ?? 0),
    )
  }
  const tasks = compose(PREPARE_MIX, new Map(PREPARE_MIX.map(([type]) => [type, order(candidates(id, type, random))])))
  return tasks.slice(0, LESSON_SIZE)
}

export interface NextGoal {
  level: TestLevel
  test: TestId // the next topic test not passed, or the level exam once they all are
  passed: number // topic tests passed at the level
  total: number
}

/**
 * Where the learner stands: the lowest level whose exam is not passed yet, and its next test.
 * Undefined once every exam is passed.
 */
export function nextGoal(isPassed: (key: string) => boolean): NextGoal | undefined {
  for (const level of TEST_LEVELS) {
    if (isPassed(testKey({ level }))) continue
    const tests = topicTests(level)
    const open = tests.filter((test) => !isPassed(testKey(test)))
    return { level, test: open[0] ?? { level }, passed: tests.length - open.length, total: tests.length }
  }
  return undefined
}
