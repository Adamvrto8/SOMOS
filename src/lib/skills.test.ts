import { describe, expect, it } from 'vitest'
import { EXERCISE_TYPES } from './exerciseOrder'
import { isSkill, SKILL_OF, SKILLS, skillOfExercise, typesOfSkill } from './skills'
import { bySkill } from './stats'

describe('skill groups', () => {
  it('every exercise type has a group and every group has a type', () => {
    for (const type of EXERCISE_TYPES) expect(SKILLS).toContain(SKILL_OF[type])
    for (const skill of SKILLS) expect(typesOfSkill(skill).length).toBeGreaterThan(0)
    expect(SKILLS.flatMap(typesOfSkill).sort()).toEqual([...EXERCISE_TYPES].sort())
  })

  it('matches the table of the spec', () => {
    expect(typesOfSkill('vocabulary').sort()).toEqual(['cloze', 'matching', 'vocab'])
    expect(typesOfSkill('grammar').sort()).toEqual(['choice', 'conjugation', 'findmistake', 'truefalse'])
    expect(typesOfSkill('writing').sort()).toEqual(['builder', 'translation'])
    expect(typesOfSkill('listening').sort()).toEqual(['dictation', 'speaking'])
  })

  it('tells a skill from anything else', () => {
    expect(isSkill('grammar')).toBe(true)
    expect(isSkill('all')).toBe(false)
    expect(isSkill(null)).toBe(false)
    expect(skillOfExercise('review')).toBeUndefined()
    expect(skillOfExercise('toString')).toBeUndefined()
    expect(skillOfExercise('builder')).toBe('writing')
  })
})

describe('bySkill', () => {
  const answers = (exercise: string, count: number, right = count) =>
    Array.from({ length: count }, (_, i) => ({ exercise, correct: i < right }))

  it('groups the answers by skill, most practised first, reviews and unknown exercises left out', () => {
    const split = bySkill([
      ...answers('cloze', 2, 1),
      ...answers('vocab', 3, 3),
      ...answers('conjugation', 6, 4),
      ...answers('findmistake', 1, 0),
      ...answers('review', 20),
      ...answers('old-exercise', 5),
    ])
    expect(split).toEqual([
      { skill: 'grammar', count: 7, correct: 4 },
      { skill: 'vocabulary', count: 5, correct: 4 },
    ])
  })

  it('keeps the order of the groups on equal counts', () => {
    expect(bySkill([...answers('speaking', 2), ...answers('builder', 2), ...answers('choice', 2)]).map((s) => s.skill)).toEqual([
      'grammar',
      'writing',
      'listening',
    ])
  })

  it('is empty without answers, and with reviews only', () => {
    expect(bySkill([])).toEqual([])
    expect(bySkill(answers('review', 4))).toEqual([])
  })
})
