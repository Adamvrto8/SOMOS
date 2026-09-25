import { PERSON_LABELS, TENSE_LABELS } from '../../lib/conjugate'
import type { Task } from '../../lib/lesson'

/** What was asked and the right answer, for mistake lists. */
export function taskSummary(task: Task): { prompt: string; answer: string } {
  switch (task.kind) {
    case 'conjugation':
      return { prompt: `${task.verb.id} · ${PERSON_LABELS[task.person]} · ${TENSE_LABELS[task.tense]}`, answer: task.answer }
    default:
      return { prompt: task.sentence.sk, answer: task.sentence.es }
  }
}
