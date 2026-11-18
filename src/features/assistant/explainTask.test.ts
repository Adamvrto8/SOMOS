import { describe, expect, it } from 'vitest'
import { sentences } from '../../data'
import { MAX_QUESTION_CHARS } from '../../lib/assistant/limits'
import { taskFromItem, type Task } from '../../lib/lesson'
import { explainQuestion } from './explainTask'

const task = (type: Parameters<typeof taskFromItem>[0], itemId: string): Task => {
  const found = taskFromItem(type, itemId)
  if (!found) throw new Error(`no task ${type} ${itemId}`)
  return found
}

describe('explainQuestion', () => {
  it('puts the task, both answers and the tip with its reason into one question', () => {
    const question = explainQuestion(task('conjugation', 'tener:preterito:yo'), 'tenía')
    const lines = question.split('\n')
    expect(lines[0]).toBe('Prečo je moja odpoveď zlá?')
    expect(lines).toContain('Úloha: tener · yo · pretérito')
    expect(lines).toContain('Moja odpoveď: tenía')
    expect(lines).toContain('Správne: tuve')
    expect(lines.at(-1)).toMatch(/^Tip: \S+/)
  })

  it('shows a cloze with its blank and hint, as the task did', () => {
    const sentence = sentences.find((s) => s.cloze?.some((c) => c.hint?.endsWith('· pretérito')))!
    const index = sentence.cloze!.findIndex((c) => c.hint?.endsWith('· pretérito'))
    const cloze = sentence.cloze![index]
    const question = explainQuestion(task('cloze', `${sentence.id}#${index}`), 'x')
    const asked = question.split('\n').find((line) => line.startsWith('Úloha: '))!
    expect(asked).toContain('___')
    expect(asked).toContain(`(${cloze.hint})`)
    expect(asked.split(' – ')[0]).not.toMatch(new RegExp(`(^|\\s)${cloze.answer}(\\s|[.,?!]|$)`))
    expect(question).toContain(`Správne: ${cloze.answer}`)
  })

  it('asks to explain the task when the wrong answer is not known (Chyby)', () => {
    const question = explainQuestion(task('conjugation', 'ser:presente:nosotros'))
    expect(question.split('\n')[0]).toBe('Vysvetli mi túto úlohu, robím v nej chyby.')
    expect(question).not.toContain('Moja odpoveď')
  })

  it('asks why the right answer is right when the learner gave up', () => {
    expect(explainQuestion(task('conjugation', 'ser:presente:nosotros'), '').split('\n')[0]).toBe('Prečo je správne práve toto?')
  })

  it('never goes past what the chat may send', () => {
    const question = explainQuestion(task('conjugation', 'tener:preterito:yo'), 'x'.repeat(400))
    expect(question.length).toBeLessThanOrEqual(MAX_QUESTION_CHARS)
  })
})
