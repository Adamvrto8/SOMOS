import { useMemo } from 'react'
import { sentences, tipById, topicById, verbById, verbs } from '../data'
import type { Level, Person, Sentence, Verb, Word } from '../data/types'
import { PERSONS, type TableTense } from './conjugate'
import { builderWords, conjugationTask, LESSON_SIZE, seededRandom, taskFromItem, vocabTask, type ExerciseType, type Grade, type Task } from './lesson'
import { useLessonProgression, type LessonProgressionMap } from './lessonProgress'
import { localizedTip, topicName } from './localized'
import { getOnboarding, MOTIVATIONS, useOnboarding, type OnboardingState } from './onboarding'
import { orderedUnits, pathUnitById, pathUnits, unitMaterial, type PathUnit } from './pathUnits'
import { useTestResults } from './testProgress'
import { itemKey, testKey, testToParams, type TestId } from './tests'
import { tipFor, tipForCloze } from './tips'

// The guided path ("Cesta", docs/guided-path-spec.md): every unit is a row of steps, each step a lesson
// built from the unit's words and sentences, the last one the unit's test. Nothing new is stored: a step
// is a record of the numbered lessons' map ("path:a1-food-1:words"), the test a test result, and where
// to go on is worked out from both.

export type StepId = 'words' | 'words2' | 'grammar' | 'sentences' | 'listening' | 'review' | 'test'

/** The steps whose tasks stay the same every time (resumed and passed like numbered lessons). */
const FIXED_STEPS = ['words', 'words2', 'grammar', 'sentences', 'listening'] as const
type FixedStep = (typeof FIXED_STEPS)[number]

/** A grammar step with fewer tasks than this is left out of its unit. */
const MIN_GRAMMAR_TASKS = 4
/** Conjugations in a grammar step, the rest are blanks of sentences. */
const GRAMMAR_CONJUGATIONS = 4

const LEVEL_ORDER: Level[] = ['A1', 'A2', 'B1', 'B2']
const levelsUpTo = (level: Level) => LEVEL_ORDER.slice(0, LEVEL_ORDER.indexOf(level) + 1)

type Random = () => number

function shuffle<T>(items: T[], random: Random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** The items `first` takes before the others, each part in the order it had (a stable sort, in one pass). */
function firstThose<T>(items: T[], first: (item: T) => boolean): T[] {
  return [...items.filter(first), ...items.filter((item) => !first(item))]
}

/** A seed from text: the same unit, the same tasks. */
function seedOf(text: string): number {
  let hash = 0
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash
}

// ---------- words ----------

function unitWords(unit: PathUnit) {
  const all = unitMaterial(unit).words
  return { first: all.slice(0, LESSON_SIZE), second: all.slice(LESSON_SIZE) }
}

// ---------- grammar ----------

const TENSE_TIPS: Record<string, TableTense> = {
  presente: 'presente',
  progresivo: 'progresivo',
  preterito: 'preterito',
  imperfecto: 'imperfecto',
  futuro: 'futuro',
}

// The accented words whose accent makes another word (CLAUDE.md §4).
const ACCENTED = new Set(['está', 'él', 'tú', 'sí', 'más', 'sé', 'té', 'dé', 'mí', 'qué', 'cómo', 'dónde', 'cuándo', 'quién', 'cuál', 'cuánto', 'cuánta', 'cuántos', 'cuántas'])

const RIGHT: Grade = { correct: true, verdict: 'correct', expected: '' }

const ruleFits = (unit: PathUnit, rule?: string) => !unit.rules || (rule !== undefined && unit.rules.includes(rule))

interface TipOf {
  tip?: string
  rule?: string
}

// Which tip and rule explain a task, worked out once per task: the steps of every unit look through them all.
const tipCache = new Map<string, TipOf>()

function cachedTip(key: string, find: () => TipOf): TipOf {
  let found = tipCache.get(key)
  if (!found) {
    found = find()
    tipCache.set(key, found)
  }
  return found
}

/** Whether a blank practises the unit's grammar point (the tip "Prečo?" would open for it). */
function clozeFits(unit: PathUnit, sentence: Sentence, index: number): boolean {
  const cloze = sentence.cloze![index]
  if (unit.grammar === 'reflexive') return verbById.get(cloze.lemma)?.reflexive === true
  if (unit.grammar === 'accents') return ACCENTED.has(cloze.answer.toLowerCase())
  const found = cachedTip(`${sentence.id}#${index}`, () => {
    const tip = tipForCloze(sentence, cloze)
    return { tip: tip?.tip.id, rule: tip?.tip.id === 'ser-estar' ? cloze.why : tip?.rule?.id }
  })
  // Which of the two past tenses: blanks of either, the sentence tells which one fits.
  if (unit.grammar === 'preterito-imperfecto') return found.tip === 'preterito' || found.tip === 'imperfecto'
  // No blank asks the gender itself: the article or adjective that agrees with it does.
  if (unit.grammar === 'gender') return sentence.grammar?.includes('gender') === true && (found.tip === 'articles' || found.tip === 'adjectives')
  return found.tip === unit.grammar && ruleFits(unit, found.rule)
}

/** Verbs of the point's tense, the unit's own verbs first, one person each that the point explains. */
function grammarConjugations(unit: PathUnit): Task[] {
  const tense = unit.grammar === 'reflexive' ? 'presente' : TENSE_TIPS[unit.grammar]
  if (!tense) return []
  const levels = levelsUpTo(unit.level)
  const own = new Set(unitMaterial(unit).words.flatMap((w) => (w.verbId ? [w.verbId] : [])))
  const list = firstThose(
    shuffle(
      verbs.filter((v) => levels.includes(v.level)),
      seededRandom(seedOf(`${unit.id}:verbs`)),
    ),
    (v) => own.has(v.id),
  )
  const fits = (verb: Verb, person: Person) => {
    if (unit.grammar === 'reflexive') return verb.reflexive === true
    const found = cachedTip(`${verb.id}:${tense}:${person}`, () => {
      const tip = tipFor(conjugationTask(verb, tense, person), RIGHT)
      return { tip: tip?.tip.id, rule: tip?.rule?.id }
    })
    return found.tip === unit.grammar && ruleFits(unit, found.rule)
  }
  const out: Task[] = []
  for (const verb of list) {
    if (out.length === GRAMMAR_CONJUGATIONS) break
    // The persons take turns from task to task; the first one the point explains is asked.
    for (let k = 0; k < PERSONS.length; k++) {
      const person = PERSONS[(out.length + k) % PERSONS.length]
      if (fits(verb, person)) {
        out.push(conjugationTask(verb, tense, person))
        break
      }
    }
  }
  return out
}

/** Blanks that practise the point, from the unit's sentences first, then any of the level and below. */
function grammarClozes(unit: PathUnit, size: number): { sentence: Sentence; index: number }[] {
  const own = new Set(unitMaterial(unit).sentences)
  const levels = levelsUpTo(unit.level)
  const pool = firstThose(
    shuffle(
      sentences.filter((s) => levels.includes(s.level)),
      seededRandom(seedOf(`${unit.id}:clozes`)),
    ),
    (s) => own.has(s),
  )
  const out: { sentence: Sentence; index: number }[] = []
  for (const sentence of pool) {
    if (out.length === size) break
    const index = (sentence.cloze ?? []).findIndex((_, i) => clozeFits(unit, sentence, i))
    if (index >= 0) out.push({ sentence, index })
  }
  return out
}

// ---------- sentences ----------

/** A task of one kind from a sentence, if the sentence has what the kind needs. */
function sentenceTask(kind: ExerciseType, sentence: Sentence, random: Random): Task | undefined {
  if (kind === 'choice' && (sentence.cloze?.[0].distractors?.length ?? 0) < 2) return undefined
  if (kind === 'builder' && builderWords(sentence).length < 3) return undefined
  if (kind === 'dictation' && /\d/.test(sentence.es)) return undefined // a digit has no single spoken form
  const itemId = kind === 'cloze' || kind === 'choice' ? `${sentence.id}#0` : sentence.id
  return taskFromItem(kind, itemId, random)
}

/**
 * One task per sentence, the kinds taking turns in `kinds` (each sentence the first kind it allows),
 * then a second kind for the sentences until the lesson is full.
 */
function sentenceLesson(list: Sentence[], kinds: ExerciseType[], random: Random): Task[] {
  const out: Task[] = []
  const used = new Set<string>()
  const add = (task: Task | undefined) => {
    if (!task || out.length === LESSON_SIZE || used.has(`${task.kind}|${task.itemId}`)) return false
    used.add(`${task.kind}|${task.itemId}`)
    out.push(task)
    return true
  }
  list.forEach((sentence, i) => {
    for (let k = 0; k < kinds.length; k++) if (add(sentenceTask(kinds[(i + k) % kinds.length], sentence, random))) break
  })
  list.forEach((sentence, i) => {
    for (let k = 1; k < kinds.length; k++) if (add(sentenceTask(kinds[(i + k) % kinds.length], sentence, random))) break
  })
  return out
}

// ---------- steps ----------

/** The words a words step brings in, met on cards before its tasks; none for the other steps. */
export function stepNewWords(unit: PathUnit, step: StepId): Word[] {
  const { first, second } = unitWords(unit)
  return step === 'words' ? first : step === 'words2' ? second : []
}

/** The tasks of a fixed step, always the same ones (the options and tiles shuffled by `random`). */
export function stepTasks(unit: PathUnit, step: FixedStep, random: Random = Math.random): Task[] {
  const { first, second } = unitWords(unit)
  const unitSentences = unitMaterial(unit).sentences
  switch (step) {
    case 'words':
      return first.map((word) => vocabTask(word, 'es-sk'))
    case 'words2':
      // The second ten, then the first ones the other way round, to fill the lesson.
      return second.length === 0
        ? []
        : [...second.map((word) => vocabTask(word, 'es-sk')), ...first.slice(0, Math.max(0, LESSON_SIZE - second.length)).map((word) => vocabTask(word, 'sk-es'))]
    case 'grammar': {
      const conjugations = grammarConjugations(unit)
      // Picking and typing take turns.
      const clozes = grammarClozes(unit, LESSON_SIZE - conjugations.length).flatMap(({ sentence, index }, i) => {
        const kind = i % 2 === 0 && (sentence.cloze![index].distractors?.length ?? 0) >= 2 ? 'choice' : 'cloze'
        return taskFromItem(kind, `${sentence.id}#${index}`, random) ?? []
      })
      const tasks = [...conjugations, ...clozes]
      return tasks.length >= MIN_GRAMMAR_TASKS ? tasks : []
    }
    case 'sentences':
      return sentenceLesson(unitSentences, ['choice', 'cloze', 'builder'], random)
    case 'listening':
      // The unit's last sentences first: a topic with many sentences hears others than it built.
      return sentenceLesson([...unitSentences].reverse(), ['dictation', 'translation'], random)
  }
}

/** Whether a fixed step has tasks, without making them (the path's state asks it of every unit). */
function hasTasks(unit: PathUnit, step: FixedStep): boolean {
  const { first, second } = unitWords(unit)
  const unitSentences = unitMaterial(unit).sentences
  switch (step) {
    case 'words':
      return first.length > 0
    case 'words2':
      return second.length > 0
    case 'grammar': {
      const conjugations = grammarConjugations(unit).length
      return conjugations + grammarClozes(unit, LESSON_SIZE - conjugations).length >= MIN_GRAMMAR_TASKS
    }
    case 'sentences':
      return unitSentences.some((s) => (s.cloze?.length ?? 0) > 0 || builderWords(s).length >= 3)
    case 'listening':
      return unitSentences.length > 0 // a translation can be asked of any sentence
  }
}

const stepCache = new Map<string, StepId[]>()

/** The steps of a unit: the fixed ones that have tasks, then the review and the test. */
export function unitSteps(unit: PathUnit): StepId[] {
  let steps = stepCache.get(unit.id)
  if (!steps) {
    steps = [...FIXED_STEPS.filter((step) => hasTasks(unit, step)), 'review', 'test']
    stepCache.set(unit.id, steps)
  }
  return steps
}

/**
 * The review step, new every time: the unit's own mistakes first, then words and sentences of this
 * unit and the ones before it, those answered least often first. `mistakes` and `seen` by itemKey.
 */
export function reviewTasks(
  unit: PathUnit,
  units: readonly PathUnit[],
  mistakes: ReadonlySet<string>,
  seen: ReadonlyMap<string, number>,
  random: Random = Math.random,
): Task[] {
  const key = (task: Task) => itemKey(task.kind, task.itemId)
  const out: Task[] = []
  const usedSentences = new Set<string>()
  const add = (task: Task) => {
    const sentence = 'sentence' in task ? task.sentence.id : undefined
    if (out.some((t) => key(t) === key(task)) || (sentence && usedSentences.has(sentence))) return false
    if (sentence) usedSentences.add(sentence)
    out.push(task)
    return true
  }

  const ownMistakes = FIXED_STEPS.flatMap((step) => stepTasks(unit, step, random)).filter((task) => mistakes.has(key(task)))
  for (const task of ownMistakes) if (out.length < LESSON_SIZE / 2) add(task)

  const at = units.indexOf(unit)
  const learnt = at < 0 ? [unit] : units.slice(0, at + 1)
  const least = (tasks: Task[]) => shuffle(tasks, random).sort((a, b) => (seen.get(key(a)) ?? 0) - (seen.get(key(b)) ?? 0))
  const material = learnt.map(unitMaterial)
  const pools: [Task[], number][] = [
    [least(material.flatMap((m) => m.words.map((word) => vocabTask(word, 'sk-es')))), 4],
    [least(material.flatMap((m) => m.sentences.flatMap((s) => sentenceTask('cloze', s, random) ?? []))), 3],
    [least(material.flatMap((m) => m.sentences.flatMap((s) => sentenceTask('builder', s, random) ?? []))), 3],
  ]
  for (const [pool, n] of pools) {
    let taken = 0
    for (const task of pool) {
      if (taken === n || out.length === LESSON_SIZE) break
      if (add(task)) taken++
    }
  }
  // A type that ran short leaves its places to the others.
  for (const [pool] of pools) for (const task of pool) if (out.length < LESSON_SIZE) add(task)
  return out
}

/** The unit's test: the topic test, or the test of its part when the topic is split. */
export const unitTest = (unit: PathUnit): TestId =>
  unit.parts > 1 ? { level: unit.level, topic: unit.topic, part: unit.part } : { level: unit.level, topic: unit.topic }

/** Where a step is stored in the numbered lessons' map. */
export const stepKey = (unit: PathUnit, step: StepId) => `path:${unit.id}:${step}`

export function stepHref(unit: PathUnit, step: StepId): string {
  return step === 'test' ? `/practice/test?${testToParams(unitTest(unit))}` : `/practice/lesson?path=${unit.id}&step=${step}`
}

/** The step a lesson URL names (`?path=a1-food-1&step=words`); the test is not a lesson. */
export function parsePathStep(unitParam: string | null, stepParam: string | null): { unit: PathUnit; step: Exclude<StepId, 'test'> } | undefined {
  const unit = unitParam ? pathUnitById.get(unitParam) : undefined
  const step = unit && unitSteps(unit).find((s) => s === stepParam)
  return unit && step && step !== 'test' ? { unit, step } : undefined
}

export const isFixedStep = (step: StepId): step is FixedStep => (FIXED_STEPS as readonly string[]).includes(step)

// ---------- where the learner stands ----------

export interface StepState {
  id: StepId
  done: boolean
  unlocked: boolean
}

export interface UnitState {
  unit: PathUnit
  number: number // 1… in the learner's order
  steps: StepState[]
  done: boolean
  unlocked: boolean
  /** Of a level below the one the learner started at (the welcome): open, but not where the path goes on. */
  belowStart: boolean
}

/**
 * Units open one after another: the next one once the test of the one before is passed. Inside a unit
 * the steps go in order, but its test is open from the start ("Viem to"): passing it closes the unit.
 * A passed topic test or level exam (Testy) closes the units it covers. A learner who started at a
 * higher level starts at its first unit, the units of the levels below are all open.
 */
export function pathState(
  units: readonly PathUnit[],
  progression: LessonProgressionMap,
  isPassed: (testKey: string) => boolean,
  startLevel: Level = 'A1',
): UnitState[] {
  const out: UnitState[] = []
  const start = units.findIndex((unit) => unit.level === startLevel)
  units.forEach((unit, i) => {
    const belowStart = LEVEL_ORDER.indexOf(unit.level) < LEVEL_ORDER.indexOf(startLevel)
    const unlocked = i === 0 || i === start || belowStart || out[i - 1].done
    const done = isPassed(testKey(unitTest(unit))) || isPassed(testKey({ level: unit.level, topic: unit.topic })) || isPassed(unit.level)
    // Worked out when asked for: a unit's steps need its tasks made, and only a few units are looked into.
    let steps: StepState[] | undefined
    const stepStates = () => {
      let previousDone = true
      return unitSteps(unit).map((id): StepState => {
        const stepDone = done || (id !== 'test' && progression[stepKey(unit, id)]?.passed === true)
        const state = { id, done: stepDone, unlocked: unlocked && (id === 'test' || previousDone) }
        previousDone = stepDone
        return state
      })
    }
    out.push({
      unit,
      number: i + 1,
      get steps() {
        return (steps ??= stepStates())
      },
      done,
      unlocked,
      belowStart,
    })
  })
  return out
}

export interface NextStep {
  unit: UnitState
  step: StepState
  index: number // of the step in the unit
}

/**
 * The first step not done of the first unit not done, from the learner's start level on (then the
 * levels below it); undefined once the path is walked.
 */
export function nextStep(states: readonly UnitState[]): NextStep | undefined {
  const unit = states.find((u) => !u.done && !u.belowStart) ?? states.find((u) => !u.done)
  if (!unit) return undefined
  const index = unit.steps.findIndex((s) => !s.done && s.unlocked)
  return index < 0 ? undefined : { unit, step: unit.steps[index], index }
}

/** The units in the learner's order: the topic of the welcome's reason comes early in the start level. */
export function learnerUnits(onboarding: OnboardingState | null = getOnboarding()): PathUnit[] {
  return orderedUnits(MOTIVATIONS.find((m) => m.id === onboarding?.motivation)?.topic, startLevelOf(onboarding))
}

/** The level the learner started at in the welcome, A1 without one. */
export const startLevelOf = (onboarding: OnboardingState | null) => onboarding?.level ?? 'A1'

/** The unit a learner begins with: the first of the start level. */
export const firstUnit = (onboarding: OnboardingState | null = getOnboarding()) =>
  learnerUnits(onboarding).find((unit) => unit.level === startLevelOf(onboarding))

/** Whether the path has units for a learner who started at `level`. */
export const pathCovers = (level?: Level) => pathUnits.some((unit) => unit.level === (level ?? 'A1'))

/** Whether anything of the path was done yet: a step or a unit. */
export const pathStarted = (states: readonly UnitState[], progression: LessonProgressionMap) =>
  states.some((u) => u.done) || Object.keys(progression).some((key) => key.startsWith('path:'))

export function usePathState(): UnitState[] {
  const progression = useLessonProgression()
  const tests = useTestResults()
  const onboarding = useOnboarding()
  return useMemo(
    () => pathState(learnerUnits(onboarding), progression, (key) => tests[key]?.passed === true, startLevelOf(onboarding)),
    [progression, tests, onboarding],
  )
}

/** The unit whose test this is (a unit's own test, not a topic test that closes several). */
export const unitOfTest = (states: readonly UnitState[], key: string) => states.find((s) => testKey(unitTest(s.unit)) === key)

// ---------- names ----------

/** "Jedlo a pitie 2" for the second part of a topic. */
export function unitTitle(unit: PathUnit): string {
  const topic = topicById.get(unit.topic)
  const name = topic ? topicName(topic) : unit.topic
  return unit.parts > 1 ? `${name} ${unit.part}` : name
}

/** The grammar point: the tip, or with one rule "Prítomný čas (presente) · Slovesá na -ar". */
export function grammarLabel(unit: PathUnit): string {
  const tip = tipById.get(unit.grammar)
  if (!tip) return unit.grammar
  const { title, rules } = localizedTip(tip)
  const rule = unit.rules?.length === 1 ? rules.find((r) => r.id === unit.rules![0]) : undefined
  return rule ? `${title} · ${rule.title}` : title
}
