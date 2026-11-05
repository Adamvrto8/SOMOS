import { bareVosotros } from './vosotros.ts'
import type { Cloze, Grammar, Person, Sentence, Tip, Verb } from '../data/types.ts'

// The blanks of the usage tips (por/para, si…): a blank names its tip and rule, since no verb hint leads there.
// Pure, so the validator (scripts/validate-data.ts) and the tests share it.

export const USAGE_TIPS: readonly Grammar[] = [
  'gustar',
  'hay-estar',
  'object-pronouns',
  'comparisons',
  'obligation',
  'subjuntivo-wishes',
  'si-clauses',
  'por-para',
  'subjuntivo-clauses',
  'relatives',
  'passive-se',
]

const PERSON_LABELS: Record<string, Person> = {
  yo: 'yo',
  tú: 'tu',
  él: 'el',
  ella: 'el',
  usted: 'el',
  nosotros: 'nosotros',
  ellos: 'ellos',
  ellas: 'ellos',
  ustedes: 'ellos',
}
const PERSONS: Person[] = ['yo', 'tu', 'el', 'nosotros', 'ellos']
const SIMPLE = ['presente', 'preterito', 'imperfecto', 'futuro', 'subjuntivo', 'subjImperfecto', 'condicional'] as const

export type UsageHint = { kind: 'person'; lemma: string; person: Person } | { kind: 'lemma' } | { kind: 'other' }

/** "leer · yo": the sentence picks the tense; "gustar": the sentence picks the person too. */
export function usageHint(cloze: Cloze, verbs: Map<string, Verb>): UsageHint {
  const hint = cloze.hint ?? ''
  const two = /^(\S+) · (\S+)$/.exec(hint)
  if (two && verbs.has(two[1]) && PERSON_LABELS[two[2]]) return { kind: 'person', lemma: two[1], person: PERSON_LABELS[two[2]] }
  if (hint === cloze.lemma && verbs.has(hint)) return { kind: 'lemma' }
  return { kind: 'other' }
}

/** The one-word forms of a verb (a reflexive's pronoun left out), of one person or of all. */
export function formsFor(verb: Verb, person?: Person): string[] {
  const out: string[] = []
  for (const p of person ? [person] : PERSONS) {
    for (const tense of SIMPLE) out.push(verb[tense][p])
    if (p !== 'yo') out.push(verb.imperativo[p])
  }
  // Spain's vosotros is derived, not stored: for "any form of this verb" it counts too (a Mexican blank never has one).
  if (!person) for (const tense of [...SIMPLE, 'imperativo'] as const) out.push(bareVosotros(verb, tense))
  return out.map((form) => form.split(' ').at(-1)!.toLowerCase())
}

// A Slovak hint on a verb ("hay/estar" on está, "musieť" on debes): the hint must not give the verb away.
const slovakOnVerb = (cloze: Cloze, verbs: Map<string, Verb>) =>
  cloze.tip !== undefined && verbs.has(cloze.lemma) && cloze.hint !== cloze.lemma && !(cloze.hint ?? '').includes(' · ')

/** Whether these checks stand in for the verb hint check of the validator (the hint has no person and tense). */
export const checksOwnHint = (cloze: Cloze, verbs: Map<string, Verb>) => usageHint(cloze, verbs).kind !== 'other' || slovakOnVerb(cloze, verbs)

export function usageClozeErrors(sentence: Sentence, cloze: Cloze, tips: Map<string, Tip>, verbs: Map<string, Verb>): string[] {
  const hint = usageHint(cloze, verbs)
  if (!cloze.tip) return hint.kind === 'person' ? ['a hint without tense needs `tip`'] : []
  const errors: string[] = []
  if (!USAGE_TIPS.includes(cloze.tip)) errors.push(`tip "${cloze.tip}" is not a usage tip`)
  if (!sentence.grammar?.includes(cloze.tip)) errors.push(`the sentence is not tagged "${cloze.tip}"`)
  if (!cloze.why) errors.push('a blank with `tip` needs `why`')
  else if (!tips.get(cloze.tip)?.rules.some((r) => r.id === cloze.why)) errors.push(`why "${cloze.why}" is not a rule of the tip "${cloze.tip}"`)
  const answer = cloze.answer.toLowerCase()
  if (hint.kind === 'person') {
    if (hint.lemma !== cloze.lemma) errors.push(`lemma "${cloze.lemma}" is not the hint's "${hint.lemma}"`)
    else if (!formsFor(verbs.get(hint.lemma)!, hint.person).includes(answer)) {
      errors.push(`"${cloze.answer}" is not a form of ${hint.lemma} for ${cloze.hint!.split(' · ')[1]}`)
    }
  }
  if ((hint.kind === 'lemma' || slovakOnVerb(cloze, verbs)) && !formsFor(verbs.get(cloze.lemma)!).includes(answer)) errors.push(`"${cloze.answer}" is not a form of ${cloze.lemma}`)
  return errors
}
