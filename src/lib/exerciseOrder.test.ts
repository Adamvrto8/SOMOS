import { describe, expect, it } from 'vitest'
import { moveExercise, orderExercises } from './exerciseOrder'
import type { ExerciseType } from './lesson'

const TYPES: ExerciseType[] = ['cloze', 'choice', 'vocab', 'matching']

describe('orderExercises', () => {
  it('by recency: the one played last first, never played ones after in their own order', () => {
    const played = new Map<ExerciseType, number>([
      ['vocab', 100],
      ['matching', 300],
    ])
    expect(orderExercises(TYPES, { mode: 'recent', custom: [] }, played)).toEqual(['matching', 'vocab', 'cloze', 'choice'])
  })

  it('by recency with nothing played keeps the default order', () => {
    expect(orderExercises(TYPES, { mode: 'recent', custom: [] }, new Map())).toEqual(TYPES)
  })

  it('custom: the learner order, a type missing from it (a new exercise) at the end', () => {
    const played = new Map<ExerciseType, number>([['cloze', 500]])
    expect(orderExercises(TYPES, { mode: 'custom', custom: ['vocab', 'matching', 'cloze'] }, played)).toEqual(['vocab', 'matching', 'cloze', 'choice'])
  })

  it('custom ignores a type that is not shown (speaking without speech recognition)', () => {
    expect(orderExercises(['cloze', 'vocab'], { mode: 'custom', custom: ['speaking', 'vocab', 'cloze'] }, new Map())).toEqual(['vocab', 'cloze'])
  })
})

describe('moveExercise', () => {
  it('moves one place up or down', () => {
    expect(moveExercise(TYPES, 'vocab', -1)).toEqual(['cloze', 'vocab', 'choice', 'matching'])
    expect(moveExercise(TYPES, 'vocab', 1)).toEqual(['cloze', 'choice', 'matching', 'vocab'])
  })

  it('stays put at the ends', () => {
    expect(moveExercise(TYPES, 'cloze', -1)).toEqual(TYPES)
    expect(moveExercise(TYPES, 'matching', 1)).toEqual(TYPES)
  })
})
