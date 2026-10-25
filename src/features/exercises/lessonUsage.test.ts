import { describe, expect, it, vi } from 'vitest'
import { createLessonRun, lessonUsage } from './lessonUsage'

describe('lessonUsage', () => {
  it('a lesson of one exercise type keeps its type, level and topic', () => {
    expect(lessonUsage({ type: 'builder', level: 'A2', topic: 'food' }, 'lesson')).toEqual({ type: 'builder', level: 'A2', topic: 'food', source: 'lesson' })
    expect(lessonUsage({ type: 'cloze', topic: 'all' }, 'first')).toEqual({ type: 'cloze', level: null, topic: null, source: 'first' })
  })

  it('mistakes and test preparation mix exercise types: not counted as the filter fallback (cloze)', () => {
    expect(lessonUsage({ type: 'cloze' }, 'mistakes')).toEqual({ type: 'mixed', level: null, topic: null, source: 'mistakes' })
    expect(lessonUsage({ type: 'cloze' }, 'test', { level: 'B1', topic: 'food' })).toEqual({ type: 'mixed', level: 'B1', topic: 'food', source: 'test' })
    expect(lessonUsage({ type: 'cloze' }, 'test', { level: 'A1', type: 'conjugation' })).toEqual({ type: 'conjugation', level: 'A1', topic: null, source: 'test' })
  })
})

describe('createLessonRun', () => {
  const usage = lessonUsage({ type: 'choice', level: 'A1' }, 'lesson')

  it('reports the start, and the end once however many ways it ends', () => {
    const send = vi.fn()
    const run = createLessonRun(usage, 10, send)!
    run.answered()
    run.answered()
    run.end(true)
    run.end(true) // the result screen again ("Ďalšia lekcia" re-renders it)
    run.end(false) // then leaving
    expect(send.mock.calls).toEqual([
      ['lesson_start', { type: 'choice', level: 'A1', topic: null, source: 'lesson' }],
      ['lesson_end', { type: 'choice', level: 'A1', total: 10, answered: 2, finished: true }],
    ])
  })

  it('answers after the end (a correction round) change nothing', () => {
    const send = vi.fn()
    const run = createLessonRun(usage, 10, send)!
    run.end(false)
    run.answered()
    run.end(true)
    expect(send.mock.calls.at(-1)).toEqual(['lesson_end', { type: 'choice', level: 'A1', total: 10, answered: 0, finished: false }])
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('caps the counts as the server takes them, and reports nothing for an empty lesson', () => {
    const send = vi.fn()
    const run = createLessonRun(usage, 150, send)!
    for (let i = 0; i < 120; i++) run.answered()
    run.end(true)
    expect(send.mock.calls[1][1]).toMatchObject({ total: 100, answered: 100 })
    expect(createLessonRun(usage, 0, send)).toBeNull()
  })
})
