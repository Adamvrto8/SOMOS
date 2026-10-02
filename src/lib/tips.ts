import { tipById } from '../data'
import type { Cloze, Grammar, Sentence, Tip, TipRule } from '../data/types'
import type { Grade, Task } from './lesson'

// Grammar tips ("Prečo?"): which tip explains a task that was answered wrong.

export interface TaskTip {
  tip: Tip
  rule?: TipRule // ser/estar: the reason that applies in this sentence
  /** The tip is about the very thing that was asked ("Prečo?"), not just the sentence's topic. */
  targeted: boolean
}

// A sentence can carry several tags; the one a learner most needs explained comes first.
const TAG_PRIORITY: Grammar[] = ['ser-estar', 'imperfecto', 'preterito', 'futuro', 'progresivo', 'gender', 'articles', 'presente']

const HINT_TENSES: Record<string, string> = { presente: 'presente', pretérito: 'preterito', imperfecto: 'imperfecto', futuro: 'futuro' }

const targeted = (id: string, rule?: TipRule): TaskTip | undefined => {
  const tip = tipById.get(id)
  return tip && { tip, rule, targeted: true }
}

/** The tip a blank's hint points at: "tener · yo · pretérito", "hacer · gerundio", "člen"… */
function tipForCloze(cloze: Cloze): TaskTip | undefined {
  const hint = cloze.hint ?? ''
  if (hint.startsWith('ser/estar ·')) {
    return targeted(
      'ser-estar',
      tipById.get('ser-estar')?.rules.find((r) => r.id === cloze.why),
    )
  }
  const parts = hint.split(' · ')
  if (parts.length === 3 && HINT_TENSES[parts[2]]) return targeted(HINT_TENSES[parts[2]])
  if (parts.length === 2 && parts[1] === 'gerundio') return targeted('progresivo')
  if (hint === 'člen' || hint === 'neurčitý člen') return targeted('articles')
  if (hint.startsWith('prídavné meno')) return targeted('adjectives')
  return undefined
}

function tipForSentence(sentence: Sentence): TaskTip | undefined {
  const tag = TAG_PRIORITY.find((t) => sentence.grammar?.includes(t))
  const tip = tag && tipById.get(tag)
  return tip ? { tip, targeted: false } : undefined
}

/** The tip to offer after a wrong answer, if there is one worth reading for this task. */
export function tipFor(task: Task, grade: Grade): TaskTip | undefined {
  // An accent that makes a different word (hablo / habló) is the mistake itself, whatever was asked.
  if (grade.check?.meanings) return targeted('accents')
  switch (task.kind) {
    case 'cloze':
    case 'choice':
      return tipForCloze(task.cloze)
    case 'conjugation':
      return targeted(task.tense)
    case 'builder':
    case 'translation':
    case 'dictation':
    case 'speaking':
      return tipForSentence(task.sentence)
    case 'vocab':
      return undefined
  }
}

export const tipLabel = (found: TaskTip) => (found.targeted ? 'Prečo?' : `Gramatika: ${found.tip.title}`)
