import { describe, expect, it } from 'vitest'
import { sentences, verbs, wordById, words } from '../data'
import { answerText, buildReport, taskSubject, TARGET_PATTERN, wordSubject } from './contentReport'
import { createLesson, type Task } from './lesson'

const firstTask = <K extends Task['kind']>(kind: K) => {
  const task = createLesson({ type: kind, topic: 'all', level: 'A1' }, 3, () => 0.5)[0]
  if (task?.kind !== kind) throw new Error(`${kind} expected`)
  return task as Extract<Task, { kind: K }>
}

describe('report subjects', () => {
  it('names the sentence and the blank of a cloze task, with the sentence as seen', () => {
    const task = firstTask('cloze')
    const subject = taskSubject(task)
    expect(subject.target).toBe(`sentence:${task.sentence.id}`)
    expect(subject.detail).toBe(task.itemId.split('#')[1])
    expect(subject.exercise).toBe('cloze')
    expect(subject.shown.es).toBe(task.sentence.es)
    expect(subject.shown.translation).not.toBe('')
  })

  it('names the sentence of a builder task without a detail', () => {
    const task = firstTask('builder')
    expect(taskSubject(task)).toMatchObject({ target: `sentence:${task.sentence.id}`, detail: '', exercise: 'builder' })
  })

  it('names the verb form of a conjugation task', () => {
    const task = firstTask('conjugation')
    expect(taskSubject(task)).toMatchObject({
      target: `verb:${task.verb.id}`,
      detail: `${task.tense}:${task.person}`,
      exercise: 'conjugation',
      shown: { es: task.answer },
    })
  })

  it('names the word and direction of a vocab task, and the word of Detail slova', () => {
    const task = firstTask('vocab')
    expect(taskSubject(task)).toMatchObject({ target: `word:${task.word.id}`, detail: task.direction, exercise: 'vocab' })
    expect(wordSubject(wordById.get('casa')!)).toEqual({ target: 'word:casa', detail: '', exercise: 'word', shown: { es: 'la casa', translation: 'dom, domov' } })
  })

  it('every sentence, word and verb id fits the server pattern', () => {
    const targets = [...sentences.map((s) => `sentence:${s.id}`), ...words.map((w) => `word:${w.id}`), ...verbs.map((v) => `verb:${v.id}`)]
    expect(targets.length).toBeGreaterThan(2000)
    expect(targets.filter((t) => !TARGET_PATTERN.test(t))).toEqual([])
  })
})

describe('buildReport', () => {
  const subject = wordSubject(wordById.get('casa')!)

  it('sends the answer only with its reason, and trims the note', () => {
    expect(buildReport(subject, 'spanish', '  zlý rod  ', 'casa')).toMatchObject({ reason: 'spanish', note: 'zlý rod', answer: null })
    expect(buildReport(subject, 'answer', '', 'la casa')).toMatchObject({ reason: 'answer', answer: 'la casa' })
    expect(buildReport(subject, 'answer', '', '')).toMatchObject({ answer: null })
  })

  it('cuts the note, the answer and the snapshot to what the server takes', () => {
    const long = buildReport({ ...subject, shown: { es: 'x'.repeat(400), translation: 'y'.repeat(400) } }, 'answer', 'n'.repeat(600), 'a'.repeat(300))
    expect(long.note).toHaveLength(500)
    expect(long.answer).toHaveLength(200)
    expect(long.shown.es).toHaveLength(300)
    expect(long.shown.translation).toHaveLength(300)
    expect(long.version).toBeTruthy()
  })

  it('joins builder tiles', () => {
    expect(answerText(['Yo', 'hablo', 'español', '.'])).toBe('Yo hablo español .')
    expect(answerText(' hablo ')).toBe('hablo')
  })
})
