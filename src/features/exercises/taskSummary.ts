import { PERSON_LABELS, TENSE_LABELS } from '../../lib/conjugate'
import { sentenceTranslation, wordTranslations } from '../../lib/localized'
import type { Task } from '../../lib/lesson'

/** What was asked and the right answer, for mistake lists. */
export function taskSummary(task: Task): { prompt: string; answer: string } {
  switch (task.kind) {
    case 'conjugation':
      return { prompt: `${task.verb.id} · ${PERSON_LABELS[task.person]} · ${TENSE_LABELS[task.tense]}`, answer: task.answer }
    case 'vocab': {
      const expectedAnswer =
        task.direction === 'es-sk'
          ? wordTranslations(task.word).join(', ')
          : task.word.gender
            ? `${task.word.gender === 'm' ? 'el' : 'la'} ${task.word.es}`
            : task.word.es
      return { prompt: task.prompt, answer: expectedAnswer }
    }
    default:
      return { prompt: sentenceTranslation(task.sentence), answer: task.sentence.es }
  }
}
