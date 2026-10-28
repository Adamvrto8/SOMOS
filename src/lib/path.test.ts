import { describe, expect, it } from 'vitest'
import { words } from '../data'
import type { LessonProgressionMap } from './lessonProgress'
import { tipForCloze } from './tips'
import { nextStep, parsePathStep, pathState, reviewTasks, stepHref, stepKey, stepNewWords, stepTasks, unitOfTest, unitSteps, unitTest, type StepId } from './path'
import { MAX_UNIT_WORDS, orderedUnits, pathUnitById, pathUnits, unitMaterial } from './pathUnits'
import { createTest, hasTest, parseTestKey, testKey } from './tests'

const passed = { bestScore: 10, total: 10, passed: true }
const none = () => false

describe('path units', () => {
  it('teach every word with a topic exactly once, A1 to B2', () => {
    const taught = pathUnits.flatMap((unit) => unitMaterial(unit).words.map((w) => w.id))
    expect(new Set(taught).size).toBe(taught.length)
    expect(taught.length).toBe(words.filter((w) => w.topics.length > 0).length)
    expect(new Set(pathUnits.map((unit) => unit.level))).toEqual(new Set(['A1', 'A2', 'B1', 'B2']))
  })

  it('have at most the words a unit can teach', () => {
    for (const unit of pathUnits) expect(unitMaterial(unit).words.length).toBeLessThanOrEqual(MAX_UNIT_WORDS)
  })

  it('each have a grammar step, sentences, a review and a test', () => {
    for (const unit of pathUnits) {
      const steps = unitSteps(unit)
      expect(steps, unit.id).toEqual(expect.arrayContaining(['grammar', 'sentences', 'listening', 'review', 'test']))
      expect(hasTest(unitTest(unit)), unit.id).toBe(true)
    }
  })

  it('put the topic of the welcome right after the first two units', () => {
    const units = orderedUnits('travel')
    expect(units[2].id).toBe('a1-travel-1')
    expect(units).toHaveLength(pathUnits.length)
    expect(orderedUnits('greetings')).toBe(pathUnits)
  })

  it('put it after the first two units of the level the learner starts at', () => {
    const units = orderedUnits('travel', 'A2')
    const start = units.findIndex((unit) => unit.level === 'A2')
    expect(units[start + 2].id).toBe('a2-travel-1')
    expect(units.slice(0, start)).toEqual(pathUnits.slice(0, start))
    expect(units).toHaveLength(pathUnits.length)
  })
})

describe('steps', () => {
  const food = pathUnitById.get('a1-food-1')!

  it('are the same tasks every time', () => {
    for (const step of ['words', 'words2', 'grammar', 'sentences', 'listening'] as const) {
      const ids = (random: () => number) => stepTasks(food, step, random).map((t) => `${t.kind}|${t.itemId}`)
      expect(ids(() => 0.1)).toEqual(ids(() => 0.9))
    }
  })

  it('ask the new words from Spanish, at most a lesson each', () => {
    const tasks = stepTasks(food, 'words')
    expect(tasks.length).toBeLessThanOrEqual(10)
    expect(tasks.every((t) => t.kind === 'vocab' && t.direction === 'es-sk')).toBe(true)
  })

  it('bring in the new words of their own part only', () => {
    expect(stepNewWords(food, 'words').map((w) => w.id)).toEqual(unitMaterial(food).words.slice(0, 10).map((w) => w.id))
    expect(stepNewWords(food, 'words2').map((w) => w.id)).toEqual(unitMaterial(food).words.slice(10).map((w) => w.id))
    expect(stepNewWords(food, 'grammar')).toEqual([])
  })

  it('mix both past tenses where the point is which one', () => {
    const unit = pathUnits.find((u) => u.grammar === 'preterito-imperfecto')!
    const tasks = stepTasks(unit, 'grammar')
    expect(tasks.length).toBeGreaterThanOrEqual(4)
    const tips = new Set(tasks.map((t) => (t.kind === 'cloze' || t.kind === 'choice' ? tipForCloze(t.sentence, t.cloze)?.tip.id : t.kind)))
    expect(tips).toEqual(new Set(['preterito', 'imperfecto']))
  })

  it('practise the grammar point of the unit', () => {
    const ar = pathUnitById.get('a1-family-1')!
    const conjugations = stepTasks(ar, 'grammar').filter((t) => t.kind === 'conjugation')
    expect(conjugations.length).toBeGreaterThan(0)
    expect(conjugations.every((t) => t.kind === 'conjugation' && t.verb.group === 'ar' && t.tense === 'presente')).toBe(true)
  })

  it('review puts the unit’s mistakes first', () => {
    const task = stepTasks(food, 'sentences')[0]
    const tasks = reviewTasks(food, pathUnits, new Set([`${task.kind}|${task.itemId}`]), new Map())
    expect(tasks[0].itemId).toBe(task.itemId)
    expect(tasks.length).toBe(10)
  })

  it('open from their URL, the test from Testy', () => {
    expect(parsePathStep('a1-food-1', 'grammar')?.step).toBe('grammar')
    expect(parsePathStep('a1-food-1', 'test')).toBeUndefined()
    expect(parsePathStep('a1-nothing-1', 'words')).toBeUndefined()
    expect(stepHref(food, 'test')).toBe('/practice/test?level=A1&topic=food&part=1')
  })
})

describe('tests of a part', () => {
  it('round-trip through their key and ask only the part', () => {
    const id = unitTest(pathUnitById.get('a1-food-2')!)
    expect(parseTestKey(testKey(id))).toEqual(id)
    const { words: partWords, sentences } = unitMaterial(pathUnitById.get('a1-food-2')!)
    for (const task of createTest(id)) {
      if (task.kind === 'vocab') expect(partWords).toContain(task.word)
      else if ('sentence' in task) expect(sentences).toContain(task.sentence)
    }
  })

  it('exist only for split topics', () => {
    expect(hasTest({ level: 'A1', topic: 'work', part: 1 })).toBe(false)
    expect(hasTest({ level: 'A1', topic: 'food', part: 3 })).toBe(true)
  })
})

describe('path state', () => {
  const [first, second] = pathUnits
  const doneSteps = (unit: (typeof pathUnits)[number], steps: StepId[]): LessonProgressionMap =>
    Object.fromEntries(steps.map((step) => [stepKey(unit, step), passed]))

  it('starts at the first step of the first unit, the rest locked', () => {
    const states = pathState(pathUnits, {}, none)
    expect(nextStep(states)).toMatchObject({ unit: { unit: first }, index: 0 })
    expect(states[0].steps.map((s) => s.unlocked)).toEqual(unitSteps(first).map((s, i) => i === 0 || s === 'test'))
    expect(states[1].unlocked).toBe(false)
  })

  it('goes on step by step', () => {
    const states = pathState(pathUnits, doneSteps(first, unitSteps(first).slice(0, 2)), none)
    expect(nextStep(states)?.index).toBe(2)
  })

  it('opens the next unit once the test is passed, also from Testy', () => {
    const viaTest = pathState(pathUnits, {}, (key) => key === testKey(unitTest(first)))
    expect(viaTest[0].done).toBe(true)
    expect(viaTest[0].steps.every((s) => s.done)).toBe(true)
    expect(nextStep(viaTest)?.unit.unit).toBe(second)
  })

  it('closes every part of a topic whose topic test was passed, and the level with its exam', () => {
    const food = pathState(pathUnits, {}, (key) => key === 'food:A1')
    expect(food.filter((u) => u.unit.topic === 'food' && u.unit.level === 'A1').every((u) => u.done)).toBe(true)
    expect(food.find((u) => u.unit.id === 'a2-food-1')?.done).toBe(false)
    const exam = pathState(pathUnits, {}, (key) => key === 'A1')
    expect(exam.filter((u) => u.unit.level === 'A1').every((u) => u.done)).toBe(true)
    expect(nextStep(exam)?.unit.unit.id).toBe(pathUnits.find((u) => u.level === 'A2')!.id)
  })

  it('starts a learner at the first unit of the level picked in the welcome, the levels below open', () => {
    const states = pathState(pathUnits, {}, none, 'B1')
    const start = states.findIndex((u) => u.unit.level === 'B1')
    expect(nextStep(states)?.unit).toBe(states[start])
    expect(states.slice(0, start).every((u) => u.unlocked && u.belowStart && !u.done)).toBe(true)
    expect(states[start + 1].unlocked).toBe(false)
    // Once B1 and B2 are walked, the path goes back to what was left below.
    const walked = pathState(pathUnits, {}, (key) => key === 'B1' || key === 'B2', 'B1')
    expect(nextStep(walked)?.unit.unit).toBe(first)
  })

  it('knows the unit whose own test a test is', () => {
    const states = pathState(pathUnits, {}, none)
    expect(unitOfTest(states, 'food:A1:2')?.unit.id).toBe('a1-food-2')
    expect(unitOfTest(states, 'work:A1')?.unit.id).toBe('a1-work-1')
    expect(unitOfTest(states, 'food:A1')).toBeUndefined()
  })
})
