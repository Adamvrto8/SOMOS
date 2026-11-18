import { t } from '../../i18n'
import { MAX_QUESTION_CHARS } from '../../lib/assistant/limits'
import type { Grade, Task } from '../../lib/lesson'
import { sentenceTranslation } from '../../lib/localized'
import { spaceBefore } from '../../lib/text'
import { tipFor } from '../../lib/tips'
import { exerciseInfo } from '../exercises/exercises'
import { taskSummary } from '../exercises/taskSummary'

// "Prečo?" asked of SOMO (docs/chat-assistant-improvements.md F1): a task the learner got wrong as one question,
// built only from what the app knows (the task, the learner's answer, the right one, the check and the task's tip).
// It is the very text the chat shows and the model reads, so the learner sees what SOMO was told.

const LINE_CHARS = 170

const clip = (text: string, max = LINE_CHARS) => {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length <= max ? line : `${line.slice(0, max - 1).trimEnd()}…`
}

/** The sentence with its blank, as the task showed it: "Ayer ___ mucho trabajo." */
const blanked = (tokens: string[], blank: number) =>
  tokens.map((token, i) => `${i > 0 && spaceBefore(tokens, i) ? ' ' : ''}${i === blank ? '___' : token}`).join('')

/** What the task asked and its right answer, in the words the screen used. */
function asked(task: Task): { asked: string; right: string } {
  switch (task.kind) {
    case 'cloze':
    case 'choice': {
      const hint = task.cloze.hint ? ` (${task.cloze.hint})` : ''
      return { asked: `${blanked(task.sentence.tokens, task.cloze.tokenIndex)}${hint} – ${sentenceTranslation(task.sentence)}`, right: task.cloze.answer }
    }
    case 'truefalse':
    case 'findmistake': {
      const shown = task.corrupted?.es ?? task.sentence.es
      return { asked: `${shown} – ${sentenceTranslation(task.sentence)}`, right: task.sentence.es }
    }
    default: {
      const { prompt, answer } = taskSummary(task)
      return { asked: prompt, right: answer }
    }
  }
}

/**
 * The question for SOMO about one task. `given` is the learner's wrong answer: empty when they gave up, undefined in
 * Chyby (they do not keep it). `grade` is the lesson's verdict, else a plain wrong one.
 */
export function explainQuestion(task: Task, given?: string, grade?: Grade): string {
  const text = t().assistant.explain
  const { asked: what, right } = asked(task)
  const verdict: Grade = grade ?? { correct: false, verdict: 'wrong', expected: right }
  const tip = tipFor(task, verdict)
  const meanings = verdict.check?.meanings?.map(({ word, gloss }) => `${word} = ${gloss}`).join(', ')
  const lines = [
    given ? text.whyWrong : given === '' ? text.whyRight : text.explainTask,
    `${text.exercise}: ${exerciseInfo(task.kind).label}`,
    `${text.task}: ${clip(what)}`,
    given ? `${text.mine}: ${clip(given, 80)}` : undefined,
    `${text.right}: ${clip(right)}`,
    meanings ? `${text.meanings}: ${clip(meanings, 120)}` : undefined,
    tip ? `${text.tip}: ${tip.tip.id}${tip.because ? ` – ${clip(tip.because, 140)}` : ''}` : undefined,
  ].filter((line): line is string => line !== undefined)
  // The tip's reason goes first when the question would be too long: the task and the answers matter most.
  let question = lines.join('\n')
  if (question.length > MAX_QUESTION_CHARS && tip) question = lines.slice(0, -1).concat(`${text.tip}: ${tip.tip.id}`).join('\n')
  return question.length <= MAX_QUESTION_CHARS ? question : `${question.slice(0, MAX_QUESTION_CHARS - 1)}…`
}
